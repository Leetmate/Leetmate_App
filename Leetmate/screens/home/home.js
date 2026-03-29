// home.js
// Firebase XP syncing and UI updates

function hasFirebase() {
  return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
}

function setHomeLoading(isLoading, text) {
  const overlay = document.getElementById("loading-overlay");
  const label = document.getElementById("loading-text");
  if (!overlay) return;

  if (label && text) {
    label.textContent = text;
  }

  overlay.classList.toggle("hidden", !isLoading);
  document.body.classList.toggle("hidden-on-load", isLoading);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!hasFirebase()) {
    console.warn("Firebase not available on this page.");
    setHomeLoading(false);
    return;
  }

  setHomeLoading(true, "Loading home...");
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

    try {
      currentUid = user.uid;

      await storageSet({ uid: currentUid });
      window.__leetmateAuth = { db, uid: currentUid };

      // Load static UI state
      loadLeetCodeUsernameFromFirestore(db, currentUid);

  		// default card to load
  		setupLeetCodeCard(db, currentUid, {
  			solved: false,
  			claimableCount: 0,
  			claimableCoins: 0,
  			claimableXp: 0,
  			claimableIds: [],
  			includesFirstSumbission: false,
  		});

  		const initalRewardsPromise = refreshRewardsCard(db, currentUid);
  		const syncedRewardsPromise = syncPendingSubmissionsToFirestore(db, currentUid)
  			.then(() => refreshRewardsCard(db, currentUid));
  		
  		// just changed to load all these in parallel
  		await Promise.all([
  			loadXPFromFirestore(db, currentUid),
  			loadCoinsFromFirestore(db, currentUid),
  			loadHappinessFromFirestore(db, currentUid),
  		]);

  		await Promise.all([
  			updateXPSectionUI(),
  			updateCoinsUI(),
  			// i think load happiness already calls update hearts ui
  		]);

      startHappinessDecayTimer();

  		await initalRewardsPromise;
      // Sync submissions before rewards/streak evaluation

      const latestProgressDate = await loadLatestProgressDate(db, currentUid);
      const today = getTodayString();
      const solvedToday = latestProgressDate === today;

      if (solvedToday) {
        await storageSet({ leetmate_last_progress_date: today });
      }
  		
  		await Promise.all([
  			syncedRewardsPromise,
  			updateStreakOnLoad(db, currentUid, solvedToday)
  		]);
  		
  		// Load active pet
      if (typeof loadActivePetFromFirestore === "function") {
        await loadActivePetFromFirestore(db, currentUid);
      }
    } catch (error) {
      console.error("Home failed to finish loading:", error);
    } finally {
      setHomeLoading(false);
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
document.querySelector(".minimize-btn").addEventListener("click", async () => {
  const { activePetStage, leetmate_happiness } = await storageGet(["activePetStage", "leetmate_happiness"]);
  const normalizedStage = (activePetStage || "").toLowerCase();
  if (!["baby", "adult"].includes(normalizedStage) || (leetmate_happiness ?? 100) <= 0) {
    return;
  }
  chrome.runtime.sendMessage({ type: "openPip" });
  window.close();
});
