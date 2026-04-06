// Same key as leetcode-content.js and sign-out cleanup in settings.
const LEETCODE_USERNAME_KEY = "leetcodeUsername";

async function getLeetCodeUsername() {
  const result = await storageGet(LEETCODE_USERNAME_KEY);
  return result[LEETCODE_USERNAME_KEY] ?? null;
}

async function setLeetCodeUsername(username) {
  await storageSet({ [LEETCODE_USERNAME_KEY]: username });
}

function normalizeUsername(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function usernameFromUserDoc(data) {
  if (!data) return null;
  return (
    normalizeUsername(data.leetcodeUsername) ||
    normalizeUsername(data.leetcode && data.leetcode.username) ||
    null
  );
}

/**
 * Uses extension host permission + browser cookies for leetcode.com.
 */
function fetchLeetCodeUsernameFromApi() {
  return fetch("https://leetcode.com/api/problems/all/", {
    credentials: "include",
  })
    .then((res) => {
      if (!res.ok) throw new Error("LeetCode API status " + res.status);
      return res.json();
    })
    .then((data) => normalizeUsername(data.user_name || data.username))
    .catch((err) => {
      console.warn("LeetCode username API fetch failed:", err);
      return null;
    });
}

async function loadLeetCodeUsernameFromFirestore(db, uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return;

    const data = doc.data();
    let resolved = usernameFromUserDoc(data);

    if (resolved) {
      await setLeetCodeUsername(resolved);
      return;
    }

    const connected = data.leetcode && data.leetcode.connected === true;
    if (!connected) return;

    const fresh = await fetchLeetCodeUsernameFromApi();
    if (!fresh) return;

    await setLeetCodeUsername(fresh);

    await db
      .collection("users")
      .doc(uid)
      .update({
        leetcodeUsername: fresh,
        "leetcode.username": fresh,
        "leetcode.lastSyncedAt":
          firebase.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("Failed to load LeetCode username:", error);
  }
}

async function saveLeetCodeUsernameToFirestore(db, uid, username) {
  if (!username) return;

  await setLeetCodeUsername(username);

  return db
    .collection("users")
    .doc(uid)
    .set(
      {
        leetcodeUsername: username,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    .then(() => {
      console.log("Saved LeetCode username:", username);
    })
    .catch((error) => {
      console.error("Failed to save LeetCode username:", error);
    });
}