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
      streakFreezeEnd: data.streakFreezeEnd || null,
      streakLastUpdated: data.streakLastUpdated || null,
    };
    await storageSet({
      leetmate_streak: streakData.streak,
      leetmate_last_streak_date: streakData.streakLastUpdated ?? null,
      leetmate_streak_freeze_end: streakData.streakFreezeEnd ?? null,
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
    leetmate_streak_freeze_end: streakData.streakFreezeEnd ?? null,
  });

  return db
  .collection("users")
  .doc(uid)
  .set(
    {
      streak: streakData.streak,
      streakFreezeEnd: streakData.streakFreezeEnd,
      streakLastUpdated: streakData.streakLastUpdated || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {merge: true}
  )
  .catch((e) => {
    console.error("saveStreakData failed: ", e);
  })
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
  today.setDate(today.getDate() + durationDays);

  const freezeEnd = today.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  })

  return {
    streak: streakData.streak,
    streakFreezeEnd: freezeEnd
  }
}

function clearStreakFreeze(streakData) {
  return {
    streak: streakData.streak,
    streakFreezeEnd: null
  }
}

function incrementStreak(streakData){
  return {
    streak: streakData.streak + 1,
    streakFreezeEnd: streakData.streakFreezeEnd
  }
}

function resetStreak(streakData) {
  return {
    streak: 0, // adjust according to leetcode implementation?
    streakFreezeEnd: streakData.streakFreezeEnd
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

async function runDailyStreakCheck() {
  try {
    const { uid } = await storageGet("uid");
    if (!uid) {
      console.log("No uid in storage, skipping.");
      return;
    }

    const today = getTodayString();

    // Check if user solved today
    const { leetmate_last_progress_date } = await storageGet("leetmate_last_progress_date");
    const solvedToday = leetmate_last_progress_date === today;

    // Solved today → home.js already handled the increment, do nothing
    if (solvedToday) {
      console.log("User solved today, streak already handled by home.js.");
      return;
    }

    // Didn't solve today → reset streak to 0
    const { leetmate_streak, leetmate_last_streak_date, leetmate_streak_freeze_end }
      = await storageGet([
          "leetmate_streak",
          "leetmate_last_streak_date",
          "leetmate_streak_freeze_end"
        ]);

    const streakData = {
      streak: leetmate_streak ?? 0,
      streakLastUpdated: leetmate_last_streak_date ?? null,
      streakFreezeEnd: leetmate_streak_freeze_end ?? null,
    };

    // Check freeze before resetting
    const updated = isStreakFreezeActive(streakData)
      ? streakData                  // freeze active → preserve streak
      : resetStreak(streakData);    // no freeze → reset to 0

    updated.streakLastUpdated = today;

    // Save to chrome storage
    await storageSet({
      leetmate_streak: updated.streak,
      leetmate_last_streak_date: updated.streakLastUpdated,
      leetmate_streak_freeze_end: updated.streakFreezeEnd ?? null,
    });

    console.log("Streak reset at midnight:", updated);

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
        leetmate_streak_freeze_end,
      } = await storageGet([
        "leetmate_streak",
        "leetmate_last_streak_date",
        "leetmate_streak_freeze_end",
      ]);

      const updated = {
        streak: leetmate_streak ?? 0,
        streakLastUpdated: leetmate_last_streak_date ?? null,
        streakFreezeEnd: leetmate_streak_freeze_end ?? null,
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