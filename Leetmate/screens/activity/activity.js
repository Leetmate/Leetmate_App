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

  function renderMonth(viewMonth) {
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

      calendarGridEl.appendChild(dayCell);
    }
  }

  function setupNavigation(months, startIndex) {
    const state = { index: startIndex };

    function update() {
      renderMonth(months[state.index]);
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

  async function initActivityCalendar() {
    const createdAt = await getCreatedAtDate();
    const now = new Date();
    const startMonth = getMonthStart(createdAt || now);
    const endMonth = getMonthStart(addMonths(now, 1));

    const months = [];
    let cursor = new Date(startMonth);
    while (cursor <= endMonth) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    let startIndex = months.length - 2;
    if (startIndex < 0) startIndex = 0;
    setupNavigation(months, startIndex);
    await loadStreakCount();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initActivityCalendar();
  });
})();
