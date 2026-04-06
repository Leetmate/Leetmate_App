/**
 * Routes Community Green header actions.
 */
(function () {
  'use strict';

  var backBtn = document.getElementById('community-back-btn');
  if (!backBtn) return;

  backBtn.addEventListener('click', function () {
    window.location.href = '../community-main/index.html';
  });
})();

