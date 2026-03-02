/**
 * Sign up screen: email/password only. On success, creates Firestore user document.
 */
(function () {
  'use strict';

  var auth = null;
  var db = null;
  try {
    if (typeof firebase !== 'undefined') {
      auth = firebase.auth();
      db = firebase.firestore ? firebase.firestore() : null;
    }
  } catch (e) {
    console.warn('Firebase not initialized:', e);
  }

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.className = 'signup-message' + (isError ? ' signup-message--error' : '');
    el.hidden = false;
  }

  function hideMessage(el) {
    if (!el) return;
    el.hidden = true;
  }

  /** Ensure Firestore users/{uid} exists with the given data (create only, do not overwrite existing). */
  function ensureUserDoc(uid, email, username) {
    if (!db) return Promise.reject(new Error('Firestore not loaded'));
    var userRef = db.collection('users').doc(uid);
    return userRef.get().then(function (snap) {
      if (snap.exists) return Promise.resolve();
      var doc = window.LeetmateUserDoc && window.LeetmateUserDoc.createUserDoc
        ? window.LeetmateUserDoc.createUserDoc(uid, email, username)
        : { email: email, username: username || '', xp: 0, coins: 0, leetcodeUsername: null, pets: [], friends: [], itemsOwned: [] };
      return userRef.set(doc);
    });
  }

  function onAuthSuccess(user, username) {
    var email = user.email || '';
    var displayName = user.displayName || '';
    var nameToUse =
      username && username.trim()
        ? username.trim()
        : displayName || email.split('@')[0] || 'User';
    return ensureUserDoc(user.uid, email, nameToUse).then(function () {
      window.location.href = '../leetcode/index.html?from=signup';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.getElementById('signup-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.href = '../../popup.html';
      });
    }

    var termsLink = document.getElementById('signup-terms-link');
    if (termsLink) {
      termsLink.addEventListener('click', function () {
        window.location.href = '../terms/index.html';
      });
    }

    var form = document.querySelector('.signup-form');
    var msgEl = document.getElementById('signup-message');
    if (!msgEl) {
      msgEl = document.createElement('p');
      msgEl.id = 'signup-message';
      msgEl.setAttribute('aria-live', 'polite');
      msgEl.hidden = true;
      if (form) form.appendChild(msgEl);
    }

    if (form && auth) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        hideMessage(msgEl);
        var email = document.getElementById('signup-email').value.trim();
        var password = document.getElementById('signup-password').value;
        var confirmPassword = document.getElementById('signup-confirm-password').value;
        var username = document.getElementById('signup-username').value.trim();
        var accept = document.getElementById('signup-accept').checked;

        if (!email) {
          showMessage(msgEl, 'Please enter your email.', true);
          return;
        }
        if (!password) {
          showMessage(msgEl, 'Please enter a password.', true);
          return;
        }
        if (password.length < 6) {
          showMessage(msgEl, 'Password should be at least 6 characters.', true);
          return;
        }
        if (password !== confirmPassword) {
          showMessage(msgEl, 'Passwords do not match.', true);
          return;
        }
        if (!accept) {
          showMessage(msgEl, 'Please accept the terms.', true);
          return;
        }

        auth.createUserWithEmailAndPassword(email, password)
          .then(function (cred) {
            return onAuthSuccess(cred.user, username);
          })
          .catch(function (err) {
            var msg = err.message || 'Sign up failed.';
            if (err.code === 'auth/email-already-in-use') msg = 'This email is already in use.';
            else if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
            showMessage(msgEl, msg, true);
          });
      });
    }
  });
})();
