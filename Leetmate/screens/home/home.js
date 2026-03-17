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

  const xpBtn = document.querySelector(".xp-test-button");
  if (!xpBtn) {
    console.warn("Unable to find xp-test-button.");
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

    setupFeedButton(db, currentUid);
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
  });

  // Refresh reward card whenever user returns to the extension
  window.addEventListener("focus", async () => {
    await refreshAfterProgressSync();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    await refreshAfterProgressSync();
  });

  xpBtn.addEventListener("click", async () => {
    const prevLevel = await getLocalLevel();

    await addXP(30);
    await updateXPSectionUI();

    if ((await getLocalLevel()) !== prevLevel) {
      animateLevelUp();
    }

    if (currentUid) {
      await saveXPToFirestore(db, currentUid);
    }
  });
});

/**
 * Handle streak update on home load.
 * Only increments once per day, after submissions are confirmed synced.
 */
async function updateStreakOnLoad(db, uid, solvedToday) {
  const streakData = await loadStreakData(db, uid);
  if (!streakData) return;

  if (isStreakUpdatedToday(streakData)) {
    updateStreakUI(streakData);
    return;
  }

  if (!solvedToday) {
    updateStreakUI(streakData);
    return;
  }

  const updated = incrementStreak(streakData);
  updated.streakLastUpdated = getTodayString();
  await saveStreakData(db, uid, updated);
  updateStreakUI(updated);
}

/* Minimize window */
document.querySelector(".minimize-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "openPip" });
  window.close();
});