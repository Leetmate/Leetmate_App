// Dev helpers (Home console, signed in)
//
// Usage:
//   await demo.stage("Egg")
//   await demo.stage("Baby")
//   await demo.stage("Adult")
//   await demo.nextDay()
//   await demo.feed()
//   await demo.addPets()
//   await demo.reset()

(function () {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const LAST_FED_KEY = "leetmate_last_fed";

  function requireFn(name, value) {
    if (typeof value !== "function") {
      throw new Error(`demo: ${name} is not available on this page.`);
    }
    return value;
  }

  async function getAuthContext() {
    if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
      throw new Error("demo: Firebase is not available.");
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error("demo: Sign in on Home first.");
    }

    return {
      db: firebase.firestore(),
      uid: user.uid,
    };
  }

  async function getActivePetId(db, uid) {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("demo: user document is missing.");
    }

    const activePetId = userSnap.data()?.activePetId || null;
    if (!activePetId) {
      throw new Error("demo: no active pet found.");
    }

    return activePetId;
  }

  async function refreshHomePet(db, uid) {
    await requireFn("loadActivePetFromFirestore", window.loadActivePetFromFirestore)(db, uid);
  }

  async function refreshHearts(db, uid) {
    await requireFn("loadHappinessFromFirestore", window.loadHappinessFromFirestore)(db, uid);
    await requireFn("updateHeartsUI", window.updateHeartsUI)();
  }

  async function redirectToEvolutionIfQueued() {
    if (
      typeof storageGet !== "function" ||
      typeof LeetmateEvolutionNotify === "undefined" ||
      typeof LeetmateEvolutionNotify.peekEvolutionQueue !== "function"
    ) {
      return false;
    }

    const { activePetId } = await storageGet(["activePetId"]);
    if (!activePetId) return false;

    const queue = await LeetmateEvolutionNotify.peekEvolutionQueue();
    const evolutionEvent = (queue || []).find((event) => event && event.petId === activePetId);
    if (!evolutionEvent) return false;

    try {
      sessionStorage.setItem("leetmate_evolution_payload", JSON.stringify(evolutionEvent));
    } catch (_) {}

    window.location.replace(chrome.runtime.getURL("screens/evolution/index.html"));
    return true;
  }

  async function stage(nextStage) {
    const normalizedStage = String(nextStage || "").trim().toLowerCase();
    const stageMap = {
      egg: "Egg",
      baby: "Baby",
      adult: "Adult",
    };

    if (!stageMap[normalizedStage]) {
      throw new Error('demo.stage expects "Egg", "Baby", or "Adult".');
    }

    const { db, uid } = await getAuthContext();
    const activePetId = await getActivePetId(db, uid);
    const stageValue = stageMap[normalizedStage];

    await db
      .collection("users")
      .doc(uid)
      .collection("pets")
      .doc(activePetId)
      .set(
        {
          stage: stageValue,
          ableToBattle: stageValue === "Adult",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    if (typeof storageSet === "function") {
      await storageSet({ leetmate_pet_age_pending_firestore_sync: false });
    }

    await refreshHomePet(db, uid);
    console.log(`demo.stage: active pet set to ${stageValue}.`);
    return true;
  }

  async function nextDay() {
    const { db, uid } = await getAuthContext();
    const { [LAST_FED_KEY]: storedLastFed } = await storageGet([LAST_FED_KEY]);
    const baseLastFed = Number.isFinite(Number(storedLastFed)) ? Number(storedLastFed) : Date.now();
    const nextLastFedMs = baseLastFed - DAY_MS;
    const yesterdayDate = new Date(Date.now() - DAY_MS);
    const yesterdayCa = yesterdayDate.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });

    const calculateHappinessFromFedTime = requireFn(
      "calculateHappinessFromFedTime",
      window.calculateHappinessFromFedTime
    );
    const runMidnightPetAgeJob = requireFn("runMidnightPetAgeJob", window.runMidnightPetAgeJob);
    const syncPendingPetAgeToFirestore = requireFn(
      "syncPendingPetAgeToFirestore",
      window.syncPendingPetAgeToFirestore
    );

    const derivedHappiness = calculateHappinessFromFedTime(nextLastFedMs);

    await db.collection("users").doc(uid).set(
      {
        lastFedTime: firebase.firestore.Timestamp.fromMillis(nextLastFedMs),
        happiness: derivedHappiness,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await storageSet({
      [LAST_FED_KEY]: nextLastFedMs,
      leetmate_happiness: derivedHappiness,
      leetmate_pet_age_last_rollover: yesterdayCa,
      leetmate_pet_age_pending_firestore_sync: false,
    });

    await refreshHearts(db, uid);
    await runMidnightPetAgeJob();
    await syncPendingPetAgeToFirestore(db, uid);
    await refreshHomePet(db, uid);
    await refreshHearts(db, uid);

    if (await redirectToEvolutionIfQueued()) {
      return true;
    }

    console.log(
      `demo.nextDay: simulated one day. happiness=${derivedHappiness.toFixed(1)}%, pet age job ran.`
    );
    return true;
  }

  async function feed() {
    const { db, uid } = await getAuthContext();
    await requireFn("feedPet", window.feedPet)(db, uid, 100);
    await refreshHearts(db, uid);
    console.log("demo.feed: hearts filled to 100%.");
    return true;
  }

  function buildPetDocData(petRef) {
    const statsByPet = {
      Bat: { hp: 40, atk: 45, def: 40, spAtk: 60, spDef: 50, spd: 80 },
      Fox: { hp: 45, atk: 50, def: 45, spAtk: 75, spDef: 60, spd: 70 },
    };

    return {
      petRef,
      customName: `Cubic ${petRef}`,
      age: 0,
      stats: statsByPet[petRef] || null,
      stage: "Egg",
      ableToBattle: false,
      createdTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      adjustedDays: 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  async function addPets() {
    const { db, uid } = await getAuthContext();
    const userRef = db.collection("users").doc(uid);
    const petsRef = userRef.collection("pets");
    const existingSnap = await petsRef.where("petRef", "in", ["Bat", "Fox"]).get();
    const existing = new Set(existingSnap.docs.map((doc) => doc.data()?.petRef).filter(Boolean));

    const writes = [];
    if (!existing.has("Bat")) {
      writes.push(petsRef.doc().set(buildPetDocData("Bat")));
    }
    if (!existing.has("Fox")) {
      writes.push(petsRef.doc().set(buildPetDocData("Fox")));
    }

    await Promise.all(writes);

    await requireFn("loadActivePetFromFirestore", window.loadActivePetFromFirestore)(db, uid);

    console.log(
      writes.length === 0
        ? "demo.addPets: Bat and Fox already exist."
        : "demo.addPets: added missing Bat/Fox pets and refreshed cache."
    );
    return true;
  }

  async function status() {
    const { db, uid } = await getAuthContext();
    const activePetId = await getActivePetId(db, uid);
    const userRef = db.collection("users").doc(uid);
    const petRef = userRef.collection("pets").doc(activePetId);

    const [userSnap, petSnap] = await Promise.all([userRef.get(), petRef.get()]);
    const storageState = await storageGet([
      "activePetId",
      "activePetSnapshot",
      "ownedPetsSnapshot",
      "leetmate_happiness",
      LAST_FED_KEY,
      "leetmate_pet_age_last_rollover",
      "leetmate_pet_age_pending_firestore_sync",
      "leetmate_evolution_queue",
    ]);

    const userData = userSnap.data() || {};
    const petData = petSnap.data() || {};
    const createdMs =
      typeof petData.createdTimestamp?.toMillis === "function"
        ? petData.createdTimestamp.toMillis()
        : null;

    const snapshotSummary = storageState.activePetSnapshot
      ? {
          id: storageState.activePetSnapshot.id || null,
          petRef: storageState.activePetSnapshot.petRef || null,
          stage: storageState.activePetSnapshot.stage || null,
          customName: storageState.activePetSnapshot.customName || "",
          adjustedDays: storageState.activePetSnapshot.adjustedDays || 0,
        }
      : null;

    const result = {
      uid,
      firestore: {
        activePetId: userData.activePetId || null,
        happiness: userData.happiness ?? null,
        lastFedTimeMs:
          typeof userData.lastFedTime?.toMillis === "function"
            ? userData.lastFedTime.toMillis()
            : null,
        pet: petSnap.exists
          ? {
              id: activePetId,
              petRef: petData.petRef || null,
              customName: petData.customName || "",
              stage: petData.stage || null,
              age: petData.age ?? null,
              adjustedDays: petData.adjustedDays ?? 0,
              ableToBattle: petData.ableToBattle ?? null,
              createdTimestampMs: createdMs,
            }
          : null,
      },
      storage: {
        activePetId: storageState.activePetId || null,
        activePetSnapshot: snapshotSummary,
        ownedPetsCount: Array.isArray(storageState.ownedPetsSnapshot)
          ? storageState.ownedPetsSnapshot.length
          : 0,
        happiness: storageState.leetmate_happiness ?? null,
        lastFedTimeMs: storageState[LAST_FED_KEY] ?? null,
        lastRollover: storageState.leetmate_pet_age_last_rollover ?? null,
        pendingPetAgeSync: storageState.leetmate_pet_age_pending_firestore_sync ?? null,
        evolutionQueueLength: Array.isArray(storageState.leetmate_evolution_queue)
          ? storageState.leetmate_evolution_queue.length
          : 0,
      },
    };

    console.log("demo.status:", result);
    return result;
  }

  async function reset() {
    const { db, uid } = await getAuthContext();
    const activePetId = await getActivePetId(db, uid);
    const nowMs = Date.now();

    await db.collection("users").doc(uid).set(
      {
        lastFedTime: firebase.firestore.Timestamp.fromMillis(nowMs),
        happiness: 100,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db
      .collection("users")
      .doc(uid)
      .collection("pets")
      .doc(activePetId)
      .set(
        {
          stage: "Egg",
          age: 0,
          adjustedDays: 0,
          ableToBattle: false,
          createdTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await storageSet({
      leetmate_last_fed: nowMs,
      leetmate_happiness: 100,
      leetmate_pet_age_last_rollover: null,
      leetmate_pet_age_pending_firestore_sync: false,
      leetmate_evolution_queue: [],
    });

    await refreshHomePet(db, uid);
    await refreshHearts(db, uid);

    console.log("demo.reset: active pet reset to Egg, age 0, and happiness timing reset to now.");
    return true;
  }

  window.demo = {
    stage,
    nextDay,
    feed,
    addPets,
    status,
    reset,
  };
})();
