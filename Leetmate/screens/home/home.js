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

  updateXPSectionUI();

  const db = firebase.firestore();
  const auth = firebase.auth();
  let currentUid = null;

  auth.onAuthStateChanged((user) => {
    if (!user) return;
    currentUid = user.uid;
    window.__leetmateAuth = { db, uid: currentUid };
    loadLeetCodeUsernameFromFirestore(db, currentUid);
    loadXPFromFirestore(db, currentUid).then(updateXPSectionUI);
    loadStreakData(db, currentUid).then(async (streakData) => {
      if (!streakData) return;

      // Check if user has solved today
      const solvedToday = await hasSolvedToday(db, currentUid);

      // If no solve today, just show current streak
      if (!solvedToday) {
        updateStreakUI(streakData);
        return;
      }

      // If already updated for today, just show it
      if (isStreakUpdatedToday(streakData)) {
        updateStreakUI(streakData);
        return;
      }

      // First time opening home after solving today → increment once
      const updated = incrementStreak(streakData);
      updated.streakLastUpdated = getTodayString();
      await saveStreakData(db, currentUid, updated);
      updateStreakUI(updated);
    });
    loadCoinsFromFirestore(db, currentUid).then(updateCoinsUI);
    syncPendingSubmissionsToFirestore(db, currentUid)
      .then(() => getRewardsState(db, currentUid))
      .then(async (state) => {
        rewardsState = state;
        loadLeetCodeProgressToday(db, currentUid);
        setupLeetCodeCard(db, currentUid, state);
      });
  });

  btn.addEventListener("click", () => {
    const prevLevel = getLevel();

    addXP(30);
    updateXPSectionUI();

    if (prevLevel !== getLevel()) {
      animateLevelUp();
    }


    saveXPToFirestore(db, currentUid);
  });
});
