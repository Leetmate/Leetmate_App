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
    loadXPFromFirestore(db, currentUid).then(updateXPSectionUI)      
  });

  btn.addEventListener("click", () => {
    const prevLevel = getLocalLevel();

    addXP(30);
    updateXPSectionUI();

    if (prevLevel !== getLocalLevel()) {
      animateLevelUp();
    }
    
    saveXPToFirestore(db, currentUid);
  })
})