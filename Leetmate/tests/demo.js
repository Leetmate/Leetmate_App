(function () {
  "use strict";

  const CLAIM_FADE_MS = 460;
  const CURRENT_STREAK_COUNT = 7;
  const OLD_STREAK_DAYS = [5, 6, 7, 8, 9, 10, 11];
  const CURRENT_STREAK_DAYS = [16, 17, 18, 19, 20, 21, 22];
  const LAST_FED_KEY = "leetmate_last_fed";
  const PROGRESS_SEGMENT_CLASSES = [
    "progress-connect-left",
    "progress-connect-right",
    "progress-run-single",
    "progress-run-start",
    "progress-run-end",
    "progress-run-mid",
  ];

  let domSnapshot = null;
  let demoState = null;

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

  async function refreshHomePet(db, uid) {
    if (typeof window.loadActivePetFromFirestore === "function") {
      await window.loadActivePetFromFirestore(db, uid);
    }
  }

  async function refreshHearts(db, uid) {
    if (typeof window.loadHappinessFromFirestore === "function") {
      await window.loadHappinessFromFirestore(db, uid);
    }
    if (typeof window.updateHeartsUI === "function") {
      await window.updateHeartsUI();
    }
  }

  function shouldReloadForCurrentPage() {
    const path = String(window.location.pathname || "").toLowerCase();
    return path.includes("/playground-food/") || path.includes("/playground-items/");
  }

  function requireElement(id, label) {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`demo: missing ${label || id} on this page.`);
    }
    return el;
  }

  function getGrid() {
    return requireElement("activityCalendarGrid", "activity calendar grid");
  }

  function getStreakCountEl() {
    const el = document.querySelector(".activity-streak-count");
    if (!el) {
      throw new Error("demo: missing streak count element on this page.");
    }
    return el;
  }

  function getVisibleCalendarCells() {
    return Array.from(getGrid().querySelectorAll(".calendar-day:not(.is-placeholder)"));
  }

  function getDayNumberFromCell(cell) {
    const value = Number((cell?.textContent || "").trim());
    return Number.isInteger(value) ? value : null;
  }

  function getCellByDay(day) {
    return getVisibleCalendarCells().find((cell) => getDayNumberFromCell(cell) === Number(day)) || null;
  }

  function getMonthLayoutFromDom() {
    const cells = Array.from(getGrid().querySelectorAll(".calendar-day"));
    let leading = 0;
    let daysInMonth = 0;

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell.classList.contains("is-placeholder")) continue;
      const day = getDayNumberFromCell(cell);
      if (day === 1) {
        leading = i;
        break;
      }
    }

    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell.classList.contains("is-placeholder")) continue;
      const day = getDayNumberFromCell(cell);
      if (day && day > daysInMonth) daysInMonth = day;
    }

    return {
      leading,
      daysInMonth,
    };
  }

  function saveSnapshot() {
    if (domSnapshot) return;

    const grid = getGrid();
    const monthLabelEl = requireElement("calendarMonthLabel", "calendar month label");
    const streakCountEl = getStreakCountEl();

    domSnapshot = {
      gridHtml: grid.innerHTML,
      monthLabel: monthLabelEl.textContent,
      streakText: streakCountEl.textContent,
    };
  }

  function restoreSnapshot(options = {}) {
    const { preserveDemoState = false } = options;
    if (!domSnapshot) return false;

    const grid = getGrid();
    const monthLabelEl = requireElement("calendarMonthLabel", "calendar month label");
    const streakCountEl = getStreakCountEl();

    grid.innerHTML = domSnapshot.gridHtml;
    monthLabelEl.textContent = domSnapshot.monthLabel;
    streakCountEl.textContent = domSnapshot.streakText;
    if (!preserveDemoState) {
      demoState = null;
    }
    return true;
  }

  function clearVisualMarkers() {
    getVisibleCalendarCells().forEach((cell) => {
      cell.classList.remove(
        "has-progress",
        "has-progress-muted",
        "has-weekly-reward",
        "weekly-reward-locked",
        "weekly-reward-claimable",
        "weekly-reward-claimed",
        "weekly-reward-claiming",
        "is-today",
        ...PROGRESS_SEGMENT_CLASSES
      );
      cell.removeAttribute("role");
      cell.removeAttribute("tabindex");
      cell.removeAttribute("aria-label");
    });
  }

  function applyProgressSegmentClasses(day, progressSet, activeSet, leading, daysInMonth) {
    const cell = getCellByDay(day);
    if (!cell || !progressSet.has(day)) return;

    cell.classList.add("has-progress");
    const isActive = activeSet.has(day);
    if (!isActive) {
      cell.classList.add("has-progress-muted");
    }

    const pos = leading + day - 1;
    const col = pos % 7;

    let linkLeft = false;
    if (day > 1 && progressSet.has(day - 1) && activeSet.has(day - 1) === isActive && col !== 0) {
      linkLeft = true;
    }

    let linkRight = false;
    if (
      day < daysInMonth &&
      progressSet.has(day + 1) &&
      activeSet.has(day + 1) === isActive &&
      col !== 6
    ) {
      linkRight = true;
    }

    if (linkLeft) cell.classList.add("progress-connect-left");
    if (linkRight) cell.classList.add("progress-connect-right");

    if (!linkLeft && !linkRight) cell.classList.add("progress-run-single");
    else if (!linkLeft && linkRight) cell.classList.add("progress-run-start");
    else if (linkLeft && !linkRight) cell.classList.add("progress-run-end");
    else cell.classList.add("progress-run-mid");
  }

  function showClaimBanner() {
    if (
      typeof window.showWeeklyRewardBanner === "function" &&
      typeof window.formatWeeklyRewardBannerMessage === "function" &&
      typeof window.getWeeklyRewardAmounts === "function"
    ) {
      const amounts = window.getWeeklyRewardAmounts();
      window.showWeeklyRewardBanner(
        window.formatWeeklyRewardBannerMessage(amounts.coinReward, amounts.xpReward)
      );
      return;
    }

    if (typeof window.showWeeklyRewardBanner === "function") {
      window.showWeeklyRewardBanner();
    }
  }

  async function handleClaim(day, cell) {
    if (!demoState || !cell || !demoState.claimableDays.has(day)) return;

    cell.classList.add("weekly-reward-claiming");
    await new Promise((resolve) => window.setTimeout(resolve, CLAIM_FADE_MS));

    demoState.claimableDays.delete(day);
    demoState.claimedDays.add(day);

    // The demo hides the future chest until today's chest is claimed.
    if (day === 22) {
      demoState.lockedDays.add(29);
    }

    showClaimBanner();
    renderScenario();
  }

  function applyRewardState(day, state) {
    const cell = getCellByDay(day);
    if (!cell) return;

    cell.classList.add("has-weekly-reward");

    if (state === "claimed") {
      cell.classList.add("weekly-reward-claimed");
      cell.setAttribute("aria-label", `Weekly reward already claimed for April ${day}`);
      return;
    }

    if (state === "locked") {
      cell.classList.add("weekly-reward-locked");
      cell.setAttribute("aria-label", `Weekly reward locked for April ${day}`);
      return;
    }

    cell.classList.add("weekly-reward-claimable");
    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label", `Claim weekly reward for April ${day}`);

    const claim = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await handleClaim(day, cell);
    };

    cell.addEventListener("click", claim);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        claim(event);
      }
    });
  }

  function renderScenario() {
    if (!demoState) return;

    restoreSnapshot({ preserveDemoState: true });
    saveSnapshot();

    const monthLabelEl = requireElement("calendarMonthLabel", "calendar month label");
    const streakCountEl = getStreakCountEl();
    const { leading, daysInMonth } = getMonthLayoutFromDom();
    const progressSet = new Set([...OLD_STREAK_DAYS, ...CURRENT_STREAK_DAYS]);
    const activeSet = new Set(CURRENT_STREAK_DAYS);

    clearVisualMarkers();
    monthLabelEl.textContent = "April 2026";
    streakCountEl.textContent = String(CURRENT_STREAK_COUNT);

    for (let day = 1; day <= daysInMonth; day += 1) {
      applyProgressSegmentClasses(day, progressSet, activeSet, leading, daysInMonth);
    }

    const todayCell = getCellByDay(22);
    if (todayCell) {
      todayCell.classList.add("is-today");
    }

    demoState.claimedDays.forEach((day) => applyRewardState(day, "claimed"));
    demoState.lockedDays.forEach((day) => applyRewardState(day, "locked"));
    demoState.claimableDays.forEach((day) => applyRewardState(day, "claimable"));
  }

  function ensureAprilView() {
    const requiredDays = [2, 8, 11, 16, 22, 29];
    const missingDay = requiredDays.find((day) => !getCellByDay(day));
    if (missingDay) {
      throw new Error("demo: open the Activity page on April 2026 before running this demo.");
    }
  }

  function activityCalendar() {
    saveSnapshot();
    ensureAprilView();

    demoState = {
      claimableDays: new Set([11, 22]),
      claimedDays: new Set(),
      lockedDays: new Set(),
    };

    renderScenario();
    console.log(
      "demo.activityCalendar: staged April 2026 demo with muted streak 4/2-4/11, active streak 4/16-4/22, and claimable chests on 4/8 and 4/22."
    );
    return true;
  }

  function downed() {
    void (async () => {
      const { db, uid } = await getAuthContext();
      const nowMs = Date.now();

      await db.collection("users").doc(uid).set(
        {
          happiness: 0,
          savedHappiness: 0,
          lastFedTime: firebase.firestore.Timestamp.fromMillis(nowMs),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (typeof storageSet === "function") {
        await storageSet({
          [LAST_FED_KEY]: nowMs,
          leetmate_happiness: 0,
          leetmate_happiness_easy_snapshot: 0,
        });
      }

      await refreshHomePet(db, uid);
      await refreshHearts(db, uid);

      if (shouldReloadForCurrentPage()) {
        window.location.reload();
        return;
      }

      console.log("demo.downed: active pet set to 0 happiness.");
    })().catch((error) => {
      console.error("demo.downed failed:", error);
    });

    return true;
  }

  function stop() {
    const restored = restoreSnapshot();
    console.log(
      restored
        ? "demo.stop: restored the original Activity calendar."
        : "demo.stop: no demo snapshot to restore."
    );
    return restored;
  }

  function help() {
    const usage = {
      start: "demo.activityCalendar()",
      downed: "demo.downed()",
      stop: "demo.stop()",
    };
    console.log("demo commands:", usage);
    return usage;
  }

	async function setHearts(count) {
  const clamped = Math.max(0, Math.min(5, Number(count)));
  const happiness = clamped * 20;

  if (typeof storageSet === "function") {
    await storageSet({
      leetmate_happiness: happiness,
      leetmate_happiness_easy_snapshot: happiness,
    });
  } else {
    await chrome.storage.local.set({
      leetmate_happiness: happiness,
      leetmate_happiness_easy_snapshot: happiness,
    });
  }

  if (typeof window.updateHeartsUI === "function") {
    await window.updateHeartsUI();
  }

  chrome.runtime.sendMessage({ action: "startTimer" });

  console.log(`demo.setHearts: set to ${clamped} hearts (${happiness}%)`);
  return true;
}

  window.demo = {
    activityCalendar,
    downed,
    stop,
    help,
		setHearts,
  };
})();
