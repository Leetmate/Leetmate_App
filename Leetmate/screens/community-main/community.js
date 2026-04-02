/**
 * Routes the Community section buttons to their destination screens.
 */
(function () {
  'use strict';

  var ids = ['multiplayer-btn', 'leaderboard-btn', 'friends-btn'];
  var routes = {
    'multiplayer-btn': '../community-multiplayer/index.html',
    'leaderboard-btn': '../community-leaderboard/index.html',
    'friends-btn': '../community-friends/index.html'
  };

  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function () {
      window.location.href = routes[id];
    });
  });
})();

