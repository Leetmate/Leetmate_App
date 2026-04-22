function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
  
function storageSet(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

async function clearAppStorage() {
    await storageSet({
      leetmate_coins:               0,
      leetmate_xp:                  0,
      leetmate_level:               1,
      leetmate_streak:              0,
      leetmate_last_streak_date:    null,
      leetmate_streak_freeze_start: null,
      leetmate_streak_freeze_end:   null,
      leetmate_happiness:           100,
      leetmate_easy_mode:           false,
      leetmate_happiness_easy_snapshot: null,
      leetmate_last_fed:            null,
      leetmate_last_progress_date:  null,
      leetcode_pending_submissions: [],
      leetcodeStartedAt:            0,
      leetcodeWaiting:              false,
      leetmate_pet_age_pending_firestore_sync: false,
      leetmate_pet_age_last_rollover: null,
      leetmate_evolution_queue: [],
    });
    console.log("App storage cleared.");
  }