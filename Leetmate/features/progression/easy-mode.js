/**
 * Easy mode (Settings toggle)
 *
 * ON:  chrome.storage leetmate_easy_mode = true, freeze the current displayed happiness locally
 *     + savedHappiness in Firestore,
 *     stop the happiness decay interval when that API exists (Home).
 * OFF: read Firestore savedHappiness (easy-on snapshot), set lastFedTime = now and
 *     write that frozen happiness locally and in Firestore, clear savedHappiness, restart timer on Home.
 *
 * Depends on happiness-decay.js (before this script): window.LeetmateHappinessDecay.
 */
(function () {
  "use strict";

  var EASY_MODE_KEY = "leetmate_easy_mode";
  var LAST_FED_KEY = "leetmate_last_fed";
  var HAPPINESS_KEY = "leetmate_happiness";
  var EASY_SNAPSHOT_KEY = "leetmate_happiness_easy_snapshot";

  var api = window.LeetmateHappinessDecay; // using functions from happiness-decay.js
  
  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  /**
   * Easy mode freezes whatever the user is currently seeing, not just the raw
   * persisted happiness snapshot.
   */
  async function getHappinessPercentForSnapshot() {
    var store = await storageGet([LAST_FED_KEY, HAPPINESS_KEY, "activePetSnapshot"]);
    return Math.max(
      0,
      Math.min(
        100,
        api.calculateDisplayHappiness(
          store[HAPPINESS_KEY] ?? 100,
          store[LAST_FED_KEY] || null,
          Date.now(),
          store.activePetSnapshot?.createdTimestampMs || null
        )
      )
    );
  }

  async function syncEasyModeToFirestore(enabled, savedHappinessPercent) {
    if (!hasFirebase()) return;
    var user = firebase.auth().currentUser;
    if (!user) return;

    var ref = firebase.firestore().collection("users").doc(user.uid);
    var patch = {
      settings: { easyMode: enabled },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (enabled && typeof savedHappinessPercent === "number") {
      patch.savedHappiness = savedHappinessPercent;
    } else if (!enabled) {
      patch.savedHappiness = null;
    }

    await ref.set(patch, { merge: true });
  }

  /** @returns {Promise<number|null>} clamped 0–100 or null if missing / invalid */
  async function readSavedHappinessFromFirestore(uid) {
    var snap = await firebase.firestore().collection("users").doc(uid).get();
    if (!snap.exists) return null;
    var v = snap.data().savedHappiness;
    if (v == null) return null;
    if (typeof v === "number" && Number.isFinite(v)) {
      return Math.max(0, Math.min(100, v));
    }
    var p = parseFloat(v);
    return Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
  }

  async function applyEasyModeOn() {
    var H = await getHappinessPercentForSnapshot();

    await storageSet({
      [EASY_MODE_KEY]: true,
      [HAPPINESS_KEY]: H,
      [EASY_SNAPSHOT_KEY]: H,
    });

    if (typeof stopHappinessDecayTimer === "function") {
      stopHappinessDecayTimer();
    }
    if (typeof updateHeartsUI === "function") {
      await updateHeartsUI();
    }

    await syncEasyModeToFirestore(true, H);
  }

  async function applyEasyModeOff() {
    var user = hasFirebase() ? firebase.auth().currentUser : null;
    var local = await storageGet([EASY_SNAPSHOT_KEY, HAPPINESS_KEY]);

    var fromCloud = null;
    if (user) {
      try {
        fromCloud = await readSavedHappinessFromFirestore(user.uid);
      } catch (e) {
        console.warn("easy-mode: could not read savedHappiness from Firestore", e);
      }
    }

    var H;
    if (fromCloud != null) {
      H = fromCloud;
    } else {
      var raw =
        local[EASY_SNAPSHOT_KEY] != null
          ? local[EASY_SNAPSHOT_KEY]
          : local[HAPPINESS_KEY];
      H =
        typeof raw === "number" && Number.isFinite(raw) ? raw : parseFloat(raw);
      if (!Number.isFinite(H)) H = 100;
      H = Math.max(0, Math.min(100, H));
    }

    var newLastFed = Date.now();

    await storageSet({
      [EASY_MODE_KEY]: false,
      [LAST_FED_KEY]: newLastFed,
      [HAPPINESS_KEY]: H,
    });
    await storageRemove([EASY_SNAPSHOT_KEY]);

    if (user) {
      await firebase.firestore().collection("users").doc(user.uid).set(
        {
          settings: { easyMode: false },
          savedHappiness: null,
          lastFedTime: new Date(newLastFed),
          happiness: H,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    if (typeof startHappinessDecayTimer === "function") {
      await startHappinessDecayTimer();
    } else if (typeof updateHeartsUI === "function") {
      await updateHeartsUI();
    }
  }

  function initEasyModeToggle() {
    var toggle = document.getElementById("easy-mode-toggle");
    if (!toggle) return;

    storageGet([EASY_MODE_KEY]).then(function (stored) {
      toggle.checked = !!stored[EASY_MODE_KEY];
    });

    toggle.addEventListener("change", async function () {
      var wantOn = toggle.checked;
      toggle.disabled = true;
      try {
        if (wantOn) await applyEasyModeOn();
        else await applyEasyModeOff();
      } catch (e) {
        console.error("Easy mode update failed:", e);
        toggle.checked = !wantOn;
      } finally {
        toggle.disabled = false;
      }
    });
  }

  window.LeetmateEasyMode = {
    EASY_MODE_KEY: EASY_MODE_KEY,
    EASY_SNAPSHOT_KEY: EASY_SNAPSHOT_KEY,
    initEasyModeToggle: initEasyModeToggle,
    applyEasyModeOn: applyEasyModeOn,
    applyEasyModeOff: applyEasyModeOff,
    syncEasyModeToFirestore: syncEasyModeToFirestore,
  };
})();
