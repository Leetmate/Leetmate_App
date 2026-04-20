// weekly-rewards.js
// Weekly streak reward logic for Activity calendar.

const WEEKLY_STREAK_DAYS = 7;
const WEEKLY_STREAK_COIN_REWARD = 100;
const WEEKLY_STREAK_XP_REWARD = 30;

let _weeklyClaimInFlight = false;
let _weeklyBannerTimer = null;

function showWeeklyRewardBanner(message) {
  const bannerMessage =
    message ||
    `Weekly reward claimed: +${WEEKLY_STREAK_COIN_REWARD} coins, +${WEEKLY_STREAK_XP_REWARD} XP`;

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

function buildWeeklyRewardMilestones(progressDateSet) {
  if (!progressDateSet || !(progressDateSet instanceof Set) || progressDateSet.size === 0) {
    return new Set();
  }

  const sortedProgressKeys = sortDateKeys(progressDateSet);
  const milestoneSet = new Set();

  let previousKey = null;
  let streakLength = 0;

  for (const dateKey of sortedProgressKeys) {
    if (!previousKey) {
      streakLength = 1;
    } else {
      const expectedNext = addDay(previousKey, 1);
      streakLength = expectedNext === dateKey ? streakLength + 1 : 1;
    }

    if (streakLength % WEEKLY_STREAK_DAYS === 0) {
      milestoneSet.add(dateKey);
    }

    previousKey = dateKey;
  }

  return milestoneSet;
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

  const claimableDateSet = new Set(
    [...milestones].filter((dateKey) => !claimedDateSet.has(dateKey))
  );

  return {
    milestones,
    claimedDateSet,
    claimableDateSet,
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

    showWeeklyRewardBanner();

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
  if (!weeklyState.claimableDateSet.has(dateKey)) return;

  dayCell.classList.add("has-weekly-gift");

  const giftButton = document.createElement("button");
  giftButton.type = "button";
  giftButton.className = "calendar-weekly-gift-btn";
  giftButton.setAttribute("aria-label", "Claim weekly streak reward");
  giftButton.textContent = "🎁";

  giftButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (_weeklyClaimInFlight) return;

    giftButton.disabled = true;
    await onClaim(dateKey);
  });

  dayCell.appendChild(giftButton);
}
