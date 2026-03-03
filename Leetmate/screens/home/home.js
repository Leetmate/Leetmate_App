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