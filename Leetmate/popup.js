/**
 * popup.js – Welcome screen routing logic.
 *
 * If the user is already signed in to Leetmate:
 *  - If their Firestore user doc has leetcode.connected === true, open the
 *    LeetCode connect screen in "success" mode.
 *  - Otherwise, open the LeetCode connect screen in "connect" mode
 *    (that screen decides based on Firestore).
 *
 * If no user is signed in, we leave the Welcome screen as-is.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (
      typeof firebase === 'undefined' ||
      !firebase.auth ||
      !firebase.firestore
    ) {
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        // Not signed in – keep showing the Welcome screen.
        return;
      }

      db.collection('users')
        .doc(user.uid)
        .get()
        .then(function (snap) {
          var data = snap.exists ? snap.data() || {} : {};
          // Whether connected or not, the next step in the flow is the
          // LeetCode connect screen; it will show success or connect state.
          window.location.href = 'screens/leetcode/index.html';
        })
        .catch(function () {
          // On error, still send to LeetCode screen – it can handle failures.
          window.location.href = 'screens/leetcode/index.html';
        });
    });
  });
})();

