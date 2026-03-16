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
    const rewardIcon = document.querySelector(".icon-reward img");
    const rewardContainer = document.querySelector(".icon-reward");
    if (!leetcodeCard) return;

    // default state 
    let state = "leetcode";

    // states: leetcode -> completed -> motivation
    leetcodeCard.addEventListener("click", () => {
      if (state === "leetcode") {
        // TODO: Add AND condition for user solving daily challenge
        // Change state to completed upon leetcode completion 
        leetcodeCard.classList.add("completed");
        state = "completed";
        return;
      }
  
      if (state === "completed") {
        // Play reward animation
        rewardIcon.classList.add("reward-claim-animate");        
        rewardContainer.classList.add("coin-burst");

        // Launch flying coins
        flyCoinToCounter(0);
        flyCoinToCounter(120);
        flyCoinToCounter(240);

        // Update coins from reward amount
        setTimeout(() => {
          animateCoinCounter(25);
          showCoinReward(25);
        }, 700);

        // Wait for animation to finish before switching card
        setTimeout(() => {
          leetcodeCard.classList.remove("completed");
          leetcodeCard.classList.add("motivation");
          rewardIcon.classList.remove("reward-claim-animate");
          rewardContainer.classList.remove("coin-burst");
        }, 1100);

        // Switch from claim reward to motivation card 
        state = "motivation";
        return;
      }
    });
  });
