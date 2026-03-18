if (typeof window !== "undefined") {
  window.demo = {
    async skip() {
      const deltaMs = 24 * 60 * 60 * 1000;
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser.uid;

      const currentLastFed = await getLocalLastFedTime();
      const baseTime = currentLastFed ?? Date.now();
      const nextLastFed = baseTime - deltaMs;
      const adjustedCurrentTime = Date.now() + deltaMs;
      const happiness = calculateHappinessFromFedTime(nextLastFed);

      await setLocalLastFedTime(nextLastFed);
      await setLocalHappiness(happiness);

      await updateHeartsUI();
      await db.collection("users").doc(uid).set(
        {
          happiness,
          lastFedTime: new Date(nextLastFed),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await saveStreakData(db, uid, {
        streak: 0,
        streakFreezeEnd: null,
        streakLastUpdated: getTodayString(),
      });
      updateStreakUI({
        streak: 0,
        streakFreezeEnd: null,
        streakLastUpdated: getTodayString(),
      });

      const currentTime = new Date(adjustedCurrentTime).toLocaleString();
      const happinessValue = Number(happiness.toFixed(1));
      const streakValue = 0;

      console.log(`Current time: ${currentTime}`);
      console.log(`Happiness: ${happinessValue}%`);
      console.log(`Streak: ${streakValue}`);
      return {
        currentTime,
        happiness: happinessValue,
        streak: streakValue,
      };
    },

    async reset() {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser.uid;
      const now = Date.now();

      await setLocalLastFedTime(now);
      await setLocalHappiness(100);
      await updateHeartsUI();

      await saveStreakData(db, uid, {
        streak: 0,
        streakFreezeEnd: null,
        streakLastUpdated: null,
      });
      updateStreakUI({
        streak: 0,
        streakFreezeEnd: null,
        streakLastUpdated: null,
      });

      await db.collection("users").doc(uid).set(
        {
          happiness: 100,
          lastFedTime: new Date(now),
          streak: 0,
          streakFreezeEnd: null,
          streakLastUpdated: null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const currentTime = new Date(now).toLocaleString();
      const happinessValue = 100;
      const streakValue = 0;

      console.log(`Current time: ${currentTime}`);
      console.log(`Happiness: ${happinessValue}%`);
      console.log(`Streak: ${streakValue}`);
      return {
        currentTime,
        happiness: happinessValue,
        streak: streakValue,
      };
    },

    async streak(value) {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser.uid;
      const streakValue = Number(value);
      const currentTime = new Date(Date.now()).toLocaleString();
      const happinessValue = await getLocalHappiness();

      await saveStreakData(db, uid, {
        streak: streakValue,
        streakFreezeEnd: null,
        streakLastUpdated: getTodayString(),
      });
      updateStreakUI({
        streak: streakValue,
        streakFreezeEnd: null,
        streakLastUpdated: getTodayString(),
      });

      console.log(`Current time: ${currentTime}`);
      console.log(`Happiness: ${happinessValue}%`);
      console.log(`Streak: ${streakValue}`);
      return {
        currentTime,
        happiness: happinessValue,
        streak: streakValue,
      };
    },

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