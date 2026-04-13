(function () {
  'use strict';

  var backBtn = document.getElementById('friend-profile-back-btn');
  var usernameEl = document.getElementById('friend-profile-username');
  var contentEl = document.querySelector('.friend-profile-content');
  var auth = null;
  var db = null;

  var STAT_ITEMS = [
    { label: 'Level', value: 0 },
    { label: 'Streak', value: 0 },
    { label: 'Coins', value: 0 },
    { label: 'Pets Owned', value: 0 },
    { label: 'Trophys', value: 0 }
  ];

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.href = '../community-friends/index.html';
    });
  }

  function getFriendUidFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get('uid') || '';
    } catch (error) {
      return '';
    }
  }

  function getPetPath(petRef, petStage) {
    var safeRef = petRef || 'Cat';
    var stage = String(petStage || 'Adult').toLowerCase();
    var base = '../../assets';

    if (stage === 'egg') {
      return {
        src: base + '/eggs/Cubic' + safeRef + 'Egg.png',
        isEgg: true
      };
    }
    if (stage === 'baby') {
      return {
        src: base + '/spritesheets/Cubic' + safeRef + 'Baby.png',
        isEgg: false
      };
    }
    return {
      src: base + '/spritesheets/Cubic' + safeRef + 'Adult.png',
      isEgg: false
    };
  }

  function buildStatsGrid() {
    var grid = document.createElement('div');
    grid.className = 'friend-stats-grid';

    STAT_ITEMS.forEach(function (item) {
      var tile = document.createElement('div');
      tile.className = 'friend-stat-tile';

      var label = document.createElement('span');
      label.className = 'friend-stat-label';
      label.textContent = item.label;

      var value = document.createElement('span');
      value.className = 'friend-stat-value';
      value.textContent = String(item.value);

      tile.appendChild(label);
      tile.appendChild(value);
      grid.appendChild(tile);
    });

    return grid;
  }

  function showError(message) {
    if (!contentEl) return;
    contentEl.innerHTML = '';
    var errorEl = document.createElement('p');
    errorEl.className = 'friend-profile-error';
    errorEl.textContent = message;
    contentEl.appendChild(errorEl);
  }

  function showLoading() {
    if (!contentEl) return;
    contentEl.innerHTML = '<p class="friend-profile-loading">Loading profile...</p>';
  }

  function renderProfile(userData, petData) {
    if (!contentEl) return;
    contentEl.innerHTML = '';

    var username = (userData && userData.username) || 'Unknown Friend';
    var profileColor = (userData && userData.profileColor) || '#d9d9d9';
    var petRef = (petData && petData.petRef) || 'Cat';
    var petStage = (petData && petData.stage) || 'Adult';
    var petInfo = getPetPath(petRef, petStage);

    if (usernameEl) {
      usernameEl.textContent = username;
    }

    var avatarEl = document.createElement('div');
    avatarEl.className = 'friend-profile-avatar';
    avatarEl.style.backgroundColor = profileColor;

    var avatarImg = document.createElement('img');
    avatarImg.className = 'friend-profile-avatar-img';
    avatarImg.src = petInfo.src;
    avatarImg.alt = username + ' active pet';
    if (petInfo.isEgg) {
      avatarImg.classList.add('is-egg');
    } else {
      avatarImg.classList.add('is-sprite');
    }

    avatarEl.appendChild(avatarImg);
    contentEl.appendChild(avatarEl);
    contentEl.appendChild(buildStatsGrid());
  }

  function loadFriendProfile(friendUid) {
    db.collection('users').doc(friendUid).get()
      .then(function (userSnap) {
        if (!userSnap.exists) {
          throw new Error('Friend profile not found.');
        }

        var userData = userSnap.data() || {};
        var activePetId = userData.activePetId;

        if (!activePetId) {
          renderProfile(userData, null);
          return null;
        }

        return db
          .collection('users')
          .doc(friendUid)
          .collection('pets')
          .doc(activePetId)
          .get()
          .then(function (petSnap) {
            var petData = petSnap.exists ? petSnap.data() : null;
            renderProfile(userData, petData);
          });
      })
      .catch(function (error) {
        console.error('Failed to load friend profile:', error);
        showError('Could not load this friend profile right now.');
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase === 'undefined') {
      showError('Unable to load profile services.');
      return;
    }

    auth = firebase.auth();
    db = firebase.firestore();

    var friendUid = getFriendUidFromQuery();
    if (!friendUid) {
      showError('Missing friend profile id.');
      return;
    }

    showLoading();
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = '../start/index.html';
        return;
      }
      loadFriendProfile(friendUid);
    });
  });
})();
