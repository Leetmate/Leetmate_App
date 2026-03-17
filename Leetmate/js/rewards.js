// rewards.js
// State-driven LeetCode reward logic.
// Banner states:
// 1) reminder   -> no solve yet
// 2) claim      -> solved and has unclaimed rewards
// 3) motivation -> solved, but today's rewards already claimed

const COINS_PER_SUBMISSION = 5;
const XP_PER_SUBMISSION = 5;
const COINS_FIRST_SUBMISSION = 10;
const XP_FIRST_SUBMISSION = 10;

let rewardsState = {
  solved: false,
  claimableCount: 0,
  claimableCoins: 0,
  claimableXp: 0,
  claimableIds: [],
};

let _claimInFlight = false;

// ------------------------------
// Reward state
// ------------------------------

async function getRewardsState(db, uid) {
  const { submissions, claimedIds } = await loadLeetCodeProgressDoc(db, uid);

  const allSubmissions = submissions || [];
  const claimedSet = new Set(claimedIds || []);
  const claimable = allSubmissions
    .filter((submission) => !claimedSet.has(submission.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  let claimableCoins = 0;
  let claimableXp = 0;

  for (const submission of claimable) {
    if (submission.order === 1) {
      claimableCoins += COINS_FIRST_SUBMISSION;
      claimableXp += XP_FIRST_SUBMISSION;
    } else {
      claimableCoins += COINS_PER_SUBMISSION;
      claimableXp += XP_PER_SUBMISSION;
    }
  }

  const includesFirstSubmission = claimable.some(
    (submission) => submission.order === 1
  );

  const solved =
    allSubmissions.length > 0 || (claimedIds && claimedIds.length > 0);

  return {
    solved,
    claimableCount: claimable.length,
    claimableCoins,
    claimableXp,
    claimableIds: claimable.map((submission) => submission.id),
    includesFirstSubmission,
  };
}


// ------------------------------
// Reward animations
// ------------------------------

function playRewardAnimation(coinAmount) {
  const rewardIcon = document.querySelector(".icon-reward img");
  const rewardContainer = document.querySelector(".icon-reward");

  rewardIcon?.classList.add("reward-claim-animate");
  rewardContainer?.classList.add("coin-burst");

  flyCoinToCounter(0);
  flyCoinToCounter(120);
  flyCoinToCounter(240);

  setTimeout(() => {
    animateCoinCounter(coinAmount);
    showCoinReward(coinAmount);
  }, 700);

  setTimeout(() => {
    rewardIcon?.classList.remove("reward-claim-animate");
    rewardContainer?.classList.remove("coin-burst");
  }, 1100);
}

// ------------------------------
// Claim rewards
// ------------------------------

async function claimRewards(db, uid) {
  if (_claimInFlight) return rewardsState;

  _claimInFlight = true;

  try {
    const state = await getRewardsState(db, uid);

    if (state.claimableCount === 0) {
      rewardsState = state;
      return state;
    }

    const prevLevel = await getLocalLevel();

    await addCoins(state.claimableCoins);
    await addXP(state.claimableXp);

    await markSubmissionsClaimed(db, uid, state.claimableIds);

    await saveCoinsToFirestore(db, uid);
    await saveXPToFirestore(db, uid);

    // UI first
    await updateCoinsUI();
    await updateXPSectionUI();

    // animation after
    playRewardAnimation(state.claimableCoins);

    if ((await getLocalLevel()) !== prevLevel) {
      animateLevelUp();
    }

    const newState = await getRewardsState(db, uid);
    rewardsState = newState;
    return newState;

  } finally {
    _claimInFlight = false;
  }
}

// ------------------------------
// Banner rendering
// ------------------------------

function renderReminderState(card) {
  card.classList.remove("completed", "motivation");
  card.onclick = null;
}

function renderClaimState(card, state) {
  const rewardStrong = document.querySelector(".view-reward strong");
  const rewardSpan = document.querySelector(".view-reward span");

  card.classList.remove("motivation");
  card.classList.add("completed");

  if (rewardStrong) {
    rewardStrong.textContent = `Solved ${state.claimableCount} problem(s) today ✓`;
  }

  if (rewardSpan) {
    rewardSpan.textContent = `Claim +${state.claimableCoins} coins and +${state.claimableXp} XP`;
  }
}

function renderMotivationState(card) {
  const motivationStrong = document.querySelector(".view-motivation strong");
  const motivationSpan = document.querySelector(".view-motivation span");

  card.classList.remove("completed");
  card.classList.add("motivation");

  if (motivationStrong) {
    motivationStrong.textContent = "Congrats, rewards claimed ✓";
  }

  if (motivationSpan) {
    motivationSpan.textContent = "Solve another LeetCode problem for more rewards.";
  }

  card.onclick = null;
}

function setupLeetCodeCard(db, uid, state) {
  const leetcodeCard = document.getElementById("leetcodeCard");
  const altTitle = document.querySelector(".leetcode-alt-title");
  const altSubtext = document.querySelector(".leetcode-alt-subtext");
  const altRewardXp = document.querySelector(".leetcode-alt-reward.xp");
  const altRewardCoins = document.querySelector(".leetcode-alt-reward.coins");
  const claimBtn = document.getElementById("leetcodeClaimBtn");

  if (!leetcodeCard) return;

  // State 1: default "Today's Quest" banner (nothing solved today)
  if (!state.solved) {
    leetcodeCard.classList.remove("completed");
    leetcodeCard.classList.remove("no-claim");
    if (claimBtn) {
      claimBtn.style.display = "none";
      claimBtn.onclick = null;
    }
    return;
  }

  // From here on, user has solved at least one problem today
  leetcodeCard.classList.add("completed");

  const hasClaimable = state.claimableCount > 0;

  // State 2 & 4: solved + has claimable rewards
  if (hasClaimable) {
    leetcodeCard.classList.remove("no-claim");

    if (altRewardXp) {
      altRewardXp.textContent = `+${state.claimableXp} XP`;
    }
    if (altRewardCoins) {
      altRewardCoins.textContent = `+${state.claimableCoins} Coins`;
    }

    // State 2: first daily problem completed
    if (state.includesFirstSubmission) {
      if (altTitle) altTitle.textContent = "Daily Quest Complete!";
      if (altSubtext) {
        altSubtext.innerHTML = "You solved today's<br />LeetCode problem!";
      }
    } else {
      // State 4: additional problem completed (smaller bonus)
      if (altTitle) altTitle.textContent = "You're on a roll!";
      if (altSubtext) altSubtext.textContent = "Another problem completed.";
    }

    if (claimBtn) {
      claimBtn.textContent = "Claim Reward";
      claimBtn.style.display = "inline-block";
      claimBtn.onclick = async (e) => {
        e.stopPropagation();
        if (_claimInFlight) return;

        // Disable the button so a single click
        // always leads to a visible state change.
        claimBtn.disabled = true;

        const newState = await claimRewards(db, uid);
        rewardsState = newState;
        setupLeetCodeCard(db, uid, newState);
      };
    }

    return;
  }

  // State 3: post-claim encouragement (solved but nothing left to claim)
  leetcodeCard.classList.add("no-claim");
  if (claimBtn) {
    claimBtn.style.display = "none";
    claimBtn.onclick = null;
  }
}

// ------------------------------
// Refresh helper
// ------------------------------

async function refreshRewardsCard(db, uid) {
  const state = await getRewardsState(db, uid);
  rewardsState = state;
  setupLeetCodeCard(db, uid, state);
  return state;
}