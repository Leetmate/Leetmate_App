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
const EASY_MODE_KEY         = "leetmate_easy_mode";
const EASY_HAPPINESS_SNAPSHOT_KEY = "leetmate_happiness_easy_snapshot";
const DECAY_INTERVAL_MS     = 8 * 60 * 60 * 1000; // 8 hours
const TOTAL_HEARTS          = 5;
let heartPercent = 100; 

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

function calculateDisplayHappiness(baseHappiness, lastFedTime, referenceTimeMs = Date.now(), fallbackStartTime = null) {
  const base = Math.max(0, Math.min(100, Number(baseHappiness)));
  const startTime = lastFedTime || fallbackStartTime;
  if (!startTime) return base;

  const elapsed = Math.max(0, referenceTimeMs - startTime);
  const decayAmount = (elapsed / DECAY_INTERVAL_MS) * 20;
  return Math.max(0, base - decayAmount);
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

async function getActivePetCreationTime() {
  const { activePetSnapshot } = await storageGet(['activePetSnapshot']);
  return activePetSnapshot?.createdTimestampMs ?? null;
}

async function getCurrentDisplayHappiness() {
  const [baseHappiness, lastFedTime, petCreatedAt] = await Promise.all([
    getLocalHappiness(),
    getLocalLastFedTime(),
    getActivePetCreationTime(),
  ]);

  return calculateDisplayHappiness(baseHappiness, lastFedTime, Date.now(), petCreatedAt);
}

// ── Decay timer ───────────────────────────────────────────────────────────────

let _decayTimerInterval = null;

/**
 * Stops the periodic happiness UI refresh (used when Easy mode is on).
 */
function stopHappinessDecayTimer() {
  if (_decayTimerInterval) {
    clearInterval(_decayTimerInterval);
    _decayTimerInterval = null;
  }
}

/**
 * Starts a 1-minute interval that recalculates happiness from lastFedTime
 * and refreshes the hearts UI. Does NOT write to storage or Firestore —
 * lastFedTime is the source of truth, so no writes are needed between feeds.
 *
 * Call once after auth. Safe to call again — clears any previous timer first.
 * If Easy mode is on, refreshes once and does not start an interval (decay paused).
 */
async function startHappinessDecayTimer() {
  stopHappinessDecayTimer();
  await updateHeartsUI(); // immediate refresh now

  const { [EASY_MODE_KEY]: easyOn } = await storageGet([EASY_MODE_KEY]);
  if (easyOn) {
    console.log("Happiness decay paused (Easy mode).");
    return;
  }

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
async function feedPet(db, uid, regenPercent = 15) {
  const currHappiness = await getCurrentDisplayHappiness();

  // Add food regen, cap at 100
  const newHappiness = Math.min(100, currHappiness + regenPercent);

  const newLastFedTime = Date.now();

  // Save locally first so UI updates immediately
  await setLocalLastFedTime(newLastFedTime);
  await setLocalHappiness(newHappiness);

  const easyStore = await storageGet([EASY_MODE_KEY]);
  if (easyStore[EASY_MODE_KEY]) {
    await storageSet({ [EASY_HAPPINESS_SNAPSHOT_KEY]: newHappiness });
  }

  await updateHeartsUI();

  // Save the real feed timestamp to Firestore
  await saveHappinessToFirestore(db, uid, newHappiness, newLastFedTime);

  console.log("Pet fed! Happiness now:", newHappiness.toFixed(1) + "%");
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
  const easyFlags = await storageGet([
    EASY_MODE_KEY,
    EASY_HAPPINESS_SNAPSHOT_KEY,
    HAPPINESS_STORAGE_KEY,
  ]);

  let happinessPerc;
  if (easyFlags[EASY_MODE_KEY]) {
    const snap = easyFlags[EASY_HAPPINESS_SNAPSHOT_KEY];
    const cached = easyFlags[HAPPINESS_STORAGE_KEY];
    const raw = snap != null ? snap : cached;
    happinessPerc =
      typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
    if (!Number.isFinite(happinessPerc)) happinessPerc = 100;
  } else {
    happinessPerc = await getCurrentDisplayHappiness();
  }

  // Store how many FULL hearts we had before update 
  // e.g. heartPercent = 100 -> prevWhole = 5 
  const prevWhole = Math.floor(heartPercent / 20);

  // Keep hearts percentage between 0-100 
  heartPercent = Math.max(0, Math.min(100, happinessPerc));

  const hearts = document.querySelectorAll(".hearts-full span img");
  // Convert percentage to heart value
  // e.g. 73% = 3.65 hearts 
  const heartValue = heartPercent / 20;

  hearts.forEach((heart, i) => {
      // Determine how much each heart should be filled 
      // e.g. heartValue = 3.65
      // heart 0-3 = 1  -> full
      // heart 4 = 0.65 -> partial
      // heart 5 = 0 -> empty 
      const fill = Math.max(0, Math.min(1, heartValue - i));
      // Clip percentage of top (full heart) from right  
      heart.style.clipPath = `inset(0 ${(1-fill)*100}% 0 0)`;
  });

  const newWhole = Math.floor(heartPercent / 20);

  // Heart Loss Animation 
  if (newWhole < prevWhole) {
      for (let i = newWhole; i < prevWhole; i++) {
          hearts[i]?.classList.add("heart-break");
          setTimeout(()=>hearts[i]?.classList.remove("heart-break"),400);
      }
  }

  // Heart Gain Animation 
  if (newWhole > prevWhole) {
      for (let i = prevWhole; i < newWhole; i++) {
          hearts[i]?.classList.add("heart-gain");
          setTimeout(()=>hearts[i]?.classList.remove("heart-gain"),400);
      }
  }

  updatePetState();
}

// Change to Fainted Pet when below 0 hearts 
function updatePetState() {
  if (window.LeetmatePetUI && typeof window.LeetmatePetUI.setPetHappinessState === "function") {
      window.LeetmatePetUI.setPetHappinessState(heartPercent);
  }
}


// ── Firestore ─────────────────────────────────────────────────────────────────

/**
 * On feed: writes lastFedTime (as server timestamp) and happiness snapshot to
 * Firestore, then reads the server timestamp back and stores it locally.
 * The happiness field here is only a convenience snapshot — never read on load.
 */
async function saveHappinessToFirestore(db, uid, happiness, lastFedTimeMs) {
  const ref = db.collection("users").doc(uid);

  return ref
    .set(
      {
        happiness:   happiness,
        lastFedTime: new Date(lastFedTimeMs),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .then(async () => {
      await setLocalLastFedTime(lastFedTimeMs);
      await setLocalHappiness(happiness);
      await updateHeartsUI();
      console.log("Firestore synced. lastFedTime:", new Date(lastFedTimeMs).toLocaleString());
    })
    .catch((e) => console.error("saveHappinessToFirestore failed:", e));
}

/**
 * On load: reads lastFedTime from Firestore, derives happiness from it,
 * and syncs both to Chrome storage. Never trusts the stored happiness field.
 */
async function loadHappinessFromFirestore(db, uid) {
  const easyFlags = await storageGet([EASY_MODE_KEY]);
  if (easyFlags[EASY_MODE_KEY]) {
    // Easy mode freezes hearts from local snapshot; still merge Firestore savedHappiness when present
    // so edits in console / another client show up after refocus.
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (snap.exists) {
        const v = snap.data().savedHappiness;
        if (v != null) {
          const H =
            typeof v === "number" && Number.isFinite(v)
              ? v
              : parseFloat(v);
          if (Number.isFinite(H)) {
            const clamped = Math.max(0, Math.min(100, H));
            await storageSet({
              [HAPPINESS_STORAGE_KEY]: clamped,
              [EASY_HAPPINESS_SNAPSHOT_KEY]: clamped,
            });
          }
        }
      }
    } catch (e) {
      console.error("loadHappinessFromFirestore (easy mode) failed:", e);
    }
    await updateHeartsUI();
    return;
  }

  return db
    .collection("users")
    .doc(uid)
    .get()
    .then(async (snap) => {
      if (!snap.exists) return;
      const data = snap.data();

      const lastFedTime = data.lastFedTime ? data.lastFedTime.toMillis() : null;

      const happiness = Math.max(0, Math.min(100, Number(data.happiness ?? 100)));

      await setLocalLastFedTime(lastFedTime);
      await setLocalHappiness(happiness);

      await updateHeartsUI();

      console.log("Happiness loaded:", happiness.toFixed(1) + "%", "lastFedTime:", lastFedTime ? new Date(lastFedTime).toLocaleString() : "never");
    })
    .catch((e) => console.error("loadHappinessFromFirestore failed:", e));
}

// Expose decay helpers for other screens (e.g. Settings easy-mode). `const` above is not global.
window.LeetmateHappinessDecay = {
  calculateDisplayHappiness,
  DECAY_INTERVAL_MS,
};
