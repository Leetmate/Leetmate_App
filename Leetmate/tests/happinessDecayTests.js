// ── Debug helpers (dev only) ──────────────────────────────────────────────────
if (typeof window !== "undefined") {
    window.happinessTest = {
  
      // ── Firestore tests (writes lastFedTime to Firestore + reloads) ──────────
  
      // Set lastFedTime to X hours ago in Firestore — happiness is always derived
      async setFedHoursAgo(hours) {
        const db  = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        const fakeMs        = Date.now() - (hours * 60 * 60 * 1000);
        const fakeTimestamp = firebase.firestore.Timestamp.fromMillis(fakeMs);
        const happiness     = calculateHappinessFromFedTime(fakeMs);
        await db.collection("users").doc(uid).set(
          {
            lastFedTime: fakeTimestamp,
            happiness,                  // snapshot for reference only
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await loadHappinessFromFirestore(db, uid);
        await updateHeartsUI();
        console.log(`Firestore: fed ${hours}h ago → happiness: ${happiness.toFixed(1)}%`);
      },
  
      // ── Local-only tests (fast, no Firestore write) ───────────────────────────
  
      async fed8hAgo()   { await this._localFake(8);  },
      async fed16hAgo()  { await this._localFake(16); },
      async fed24hAgo()  { await this._localFake(24); },
      async fedLongAgo() { await this._localFake(40); },
  
      async fedHoursAgo(hours) { await this._localFake(hours); },
  
      async _localFake(hours) {
        const fakeTime = Date.now() - (hours * 60 * 60 * 1000);
        await setLocalLastFedTime(fakeTime);
        // Derive — don't snapshot — so local matches what status() will show
        await setLocalHappiness(calculateHappinessFromFedTime(fakeTime));
        await updateHeartsUI();
        const derived = calculateHappinessFromFedTime(fakeTime);
        console.log(`Local only: fed ${hours}h ago. Happiness: ${derived.toFixed(1)}%`);
      },
  
      // Feed now — writes to Firestore
      async feed() {
        const db  = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        await feedPet(db, uid);
        const lastFedTime = await getLocalLastFedTime();
        console.log("Pet fed! Happiness:", calculateHappinessFromFedTime(lastFedTime).toFixed(1) + "%");
      },
  
      // Check current state — happiness is always derived from lastFedTime
      async status() {
        const db  = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        const snap = await db.collection("users").doc(uid).get();
        const data = snap.data();
  
        const firestoreLastFed  = data?.lastFedTime?.toMillis() ?? null;
        const localLastFed      = await getLocalLastFedTime();
  
        const firestoreDerived  = calculateHappinessFromFedTime(firestoreLastFed);
        const localDerived      = calculateHappinessFromFedTime(localLastFed);
  
        console.group("Happiness Status");
        console.log("Firestore lastFedTime:", data?.lastFedTime?.toDate().toLocaleString() ?? "never");
        console.log("Firestore happiness (derived):", firestoreDerived.toFixed(1) + "%");
        console.log("Local    lastFedTime:", localLastFed ? new Date(localLastFed).toLocaleString() : "never");
        console.log("Local    happiness (derived):", localDerived.toFixed(1) + "%");
        console.log("In sync:", firestoreLastFed === localLastFed ? "✅ yes" : "⚠️ no — timestamps differ");
        console.groupEnd();
      },
  
      // Reload lastFedTime from Firestore and re-derive everything
      async reload() {
        const db  = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        await loadHappinessFromFirestore(db, uid);
        await updateHeartsUI();
        const lastFedTime = await getLocalLastFedTime();
        console.log("Reloaded from Firestore. Happiness:", calculateHappinessFromFedTime(lastFedTime).toFixed(1) + "%");
      },
  
      // Wipe local storage only
      async reset() {
        await storageSet({ [HAPPINESS_STORAGE_KEY]: 100, [LAST_FED_KEY]: null });
        await updateHeartsUI();
        console.log("Local storage reset.");
      },
    };
  }