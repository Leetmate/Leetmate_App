// notifications.js

(() => {
  // Default state 
  const defaults = {
    enabled: true,
    mode: "time",         // "time" or "heatlh"
    hour: "12",
    minute: "00",
    period: "AM",         // "AM" or "PM"
    healthThreshold: 3    // full hearts only: 1-5
  };

  // ---- DOM References --------
  const card = document.querySelector(".notifications-card");
  // Reminder toggle
  const reminderToggle = document.getElementById("reminder-mode-toggle");
  // Mode tabs
  const timeTab = document.getElementById("time-tab");
  const healthTab = document.getElementById("health-tab");
  // Panels
  const timePanel = document.getElementById("time-panel");
  const healthPanel = document.getElementById("health-panel");
  // Time inputs
  const hourInput = document.getElementById("hour-input");
  const minuteInput = document.getElementById("minute-input");
  const ampmButtons = Array.from(document.querySelectorAll(".ampm-btn"));
  // Health reminder controls
  const heartsPicker = document.getElementById("health-hearts-picker");
  const heartHitButtons = Array.from(document.querySelectorAll(".heart-hit"));
  const topHeartSpans = Array.from(document.querySelectorAll(".top-heart"));
  const healthValueText = document.getElementById("health-value-text");
  // Save / feedback / navigation
  const saveBtn = document.getElementById("save-btn");
  const feedback = document.getElementById("save-feedback");
  const backBtn = document.getElementById("back-btn");

  // ---- CURRENT STATE --------
  let state = { ...defaults };

  // Clamp heart value into whole 1-5 range 
  function clampThreshold(value) {
    const rounded = Math.round(Number(value) * 2) / 2;
    return Math.max(1, Math.min(5, rounded));
  }

  // Time input (hour) validation
  function sanitizeHour(value) {
    const num = parseInt(String(value).replace(/\D/g, ""), 10);
    if (Number.isNaN(num)) return "";
    return String(Math.max(1, Math.min(12, num))).padStart(2, "0");
  }

    // Time input (min) validation
  function sanitizeMinute(value) {
    const num = parseInt(String(value).replace(/\D/g, ""), 10);
    if (Number.isNaN(num)) return "";
    return String(Math.max(0, Math.min(59, num))).padStart(2, "0");
  }

  // Format time inputs into "HH:MM"
  function formatTimeString() {
    const hour = sanitizeHour(state.hour) || "12";
    const minute = sanitizeMinute(state.minute) || "00";
    return `${hour}:${minute}`;
  }

  // Validate currently typed time fields 
  function isValidTimeInput() {
    const hour = hourInput?.value.trim() || "";
    const minute = minuteInput?.value.trim() || "";
    return (
      hour !== "" &&
      minute !== "" &&
      !Number.isNaN(Number(hour)) &&
      !Number.isNaN(Number(minute)) &&
      Number(hour) >= 1 &&
      Number(hour) <= 12 &&
      Number(minute) >= 0 &&
      Number(minute) <= 59
    );
  }

  // ---- UI UPDATE FUNCTIONS --------
  function updateHeartsUI() {
    topHeartSpans.forEach((heart, index) => {
      heart.classList.toggle("is-active", index < state.healthThreshold);
    });
    heartsPicker.setAttribute("aria-valuenow", String(state.healthThreshold));
    healthValueText.textContent = `Notify me at ${state.healthThreshold} ${state.healthThreshold === 1 ? "heart" : "hearts"}`;
  }

  // Update reminder toggle UI and blur state 
  // Firestore - enabled = true -> clear  |   enable = false -> blur 
  function updateToggleUI() {
    if (reminderToggle) {
      reminderToggle.checked = state.enabled;
      reminderToggle.setAttribute("aria-pressed", String(state.enabled));
    }
    card.classList.toggle("reminders-off", !state.enabled);
  }

  // Show correct panel for selected reminder mode 
  function updateModeUI() {
    const isTime = state.mode === "time";
    timeTab.classList.toggle("is-active", isTime);
    healthTab.classList.toggle("is-active", !isTime);
    timePanel.classList.toggle("hidden", !isTime);
    healthPanel.classList.toggle("hidden", isTime);
  }

  // Highlight the selected AM / PM button
  function updatePeriodUI() {
    ampmButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.period === state.period);
    });
  }

  // Push current state values into visible form 
  function syncFormUI() {
    if (hourInput) hourInput.value = sanitizeHour(state.hour);
    if (minuteInput) minuteInput.value = sanitizeMinute(state.minute);
    updatePeriodUI();
    updateModeUI();
    updateToggleUI();
    updateHeartsUI();
  }

  // ---- FEEDBACK HELPERS --------
  function showSuccess() {
    feedback.textContent = "Notification set!";
    feedback.classList.remove("error");
    feedback.classList.add("show");

    setTimeout(() => {
      feedback.classList.remove("show");
    }, 1200);
  }

  function showError() {
    feedback.textContent = "Please set a reminder first.";
    feedback.classList.remove("show");
    feedback.classList.add("error");
    void feedback.offsetWidth;
    feedback.classList.add("show");

    setTimeout(() => {
      feedback.classList.remove("show", "error");
    }, 1200);
  }

  // ---- LOCAL STORAGE --------
  // Save notification settings locally in chrome.storage 
  function persistSettingsLocal() {
    chrome.storage.local.set({
      leetmate_notifications_enabled: state.enabled,
      leetmate_notification_mode: state.mode,
      leetmate_notification_time: {
        hour: sanitizeHour(state.hour) || "12",
        minute: sanitizeMinute(state.minute) || "00",
        period: state.period
      },
      leetmate_health_notification_threshold: state.healthThreshold
    });
  }

  // ---- FIREBASE / FIRESTORE HELPERS --------
  function getCurrentUser() {
    return new Promise((resolve) => {
      if (firebase?.auth?.().currentUser) {
        resolve(firebase.auth().currentUser);
        return;
      }
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user || null);
      });
    });
  }

  // Save toggle state (enable=true / enable=false) to Firestore immediately on change
  async function updateReminderEnabledInFirestore() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const db = firebase.firestore();
      await db.collection("users").doc(user.uid).set({
          settings: {
            reminders: {
              enabled: state.enabled
            }
          }
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to update settings.reminders.enabled:", error);
    }
  }

  // Save full reminder state to Firestore when press 'Save' button
  async function saveReminderSettingsToFirestore() {
    try {
      const health_percent = (state.healthThreshold / 5) * 100;
      const user = await getCurrentUser();
      if (!user) return;

      const db = firebase.firestore();
      await db.collection("users").doc(user.uid).set({
          settings: {
            reminders: {
              enabled: state.enabled,
              type: state.mode,
              setTime: formatTimeString(),
              setHealth: health_percent
            }
          }
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to save reminder settings:", error);
    }
  }

  // Load reminder settings from Firestore first (init) 
  async function loadSettings() {
    try {
      const user = await getCurrentUser();

      if (user) {
        const db = firebase.firestore();
        const doc = await db.collection("users").doc(user.uid).get();

        if (doc.exists) {
          const data = doc.data();
          const reminders = data?.settings?.reminders;

          if (reminders && typeof reminders === "object") {
            if (typeof reminders.enabled === "boolean") {
              state.enabled = reminders.enabled;
            }

            if (reminders.type === "time" || reminders.type === "health") {
              state.mode = reminders.type;
            }

            if (typeof reminders.setTime === "string" && reminders.setTime.includes(":")) {
              const [hour, minute] = reminders.setTime.split(":");
              if (hour) state.hour = sanitizeHour(hour) || defaults.hour;
              if (minute) state.minute = sanitizeMinute(minute) || defaults.minute;
            }

            // Convert from Firestore health percent to 1-5 full-heart value 
            if (typeof reminders.setHealth === "number") {
              state.healthThreshold = clampThreshold(reminders.setHealth);
            }
          }
        }
      } else {
        // Logged-out / fallback path: load from local storage
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          const saved = result[STORAGE_KEY];
          if (saved && typeof saved === "object") {
            state = {
              ...defaults,
              ...saved,
              healthThreshold: clampThreshold(saved.healthThreshold ?? defaults.healthThreshold)
            };
          }
          syncFormUI();
        });
        return;
      }
    } catch (error) {
      console.error("Failed to load reminder settings:", error);
    }
    syncFormUI();
  }


  // ---- EVENT HANDLERS --------
  // Reminder toggle to update page blur state 
  reminderToggle?.addEventListener("change", async () => {
    state.enabled = reminderToggle.checked;
    updateToggleUI();
    persistSettingsLocal();
    await updateReminderEnabledInFirestore();
  });

  // Mode tab switching
  timeTab?.addEventListener("click", () => {
    state.mode = "time";
    updateModeUI();
  });
  healthTab?.addEventListener("click", () => {
    state.mode = "health";
    updateModeUI();
  });

  // Time input (hour) validation + auto-jump to min when full
  hourInput?.addEventListener("input", () => {
    hourInput.value = hourInput.value.replace(/\D/g, "").slice(0, 2);
    state.hour = hourInput.value;
    if (hourInput.value.length === 2) {
      minuteInput?.focus();
    }
  });
  // Time input (min) validation
  minuteInput?.addEventListener("input", () => {
    minuteInput.value = minuteInput.value.replace(/\D/g, "").slice(0, 2);
    state.minute = minuteInput.value;
  });

  // On blur, normalize hour/min into save values
  hourInput?.addEventListener("blur", () => {
    hourInput.value = sanitizeHour(hourInput.value);
    state.hour = hourInput.value || defaults.hour;
  });
  minuteInput?.addEventListener("blur", () => {
    minuteInput.value = sanitizeMinute(minuteInput.value);
    state.minute = minuteInput.value || defaults.minute;
  });

  // AM / PM button clicks 
  ampmButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.period = button.dataset.period;
      updatePeriodUI();
    });
  });

  // Heart clicks -> selecting one heart fills that heart & all prev hearts
  heartHitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.healthThreshold = Number(button.dataset.value);
      updateHeartsUI();
    });
  });

  // Keyboard support for heart selection (arrows) 
  heartsPicker?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      state.healthThreshold = clampThreshold(state.healthThreshold - 1);
      updateHeartsUI();
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      state.healthThreshold = clampThreshold(state.healthThreshold + 1);
      updateHeartsUI();
    }
  });

  // Save button: validates time, normalizes inputs, saves locally, saves to Firestore, shows feedback
  saveBtn?.addEventListener("click", async () => {
    if (state.mode === "time" && !isValidTimeInput()) {
      showError();
      return;
    }
    if (state.mode === "time") {
      state.hour = sanitizeHour(hourInput?.value || "") || defaults.hour;
      state.minute = sanitizeMinute(minuteInput?.value || "") || defaults.minute;
      if (hourInput) hourInput.value = state.hour;
      if (minuteInput) minuteInput.value = state.minute;
    }
    persistSettingsLocal();
    await saveReminderSettingsToFirestore();
    showSuccess();
  });

  // Back button navigation
  backBtn?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "../settings-main/index.html";
    }
  });

  // ---- INIT --------
  loadSettings();

})();