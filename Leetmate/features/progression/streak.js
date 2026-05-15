function isValidDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function millisToPacificDateKey(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

/**
 * Canonical YYYY-MM-DD in America/Los_Angeles from Firestore string, Timestamp, Date, etc.
 */
function normalizePacificDateKey(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const s = value.trim();
    return isValidDateKey(s) ? s : null;
  }
  let ms = null;
  try {
    if (value instanceof Date && !isNaN(value.getTime())) {
      ms = value.getTime();
    } else if (typeof value.toMillis === "function") {
      ms = value.toMillis();
    } else if (typeof value.seconds === "number") {
      ms = value.seconds * 1000;
    }
  } catch (_) {
    ms = null;
  }
  return millisToPacificDateKey(ms);
}

async function loadStreakData(db, uid) {
  return db
  .collection("users")
  .doc(uid)
  .get()
  .then(async (snap) => {
    if (!snap.exists) return null;

    const data = snap.data()

    const streakData = {
      streak: typeof data.streak === "number" ? data.streak : 0,
      streakFreezeStart:
        normalizePacificDateKey(data.streakFreezeStart) || null,
      streakFreezeEnd: normalizePacificDateKey(data.streakFreezeEnd) || null,
      streakLastUpdated: normalizePacificDateKey(data.streakLastUpdated) || null,
      // Last Pacific day streak was incremented specifically for solving (not midnight bookkeeping).
      streakSolveRewardDate:
        normalizePacificDateKey(data.streakSolveRewardDate) || null,
    };
    await storageSet({
      leetmate_streak: streakData.streak,
      leetmate_last_streak_date: streakData.streakLastUpdated ?? null,
      leetmate_streak_freeze_start: streakData.streakFreezeStart ?? null,
      leetmate_streak_freeze_end: streakData.streakFreezeEnd ?? null,
      leetmate_streak_solve_reward_date:
        streakData.streakSolveRewardDate ?? null,
    });

    return streakData;
  })
  .catch((e) => {
    console.error("loadStreakData failed: ", e);
    return null
  })
}

async function saveStreakData(db, uid, streakData) {
  await storageSet({
    leetmate_streak: streakData.streak,
    leetmate_last_streak_date: streakData.streakLastUpdated ?? null,
    leetmate_streak_freeze_start: streakData.streakFreezeStart ?? null,
    leetmate_streak_freeze_end: streakData.streakFreezeEnd ?? null,
    leetmate_streak_solve_reward_date:
      streakData.streakSolveRewardDate ?? null,
  });

  const savePromise = db
  .collection("users")
  .doc(uid)
  .set(
    {
      streak: streakData.streak,
      streakFreezeStart: streakData.streakFreezeStart,
      streakFreezeEnd: streakData.streakFreezeEnd,
      streakLastUpdated: streakData.streakLastUpdated || null,
      streakSolveRewardDate: streakData.streakSolveRewardDate ?? null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {merge: true}
  )
  .catch((e) => {
    console.error("saveStreakData failed: ", e);
  });

  await savePromise;
  await saveStreakFreezeUsage(db, uid, streakData);
  return savePromise;
}

async function saveStreakFreezeUsage(db, uid, streakData) {
  const startDate = streakData?.streakFreezeStart;
  const endDate = streakData?.streakFreezeEnd;
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) return;
  if (startDate > endDate) return;

  const usageDocId = `${startDate}_${endDate}`;

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("streakFreezeUsage")
      .doc(usageDocId)
      .set(
        {
          startDate,
          endDate,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (e) {
    console.warn("saveStreakFreezeUsage subcollection write failed, using fallback:", e);
    await saveStreakFreezeUsageFallback(db, uid, startDate, endDate);
  }
}

async function saveStreakFreezeUsageFallback(db, uid, startDate, endDate) {
  try {
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          streakFreezeUsageHistory: firebase.firestore.FieldValue.arrayUnion({
            startDate,
            endDate,
          }),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (fallbackError) {
    console.error("saveStreakFreezeUsage fallback failed:", fallbackError);
  }
}

async function deleteStreakFreezeUsage(db, uid, startDate, endDate) {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) return;
  if (startDate > endDate) return;

  const usageDocId = `${startDate}_${endDate}`;

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("streakFreezeUsage")
      .doc(usageDocId)
      .delete();
  } catch (e) {
    console.warn("deleteStreakFreezeUsage subcollection delete failed:", e);
  }

  try {
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          streakFreezeUsageHistory: firebase.firestore.FieldValue.arrayRemove({
            startDate,
            endDate,
          }),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (fallbackError) {
    console.warn("deleteStreakFreezeUsage fallback remove failed:", fallbackError);
  }
}

function getTodayString() {
  // For demo/testing
  if (typeof window !== "undefined" && window.__leetmateFakeToday) {
    return window.__leetmateFakeToday;
  }

  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });
}


function isStreakFreezeActive(streakData) {
  if (!streakData.streakFreezeEnd) return false;

  const today = getTodayString();
  return streakData.streakFreezeEnd >= today;
}

function activateStreakFreeze(streakData, durationDays) {
  const today = new Date();
  const freezeStart = getTodayString();
  today.setDate(today.getDate() + Math.max(0, durationDays - 1));

  const freezeEnd = today.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  })

  return {
    streak: streakData.streak,
    streakFreezeStart: freezeStart,
    streakFreezeEnd: freezeEnd,
    streakLastUpdated: streakData.streakLastUpdated ?? null,
    streakSolveRewardDate: streakData.streakSolveRewardDate ?? null,
  }
}

function clearStreakFreeze(streakData) {
  return {
    streak: streakData.streak,
    streakFreezeStart: null,
    streakFreezeEnd: null,
    streakLastUpdated: streakData.streakLastUpdated ?? null,
    streakSolveRewardDate: streakData.streakSolveRewardDate ?? null,
  }
}

function incrementStreak(streakData){
  return {
    streak: streakData.streak + 1,
    streakFreezeStart: streakData.streakFreezeStart ?? null,
    streakFreezeEnd: streakData.streakFreezeEnd ?? null,
    streakLastUpdated: streakData.streakLastUpdated ?? null,
    streakSolveRewardDate: streakData.streakSolveRewardDate ?? null,
  }
}

function resetStreak(streakData) {
  return {
    streak: 0, // adjust according to leetcode implementation?
    streakFreezeStart: streakData.streakFreezeStart,
    streakFreezeEnd: streakData.streakFreezeEnd,
    streakLastUpdated: streakData.streakLastUpdated ?? null,
    streakSolveRewardDate: null,
  }
}

function processMissedDay(streakData) {
  if (isStreakFreezeActive(streakData)) {
    return incrementStreak(streakData);
  }

  return resetStreak(streakData);
}

function recordStreakProgress(streakData, solvedToday) {
  if (solvedToday) {
    return incrementStreak(streakData);
  }

  return processMissedDay(streakData);
}

function updateStreakUI(streakData) {
  const streakCount = document.querySelector(".streak-count");
  const freezeOverlay = document.querySelector(".streak-freeze-overlay");

  if (!streakCount || !freezeOverlay) {
    console.warn("Streak UI elements not found.");
    return;
  }

  streakCount.textContent = streakData.streak;
  freezeOverlay.style.display = isStreakFreezeActive(streakData) ? "block" : "none"
}

function isStreakUpdatedToday(streakData) {
  if (!streakData.streakLastUpdated) return false;

  const today = getTodayString();
  return streakData.streakLastUpdated === today;
}

function isDailyStreakCheckTime() {
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());

  const hour = Number(timeParts.find((part) => part.type === "hour")?.value);
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value);

  return hour === 23 && minute === 59;
}

async function runDailyStreakCheck() {
  try {
    const { uid } = await storageGet("uid");
    if (!uid) {
      console.log("No uid in storage, skipping.");
      return;
    }

    const today = getTodayString();
    const { leetmate_last_streak_date, leetmate_last_progress_date } = await storageGet([
      "leetmate_last_streak_date",
      "leetmate_last_progress_date",
    ]);
    const streakUpdatedToday = leetmate_last_streak_date === today;
    const solvedToday = leetmate_last_progress_date === today;

    if (streakUpdatedToday) {
      console.log("Daily streak check skipped: streak already updated today.");
      return;
    }

    if (!isDailyStreakCheckTime()) {
      console.log("Daily streak check skipped: not 11:59 PM yet.");
      return;
    }

    if (solvedToday) {
      console.log("Daily streak check skipped: progress already made today.");
      return;
    }

    // Didn't solve today → reset streak to 0
    const {
      leetmate_streak,
      leetmate_streak_freeze_start,
      leetmate_streak_freeze_end,
      leetmate_streak_solve_reward_date,
    }
      = await storageGet([
          "leetmate_streak",
          "leetmate_streak_freeze_start",
          "leetmate_streak_freeze_end",
          "leetmate_streak_solve_reward_date",
        ]);

    const streakData = {
      streak: leetmate_streak ?? 0,
      streakLastUpdated: leetmate_last_streak_date ?? null,
      streakFreezeStart: leetmate_streak_freeze_start ?? null,
      streakFreezeEnd: leetmate_streak_freeze_end ?? null,
      streakSolveRewardDate:
        normalizePacificDateKey(leetmate_streak_solve_reward_date) || null,
    };

    const freezeActive = isStreakFreezeActive(streakData);
    // Freeze active → keep current streak count, otherwise reset to 0.
    const updated = freezeActive
      ? { ...streakData }
      : resetStreak(streakData);

    updated.streakLastUpdated = today;

    if (window.firebase && firebase.firestore) {
      const db = firebase.firestore();
      await saveStreakData(db, uid, updated);
    } else {
      await storageSet({
        leetmate_streak: updated.streak,
        leetmate_last_streak_date: updated.streakLastUpdated,
        leetmate_streak_freeze_start: updated.streakFreezeStart ?? null,
        leetmate_streak_freeze_end: updated.streakFreezeEnd ?? null,
        leetmate_streak_solve_reward_date:
          updated.streakSolveRewardDate ?? null,
      });
    }

    if (freezeActive) {
      console.log("Freeze active at midnight: streak preserved and date updated.", updated);
    } else {
      console.log("Streak reset at midnight:", updated);
    }

  } catch (e) {
    console.error("runDailyStreakCheck failed:", e);
  }
}

if (typeof window !== "undefined") {

  window.streakTest = {
    async freeze(days = 1) {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;
      if (!user) return console.warn("No signed-in user.");

      const data = await loadStreakData(db, user.uid);
      const updated = activateStreakFreeze(data, days);

      await saveStreakData(db, user.uid, updated);
      updateStreakUI(updated);

      console.log("Freeze activated:", updated);
    },

    async clear() {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;
      if (!user) return console.warn("No signed-in user.");

      const data = await loadStreakData(db, user.uid);
      await deleteStreakFreezeUsage(
        db,
        user.uid,
        data?.streakFreezeStart,
        data?.streakFreezeEnd
      );
      const updated = clearStreakFreeze(data);

      await saveStreakData(db, user.uid, updated);
      updateStreakUI(updated);

      console.log("Freeze cleared:", updated);
    },

    async increment() {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;
      if (!user) return console.warn("No signed-in user.");

      const data = await loadStreakData(db, user.uid);
      const updated = incrementStreak(data);

      await saveStreakData(db, user.uid, updated);
      updateStreakUI(updated);

      console.log("Streak incremented:", updated);
    },

    async miss() {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;
      if (!user) return console.warn("No signed-in user.");

      const data = await loadStreakData(db, user.uid);
      const updated = processMissedDay(data);

      await saveStreakData(db, user.uid, updated);
      updateStreakUI(updated);

      console.log("Streak updated:", updated);
    },

    setFakeToday(dateString) {
      window.__leetmateFakeToday = dateString;
      console.log("Fake today set to:", dateString);
    },

    clearFakeToday() {
      window.__leetmateFakeToday = null;
      console.log("Fake today cleared.");
    },

    async runDailyCheck() {
      await runDailyStreakCheck();
      const {
        leetmate_streak,
        leetmate_last_streak_date,
        leetmate_streak_freeze_start,
        leetmate_streak_freeze_end,
        leetmate_streak_solve_reward_date,
      } = await storageGet([
        "leetmate_streak",
        "leetmate_last_streak_date",
        "leetmate_streak_freeze_start",
        "leetmate_streak_freeze_end",
        "leetmate_streak_solve_reward_date",
      ]);

      const updated = {
        streak: leetmate_streak ?? 0,
        streakLastUpdated: leetmate_last_streak_date ?? null,
        streakFreezeStart: leetmate_streak_freeze_start ?? null,
        streakFreezeEnd: leetmate_streak_freeze_end ?? null,
        streakSolveRewardDate:
          normalizePacificDateKey(leetmate_streak_solve_reward_date) || null,
      };

      updateStreakUI(updated);
      console.log("Daily streak check complete (UI updated from storage):", updated);
    },

    async reload() {
      const db = firebase.firestore();
      const user = firebase.auth().currentUser;
      if (!user) return console.warn("No signed-in user.");

      const data = await loadStreakData(db, user.uid);
      updateStreakUI(data);
      console.log("Reloaded streak data:", data);
    }
  };
}