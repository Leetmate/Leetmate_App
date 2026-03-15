const LEETCODE_USERNAME_KEY = "leetmate_leetcode_username";

async function getLeetCodeUsername() {
  const result = await storageGet(LEETCODE_USERNAME_KEY);
  return result[LEETCODE_USERNAME_KEY] ?? null;
}

async function setLeetCodeUsername(username) {
  await storageSet({ [LEETCODE_USERNAME_KEY]: username });
}

async function loadLeetCodeUsernameFromFirestore(db, uid) {
  return db
    .collection("users")
    .doc(uid)
    .get()
    .then((doc) => {
      if (!doc.exists) return;

      const data = doc.data();

      if (data.leetcodeUsername) {
        const username = data.leetcodeUsername;

        chrome.storage.local.set({
          leetcodeUsername: username
        });
      }
    })
    .catch((error) => {
      console.error("Failed to load LeetCode username:", error);
    });
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