/**
 * Sign in screen: email/password only. On success, ensures user Firestore doc exists and redirects.
 */
(function () {
  'use strict';

  var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
  var db = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.className = 'signin-message' + (isError ? ' signin-message--error' : '');
    el.hidden = false;
  }

  function hideMessage(el) {
    if (!el) return;
    el.hidden = true;
  }

  function ensureUserDoc(uid, email, username) {
    if (!db) return Promise.resolve();
    var userRef = db.collection('users').doc(uid);
    return userRef.get().then(function (snap) {
      if (snap.exists) return Promise.resolve();
      var doc = window.LeetmateUserDoc && window.LeetmateUserDoc.createUserDoc
        ? window.LeetmateUserDoc.createUserDoc(uid, email, username)
        : { email: email || '', username: username || '', xp: 0, coins: 0, leetcodeUsername: null, pets: [], friends: [], itemsOwned: [], streak: 0, streakFreezeEnd: null };
      return userRef.set(doc);
    });
  }

  function onAuthSuccess(user) {
    var email = user.email || '';
    var displayName = user.displayName || email.split('@')[0] || 'User';
    return ensureUserDoc(user.uid, email, displayName).then(function () {
      window.location.href = '../leetcode/index.html?from=signin';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.getElementById('signin-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.href = '../../popup.html';
      });
    }

    var signupLink = document.getElementById('signin-signup-link');
    if (signupLink) {
      signupLink.addEventListener('click', function () {
        window.location.href = '../signup/index.html';
      });
    }

    var form = document.querySelector('.signin-form');
    var msgEl = document.getElementById('signin-message');
    if (!msgEl) {
      msgEl = document.createElement('p');
      msgEl.id = 'signin-message';
      msgEl.setAttribute('aria-live', 'polite');
      msgEl.hidden = true;
      if (form) form.appendChild(msgEl);
    }

    if (form && auth) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        hideMessage(msgEl);
        var email = document.getElementById('signin-email').value.trim();
        var password = document.getElementById('signin-password').value;

        if (!email || !password) {
          showMessage(msgEl, 'Please enter email and password.', true);
          return;
        }

        auth.signInWithEmailAndPassword(email, password)
          .then(function (result) {
            return onAuthSuccess(result.user);
          })
          .catch(function (err) {
            var msg = 'Sign in failed.';
            if (err && err.code === 'auth/user-not-found') {
              msg = 'No account found for this email. Try signing up first.';
            } else if (err && err.code === 'auth/wrong-password') {
              msg = 'Incorrect password. Please try again.';
            } else if (err && err.code === 'auth/invalid-email') {
              msg = 'Invalid email address.';
            } else if (err && err.code === 'auth/too-many-requests') {
              msg = 'Too many attempts. Please wait a moment and try again.';
            } else if (err && err.message) {
              msg = err.message;
            }
            showMessage(msgEl, msg, true);
          });
      });
    }
  });
})();
