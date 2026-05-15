/**
 * LeetCode progress – save/load to Firestore.
 * Path: users/{uid}/leetcodeProgress/{date}
 */
const PENDING_SUBMISSIONS_KEY = "leetcode_pending_submissions";

function normalizeSubmissions(rawSubmissions, startingOrder) {
  const sorted = [...rawSubmissions].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp)
  );
  return sorted.map((s, idx) => ({
    order: startingOrder + idx + 1,
    id: s.id,
    title: s.title,
    titleSlug: s.titleSlug,
    timestamp: Number(s.timestamp) * 1000,
  }));
}

/**
 * Save today's submissions to Firestore.
 * Merges with existing, dedupes by titleSlug (and id), assigns order.
 */
function saveLeetCodeProgressToFirestore(db, uid, rawSubmissions) {
  if (!db || !uid || !Array.isArray(rawSubmissions) || rawSubmissions.length === 0) {
    return Promise.resolve();
  }

  return getLeetCodeLinkedAtTime(db, uid)
    .then((linkedAtMs) => {
      const filteredSubmissions = rawSubmissions.filter((s) => {
        if (!s) return false;
        const submittedAtMs = Number(s.timestamp) * 1000;
        if (!linkedAtMs) return true;
        return submittedAtMs >= linkedAtMs;
      });

      if (filteredSubmissions.length === 0) return Promise.resolve();

      const todayKey = getTodayString();
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("leetcodeProgress")
        .doc(todayKey);

      return ref
        .get()
        .then((snap) => {
          const existing = snap.exists ? snap.data().submissions || [] : [];
          const existingIds = new Set(existing.map((s) => s.id).filter(Boolean));
          const existingSlugs = new Set(existing.map((s) => s.titleSlug).filter(Boolean));

          // Only keep submissions that introduce a new problem (titleSlug) for the day.
          // Also ignore ids we've already seen, for safety.
          const newSubs = filteredSubmissions.filter((s) => {
            if (!s || !s.titleSlug) return false;
            if (existingSlugs.has(s.titleSlug)) return false;
            if (s.id && existingIds.has(s.id)) return false;
            return true;
          });
          if (newSubs.length === 0) return Promise.resolve();

          const normalized = normalizeSubmissions(newSubs, existing.length);
          // Final safety: dedupe merged by titleSlug.
          const merged = [];
          const seenSlugs = new Set();
          for (const s of existing.concat(normalized)) {
            const slug = s && s.titleSlug;
            if (!slug || seenSlugs.has(slug)) continue;
            seenSlugs.add(slug);
            merged.push(s);
          }

          return ref.set(
            {
              submissions: merged,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .then(() => {
            return storageSet({ leetmate_last_progress_date: todayKey });
          });
        });
    })
    .catch((e) => {
      console.error("saveLeetCodeProgressToFirestore failed:", e);
      throw e;
    });
}

/**
 * True if today's Pacific calendar doc has at least one recorded submission row.
 * Prefers reading the dated doc directly so we don't rely on orderBy(updatedAt),
 * which can lag behind serverTimestamp() resolution.
 */
async function hasFirestoreProgressPacificToday(db, uid) {
  if (!db || !uid || typeof getTodayString !== "function") return false;
  const todayKey = getTodayString();
  try {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("leetcodeProgress")
      .doc(todayKey)
      .get();
    if (!snap.exists) return false;
    const subs = snap.data().submissions || [];
    return subs.length > 0;
  } catch (e) {
    console.error("hasFirestoreProgressPacificToday failed:", e);
    return false;
  }
}

/**
 * Load today's submissions from Firestore.
 */
function loadLeetCodeProgressToday(db, uid) {
  if (!db || !uid) return Promise.resolve([]);

  const todayKey = getTodayString();
  return db
    .collection("users")
    .doc(uid)
    .collection("leetcodeProgress")
    .doc(todayKey)
    .get()
    .then((snap) => (snap.exists ? snap.data().submissions || [] : []))
    .catch((e) => {
      console.error("loadLeetCodeProgress failed:", e);
      return [];
    });
}

/**
 * Load today's full progress doc (submissions + claimedIds).
 */
function loadLeetCodeProgressDoc(db, uid) {
  if (!db || !uid) return Promise.resolve({ submissions: [], claimedIds: [] });

  const todayKey = getTodayString();
  return db
    .collection("users")
    .doc(uid)
    .collection("leetcodeProgress")
    .doc(todayKey)
    .get()
    .then((snap) => {
      if (!snap.exists) return { submissions: [], claimedIds: [] };
      const data = snap.data();
      return {
        submissions: data.submissions || [],
        claimedIds: data.claimedIds || [],
      };
    })
    .catch((e) => {
      console.error("loadLeetCodeProgressDoc failed:", e);
      return { submissions: [], claimedIds: [] };
    });
}

/**
 * Mark submission IDs as claimed. Appends to existing claimedIds.
 */
function markSubmissionsClaimed(db, uid, submissionIds) {
  if (!db || !uid || !Array.isArray(submissionIds) || submissionIds.length === 0) {
    return Promise.resolve();
  }

  const todayKey = getTodayString();
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("leetcodeProgress")
    .doc(todayKey);

  return ref
    .get()
    .then((snap) => {
      const existing = snap.exists ? snap.data().claimedIds || [] : [];
      const merged = [...new Set([...existing, ...submissionIds])];
      return ref.set(
        {
          claimedIds: merged,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    })
    .catch((e) => console.error("markSubmissionsClaimed failed:", e));
}


/**
 * Sync any pending submissions from chrome.storage to Firestore.
 * Call from Home when user is authenticated.
 */
function syncPendingSubmissionsToFirestore(db, uid) {
  return new Promise((resolve) => {
    chrome.storage.local.get(PENDING_SUBMISSIONS_KEY, async (items) => {
      const pending = items[PENDING_SUBMISSIONS_KEY];
      if (!pending || !Array.isArray(pending) || pending.length === 0) {
        resolve();
        return;
      }

      try {
        await saveLeetCodeProgressToFirestore(db, uid, pending);
        chrome.storage.local.remove(PENDING_SUBMISSIONS_KEY, resolve);
      } catch (_e) {
        console.warn(
          "[Leetmate] Keeping leetcode_pending_submissions; sync will retry:",
          pending.length,
          "row(s)."
        );
        resolve();
      }
    });
  });
}

/**
 * Gets the latest date the user has any leetcode progress recorded in Firestore.
 * Returns a "YYYY-MM-DD" string or null if none found.
 */
async function loadLatestProgressDate(db, uid) {
  if (!db || !uid) return null;

  try {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("leetcodeProgress")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) return null;

    // The document ID is the date string e.g. "2026-03-15"
    const latestDate = snap.docs[0].id;
    console.log("Latest progress date loaded:", latestDate);

    return latestDate;

  } catch (e) {
    console.error("loadLatestProgressDate failed:", e);
    return null;
  }
}

async function getLeetCodeLinkedAtTime(db, uid) {
  if (!db || !uid) return null;

  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    const linkedAt = data.leetcode && data.leetcode.linkedAt;

    if (!linkedAt) return null;
    if (typeof linkedAt.toMillis === "function") return linkedAt.toMillis();

    return new Date(linkedAt).getTime() || null;
  } catch (e) {
    console.error("getLeetCodeLinkedAtTime failed:", e);
    return null;
  }
}
