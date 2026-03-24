// home.js
// Firebase XP syncing and UI updates

function hasFirebase() {
  return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!hasFirebase()) {
    console.warn("Firebase not available on this page.");
    return;
  }

  updateXPSectionUI();
  updateCoinsUI();

  const db = firebase.firestore();
  const auth = firebase.auth();
  let currentUid = null;

  async function refreshAfterProgressSync() {
    if (!currentUid) return;

    await syncPendingSubmissionsToFirestore(db, currentUid);
    await refreshRewardsCard(db, currentUid);
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    currentUid = user.uid;

    await storageSet({ uid: currentUid });
    window.__leetmateAuth = { db, uid: currentUid };

    // Load static UI state
    loadLeetCodeUsernameFromFirestore(db, currentUid);
    await loadXPFromFirestore(db, currentUid);
    await updateXPSectionUI();

    await loadCoinsFromFirestore(db, currentUid);
    await updateCoinsUI();

    await loadHappinessFromFirestore(db, currentUid);
    await updateHeartsUI();

    startHappinessDecayTimer();

    // Sync submissions before rewards/streak evaluation
    await syncPendingSubmissionsToFirestore(db, currentUid);

    const latestProgressDate = await loadLatestProgressDate(db, currentUid);
    const today = getTodayString();
    const solvedToday = latestProgressDate === today;

    if (solvedToday) {
      await storageSet({ leetmate_last_progress_date: today });
    }

    await updateStreakOnLoad(db, currentUid, solvedToday);

    // State-driven reward banner
    await refreshRewardsCard(db, currentUid);

    // Load active pet
    if (typeof loadActivePetFromFirestore === 'function') {
      await loadActivePetFromFirestore(db, currentUid);
    }
  });

  // Refresh reward card whenever user returns to the extension
  window.addEventListener("focus", async () => {
    await refreshAfterProgressSync();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    await refreshAfterProgressSync();
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

  const updated = incrementStreak(streakData);
  updated.streakLastUpdated = today;
  await saveStreakData(db, uid, updated);
  updateStreakUI(updated);
}

/* Minimize window */
document.querySelector(".minimize-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "openPip" });
  window.close();
});
