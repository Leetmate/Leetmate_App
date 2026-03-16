/**
 * happinessDecay.js
 * Happiness is calculated from the last time the pet was fed.
 * Decays gradually and continuously — 20% per 8 hours (100% over 40 hours).
 * Full happiness (100%) resets when pet is fed.
 *
 * ── Single source of truth ────────────────────────────────────────────────────
 * lastFedTime is the ONLY persisted value that matters.
 * Happiness is ALWAYS derived from it on the fly — never stored as a snapshot.
 *
 * This means Firestore and local can never drift:
 *   currentHappiness = calculateHappinessFromFedTime(lastFedTime)
 *
 * The decay timer only refreshes the UI each minute — it does NOT write to
 * Chrome storage or Firestore. Writes only happen on feed.
 *
 * Chrome storage keys:
 *   leetmate_last_fed    – timestamp (ms) of last feed  ← source of truth
 *   leetmate_happiness   – derived cache, written on feed/load only (for fast reads)
 *
 * Firestore fields (on users/{uid}):
 *   lastFedTime          – timestamp (ms) of last feed  ← source of truth
 *   happiness            – derived cache, written on feed only (for quick reads)
 */

const HAPPINESS_STORAGE_KEY = "leetmate_happiness";
const LAST_FED_KEY          = "leetmate_last_fed";
const DECAY_INTERVAL_MS     = 8 * 60 * 60 * 1000; // 8 hours
const TOTAL_HEARTS          = 5;

// ── Core formula ─────────────────────────────────────────────────────────────

/**
 * Translates a happiness percentage (0–100) into an array of 5 fill values.
 * Each heart = 20% of total happiness. Values are continuous (gradual decay).
 *
 * Returns array of 5 numbers (0 to 1):
 *   1.0 = full, 0.0 = empty, 0.x = partial
 *
 * calculateHeartValues(100)  → [1,    1,    1,    1,    1   ]
 * calculateHeartValues(90)   → [1,    1,    1,    1,    0.5 ]
 * calculateHeartValues(82.5) → [1,    1,    1,    1,    0.125]
 * calculateHeartValues(55)   → [1,    1,    0.75, 0,    0   ]
 * calculateHeartValues(0)    → [0,    0,    0,    0,    0   ]
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
 * Decays continuously — 20% per 8 hours (100% over 40 hours).
 * Returns 100 if never fed (fresh pet = full happiness).
 */
function calculateHappinessFromFedTime(lastFedTime) {
  if (!lastFedTime) return 100;

  const elapsed     = Date.now() - lastFedTime;
  const decayAmount = (elapsed / DECAY_INTERVAL_MS) * 20; // continuous, not stepped

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

// ── Decay timer ───────────────────────────────────────────────────────────────

let _decayTimerInterval = null;

/**
 * Starts a 1-minute interval that recalculates happiness from lastFedTime
 * and refreshes the hearts UI. Does NOT write to storage or Firestore —
 * lastFedTime is the source of truth, so no writes are needed between feeds.
 *
 * Call once after auth. Safe to call again — clears any previous timer first.
 */
function startHappinessDecayTimer() {
  if (_decayTimerInterval) clearInterval(_decayTimerInterval);

  _decayTimerInterval = setInterval(async () => {
    await updateHeartsUI();
  }, 60 * 1000); // every 1 minute

  console.log("Happiness decay timer started.");
}

// ── Feed the pet ──────────────────────────────────────────────────────────────

/**
 * Call this when the user feeds their pet.
 * Resets happiness to 100, records the current time, and restarts the decay timer.
 */
async function feedPet(db, uid) {
  await setLocalLastFedTime(Date.now());
  await setLocalHappiness(100);
  await updateHeartsUI();

  // Save to Firestore and sync the authoritative server timestamp back
  await saveHappinessToFirestore(db, uid, 100);

  // Refresh UI with the accurate server timestamp
  await updateHeartsUI();

  // Restart decay timer from this new feed time
  startHappinessDecayTimer();

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
 * Derives happiness live from lastFedTime and updates the hearts display.
 * Does NOT write happiness to storage — reads lastFedTime, computes on the fly.
 */
async function updateHeartsUI() {
  const heartSpans = document.querySelectorAll(".hearts span");
  if (!heartSpans || heartSpans.length === 0) {
    console.warn("No heart elements found.");
    return;
  }

  const lastFedTime   = await getLocalLastFedTime();
  const happinessPerc = calculateHappinessFromFedTime(lastFedTime);
  const heartValues   = calculateHeartValues(happinessPerc);

  heartSpans.forEach((span, i) => {
    const fill = heartValues[i];

    if (fill >= 1) {
      span.style.opacity = "1";
      span.style.filter  = "none";
      span.textContent   = "❤️";
    } else if (fill <= 0) {
      span.style.opacity = "0.25";
      span.style.filter  = "grayscale(100%)";
      span.textContent   = "🤍";
    } else {
      // Partial heart — blend opacity and grayscale
      span.style.opacity = String(0.25 + fill * 0.75);
      span.style.filter  = `grayscale(${Math.round((1 - fill) * 100)}%)`;
      span.textContent   = "❤️";
    }
  });
}

// ── Firestore ─────────────────────────────────────────────────────────────────

/**
 * On feed: writes lastFedTime (as server timestamp) and happiness snapshot to
 * Firestore, then reads the server timestamp back and stores it locally.
 * The happiness field here is only a convenience snapshot — never read on load.
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

      // Store the authoritative server timestamp locally
      const lastFedTime = data.lastFedTime ? data.lastFedTime.toMillis() : null;
      await setLocalLastFedTime(lastFedTime);
      // Derive happiness from the server timestamp (may differ slightly from 100
      // if there was a round-trip delay, but will be accurate)
      await setLocalHappiness(calculateHappinessFromFedTime(lastFedTime));

      console.log("Firestore synced. lastFedTime:", new Date(lastFedTime).toLocaleString());
    })
    .catch((e) => console.error("saveHappinessToFirestore failed:", e));
}

/**
 * On load: reads lastFedTime from Firestore, derives happiness from it,
 * and syncs both to Chrome storage. Never trusts the stored happiness field.
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

      await setLocalLastFedTime(lastFedTime);
      await setLocalHappiness(happiness);

      console.log("Happiness loaded:", happiness.toFixed(1) + "%", "lastFedTime:", lastFedTime ? new Date(lastFedTime).toLocaleString() : "never");
    })
    .catch((e) => console.error("loadHappinessFromFirestore failed:", e));
}