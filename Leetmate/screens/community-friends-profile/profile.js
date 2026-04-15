(function () {
  'use strict';

  var backBtn = document.getElementById('friend-profile-back-btn');
  var usernameEl = document.getElementById('friend-profile-username');
  var contentEl = document.querySelector('.friend-profile-content');
  var auth = null;
  var db = null;

  function deriveLevel(userData) {
    if (!userData) return 1;
    var lv = userData.level;
    if (lv !== undefined && lv !== null && Number.isFinite(Number(lv))) {
      return Math.max(1, Math.floor(Number(lv)));
    }
    var xp = Number(userData.xp) || 0;
    return Math.max(1, Math.floor(xp / 100) + 1);
  }

  function buildStatsFromUser(userData, petDocCount) {
    var data = userData || {};
    return {
      level: deriveLevel(data),
      streak: Math.max(0, Math.floor(Number(data.streak) || 0)),
      pets: Math.max(0, Math.floor(Number(petDocCount) || 0)),
      trophy: Math.max(0, Math.floor(Number(data.trophy) || 0))
    };
  }

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

  var PET_DEFAULT_NAMES = {
    Bat: 'Cubic Bat',
    Cat: 'Cubic Cat',
    Fox: 'Cubic Fox',
    Fish: 'Cubic Fish',
    Frog: 'Cubic Frog',
    Wolf: 'Cubic Wolf',
    Giraffe: 'Cubic Giraffe',
    MicoLeaoDourado: 'Mico Leão Dourado'
  };

  function getPetDisplayName(petData) {
    if (!petData) return '';
    var custom = (petData.customName || '').trim();
    if (custom) return custom;
    var ref = petData.petRef || '';
    if (PET_DEFAULT_NAMES[ref]) return PET_DEFAULT_NAMES[ref];
    return ref || 'Pet';
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

  function buildStatsGrid(stats) {
    var s = stats || buildStatsFromUser(null, 0);
    var items = [
      { label: 'Level', value: s.level },
      { label: 'Streak', value: s.streak },
      { label: 'Pets', value: s.pets },
      { label: 'Trophys', value: s.trophy }
    ];

    var grid = document.createElement('div');
    grid.className = 'friend-stats-grid';

    items.forEach(function (item) {
      var tile = document.createElement('div');
      tile.className = 'friend-stat-tile';

      var label = document.createElement('span');
      label.className = 'friend-stat-label';
      label.textContent = item.label;

      var value = document.createElement('span');
      value.className = 'friend-stat-value';
      value.textContent = Number(item.value || 0).toLocaleString();

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

  function renderProfile(userData, petData, stats) {
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

    var petBlock = document.createElement('div');
    petBlock.className = 'friend-profile-pet-block';

    var avatarEl = document.createElement('div');
    avatarEl.className = 'friend-profile-avatar';
    avatarEl.style.backgroundColor = profileColor;

    var avatarImg = document.createElement('img');
    avatarImg.className = 'friend-profile-avatar-img friend-profile-avatar-img--animate';
    avatarImg.src = petInfo.src;
    avatarImg.alt = username + ' active pet';
    if (petInfo.isEgg) {
      avatarImg.classList.add('is-egg');
    } else {
      avatarImg.classList.add('is-sprite');
    }

    avatarEl.appendChild(avatarImg);

    var petNameEl = document.createElement('p');
    petNameEl.className = 'friend-profile-pet-name';
    if (petData) {
      petNameEl.textContent = getPetDisplayName(petData);
    } else {
      petNameEl.textContent = 'No active pet';
      petNameEl.classList.add('friend-profile-pet-name--muted');
    }

    petBlock.appendChild(avatarEl);
    petBlock.appendChild(petNameEl);
    contentEl.appendChild(petBlock);
    contentEl.appendChild(buildStatsGrid(stats));
  }

  function loadFriendProfile(friendUid) {
    var userRef = db.collection('users').doc(friendUid);

    Promise.all([userRef.get(), userRef.collection('pets').get()])
      .then(function (results) {
        var userSnap = results[0];
        var petsSnap = results[1];

        if (!userSnap.exists) {
          throw new Error('Friend profile not found.');
        }

        var userData = userSnap.data() || {};
        var petDocCount = petsSnap.size;
        var stats = buildStatsFromUser(userData, petDocCount);
        var activePetId = userData.activePetId;

        if (!activePetId) {
          renderProfile(userData, null, stats);
          return null;
        }

        return userRef
          .collection('pets')
          .doc(activePetId)
          .get()
          .then(function (petSnap) {
            var petData = petSnap.exists ? petSnap.data() : null;
            renderProfile(userData, petData, stats);
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
