/**
 * happinessDecay.js
 * Happiness is calculated from the last time the pet was fed.
 * Decays by 1 heart (20%) every 8 hours after feeding.
 * Full happiness (100%) resets when pet is fed.
 *
 * Chrome storage keys:
 *   leetmate_happiness   – last saved happiness value (0–100)
 *   leetmate_last_fed    – timestamp (ms) of last feed
 *
 * Firestore fields (on users/{uid}):
 *   happiness            – last saved happiness value (0–100)
 *   lastFedTime          – timestamp (ms) of last feed
 */

const HAPPINESS_STORAGE_KEY = "leetmate_happiness";
const LAST_FED_KEY          = "leetmate_last_fed";
const DECAY_INTERVAL_MS     = 8 * 60 * 60 * 1000; // 8 hours
const TOTAL_HEARTS          = 5;

// ── Core formula ─────────────────────────────────────────────────────────────

/**
 * Translates a happiness percentage (0–100) into an array of 5 fill values.
 * Each heart = 20% of total happiness.
 *
 * Returns array of 5 numbers (0 to 1):
 *   1.0 = full, 0.0 = empty, 0.x = partial
 *
 * calculateHeartValues(100) → [1,    1,    1,    1,    1   ]
 * calculateHeartValues(95)  → [1,    1,    1,    1,    0.75]
 * calculateHeartValues(80)  → [1,    1,    1,    1,    0   ]
 * calculateHeartValues(55)  → [1,    1,    0.75, 0,    0   ]
 * calculateHeartValues(0)   → [0,    0,    0,    0,    0   ]
 */
function calculateHeartValues(timePerc) {
  const hearts = [0, 0, 0, 0, 0];
  const perc = Math.max(0, Math.min(100, timePerc));

  const fullHearts = Math.floor(perc / 20);

  for (let i = 0; i < fullHearts; i++) {
    hearts[i] = 1;
  }

  if (fullHearts < TOTAL_HEARTS) {
    hearts[fullHearts] = (perc - fullHearts * 20) / 20;
  }

  return hearts;
}

/**
 * Calculate current happiness % from lastFedTime.
 * Decays 20% per 8-hour interval elapsed since last feed.
 * Returns 100 if never fed (fresh pet = full happiness).
 */
function calculateHappinessFromFedTime(lastFedTime) {
  if (!lastFedTime) return 100;

  const elapsed = Date.now() - lastFedTime;
  const intervalsElapsed = Math.floor(elapsed / DECAY_INTERVAL_MS);
  const decayAmount = intervalsElapsed * 20;

  return Math.max(0, 100 - decayAmount);
}

// ── Local storage read/write ──────────────────────────────────────────────────

async function getLocalHappiness() {
  const result = await storageGet(HAPPINESS_STORAGE_KEY);
  return result[HAPPINESS_STORAGE_KEY] ?? 100;
}

async function setLocalHappiness(value) {
  await storageSet({ [HAPPINESS_STORAGE_KEY]: value });
}

async function getLocalLastFedTime() {
  const result = await storageGet(LAST_FED_KEY);
  return result[LAST_FED_KEY] ?? null;
}

async function setLocalLastFedTime(timestamp) {
  await storageSet({ [LAST_FED_KEY]: timestamp });
}

// ── Feed the pet ──────────────────────────────────────────────────────────────

/**
 * Call this when the user feeds their pet.
 * Resets happiness to 100 and records the current time.
 */
async function feedPet(db, uid) {
    await setLocalLastFedTime(Date.now());
    await setLocalHappiness(100);
    await updateHeartsUI();
  
    // Then save to Firestore and sync server timestamp back
    await saveHappinessToFirestore(db, uid, 100);
  
    // Refresh UI again with accurate server timestamp
    await updateHeartsUI();
  
    console.log("Pet fed! Happiness reset to 100.");
  }

function setupFeedButton(db, uid) {
    const feedBtn = document.getElementById("feedBtn");
    if (!feedBtn) {
      console.warn("feedBtn not found in DOM.");
      return;
    }
   
    feedBtn.addEventListener("click", async () => {
      await feedPet(db, uid);
    });
}
// ── UI ────────────────────────────────────────────────────────────────────────

/**
 * Recalculates happiness from lastFedTime and updates the hearts display.
 */
async function updateHeartsUI() {
  const heartSpans = document.querySelectorAll(".hearts span");
  if (!heartSpans || heartSpans.length === 0) {
    console.warn("No heart elements found.");
    return;
  }

  // Always derive happiness live from lastFedTime for accuracy
  const lastFedTime = await getLocalLastFedTime();
  const happinessPerc = calculateHappinessFromFedTime(lastFedTime);

  // Keep stored happiness in sync with live value
  await setLocalHappiness(happinessPerc);

  const heartValues = calculateHeartValues(happinessPerc);

  heartSpans.forEach((span, i) => {
    const fill = heartValues[i];

    if (fill >= 1) {
      span.style.opacity = "1";
      span.style.filter = "none";
      span.textContent = "❤️";
    } else if (fill <= 0) {
      span.style.opacity = "0.25";
      span.style.filter = "grayscale(100%)";
      span.textContent = "🤍";
    } else {
      // Partial heart — blend opacity and grayscale
      span.style.opacity = String(0.25 + fill * 0.75);
      span.style.filter = `grayscale(${Math.round((1 - fill) * 100)}%)`;
      span.textContent = "❤️";
    }
  });
}

// ── Firestore ─────────────────────────────────────────────────────────────────

/**
 * Save happiness and lastFedTime to Firestore + chrome storage.
 */
async function saveHappinessToFirestore(db, uid, happiness) {
    const ref = db.collection("users").doc(uid);
  
    return ref
      .set(
        {
          happiness:   happiness,
          lastFedTime: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(() => ref.get())           
      .then(async (snap) => {
        if (!snap.exists) return;
        const data = snap.data();
  
        // Convert Firestore Timestamp → ms
        const lastFedTime = data.lastFedTime ? data.lastFedTime.toMillis() : null;
  
        // Sync server timestamp back to local storage
        await setLocalLastFedTime(lastFedTime);
        await setLocalHappiness(happiness);
  
        console.log("Firestore synced. lastFedTime:", new Date(lastFedTime).toLocaleString());
      })
      .catch((e) => console.error("saveHappinessToFirestore failed:", e));
  }

/**
 * Load happiness and lastFedTime from Firestore.
 * Recalculates live happiness from lastFedTime (never trusts stale stored value).
 * Syncs result to chrome storage and updates the UI.
 */
async function loadHappinessFromFirestore(db, uid) {
  return db
    .collection("users")
    .doc(uid)
    .get()
    .then(async (snap) => {
      if (!snap.exists) return;
      const data = snap.data();

      const lastFedTime = data.lastFedTime ? data.lastFedTime.toMillis() : null;
      const happiness   = calculateHappinessFromFedTime(lastFedTime);


      await setLocalHappiness(happiness);
      await setLocalLastFedTime(lastFedTime);

      console.log("Happiness loaded:", happiness, "lastFedTime:", lastFedTime);
    })
    .catch((e) => console.error("loadHappinessFromFirestore failed:", e));
}

// ── Debug helpers (dev only) ──────────────────────────────────────────────────
if (typeof window !== "undefined") {
    window.happinessTest = {
  
      // ── Firestore tests (writes to Firestore + reloads UI) ────────────────
  
      // Set specific happiness value directly in Firestore
      async setHappiness(value) {
        const db = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        await db.collection("users").doc(uid).set(
          { happiness: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        // Reload from Firestore so UI reflects what's actually stored
        await loadHappinessFromFirestore(db, uid);
        await updateHeartsUI();
        console.log("Firestore happiness set to:", value);
      },
  
      // Set lastFedTime to X hours ago in Firestore + recalculate happiness
      async setFedHoursAgo(hours) {
        const db = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        const fakeMs = Date.now() - (hours * 60 * 60 * 1000);
        const fakeTimestamp = firebase.firestore.Timestamp.fromMillis(fakeMs);
        const happiness = calculateHappinessFromFedTime(fakeMs);
        await db.collection("users").doc(uid).set(
          {
            happiness,
            lastFedTime: fakeTimestamp,  // ✅ Firestore Timestamp format
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        await loadHappinessFromFirestore(db, uid);
        await updateHeartsUI();
        console.log(`Firestore: fed ${hours}h ago → happiness: ${happiness}`);
      },
  
      // ── Local-only tests (fast, no Firestore write) ───────────────────────
  
      async fed8hAgo()  { await this._localFake(8);  },
      async fed16hAgo() { await this._localFake(16); },
      async fed24hAgo() { await this._localFake(24); },
      async fedLongAgo(){ await this._localFake(40); },
  
      async fedHoursAgo(hours) { await this._localFake(hours); },
  
      async _localFake(hours) {
        const fakeTime = Date.now() - (hours * 60 * 60 * 1000);
        await setLocalLastFedTime(fakeTime);
        await setLocalHappiness(calculateHappinessFromFedTime(fakeTime));
        await updateHeartsUI();
        console.log(`Local only: fed ${hours}h ago. Happiness:`, await getLocalHappiness());
      },
  
      // Feed now — writes to Firestore
      async feed() {
        const db = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        await feedPet(db, uid);
        console.log("Pet fed! Happiness:", await getLocalHappiness());
      },
  
      // Check current state
      async status() {
        const db = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        const snap = await db.collection("users").doc(uid).get();
        const data = snap.data();
        const lastFedTime = await getLocalLastFedTime();
        console.group("Happiness Status");
        console.log("Firestore happiness:", data?.happiness);
        console.log("Firestore lastFedTime:", data?.lastFedTime?.toDate().toLocaleString() ?? "never");
        console.log("Local lastFedTime:", lastFedTime ? new Date(lastFedTime).toLocaleString() : "never");
        console.log("Local happiness:", await getLocalHappiness());
        console.log("Derived from lastFedTime:", calculateHappinessFromFedTime(lastFedTime));
        console.groupEnd();
      },
  
      // Clear local storage and reload from Firestore
      async reload() {
        const db = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid;
        await loadHappinessFromFirestore(db, uid);
        await updateHeartsUI();
        console.log("Reloaded from Firestore. Happiness:", await getLocalHappiness());
      },
  
      // Wipe local storage only
      async reset() {
        await storageSet({ [HAPPINESS_STORAGE_KEY]: 100, [LAST_FED_KEY]: null });
        await updateHeartsUI();
        console.log("Local storage reset.");
      }
    };
  }