/**
 * signin.js – Logic for the Sign in screen only.
 * Add form handling, validation, and Firebase (or your) sign-in here.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.getElementById('signin-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        // Navigate explicitly back to the Welcome popup
        window.location.href = '../../popup.html';
      });
    }

    var signupLink = document.getElementById('signin-signup-link');
    if (signupLink) {
      signupLink.addEventListener('click', function () {
        window.location.href = '../signup/index.html';
      });
    }
  });
})();
