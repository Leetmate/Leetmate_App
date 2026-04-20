/* Activity page base rendering (front-end only) */
(function () {
  "use strict";

  const monthLabelEl = document.getElementById("calendarMonthLabel");
  const calendarGridEl = document.getElementById("activityCalendarGrid");
  const prevBtn = document.getElementById("calendarPrev");
  const nextBtn = document.getElementById("calendarNext");
  const streakCountEl = document.querySelector(".activity-streak-count");

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });

  function toDateKey(date) {
    return date.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
  }

  function parseDateKey(dateKey) {
    if (!dateKey || typeof dateKey !== "string") return null;
    const parts = dateKey.split("-").map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function isDateKeyInRange(dateKey, startKey, endKey) {
    return dateKey >= startKey && dateKey <= endKey;
  }

  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function applyProgressBorder(dayCell, cellDate, progressDateSet) {
    if (!progressDateSet || !(progressDateSet instanceof Set)) return;
    const dateKey = toDateKey(cellDate);
    if (progressDateSet.has(dateKey)) {
      dayCell.classList.add("has-progress");
    }
  }

  function applyFreezeOverlay(dayCell, cellDate, freezeRange) {
    if (!freezeRange || !freezeRange.isActive) return;
    const cellKey = toDateKey(cellDate);
    if (isDateKeyInRange(cellKey, freezeRange.startKey, freezeRange.endKey)) {
      dayCell.classList.add("has-freeze");
    }
  }

  function renderMonth(viewMonth, progressDateSet, freezeRange) {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = firstDay.getDay();
    const today = new Date();

    monthLabelEl.textContent = monthFormatter.format(viewMonth);
    calendarGridEl.innerHTML = "";

    for (let i = 0; i < leading; i += 1) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-day is-placeholder";
      emptyCell.setAttribute("aria-hidden", "true");
      emptyCell.textContent = "0";
      calendarGridEl.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(year, month, day);
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";
      dayCell.setAttribute("role", "gridcell");
      dayCell.setAttribute("aria-label", cellDate.toDateString());
      dayCell.textContent = String(day);

      if (isSameDay(cellDate, today)) {
        dayCell.classList.add("is-today");
      }
      applyProgressBorder(dayCell, cellDate, progressDateSet);
      applyFreezeOverlay(dayCell, cellDate, freezeRange);

      calendarGridEl.appendChild(dayCell);
    }

    const cellsUsed = leading + daysInMonth;
    const weeksRows = 6;
    const totalSlots = 7 * weeksRows;
    for (let i = cellsUsed; i < totalSlots; i += 1) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "calendar-day is-placeholder";
      emptyCell.setAttribute("aria-hidden", "true");
      emptyCell.textContent = "0";
      calendarGridEl.appendChild(emptyCell);
    }
  }

  function setupNavigation(months, startIndex, progressDateSet, freezeRange) {
    const state = { index: startIndex };

    function update() {
      renderMonth(months[state.index], progressDateSet, freezeRange);
      prevBtn.disabled = state.index === 0;
      nextBtn.disabled = state.index === months.length - 1;
    }

    prevBtn.addEventListener("click", () => {
      if (state.index > 0) {
        state.index -= 1;
        update();
      }
    });

    nextBtn.addEventListener("click", () => {
      if (state.index < months.length - 1) {
        state.index += 1;
        update();
      }
    });

    update();
  }

  async function getCreatedAtDate() {
    try {
      if (typeof storageGet !== "function") return null;
      const { uid } = await storageGet("uid");
      if (!uid || !window.firebase || !firebase.firestore) return null;

      const db = firebase.firestore();
      const snap = await db.collection("users").doc(uid).get();
      if (!snap.exists) return null;

      const data = snap.data() || {};
      const createdAt = data.createdAt;
      if (!createdAt) return null;

      if (typeof createdAt.toDate === "function") {
        return createdAt.toDate();
      }

      const parsed = new Date(createdAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      console.warn("Activity: failed to load account creation date.", error);
      return null;
    }
  }

  async function loadStreakCount() {
    try {
      if (typeof storageGet !== "function" || !streakCountEl) return;
      const { leetmate_streak } = await storageGet("leetmate_streak");
      streakCountEl.textContent = String(leetmate_streak ?? 0);
    } catch (error) {
      console.warn("Activity: failed to load streak count.", error);
    }
  }

  async function loadProgressDateSet(startMonth, endMonth) {
    try {
      if (typeof storageGet !== "function") return new Set();
      if (!window.firebase || !firebase.firestore) return new Set();

      const { uid } = await storageGet("uid");
      if (!uid) return new Set();

      const startKey = toDateKey(new Date(startMonth.getFullYear(), startMonth.getMonth(), 1));
      const endKey = toDateKey(new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0));
      const db = firebase.firestore();
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("leetcodeProgress");

      const snap = await ref
        .where(firebase.firestore.FieldPath.documentId(), ">=", startKey)
        .where(firebase.firestore.FieldPath.documentId(), "<=", endKey)
        .get();

      return new Set(snap.docs.map((doc) => doc.id));
    } catch (error) {
      console.warn("Activity: failed to load progress dates.", error);
      return new Set();
    }
  }

  async function loadStreakFreezeRange() {
    try {
      if (typeof storageGet !== "function") return null;
      if (!window.firebase || !firebase.firestore) return null;

      const { uid } = await storageGet("uid");
      if (!uid) return null;

      const db = firebase.firestore();
      const snap = await db.collection("users").doc(uid).get();
      if (!snap.exists) return null;

      const data = snap.data() || {};
      const freezeEndRaw = data.streakFreezeEnd;
      if (!freezeEndRaw || typeof freezeEndRaw !== "string") return null;

      const todayKey = toDateKey(new Date());
      if (!parseDateKey(freezeEndRaw)) return null;

      // Only show freeze icons when freeze is active today.
      if (freezeEndRaw < todayKey) return null;

      return {
        isActive: true,
        startKey: todayKey,
        endKey: freezeEndRaw,
      };
    } catch (error) {
      console.warn("Activity: failed to load streak freeze range.", error);
      return null;
    }
  }

  async function initActivityCalendar() {
    const createdAt = await getCreatedAtDate();
    const now = new Date();
    const startMonth = getMonthStart(createdAt || now);
    const endMonth = getMonthStart(addMonths(now, 1));
    const progressDateSet = await loadProgressDateSet(startMonth, endMonth);
    const freezeRange = await loadStreakFreezeRange();

    const months = [];
    let cursor = new Date(startMonth);
    while (cursor <= endMonth) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    let startIndex = months.length - 2;
    if (startIndex < 0) startIndex = 0;
    setupNavigation(months, startIndex, progressDateSet, freezeRange);
    await loadStreakCount();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initActivityCalendar();
  });
})();
