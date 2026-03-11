const LEETCODE_USERNAME_KEY = "leetmate_leetcode_username";

function getLeetCodeUsername() {
  return localStorage.getItem(LEETCODE_USERNAME_KEY);
}

function setLeetCodeUsername(username) {
  localStorage.setItem(LEETCODE_USERNAME_KEY, username);
}

function loadLeetCodeUsernameFromFirestore(db, uid) {
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

function saveLeetCodeUsernameToFirestore(db, uid, username) {
  if (!username) return;

  setLeetCodeUsername(username);

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