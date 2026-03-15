function loadStreakData(db, uid) {
  return db
  .collection("users")
  .doc(uid)
  .get()
  .then((snap) => {
    if (!snap.exists) return null;

    const data = snap.data()

    return {
      streak: typeof data.streak === 'number' ? data.streak : 0,
      streakFreezeEnd: data.streakFreezeEnd || null
    };
  })
  .catch((e) => {
    console.error("loadStreakData failed: ", e);
    return null
  })
}

function saveStreakData(db, uid, streakData) {
  return db
  .collection("users")
  .doc(uid)
  .set(
    {
      streak: streakData.streak,
      streakFreezeEnd: streakData.streakFreezeEnd,
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
  if (window.__leetmateFakeToday) {
    return window.__leetmateFakeToday;
  }

  const today = new Date();
  return today.toLocaleDateString("en-CA", {
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

  async reload() {
    const db = firebase.firestore();
    const user = firebase.auth().currentUser;
    if (!user) return console.warn("No signed-in user.");

    const data = await loadStreakData(db, user.uid);
    updateStreakUI(data);
    console.log("Reloaded streak data:", data);
  }
};