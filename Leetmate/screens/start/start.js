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
    console.log('Leetmate: popup.js DOMContentLoaded');
    if (
      typeof firebase === 'undefined' ||
      !firebase.auth ||
      !firebase.firestore
    ) {
      console.error('Leetmate: Firebase not loaded in popup.js');
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    console.log('Leetmate: attaching onAuthStateChanged');
    auth.onAuthStateChanged(function (user) {
      console.log('Leetmate: onAuthStateChanged fired. User:', user ? user.uid : 'null');
      if (!user) {
        // Not signed in – keep showing the Welcome screen.
        var loading = document.getElementById('loading-overlay');
        if (loading) loading.classList.add('hidden');
        return;
      }

      console.log('Leetmate: Fetching user doc from Firestore...');
      db.collection('users')
        .doc(user.uid)
        .get()
        .then(function (snap) {
          console.log('Leetmate: User doc fetched! exists:', snap.exists);
          var data = snap.exists ? snap.data() || {} : {};

          if (data.leetcode && data.leetcode.connected) {
            console.log('Leetmate: Redirecting to home...');
            window.location.href = '../home/index.html';
          } else {
            console.log('Leetmate: Redirecting to leetcode connect...');
            window.location.href = '../auth-leetcode/index.html';
          }
        })
        .catch(function (error) {
          console.error('Leetmate: Firestore get error:', error);
          window.location.href = '../auth-leetcode/index.html';
        });
    });

    // Failsafe: if nothing happens after 5s, hide the loading screen and log
    setTimeout(() => {
      var loading = document.getElementById('loading-overlay');
      if (loading && !loading.classList.contains('hidden')) {
         console.warn('Leetmate: Failsafe triggered. Stuck on loading for 5 seconds.');
         loading.classList.add('hidden');
      }
    }, 5000);
  });
})();

