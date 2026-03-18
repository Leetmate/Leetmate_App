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

  const claimedSet = new Set(claimedIds || []);
  const claimable = (submissions || [])
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

  return {
    solved: (submissions || []).length > 0,
    claimableCount: claimable.length,
    claimableCoins,
    claimableXp,
    claimableIds: claimable.map((submission) => submission.id),
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
  const card = document.getElementById("leetcodeCard");
  if (!card) return;

  // State 1: no solve yet
  if (!state.solved) {
    renderReminderState(card);
    return;
  }

  // State 2: solved + has claimable rewards
  if (state.claimableCount > 0) {
    renderClaimState(card, state);

    card.onclick = async () => {
      if (_claimInFlight) return;

      card.onclick = null;

      const newState = await claimRewards(db, uid);
      rewardsState = newState;
      setupLeetCodeCard(db, uid, newState);
    };

    return;
  }

  // State 3: solved but nothing left to claim
  renderMotivationState(card);
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