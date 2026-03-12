// Firebase XP syncing and UI updates 
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
    loadXPFromFirestore(db, currentUid).then(updateXPSectionUI);
    if (typeof loadStreakData === 'function') {
      loadStreakData(db, currentUid).then(updateStreakUI);
    }
  });

  btn.addEventListener("click", () => {
    const prevLevel = getLevel();

    addXP(30);
    updateXPSectionUI();

    if (prevLevel !== getLevel()) {
      animateLevelUp();
    }
    
    saveXPToFirestore(db, currentUid);
  })
})
// LeetCode Daily Card
// TEMP: Toggles completed state visually
// TODO: Replace with real completion check and reward-claim logic
// (Should only toggle after verifying user solved daily problem)

document.addEventListener("DOMContentLoaded", () => {
    const leetcodeCard = document.getElementById("leetcodeCard");
  
    if (!leetcodeCard) return;
  
    leetcodeCard.addEventListener("click", () => {
      leetcodeCard.classList.toggle("completed");
    });
  });
