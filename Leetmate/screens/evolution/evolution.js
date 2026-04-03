/**
 * Congratulations / evolution screen — reads payload from sessionStorage (set by Home).
 * Replace UI in this file when you build the real celebration flow.
 */
document.addEventListener("DOMContentLoaded", () => {
  const messageEl = document.getElementById("evolution-message");
  const debugEl = document.getElementById("evolution-debug");
  const continueBtn = document.getElementById("evolution-continue");

  let payload = null;
  try {
    const raw = sessionStorage.getItem("leetmate_evolution_payload");
    if (raw) payload = JSON.parse(raw);
  } catch (_) {}

  if (payload && payload.toStage) {
    if (messageEl) {
      messageEl.textContent = `Your pet evolved from ${payload.fromStage || "?"} to ${payload.toStage}!`;
    }
  } else {
    if (messageEl) {
      messageEl.textContent = "No evolution data (open this screen from Home after a stage change).";
    }
  }

  if (debugEl) {
    debugEl.textContent = payload ? JSON.stringify(payload, null, 2) : "(empty)";
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("leetmate_evolution_payload");
      } catch (_) {}
      window.location.href = chrome.runtime.getURL("screens/home/index.html");
    });
  }
});
