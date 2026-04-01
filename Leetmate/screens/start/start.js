/**
 * popup.js - Welcome screen routing logic.
 *
 * If the user is already signed in to Leetmate:
 *  - If their Firestore user doc has leetcode.connected === true, open Home.
 *  - Otherwise, open the LeetCode connect screen.
 *
 * If no user is signed in, reveal the Welcome screen.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    console.log('Leetmate: popup.js DOMContentLoaded');

    function revealWelcome() {
      document.body.classList.remove('auth-checking');
      var loading = document.getElementById('loading-overlay');
      if (loading) loading.classList.add('hidden');
    }

    if (
      typeof firebase === 'undefined' ||
      !firebase.auth ||
      !firebase.firestore
    ) {
      console.error('Leetmate: Firebase not loaded in popup.js');
      revealWelcome();
      return;
    }

    var auth = firebase.auth();
    var db = firebase.firestore();

    console.log('Leetmate: attaching onAuthStateChanged');
    auth.onAuthStateChanged(function (user) {
      console.log(
        'Leetmate: onAuthStateChanged fired. User:',
        user ? user.uid : 'null'
      );

      if (!user) {
        revealWelcome();
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
          revealWelcome();
        });
    });

    // Failsafe: if auth resolution stalls, reveal the Welcome screen.
    setTimeout(function () {
      if (document.body.classList.contains('auth-checking')) {
        console.warn('Leetmate: Failsafe triggered. Auth check exceeded 5 seconds.');
        revealWelcome();
      }
    }, 5000);
  });
})();
