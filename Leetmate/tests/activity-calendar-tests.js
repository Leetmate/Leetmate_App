/* Activity calendar visual demo helpers (non-destructive) */
(function () {
  "use strict";

  let domPreviewSnapshot = null;
  let lastFreezeDemoRange = null;

  function isValidDateKey(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  async function getAuthCtx() {
    if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
      throw new Error("activityCalendarTest: Firebase is not available.");
    }
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("activityCalendarTest: sign in first.");
    return { db: firebase.firestore(), uid: user.uid };
  }

  function getVisibleCalendarCells() {
    return Array.from(document.querySelectorAll(".calendar-day:not(.is-placeholder)"));
  }

  function getDayNumberFromCell(cell) {
    if (!cell) return null;
    const value = Number((cell.textContent || "").trim());
    return Number.isInteger(value) ? value : null;
  }

  function getCalendarSummary() {
    const cells = getVisibleCalendarCells();
    return {
      visibleDayCells: cells.length,
      progressCount: cells.filter((cell) => cell.classList.contains("has-progress")).length,
      freezeCount: cells.filter((cell) => cell.classList.contains("has-freeze")).length,
      giftCount: cells.filter((cell) => cell.classList.contains("has-weekly-gift")).length,
      giftButtons: document.querySelectorAll(".calendar-weekly-gift-btn").length,
    };
  }

  function saveDomPreviewSnapshot() {
    const cells = getVisibleCalendarCells();
    domPreviewSnapshot = cells.map((cell) => ({
      cell,
      className: cell.className,
    }));
  }

  function restoreDomPreviewSnapshot() {
    if (!domPreviewSnapshot) return false;
    domPreviewSnapshot.forEach((entry) => {
      if (!entry?.cell) return;
      entry.cell.className = entry.className;
      entry.cell.querySelectorAll(".calendar-weekly-gift-btn").forEach((btn) => btn.remove());
    });
    domPreviewSnapshot = null;
    return true;
  }

  function clearAllVisualMarkers() {
    getVisibleCalendarCells().forEach((cell) => {
      cell.classList.remove("has-progress", "has-freeze", "has-weekly-gift");
      cell.querySelectorAll(".calendar-weekly-gift-btn").forEach((btn) => btn.remove());
    });
  }

  function pickDayNumbersNearEnd(count) {
    const dayNumbers = getVisibleCalendarCells()
      .map((cell) => getDayNumberFromCell(cell))
      .filter((value) => Number.isInteger(value));

    if (dayNumbers.length === 0) return [];

    const maxDay = Math.max(...dayNumbers);
    const start = Math.max(1, maxDay - count + 1);
    const picked = [];
    for (let day = start; day <= maxDay; day += 1) {
      picked.push(day);
    }
    return picked;
  }

  function applyGiftButtonToCell(cell) {
    if (!cell) return;
    cell.classList.add("has-weekly-gift");

    if (cell.querySelector(".calendar-weekly-gift-btn")) return;

    const giftButton = document.createElement("button");
    giftButton.type = "button";
    giftButton.className = "calendar-weekly-gift-btn";
    giftButton.setAttribute("aria-label", "Demo weekly reward gift");
    giftButton.textContent = "🎁";
    giftButton.addEventListener("click", () => {
      giftButton.disabled = true;
      giftButton.textContent = "✓";
      if (typeof window.showWeeklyRewardBanner === "function") {
        const rewardAmounts =
          typeof window.getWeeklyRewardAmounts === "function"
            ? window.getWeeklyRewardAmounts()
            : { coinReward: 100, xpReward: 30 };
        const bannerMessage =
          typeof window.formatWeeklyRewardBannerMessage === "function"
            ? window.formatWeeklyRewardBannerMessage(
                rewardAmounts.coinReward,
                rewardAmounts.xpReward
              )
            : `Weekly reward claimed: +${rewardAmounts.coinReward} coins, +${rewardAmounts.xpReward} XP`;
        window.showWeeklyRewardBanner(bannerMessage);
      }
    });
    cell.appendChild(giftButton);
  }

  function getAutoGiftDaysFromProgress(progressDays) {
    const normalizedDays = Array.from(
      new Set(
        (progressDays || [])
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day > 0)
      )
    ).sort((a, b) => a - b);

    const giftDays = [];
    let previousDay = null;
    let streakLength = 0;

    normalizedDays.forEach((day) => {
      if (previousDay !== null && day === previousDay + 1) {
        streakLength += 1;
      } else {
        streakLength = 1;
      }

      if (streakLength % 7 === 0) {
        giftDays.push(day);
      }

      previousDay = day;
    });

    return giftDays;
  }

  function applyVisualDemo({ progressDays, freezeDays, giftDays }) {
    const progressSet = new Set(progressDays || []);
    const freezeSet = new Set(freezeDays || []);
    const giftSourceDays = Array.isArray(giftDays)
      ? giftDays
      : getAutoGiftDaysFromProgress(progressDays);
    const giftSet = new Set(giftSourceDays);

    getVisibleCalendarCells().forEach((cell) => {
      const day = getDayNumberFromCell(cell);
      if (!day) return;

      if (progressSet.has(day)) cell.classList.add("has-progress");
      if (freezeSet.has(day)) cell.classList.add("has-freeze");
      if (giftSet.has(day)) applyGiftButtonToCell(cell);
    });
  }

  async function writeFreezeUsage(db, uid, startDate, endDate) {
    const usageDocId = `${startDate}_${endDate}`;
    try {
      await db
        .collection("users")
        .doc(uid)
        .collection("streakFreezeUsage")
        .doc(usageDocId)
        .set(
          {
            startDate,
            endDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (_) {
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            streakFreezeUsageHistory: firebase.firestore.FieldValue.arrayUnion({
              startDate,
              endDate,
            }),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }

  async function deleteFreezeUsage(db, uid, startDate, endDate) {
    const usageDocId = `${startDate}_${endDate}`;
    try {
      await db
        .collection("users")
        .doc(uid)
        .collection("streakFreezeUsage")
        .doc(usageDocId)
        .delete();
    } catch (_) {}

    try {
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            streakFreezeUsageHistory: firebase.firestore.FieldValue.arrayRemove({
              startDate,
              endDate,
            }),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (_) {}
  }

  const api = {
    freezeDemo: {
      async setRange(startDate, endDate) {
        if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
          throw new Error("activityCalendarTest.freezeDemo.setRange expects YYYY-MM-DD dates.");
        }
        if (startDate > endDate) {
          throw new Error("activityCalendarTest.freezeDemo.setRange requires startDate <= endDate.");
        }

        const { db, uid } = await getAuthCtx();

        await db
          .collection("users")
          .doc(uid)
          .set(
            {
              streakFreezeStart: startDate,
              streakFreezeEnd: endDate,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        await writeFreezeUsage(db, uid, startDate, endDate);
        lastFreezeDemoRange = { startDate, endDate };

        console.log("Freeze demo range saved to Firestore:", lastFreezeDemoRange);
        return lastFreezeDemoRange;
      },

      async clear() {
        const { db, uid } = await getAuthCtx();
        let targetRange = lastFreezeDemoRange;

        if (!targetRange) {
          const snap = await db.collection("users").doc(uid).get();
          const data = snap.exists ? snap.data() || {} : {};
          const startDate = data.streakFreezeStart;
          const endDate = data.streakFreezeEnd;
          if (isValidDateKey(startDate) && isValidDateKey(endDate)) {
            targetRange = { startDate, endDate };
          }
        }

        if (targetRange) {
          await deleteFreezeUsage(db, uid, targetRange.startDate, targetRange.endDate);
        }

        await db
          .collection("users")
          .doc(uid)
          .set(
            {
              streakFreezeStart: null,
              streakFreezeEnd: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        lastFreezeDemoRange = null;
        console.log("Freeze demo cleared from Firestore.");
        return true;
      },
    },

    preview: {
      custom({
        progressDays = pickDayNumbersNearEnd(10),
        freezeDays = pickDayNumbersNearEnd(3),
        giftDays,
      } = {}) {
        if (!domPreviewSnapshot) saveDomPreviewSnapshot();

        const resolvedGiftDays = Array.isArray(giftDays)
          ? giftDays
          : getAutoGiftDaysFromProgress(progressDays);

        clearAllVisualMarkers();
        applyVisualDemo({ progressDays, freezeDays, giftDays: resolvedGiftDays });

        const summary = getCalendarSummary();
        console.log("Preview demo applied (visual-only):", {
          progressDays,
          freezeDays,
          giftDays: resolvedGiftDays,
          summary,
        });
        return summary;
      },

      quick(options = {}) {
        return this.custom(options);
      },

      stop() {
        const restored = restoreDomPreviewSnapshot();
        console.log(
          restored
            ? "Preview demo cleared. Original calendar restored."
            : "No active preview snapshot to restore."
        );
        return restored;
      },
    },

    readView() {
      const summary = getCalendarSummary();
      console.log("Calendar summary:", summary);
      return summary;
    },

    help() {
      const usage = {
        freezeSet:
          "await activityCalendarTest.freezeDemo.setRange('2026-04-10', '2026-04-13')",
        freezeClear: "await activityCalendarTest.freezeDemo.clear()",
        previewQuick: "activityCalendarTest.preview.quick()",
        previewQuickCustom:
          "activityCalendarTest.preview.quick({ progressDays:[14,15,16], freezeDays:[16], giftDays:[16] })",
        previewCustom:
          "activityCalendarTest.preview.start({ progressDays:[14,15,16], freezeDays:[16], giftDays:[16] })",
        previewStop: "activityCalendarTest.preview.stop()",
        readView: "activityCalendarTest.readView()",
      };
      console.log("activityCalendarTest commands:", usage);
      return usage;
    },
  };

  window.activityCalendarTest = api;
  window.activityTest = api;
  window.calendarTest = api;

  console.log("activityCalendarTest loaded.");
})();
