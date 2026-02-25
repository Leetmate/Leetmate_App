(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.getElementById('signup-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        window.location.href = '../../popup.html';
      });
    }
  });
})();
