// home.js
// Firebase XP syncing and UI updates

function hasFirebase() {
  return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
}

function setHomeLoading(isLoading, text) {
  const overlay = document.getElementById("loading-overlay");
  const label = document.getElementById("loading-text");
  if (!overlay) return;

  if (label && text) {
    label.textContent = text;
  }

  overlay.classList.toggle("hidden", !isLoading);
  document.body.classList.toggle("hidden-on-load", isLoading);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!hasFirebase()) {
    console.warn("Firebase not available on this page.");
    setHomeLoading(false);
    return;
  }

  setHomeLoading(true, "Loading Home...");
  updateXPSectionUI();
  updateCoinsUI();

  const db = firebase.firestore();
  const auth = firebase.auth();
  let currentUid = null;

  /**
   * Flush pending submissions, refresh rewards from Firestore, then derive solvedToday
   * and update streak. Must run after sync — reading progress before sync leaves
   * solvedToday false until the next full reload.
   *
   * Prefer reading users/.../leetcodeProgress/{Pacific YYYY-MM-DD} over orderBy(updatedAt),
   * since server timestamps can reorder the latest-doc query incorrectly right after writes.
   */
  async function refreshProgressAndStreak() {
    if (!currentUid) return;

    await syncPendingSubmissionsToFirestore(db, currentUid);
    await refreshRewardsCard(db, currentUid);

    const today = getTodayString();

    let solvedToday = await hasFirestoreProgressPacificToday(db, currentUid);
    let latestRecorded = null;
    if (!solvedToday && typeof loadLatestProgressDate === "function") {
      latestRecorded = await loadLatestProgressDate(db, currentUid);
      solvedToday = latestRecorded === today;
    }

    if (solvedToday) {
      await storageSet({ leetmate_last_progress_date: today });
    } else if (latestRecorded) {
      await storageSet({ leetmate_last_progress_date: latestRecorded });
    }

    const { leetmate_last_streak_date } = await storageGet([
      "leetmate_last_streak_date",
    ]);
    if (
      leetmate_last_streak_date !== today &&
      typeof runDailyStreakCheck === "function"
    ) {
      await runDailyStreakCheck();
    }

    await updateStreakOnLoad(db, currentUid, solvedToday);
  }

  async function refreshAfterProgressSync() {
    await refreshProgressAndStreak();
  }

  /** Re-pull pet + happiness from Firestore when the user returns (Firestore edits otherwise stay stale). */
  async function refreshPetAndHappinessFromFirestore() {
    if (!currentUid) return;

    if (typeof loadHappinessFromFirestore === "function") {
      await loadHappinessFromFirestore(db, currentUid);
    }
    if (typeof syncPendingPetAgeToFirestore === "function") {
      await syncPendingPetAgeToFirestore(db, currentUid);
    }
    if (typeof loadActivePetFromFirestore === "function") {
      await loadActivePetFromFirestore(db, currentUid);
    }
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
      currentUid = user.uid;

      await storageSet({ uid: currentUid });
      window.__leetmateAuth = { db, uid: currentUid };

      // Restore LeetCode username into chrome.storage (needed by leetcode.com content script)
      await loadLeetCodeUsernameFromFirestore(db, currentUid);

  		// default card to load
  		setupLeetCodeCard(db, currentUid, {
  			solved: false,
  			claimableCount: 0,
  			claimableCoins: 0,
  			claimableXp: 0,
  			claimableIds: [],
  			includesFirstSumbission: false,
  		});

  		const initalRewardsPromise = refreshRewardsCard(db, currentUid);
  		
  		await Promise.all([
  			loadXPFromFirestore(db, currentUid),
  			loadHappinessFromFirestore(db, currentUid),
  		]);
      await loadCoinsFromFirestore(db, currentUid);

  		if (typeof applyPendingEvolutionCoinsToFirestore === "function") {
  			await applyPendingEvolutionCoinsToFirestore(db, currentUid);
  		}

  		await Promise.all([
  			updateXPSectionUI(),
  			updateCoinsUI(),
  			// i think load happiness already calls update hearts ui
  		]);

      startHappinessDecayTimer();

  		await initalRewardsPromise;

      await refreshProgressAndStreak();
  		// Load active pet (sync any midnight age bumps to Firestore subcollection first)
      if (typeof syncPendingPetAgeToFirestore === "function") {
        await syncPendingPetAgeToFirestore(db, currentUid);
      }
      if (typeof loadActivePetFromFirestore === "function") {
        await loadActivePetFromFirestore(db, currentUid);
      }

      if (typeof LeetmateEvolutionNotify !== "undefined" && LeetmateEvolutionNotify.peekEvolutionQueue) {
        const { activePetId } = await storageGet(["activePetId"]);
        const queue = await LeetmateEvolutionNotify.peekEvolutionQueue();
        const evolutionEvent = (queue || []).find(
          (e) => e && e.petId === activePetId
        );
        if (evolutionEvent) {
          try {
            sessionStorage.setItem(
              "leetmate_evolution_payload",
              JSON.stringify(evolutionEvent)
            );
          } catch (_) {}
          setHomeLoading(false);
          window.location.replace(
            chrome.runtime.getURL("screens/evolution/index.html")
          );
          return;
        }
      }
    } catch (error) {
      console.error("Home failed to finish loading:", error);
    } finally {
      setHomeLoading(false);
    }
  });

  // Refresh rewards + pet/happiness when user returns (Firestore is not realtime in the popup)
  window.addEventListener("focus", async () => {
    await refreshAfterProgressSync();
    await refreshPetAndHappinessFromFirestore();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    await refreshAfterProgressSync();
    await refreshPetAndHappinessFromFirestore();
  });

  // Easy mode: keep decay timer in sync if the toggle changes on Settings (same profile).
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.leetmate_easy_mode) return;
      const on = changes.leetmate_easy_mode.newValue;
      if (on) {
        if (typeof stopHappinessDecayTimer === "function") stopHappinessDecayTimer();
      } else if (typeof startHappinessDecayTimer === "function") {
        startHappinessDecayTimer();
        return;
      }
      if (typeof updateHeartsUI === "function") updateHeartsUI();
    });
  }
});

/**
 * Handle streak update on home load.
 * Only increments once per day, after submissions are confirmed synced.
 */
async function updateStreakOnLoad(db, uid, solvedToday) {
  const streakData = await loadStreakData(db, uid);
  if (!streakData) return;
  const today = getTodayString();
  const { leetmate_last_progress_date } = await storageGet([
    "leetmate_last_progress_date",
  ]);

  /* streakLastUpdated is also written for midnight / missed-day bookkeeping; don't use
   * it alone to decide whether we credited today's solve (+1 streak). */
  const rewardedSolveToday =
    streakData.streakSolveRewardDate != null &&
    streakData.streakSolveRewardDate === today;

  if (solvedToday && !rewardedSolveToday) {
    const updated = incrementStreak(streakData);
    updated.streakLastUpdated = today;
    updated.streakSolveRewardDate = today;
    await saveStreakData(db, uid, updated);
    updateStreakUI(updated);
    return;
  }

  // If the background daily check already ran, it would have written the new
  // streak values to chrome storage with leetmate_last_streak_date === today.
  // In that case, sync storage -> Firestore so the UI matches.
  const {
    leetmate_streak,
    leetmate_last_streak_date,
    leetmate_streak_freeze_start,
    leetmate_streak_freeze_end,
    leetmate_streak_solve_reward_date,
  } = await storageGet([
    "leetmate_streak",
    "leetmate_last_streak_date",
    "leetmate_streak_freeze_start",
    "leetmate_streak_freeze_end",
    "leetmate_streak_solve_reward_date",
  ]);

  const storageUpdatedToday = leetmate_last_streak_date === today;
  if (storageUpdatedToday) {
    const fromStorage = {
      streak: leetmate_streak ?? 0,
      streakLastUpdated: leetmate_last_streak_date ?? null,
      streakFreezeStart: leetmate_streak_freeze_start ?? null,
      streakFreezeEnd: leetmate_streak_freeze_end ?? null,
      streakSolveRewardDate: (() => {
        const r = leetmate_streak_solve_reward_date;
        if (
          typeof r === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(r).trim())
        ) {
          return String(r).trim();
        }
        return streakData.streakSolveRewardDate ?? null;
      })(),
    };

    if (
      fromStorage.streak !== streakData.streak ||
      fromStorage.streakLastUpdated !== streakData.streakLastUpdated ||
      fromStorage.streakFreezeStart !== streakData.streakFreezeStart ||
      fromStorage.streakFreezeEnd !== streakData.streakFreezeEnd ||
      (fromStorage.streakSolveRewardDate ?? null) !==
        (streakData.streakSolveRewardDate ?? null)
    ) {
      await saveStreakData(db, uid, fromStorage);
    }

    updateStreakUI(fromStorage);
    return;
  }
  // Already updated today — just show current streak
  if (isStreakUpdatedToday(streakData)) {
    updateStreakUI(streakData);
    return;
  }

  // Catch-up path: if yesterday (or earlier) was missed and background alarm did not run,
  // apply the missed-day update once when Home opens.
  const missedDayWithoutProgress =
    !solvedToday &&
    typeof leetmate_last_progress_date === "string" &&
    leetmate_last_progress_date < today;

  if (missedDayWithoutProgress) {
    const updated = processMissedDay(streakData);
    updated.streakLastUpdated = today;
    await saveStreakData(db, uid, updated);
    updateStreakUI(updated);
    return;
  }

  // Not solved today — show streak as-is. Background will handle reset at 11:59pm.
  if (!solvedToday) {
    updateStreakUI(streakData);
    return;
  }

  /* Solve credit handled at top via streakSolveRewardDate; if we reached here solvedToday
     is false or already rewarded — should not increment again (defensive fallback). */
  updateStreakUI(streakData);
}

/* Minimize window */
document.querySelector(".minimize-btn").addEventListener("click", async () => {
  const { activePetStage, leetmate_happiness } = await storageGet(["activePetStage", "leetmate_happiness"]);
  const normalizedStage = (activePetStage || "").toLowerCase();
  if (!["baby", "adult"].includes(normalizedStage) || (leetmate_happiness ?? 100) <= 0) {
    return;
  }
  chrome.runtime.sendMessage({ type: "openPip" });
  window.close();
});

/* Premium button navigation */
const premiumBtn = document.getElementById("prem-btn");
premiumBtn?.addEventListener("click", () => {
    window.location.href = "../premium/index.html";
});

/* Add check mark in premium button if user has premium */
function applyPremiumUI(isPremium) {
  if (!premiumBtn) return;
  premiumBtn.textContent = isPremium ? "✔ Premium" : "+ Premium";
}

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) return;
  const isPremium = await window.LeetmatePremium.getFirestorePremium();
  if (isPremium === null) return;
  applyPremiumUI(isPremium);
});
