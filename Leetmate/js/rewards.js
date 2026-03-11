/**
 * Rewards logic – claimable coins/XP from LeetCode submissions.
 * Users can only claim rewards for submissions that haven't been claimed yet.
 */

const COINS_PER_SUBMISSION = 5;
const XP_PER_SUBMISSION = 5;
const COINS_FIRST_SUBMISSION = 10;
const XP_FIRST_SUBMISSION = 10;

/**
 * Get rewards state for today: solved, claimable count, coins, XP.
 */
function getRewardsState(db, uid) {
  return loadLeetCodeProgressDoc(db, uid).then(({ submissions, claimedIds }) => {
    const claimedSet = new Set(claimedIds);
    const claimable = submissions
      .filter((s) => !claimedSet.has(s.id))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const claimableCount = claimable.length;
    const solved = submissions.length > 0;

    let claimableCoins = 0;
    let claimableXp = 0;
    claimable.forEach((s, i) => {
      if (i === 0) {
        claimableCoins += COINS_FIRST_SUBMISSION;
        claimableXp += XP_FIRST_SUBMISSION;
      } else {
        claimableCoins += COINS_PER_SUBMISSION;
        claimableXp += XP_PER_SUBMISSION;
      }
    });

    return {
      solved,
      claimableCount,
      claimableCoins,
      claimableXp,
      claimableIds: claimable.map((s) => s.id),
    };
  });
}

/**
 * Claim rewards for new submissions today.
 * Adds coins/XP, marks submissions as claimed, returns updated state.
 */
function claimRewards(db, uid) {
  return getRewardsState(db, uid).then((state) => {
    const { claimableIds, claimableCoins, claimableXp } = state;
    if (claimableIds.length === 0) {
      return state;
    }

    addCoins(claimableCoins);
    addXP(claimableXp);

    return markSubmissionsClaimed(db, uid, claimableIds)
      .then(() => saveCoinsToFirestore(db, uid))
      .then(() => saveXPToFirestore(db, uid))
      .then(() => getRewardsState(db, uid));
  });
}

// LeetCode Daily Card – 3 states: reminder, claim, completed
function setupLeetCodeCard(db, uid, state) {
    const leetcodeCard = document.getElementById("leetcodeCard");
    const altText = document.querySelector(".leetcode-alt-text");
    const altStrong = document.querySelector(".leetcode-alt-strong");
    const claimBtn = document.getElementById("leetcodeClaimBtn");
  
    if (!leetcodeCard) return;
  
    if (!state.solved) {
      leetcodeCard.classList.remove("completed");
      if (claimBtn) claimBtn.style.display = "none";
      return;
    }
  
    leetcodeCard.classList.add("completed");
  
    const hasClaimable = state.claimableCount > 0;
  
    if (hasClaimable) {
      if (altText) altText.textContent = "You solved " + state.claimableCount + " problem(s) today.";
      if (altStrong) altStrong.textContent = "";
      if (claimBtn) {
        claimBtn.textContent = "Claim (+" + state.claimableCoins + " coins, +" + state.claimableXp + " XP)";
        claimBtn.style.display = "inline-block";
        claimBtn.onclick = (e) => {
          e.stopPropagation();
          const prevLevel = getLocalLevel();
          claimRewards(db, uid).then((newState) => {
            rewardsState = newState;
            updateCoinsUI();
            updateXPSectionUI();
            if (getLocalLevel() !== prevLevel) animateLevelUp();
            setupLeetCodeCard(db, uid, newState);
          });
        };
      }
    } else {
      if (altText) altText.textContent = " Congrats, Leetcode Daily done ✓";
      if (altStrong) altStrong.textContent = "Keep Grinding for extra rewards!";
      if (claimBtn) claimBtn.style.display = "none";
    }
  }