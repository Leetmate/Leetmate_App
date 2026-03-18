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
      console.log("Daily streak check complete:", updated);
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

  window.happinessTest = {
    async setFedHoursAgo(hours) {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid;
      const fakeMs = Date.now() - hours * 60 * 60 * 1000;
      const fakeTimestamp = firebase.firestore.Timestamp.fromMillis(fakeMs);
      const happiness = calculateHappinessFromFedTime(fakeMs);

      await db.collection("users").doc(uid).set(
        {
          lastFedTime: fakeTimestamp,
          happiness,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await loadHappinessFromFirestore(db, uid);
      await updateHeartsUI();
      console.log(`Firestore: fed ${hours}h ago -> happiness: ${happiness.toFixed(1)}%`);
    },

    async fed8hAgo() { await this._localFake(8); },
    async fed16hAgo() { await this._localFake(16); },
    async fed24hAgo() { await this._localFake(24); },
    async fedLongAgo() { await this._localFake(40); },
    async fedHoursAgo(hours) { await this._localFake(hours); },

    async _localFake(hours) {
      const fakeTime = Date.now() - hours * 60 * 60 * 1000;
      await setLocalLastFedTime(fakeTime);
      await setLocalHappiness(calculateHappinessFromFedTime(fakeTime));
      await updateHeartsUI();

      const derived = calculateHappinessFromFedTime(fakeTime);
      console.log(`Local only: fed ${hours}h ago. Happiness: ${derived.toFixed(1)}%`);
    },

    async feed() {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid;
      await feedPet(db, uid);

      const lastFedTime = await getLocalLastFedTime();
      console.log(
        "Pet fed! Happiness:",
        calculateHappinessFromFedTime(lastFedTime).toFixed(1) + "%"
      );
    },

    async status() {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid;
      const snap = await db.collection("users").doc(uid).get();
      const data = snap.data();

      const firestoreLastFed = data?.lastFedTime?.toMillis() ?? null;
      const localLastFed = await getLocalLastFedTime();

      const firestoreDerived = calculateHappinessFromFedTime(firestoreLastFed);
      const localDerived = calculateHappinessFromFedTime(localLastFed);

      console.group("Happiness Status");
      console.log("Firestore lastFedTime:", data?.lastFedTime?.toDate().toLocaleString() ?? "never");
      console.log("Firestore happiness (derived):", firestoreDerived.toFixed(1) + "%");
      console.log("Local lastFedTime:", localLastFed ? new Date(localLastFed).toLocaleString() : "never");
      console.log("Local happiness (derived):", localDerived.toFixed(1) + "%");
      console.log("In sync:", firestoreLastFed === localLastFed ? "yes" : "no");
      console.groupEnd();
    },

    async reload() {
      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid;
      await loadHappinessFromFirestore(db, uid);
      await updateHeartsUI();

      const lastFedTime = await getLocalLastFedTime();
      console.log(
        "Reloaded from Firestore. Happiness:",
        calculateHappinessFromFedTime(lastFedTime).toFixed(1) + "%"
      );
    },

    async reset() {
      await storageSet({ [HAPPINESS_STORAGE_KEY]: 100, [LAST_FED_KEY]: null });
      await updateHeartsUI();
      console.log("Local storage reset.");
    }
  };
}
