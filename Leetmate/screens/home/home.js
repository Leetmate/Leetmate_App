// Firebase XP syncing and UI updates
let rewardsState = { solved: false, claimableCount: 0, claimableCoins: 0, claimableXp: 0 };

function hasFirebase() {
  return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!hasFirebase()) {
    console.warn("Firebase not available on this page.");
    return;
  }

  const btn = document.querySelector(".xp-test-button");
  if (!btn) {
    console.warn("Unable to find xp-test-button.");
    return;
  }

  // Show cached UI immediately from chrome storage while Firestore loads
  updateXPSectionUI();
  updateCoinsUI();

  const db = firebase.firestore();
  const auth = firebase.auth();
  let currentUid = null;

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    currentUid = user.uid;

    // Save uid to chrome storage so background.js can access it
    await storageSet({ uid: currentUid });
    window.__leetmateAuth = { db, uid: currentUid };

    // ── Step 1: Load static user data (independent, run in parallel) ──────
    loadLeetCodeUsernameFromFirestore(db, currentUid);
    loadXPFromFirestore(db, currentUid).then(updateXPSectionUI);
    loadCoinsFromFirestore(db, currentUid).then(updateCoinsUI);
    loadHappinessFromFirestore(db, currentUid).then(updateHeartsUI);
    setupFeedButton(db, currentUid);
    updateHeartsUI();
    startHappinessDecayTimer();

    // ── Step 2: Sync pending submissions FIRST before checking progress ────
    // This must complete before streak or rewards checks,
    // otherwise hasSolvedToday() may return false for fresh solves.
    await syncPendingSubmissionsToFirestore(db, currentUid);

    // ── Step 3: Load latest progress date from Firestore ──────────────────
    const latestProgressDate = await loadLatestProgressDate(db, currentUid);
    const today = getTodayString();
    const solvedToday = latestProgressDate === today;

    //  Save last progress date to chrome storage for background.js
    if (solvedToday) {
      await storageSet({ leetmate_last_progress_date: getTodayString() });
    }

    // ── Step 4: Update streak based on accurate solved status ─────────────
    await updateStreakOnLoad(db, currentUid, solvedToday);

    // ── Step 5: Load rewards state and set up LeetCode card ───────────────
    const state = await getRewardsState(db, currentUid);
    rewardsState = state;
    setupLeetCodeCard(db, currentUid, state);
  });

  // ── XP test button ───────────────────────────────────────────────────────
  btn.addEventListener("click", async () => {
    const prevLevel = await getLocalLevel();

    await addXP(30);
    updateXPSectionUI();

    if ((await getLocalLevel()) !== prevLevel) {
      animateLevelUp();
    }

    saveXPToFirestore(db, currentUid);
  });
});

/**
 * Handle streak update on home load.
 * Only increments once per day, after submissions are confirmed synced.
 */
async function updateStreakOnLoad(db, uid, solvedToday) {
  const streakData = await loadStreakData(db, uid);
  if (!streakData) return;
  const today = getTodayString();

  // If the background daily check already ran, it would have written the new
  // streak values to chrome storage with leetmate_last_streak_date === today.
  // In that case, sync storage -> Firestore so the UI matches.
  const {
    leetmate_streak,
    leetmate_last_streak_date,
    leetmate_streak_freeze_end,
  } = await storageGet([
    "leetmate_streak",
    "leetmate_last_streak_date",
    "leetmate_streak_freeze_end",
  ]);

  const storageUpdatedToday = leetmate_last_streak_date === today;
  if (storageUpdatedToday) {
    const fromStorage = {
      streak: leetmate_streak ?? 0,
      streakLastUpdated: leetmate_last_streak_date ?? null,
      streakFreezeEnd: leetmate_streak_freeze_end ?? null,
    };

    if (
      fromStorage.streak !== streakData.streak ||
      fromStorage.streakLastUpdated !== streakData.streakLastUpdated ||
      fromStorage.streakFreezeEnd !== streakData.streakFreezeEnd
    ) {
      await saveStreakData(db, uid, fromStorage);
    }

    updateStreakUI(fromStorage);
    return;
  }

  // Already updated today — just show current streak
  if (isStreakUpdatedToday(streakData)) {
    updateStreakUI(streakData);
    return;
  }

  // Not solved today — show streak as-is. Background will handle reset at 11:59pm.
  if (!solvedToday) {
    updateStreakUI(streakData);
    return;
  }

  // Solved today and not yet updated → increment once
  const updated = incrementStreak(streakData);
  updated.streakLastUpdated = today;
  await saveStreakData(db, uid, updated);
  updateStreakUI(updated);
}