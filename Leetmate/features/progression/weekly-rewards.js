// weekly-rewards.js
// Weekly streak reward logic for Activity calendar.

const WEEKLY_STREAK_DAYS = 7;
const WEEKLY_STREAK_COIN_REWARD = 100;
const WEEKLY_STREAK_XP_REWARD = 30;

let _weeklyClaimInFlight = false;
let _weeklyBannerTimer = null;

function getWeeklyRewardAmounts() {
  return {
    coinReward: WEEKLY_STREAK_COIN_REWARD,
    xpReward: WEEKLY_STREAK_XP_REWARD,
  };
}

function formatWeeklyRewardBannerMessage(coinReward, xpReward) {
  const safeCoinReward = Number.isFinite(coinReward)
    ? Math.max(0, Math.floor(coinReward))
    : WEEKLY_STREAK_COIN_REWARD;
  const safeXpReward = Number.isFinite(xpReward)
    ? Math.max(0, Math.floor(xpReward))
    : WEEKLY_STREAK_XP_REWARD;

  return `Weekly reward claimed: +${safeCoinReward} coins, +${safeXpReward} XP`;
}

function showWeeklyRewardBanner(message) {
  const bannerMessage =
    message ||
    formatWeeklyRewardBannerMessage(
      WEEKLY_STREAK_COIN_REWARD,
      WEEKLY_STREAK_XP_REWARD
    );

  let bannerEl = document.getElementById("weeklyRewardBanner");

  if (!bannerEl) {
    bannerEl = document.createElement("div");
    bannerEl.id = "weeklyRewardBanner";
    bannerEl.className = "weekly-reward-banner";
    bannerEl.setAttribute("role", "status");
    bannerEl.setAttribute("aria-live", "polite");
    document.body.appendChild(bannerEl);
  }

  bannerEl.textContent = bannerMessage;
  bannerEl.classList.add("is-visible");

  if (_weeklyBannerTimer) {
    clearTimeout(_weeklyBannerTimer);
  }

  _weeklyBannerTimer = setTimeout(() => {
    bannerEl.classList.remove("is-visible");
    _weeklyBannerTimer = null;
  }, 2200);
}

function sortDateKeys(dateKeys) {
  return [...dateKeys]
    .filter((dateKey) => typeof dateKey === "string")
    .sort((a, b) => a.localeCompare(b));
}

function parseDateKeyToDate(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return null;
  const parts = dateKey.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toDateKey(date) {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

function addDay(dateKey, dayDelta) {
  const parsed = parseDateKeyToDate(dateKey);
  if (!parsed) return null;
  const shifted = new Date(parsed);
  shifted.setDate(shifted.getDate() + dayDelta);
  return toDateKey(shifted);
}

function hasSevenDayStreakEndingOn(dateKey, progressDateSet) {
  if (!dateKey || !(progressDateSet instanceof Set) || progressDateSet.size === 0) {
    return false;
  }
  if (!progressDateSet.has(dateKey)) return false;

  for (let offset = 1; offset < WEEKLY_STREAK_DAYS; offset += 1) {
    const previousDayKey = addDay(dateKey, -offset);
    if (!previousDayKey || !progressDateSet.has(previousDayKey)) {
      return false;
    }
  }

  return true;
}

function buildWeeklyRewardMilestones(progressDateSet) {
  if (!progressDateSet || !(progressDateSet instanceof Set) || progressDateSet.size === 0) {
    return new Set();
  }

  const sortedProgressKeys = sortDateKeys(progressDateSet);
  const milestoneSet = new Set();

  for (const dateKey of sortedProgressKeys) {
    if (hasSevenDayStreakEndingOn(dateKey, progressDateSet)) {
      milestoneSet.add(dateKey);
    }
  }

  return milestoneSet;
}

function getCurrentStreakLength(progressDateSet) {
  if (!progressDateSet || !(progressDateSet instanceof Set) || progressDateSet.size === 0) {
    return 0;
  }

  const sortedProgressKeys = sortDateKeys(progressDateSet);
  const latestDateKey = sortedProgressKeys[sortedProgressKeys.length - 1];
  if (!latestDateKey) return 0;

  let streakLength = 0;
  let cursorKey = latestDateKey;
  while (cursorKey && progressDateSet.has(cursorKey)) {
    streakLength += 1;
    cursorKey = addDay(cursorKey, -1);
  }

  return streakLength;
}

function buildWeeklyRewardPreviewDateSet(progressDateSet) {
  const streakLength = getCurrentStreakLength(progressDateSet);
  if (streakLength <= 0) return new Set();

  const sortedProgressKeys = sortDateKeys(progressDateSet);
  const latestDateKey = sortedProgressKeys[sortedProgressKeys.length - 1];
  if (!latestDateKey) return new Set();

  const progressIntoCycle = streakLength % WEEKLY_STREAK_DAYS;
  const daysUntilNextReward =
    progressIntoCycle === 0
      ? WEEKLY_STREAK_DAYS
      : WEEKLY_STREAK_DAYS - progressIntoCycle;

  const previewDateSet = new Set();
  const previewDateKey = addDay(latestDateKey, daysUntilNextReward);
  if (previewDateKey) previewDateSet.add(previewDateKey);

  return previewDateSet;
}

async function loadWeeklyClaimedDateSet(db, uid) {
  if (!db || !uid) return new Set();

  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return new Set();

    const data = userSnap.data() || {};
    const claimed = Array.isArray(data.weeklyRewardClaimedDateKeys)
      ? data.weeklyRewardClaimedDateKeys
      : [];
    return new Set(claimed.filter((dateKey) => typeof dateKey === "string"));
  } catch (error) {
    console.warn("Weekly rewards: failed to load claimed dates.", error);
    return new Set();
  }
}

async function getWeeklyRewardsState(db, uid, progressDateSet) {
  const milestones = buildWeeklyRewardMilestones(progressDateSet);
  const claimedDateSet = await loadWeeklyClaimedDateSet(db, uid);
  const previewDateSet = buildWeeklyRewardPreviewDateSet(progressDateSet);

  const claimableDateSet = new Set(
    [...milestones].filter((dateKey) => !claimedDateSet.has(dateKey))
  );

  return {
    milestones,
    claimedDateSet,
    claimableDateSet,
    previewDateSet,
    claimableCount: claimableDateSet.size,
  };
}

async function claimWeeklyReward(db, uid, dateKey, state) {
  if (_weeklyClaimInFlight) return state;
  if (!state || !(state.claimableDateSet instanceof Set)) return state;
  if (!state.claimableDateSet.has(dateKey)) return state;

  _weeklyClaimInFlight = true;

  try {
    const previousLevel =
      typeof getLocalLevel === "function" ? await getLocalLevel() : null;

    if (typeof addCoins === "function") {
      await addCoins(WEEKLY_STREAK_COIN_REWARD);
    }

    if (typeof addXP === "function") {
      await addXP(WEEKLY_STREAK_XP_REWARD);
    }

    if (db && uid) {
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            weeklyRewardClaimedDateKeys: firebase.firestore.FieldValue.arrayUnion(dateKey),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    if (typeof saveCoinsToFirestore === "function") {
      await saveCoinsToFirestore(db, uid);
    }
    if (typeof saveXPToFirestore === "function") {
      await saveXPToFirestore(db, uid);
    }

    if (typeof updateCoinsUI === "function") {
      await updateCoinsUI();
    }
    if (typeof updateXPSectionUI === "function") {
      await updateXPSectionUI();
    }

    if (
      previousLevel !== null &&
      typeof getLocalLevel === "function" &&
      typeof animateLevelUp === "function" &&
      (await getLocalLevel()) !== previousLevel
    ) {
      animateLevelUp();
    }

    const nextClaimed = new Set(state.claimedDateSet);
    nextClaimed.add(dateKey);

    const nextClaimable = new Set(state.claimableDateSet);
    nextClaimable.delete(dateKey);

    showWeeklyRewardBanner(
      formatWeeklyRewardBannerMessage(
        WEEKLY_STREAK_COIN_REWARD,
        WEEKLY_STREAK_XP_REWARD
      )
    );

    return {
      ...state,
      claimedDateSet: nextClaimed,
      claimableDateSet: nextClaimable,
      claimableCount: nextClaimable.size,
    };
  } finally {
    _weeklyClaimInFlight = false;
  }
}

function attachWeeklyRewardGift(dayCell, dateKey, weeklyState, onClaim) {
  if (!dayCell || !weeklyState || !(weeklyState.claimableDateSet instanceof Set)) return;
  const hasClaimableGift = weeklyState.claimableDateSet.has(dateKey);
  const hasPreviewGift =
    weeklyState.previewDateSet instanceof Set && weeklyState.previewDateSet.has(dateKey);
  if (!hasClaimableGift && !hasPreviewGift) return;

  dayCell.classList.add("has-weekly-gift");
  if (hasPreviewGift && !hasClaimableGift) {
    dayCell.classList.add("is-reward-preview");
  }

  const giftButton = document.createElement("button");
  giftButton.type = "button";
  giftButton.className = "calendar-weekly-gift-btn";
  giftButton.textContent = "🎁";

  if (hasClaimableGift) {
    giftButton.setAttribute("aria-label", "Claim weekly streak reward");
    giftButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (_weeklyClaimInFlight) return;

      giftButton.disabled = true;
      await onClaim(dateKey);
    });
  } else {
    giftButton.classList.add("is-locked");
    giftButton.disabled = true;
    giftButton.setAttribute("aria-label", "Weekly streak reward locked");
  }

  dayCell.appendChild(giftButton);
}
