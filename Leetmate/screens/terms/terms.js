(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = document.getElementById('terms-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        // Return to the signup screen by default.
        window.location.href = '../signup/index.html';
      });
    }
  });
})();

