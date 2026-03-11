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
 * Merges with existing, dedupes by id, assigns order.
 */
function saveLeetCodeProgressToFirestore(db, uid, rawSubmissions) {
  if (!db || !uid || !Array.isArray(rawSubmissions) || rawSubmissions.length === 0) {
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
      const existing = snap.exists ? snap.data().submissions || [] : [];
      const existingIds = new Set(existing.map((s) => s.id));
      const newSubs = rawSubmissions.filter((s) => !existingIds.has(s.id));
      if (newSubs.length === 0) return Promise.resolve();

      const normalized = normalizeSubmissions(newSubs, existing.length);
      const merged = existing.concat(normalized);

      return ref.set(
        {
          submissions: merged,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    })
    .catch((e) => console.error("saveLeetCodeProgressToFirestore failed:", e));
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

function hasSolvedToday(db, uid) {
  return loadLeetCodeProgressToday(db, uid).then((subs) => subs.length > 0);
}

/**
 * Sync any pending submissions from chrome.storage to Firestore.
 * Call from Home when user is authenticated.
 */
function syncPendingSubmissionsToFirestore(db, uid) {
  return new Promise((resolve) => {
    chrome.storage.local.get(PENDING_SUBMISSIONS_KEY, (items) => {
      const pending = items[PENDING_SUBMISSIONS_KEY];
      if (!pending || !Array.isArray(pending) || pending.length === 0) {
        resolve();
        return;
      }

      saveLeetCodeProgressToFirestore(db, uid, pending).then(() => {
        chrome.storage.local.remove(PENDING_SUBMISSIONS_KEY, resolve);
      });
    });
  });
}
