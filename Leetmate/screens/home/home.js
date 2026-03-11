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
    loadStreakData(db, currentUid).then(updateStreakUI);
    loadCoinsFromFirestore(db, currentUid).then(updateCoinsUI);
    syncPendingSubmissionsToFirestore(db, currentUid)
      .then(() => getRewardsState(db, currentUid))
      .then((state) => {
        rewardsState = state;
        loadLeetCodeProgressToday(db, currentUid);
        setupLeetCodeCard(db, currentUid, state);
      });
  });

  btn.addEventListener("click", () => {
    const prevLevel = getLocalLevel();

    addXP(30);
    updateXPSectionUI();

    if (prevLevel !== getLocalLevel()) {
      animateLevelUp();
    }

    saveXPToFirestore(db, currentUid);
  });
});