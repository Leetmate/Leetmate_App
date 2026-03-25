/**
 * Routes the Community section buttons to their destination screens.
 */
(function () {
  'use strict';

  var dest = '../community-green/index.html';
  var ids = ['multiplayer-btn', 'leaderboard-btn', 'friends-btn'];

  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function () {
      window.location.href = dest;
    });
  });
})();

