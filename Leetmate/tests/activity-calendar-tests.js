/* Activity calendar visual demo helpers (non-destructive) */
(function () {
  "use strict";

  let domPreviewSnapshot = null;
  let lastFreezeDemoRange = null;
  const DEMO_CHEST_CLAIM_FADE_MS = 460;

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

  function getDateKeyFromCell(cell) {
    const ariaLabel = cell?.getAttribute("aria-label");
    if (!ariaLabel) return null;
    const parsed = new Date(ariaLabel);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
  }

  function getCalendarSummary() {
    const cells = getVisibleCalendarCells();
    return {
      visibleDayCells: cells.length,
      progressCount: cells.filter((cell) => cell.classList.contains("has-progress")).length,
      progressActiveCount: cells.filter(
        (cell) =>
          cell.classList.contains("has-progress") &&
          !cell.classList.contains("has-progress-muted")
      ).length,
      progressMutedCount: cells.filter((cell) => cell.classList.contains("has-progress-muted")).length,
      freezeCount: cells.filter((cell) => cell.classList.contains("has-freeze")).length,
      rewardCount: cells.filter((cell) => cell.classList.contains("has-weekly-reward")).length,
      rewardClaimableCount: cells.filter((cell) => cell.classList.contains("weekly-reward-claimable")).length,
      rewardLockedCount: cells.filter((cell) => cell.classList.contains("weekly-reward-locked")).length,
      rewardClaimedCount: cells.filter((cell) => cell.classList.contains("weekly-reward-claimed")).length,
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
      entry.cell.removeAttribute("role");
      entry.cell.removeAttribute("tabindex");
      entry.cell.removeAttribute("aria-label");
    });
    domPreviewSnapshot = null;
    return true;
  }

  const PROGRESS_SEGMENT_CLASSES = [
    "progress-connect-left",
    "progress-connect-right",
    "progress-run-single",
    "progress-run-start",
    "progress-run-end",
    "progress-run-mid",
  ];

  function getMonthLayoutFromDom() {
    const grid = document.getElementById("activityCalendarGrid");
    if (!grid) return { leading: 0, daysInMonth: 31 };
    const cells = Array.from(grid.querySelectorAll(".calendar-day"));
    let leading = 0;
    let daysInMonth = 0;
    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i];
      if (c.classList.contains("is-placeholder")) continue;
      const d = getDayNumberFromCell(c);
      if (d === 1) {
        leading = i;
        break;
      }
    }
    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i];
      if (c.classList.contains("is-placeholder")) continue;
      const d = getDayNumberFromCell(c);
      if (d >= 1 && d > daysInMonth) daysInMonth = d;
    }
    return { leading, daysInMonth: daysInMonth || 31 };
  }

  function applyProgressSegmentClassesForDemo(
    cell,
    day,
    progressSet,
    activeProgressSet,
    leading,
    daysInMonth
  ) {
    if (!progressSet.has(day)) return;
    cell.classList.add("has-progress");
    const isActive = activeProgressSet.has(day);
    if (!isActive) {
      cell.classList.add("has-progress-muted");
    }
    const pos = leading + day - 1;
    const col = pos % 7;

    let linkLeft = false;
    if (day > 1) {
      if (progressSet.has(day - 1) && activeProgressSet.has(day - 1) === isActive && col !== 0) {
        linkLeft = true;
      }
    }

    let linkRight = false;
    if (day < daysInMonth) {
      if (progressSet.has(day + 1) && activeProgressSet.has(day + 1) === isActive && col !== 6) {
        linkRight = true;
      }
    }

    if (linkLeft) cell.classList.add("progress-connect-left");
    if (linkRight) cell.classList.add("progress-connect-right");

    if (!linkLeft && !linkRight) cell.classList.add("progress-run-single");
    else if (!linkLeft && linkRight) cell.classList.add("progress-run-start");
    else if (linkLeft && !linkRight) cell.classList.add("progress-run-end");
    else cell.classList.add("progress-run-mid");
  }

  function clearAllVisualMarkers() {
    getVisibleCalendarCells().forEach((cell) => {
      cell.classList.remove(
        "has-progress",
        "has-progress-muted",
        "has-freeze",
        "has-weekly-reward",
        "weekly-reward-locked",
        "weekly-reward-claimable",
        "weekly-reward-claimed",
        "weekly-reward-claiming",
        ...PROGRESS_SEGMENT_CLASSES
      );
      cell.removeAttribute("role");
      cell.removeAttribute("tabindex");
      cell.removeAttribute("aria-label");
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

  function applyRewardStateToCell(cell, state) {
    if (!cell) return;
    cell.classList.add("has-weekly-reward");
    if (state === "claimed") {
      cell.classList.add("weekly-reward-claimed");
      return;
    }
    if (state === "claimable") {
      cell.classList.add("weekly-reward-claimable");
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", "Demo weekly reward claimable");
      const handleDemoClaim = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!cell.classList.contains("weekly-reward-claimable")) return;

        cell.classList.add("weekly-reward-claiming");
        await new Promise((resolve) => {
          setTimeout(resolve, DEMO_CHEST_CLAIM_FADE_MS);
        });

        cell.classList.remove("weekly-reward-claimable");
        cell.classList.add("weekly-reward-claimed");
        cell.removeAttribute("role");
        cell.removeAttribute("tabindex");
        cell.setAttribute("aria-label", "Demo weekly reward claimed");

        try {
          const dateKey = getDateKeyFromCell(cell);
          const rewardAmounts =
            typeof window.getWeeklyRewardAmounts === "function"
              ? window.getWeeklyRewardAmounts()
              : { coinReward: 100, xpReward: 30 };
          const coinReward = Number(rewardAmounts?.coinReward) || 0;
          const xpReward = Number(rewardAmounts?.xpReward) || 0;

          const { db, uid } = await getAuthCtx();

          if (dateKey) {
            await db
              .collection("users")
              .doc(uid)
              .set(
                {
                  weeklyRewardClaimedDateKeys: firebase.firestore.FieldValue.arrayUnion(dateKey),
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
          }

          if (typeof window.addCoins === "function") {
            await window.addCoins(coinReward);
          }
          if (typeof window.addXP === "function") {
            await window.addXP(xpReward);
          }
          if (typeof window.saveCoinsToFirestore === "function") {
            await window.saveCoinsToFirestore(db, uid);
          }
          if (typeof window.saveXPToFirestore === "function") {
            await window.saveXPToFirestore(db, uid);
          }
          if (typeof window.updateCoinsUI === "function") {
            await window.updateCoinsUI();
          }
          if (typeof window.updateXPSectionUI === "function") {
            await window.updateXPSectionUI();
          }
        } catch (error) {
          console.warn("Demo weekly reward claim failed:", error);
        } finally {
          cell.classList.remove("weekly-reward-claiming");
        }

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
      };

      cell.addEventListener("click", handleDemoClaim);
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          handleDemoClaim(event);
        }
      });
      return;
    }
    cell.classList.add("weekly-reward-locked");
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

  function applyVisualDemo({
    progressDays,
    activeProgressDays,
    mutedProgressDays,
    freezeDays,
    rewardDays,
    claimableDays,
    lockedDays,
    claimedDays,
  }) {
    const progressSet = new Set(progressDays || []);
    const activeProgressSet = Array.isArray(activeProgressDays)
      ? new Set(activeProgressDays)
      : Array.isArray(mutedProgressDays)
      ? new Set([...progressSet].filter((day) => !new Set(mutedProgressDays).has(day)))
      : new Set(progressSet);
    const freezeSet = new Set(freezeDays || []);
    const claimableSourceDays = Array.isArray(claimableDays)
      ? claimableDays
      : Array.isArray(rewardDays)
      ? rewardDays
      : getAutoGiftDaysFromProgress(progressDays);
    const claimableSet = new Set(claimableSourceDays);
    const lockedSet = new Set(lockedDays || []);
    const claimedSet = new Set(claimedDays || []);
    const { leading, daysInMonth } = getMonthLayoutFromDom();

    getVisibleCalendarCells().forEach((cell) => {
      const day = getDayNumberFromCell(cell);
      if (!day) return;

      if (progressSet.has(day)) {
        applyProgressSegmentClassesForDemo(
          cell,
          day,
          progressSet,
          activeProgressSet,
          leading,
          daysInMonth
        );
      }
      if (freezeSet.has(day)) cell.classList.add("has-freeze");
      if (claimedSet.has(day)) applyRewardStateToCell(cell, "claimed");
      else if (claimableSet.has(day)) applyRewardStateToCell(cell, "claimable");
      else if (lockedSet.has(day)) applyRewardStateToCell(cell, "locked");
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
        activeProgressDays,
        mutedProgressDays,
        freezeDays = pickDayNumbersNearEnd(3),
        rewardDays,
        claimableDays,
        lockedDays,
        claimedDays,
      } = {}) {
        if (!domPreviewSnapshot) saveDomPreviewSnapshot();

        const resolvedClaimableDays = Array.isArray(claimableDays)
          ? claimableDays
          : Array.isArray(rewardDays)
          ? rewardDays
          : getAutoGiftDaysFromProgress(progressDays);

        clearAllVisualMarkers();
        applyVisualDemo({
          progressDays,
          activeProgressDays,
          mutedProgressDays,
          freezeDays,
          rewardDays,
          claimableDays: resolvedClaimableDays,
          lockedDays,
          claimedDays,
        });

        const summary = getCalendarSummary();
        console.log("Preview demo applied (visual-only):", {
          progressDays,
          activeProgressDays,
          mutedProgressDays,
          freezeDays,
          claimableDays: resolvedClaimableDays,
          lockedDays,
          claimedDays,
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
          "activityCalendarTest.preview.quick({ progressDays:[10,11,12,13,14,15,16], activeProgressDays:[14,15,16], freezeDays:[12], claimableDays:[16], lockedDays:[18], claimedDays:[11] })",
        previewCustom:
          "activityCalendarTest.preview.custom({ progressDays:[10,11,12,13,14,15,16], activeProgressDays:[14,15,16], freezeDays:[12], claimableDays:[16], lockedDays:[18], claimedDays:[11] })",
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
