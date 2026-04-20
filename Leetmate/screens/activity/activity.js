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

  function dateKeyToDate(dateKey) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) return null;
    return new Date(parsed.year, parsed.month - 1, parsed.day);
  }

  function addDaysToDateKey(dateKey, dayDelta) {
    const parsedDate = dateKeyToDate(dateKey);
    if (!parsedDate) return null;
    const shiftedDate = new Date(parsedDate);
    shiftedDate.setDate(shiftedDate.getDate() + dayDelta);
    return toDateKey(shiftedDate);
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

  function applyFreezeOverlay(dayCell, cellDate, freezeDateSet) {
    if (!freezeDateSet || !(freezeDateSet instanceof Set)) return;
    const cellKey = toDateKey(cellDate);
    if (freezeDateSet.has(cellKey)) {
      dayCell.classList.add("has-freeze");
    }
  }

  function renderMonth(viewMonth, progressDateSet, freezeDateSet, weeklyRewardsState, onWeeklyClaim) {
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
      applyFreezeOverlay(dayCell, cellDate, freezeDateSet);
      if (typeof attachWeeklyRewardGift === "function") {
        attachWeeklyRewardGift(
          dayCell,
          toDateKey(cellDate),
          weeklyRewardsState,
          onWeeklyClaim
        );
      }

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

  function setupNavigation(
    months,
    startIndex,
    progressDateSet,
    freezeDateSet,
    weeklyRewardsState,
    onWeeklyClaim
  ) {
    const state = { index: startIndex, weeklyRewardsState };

    function update() {
      renderMonth(
        months[state.index],
        progressDateSet,
        freezeDateSet,
        state.weeklyRewardsState,
        onWeeklyClaim
      );
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
    return {
      setWeeklyRewardsState(nextWeeklyRewardsState) {
        state.weeklyRewardsState = nextWeeklyRewardsState;
      },
      renderCurrentMonth: update,
    };
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

  function buildDateKeyRangeSet(startKey, endKey) {
    if (!startKey || !endKey || startKey > endKey) return new Set();
    const keys = new Set();
    let cursorKey = startKey;
    while (cursorKey && cursorKey <= endKey) {
      keys.add(cursorKey);
      cursorKey = addDaysToDateKey(cursorKey, 1);
    }
    return keys;
  }

  async function loadStreakFreezeDateSet(startMonth, endMonth) {
    try {
      if (typeof storageGet !== "function") return new Set();
      if (!window.firebase || !firebase.firestore) return new Set();

      const { uid } = await storageGet("uid");
      if (!uid) return new Set();

      const db = firebase.firestore();
      const freezeDateSet = new Set();
      const rangeStartKey = toDateKey(new Date(startMonth.getFullYear(), startMonth.getMonth(), 1));
      const rangeEndKey = toDateKey(new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0));
      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) return freezeDateSet;

      const data = userSnap.data() || {};
      const freezeEndRaw = data.streakFreezeEnd;
      if (freezeEndRaw && typeof freezeEndRaw === "string" && parseDateKey(freezeEndRaw)) {
        const todayKey = toDateKey(new Date());
        const freezeStartRaw = data.streakFreezeStart;
        let freezeStartKey = parseDateKey(freezeStartRaw) ? freezeStartRaw : null;

        // Backward compatibility for users without streakFreezeStart persisted yet.
        if (!freezeStartKey) {
          freezeStartKey = freezeEndRaw >= todayKey ? todayKey : addDaysToDateKey(freezeEndRaw, -1);
        }

        if (freezeStartKey && freezeStartKey <= freezeEndRaw) {
          const currentRangeStart = freezeStartKey < rangeStartKey ? rangeStartKey : freezeStartKey;
          const currentRangeEnd = freezeEndRaw > rangeEndKey ? rangeEndKey : freezeEndRaw;
          const currentRangeSet = buildDateKeyRangeSet(currentRangeStart, currentRangeEnd);
          for (const key of currentRangeSet) freezeDateSet.add(key);
        }
      }

      // Fallback history source on user doc when subcollection writes are blocked by rules.
      const usageHistory = Array.isArray(data.streakFreezeUsageHistory)
        ? data.streakFreezeUsageHistory
        : [];
      usageHistory.forEach((usage) => {
        const startDate = usage?.startDate;
        const endDate = usage?.endDate;
        if (!parseDateKey(startDate) || !parseDateKey(endDate)) return;
        if (startDate > endDate) return;
        if (endDate < rangeStartKey || startDate > rangeEndKey) return;

        const overlapStart = startDate < rangeStartKey ? rangeStartKey : startDate;
        const overlapEnd = endDate > rangeEndKey ? rangeEndKey : endDate;
        const usageRange = buildDateKeyRangeSet(overlapStart, overlapEnd);
        for (const key of usageRange) freezeDateSet.add(key);
      });

      // New source of truth for historical freeze usage
      try {
        const usageSnap = await db
          .collection("users")
          .doc(uid)
          .collection("streakFreezeUsage")
          .get();

        usageSnap.forEach((doc) => {
          const usage = doc.data() || {};
          const startDate = usage.startDate;
          const endDate = usage.endDate;
          if (!parseDateKey(startDate) || !parseDateKey(endDate)) return;
          if (startDate > endDate) return;
          if (endDate < rangeStartKey || startDate > rangeEndKey) return;

          const overlapStart = startDate < rangeStartKey ? rangeStartKey : startDate;
          const overlapEnd = endDate > rangeEndKey ? rangeEndKey : endDate;
          const usageRange = buildDateKeyRangeSet(overlapStart, overlapEnd);
          for (const key of usageRange) freezeDateSet.add(key);
        });
      } catch (usageError) {
        console.warn("Activity: unable to read streakFreezeUsage subcollection.", usageError);
      }

      return freezeDateSet;
    } catch (error) {
      console.warn("Activity: failed to load streak freeze dates.", error);
      return new Set();
    }
  }

  async function initActivityCalendar() {
    const createdAt = await getCreatedAtDate();
    const now = new Date();
    const startMonth = getMonthStart(createdAt || now);
    const endMonth = getMonthStart(addMonths(now, 1));
    const progressDateSet = await loadProgressDateSet(startMonth, endMonth);
    const freezeDateSet = await loadStreakFreezeDateSet(startMonth, endMonth);
    const { uid } = typeof storageGet === "function" ? await storageGet("uid") : { uid: null };
    const db = window.firebase && firebase.firestore ? firebase.firestore() : null;
    let weeklyRewardsState = null;

    if (typeof getWeeklyRewardsState === "function" && db && uid) {
      weeklyRewardsState = await getWeeklyRewardsState(db, uid, progressDateSet);
    }

    const months = [];
    let cursor = new Date(startMonth);
    while (cursor <= endMonth) {
      months.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }

    let startIndex = months.length - 2;
    if (startIndex < 0) startIndex = 0;

    let navigationController = null;

    async function onWeeklyClaim(claimDateKey) {
      if (
        !db ||
        !uid ||
        !weeklyRewardsState ||
        typeof claimWeeklyReward !== "function"
      ) {
        return;
      }

      const nextState = await claimWeeklyReward(db, uid, claimDateKey, weeklyRewardsState);
      weeklyRewardsState = nextState;
      if (navigationController) {
        navigationController.setWeeklyRewardsState(nextState);
        navigationController.renderCurrentMonth();
      }
    }

    navigationController = setupNavigation(
      months,
      startIndex,
      progressDateSet,
      freezeDateSet,
      weeklyRewardsState,
      onWeeklyClaim
    );
    await loadStreakCount();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initActivityCalendar();
  });
})();
