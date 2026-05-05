(function () {
  'use strict';

  var backBtn = document.getElementById('friend-profile-back-btn');
  var usernameEl = document.getElementById('friend-profile-username');
  var contentEl = document.querySelector('.friend-profile-content');
  var auth = null;
  var db = null;
  var SENT_REQUESTS_STORAGE_KEY = 'leetmate_sent_friend_requests';

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
      var params = new URLSearchParams(window.location.search || '');
      var returnTo = params.get('returnTo');
      if (returnTo === 'leaderboard') {
        window.location.href = '../community-leaderboard/index.html';
      } else {
        // Default behavior stays as "back to friends".
        window.location.href = '../community-friends/index.html';
      }
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

  function getReturnToFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get('returnTo') || '';
    } catch (error) {
      return '';
    }
  }

  function getSentRequestsMap() {
    try {
      var raw = window.localStorage.getItem(SENT_REQUESTS_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function markSentRequest(currentUid, targetUid) {
    if (!currentUid || !targetUid) return;
    var map = getSentRequestsMap();
    if (!map[currentUid] || typeof map[currentUid] !== 'object') {
      map[currentUid] = {};
    }
    map[currentUid][targetUid] = true;
    try {
      window.localStorage.setItem(SENT_REQUESTS_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      // Ignore storage failures; UI still works for current view.
    }
  }

  function clearSentRequest(currentUid, targetUid) {
    if (!currentUid || !targetUid) return;
    var map = getSentRequestsMap();
    if (!map[currentUid] || typeof map[currentUid] !== 'object') return;
    if (!Object.prototype.hasOwnProperty.call(map[currentUid], targetUid)) return;
    delete map[currentUid][targetUid];
    if (Object.keys(map[currentUid]).length === 0) {
      delete map[currentUid];
    }
    try {
      window.localStorage.setItem(SENT_REQUESTS_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function hasSentRequest(currentUid, targetUid) {
    if (!currentUid || !targetUid) return false;
    var map = getSentRequestsMap();
    return !!(map[currentUid] && map[currentUid][targetUid]);
  }

  var PET_DEFAULT_NAMES = {
    Bat:             'Cubic Bat',
    Cat:             'Cubic Cat',
    Fish:            'Cubic Fish',
    Fox:             'Cubic Fox',
    Frog:            'Cubic Frog',
    Jaguatirica:     'Cubic Jaguatirica',
    Wolf:            'Cubic Wolf',
    Giraffe:         'Cubic Giraffe',
    MicoLeaoDourado: 'Mico Leão Dourado'
  };

  var SINGLE_ROW_PETS = { Fish: true, Jaguatirica: true };

  var ACCESSORY_SUFFIX = {
    'acc-greyhat':       'GreyHat',
    'acc-brownhat':      'BrownHat',
    'acc-strawhat':      'StrawHat',
    'acc-tophat':        'TopHat',
    'acc-santahat':      'SantaHat',
    'acc-leprechaunhat': 'LeprechaunHat'
  };

  function getPetDisplayName(petData) {
    if (!petData) return '';
    var custom = (petData.customName || '').trim();
    if (custom) return custom;
    var ref = petData.petRef || '';
    if (PET_DEFAULT_NAMES[ref]) return PET_DEFAULT_NAMES[ref];
    return ref || 'Pet';
  }

  function normalizePetRef(ref) {
    var r = (ref != null && String(ref).trim()) ? String(ref).trim() : '';
    return r || 'Cat';
  }

  function normalizePetStage(stage) {
    var s = String(stage != null ? stage : 'Adult').trim().toLowerCase();
    if (s === 'egg') return 'egg';
    if (s === 'baby') return 'baby';
    return 'adult';
  }

  function getPetPath(petRef, petStage) {
    var safeRef = normalizePetRef(petRef);
    var stage = normalizePetStage(petStage);
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
    var equippedItemId = (petData && petData.equippedItemId) || null;
    var petInfo = getPetPath(petRef, petStage);

    // Use hat spritesheet if equipped and it's an adult
    var hatSuffix = equippedItemId && ACCESSORY_SUFFIX[equippedItemId];
    if (hatSuffix && normalizePetStage(petStage) === 'adult') {
      petInfo = { src: '../../assets/spritesheets/Cubic' + petRef + hatSuffix + '.png', isEgg: false };
    }

    if (usernameEl) {
      usernameEl.textContent = username;
    }

    var petBlock = document.createElement('div');
    petBlock.className = 'friend-profile-pet-block';

    var avatarEl = document.createElement('div');
    avatarEl.className = 'friend-profile-avatar';
    avatarEl.style.backgroundColor = profileColor;

    if (petInfo.isEgg) {
      var avatarImg = document.createElement('img');
      avatarImg.className = 'friend-profile-avatar-img is-egg';
      avatarImg.src = petInfo.src;
      avatarImg.alt = username + ' active pet';
      avatarEl.appendChild(avatarImg);
    } else {
      var spriteEl = document.createElement('div');
      spriteEl.className = 'friend-profile-avatar-sprite';
      spriteEl.setAttribute('role', 'img');
      spriteEl.setAttribute('aria-label', username + ' active pet');
      spriteEl.style.backgroundImage = 'url("' + petInfo.src + '")';
      if (SINGLE_ROW_PETS[petRef] && !hatSuffix) {
        spriteEl.style.backgroundSize     = '700% 100%';
        spriteEl.style.backgroundPosition = '0% 0%';
      }
      avatarEl.appendChild(spriteEl);
    }

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

  function buildActionArea() {
    var wrap = document.createElement('div');
    wrap.className = 'friend-profile-actions';
    return wrap;
  }

  function buildAddFriendButton(disabled, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'friend-profile-add-btn';
    btn.textContent = label || 'Add Friend';
    if (disabled) btn.disabled = true;
    return btn;
  }

  function sendFriendRequest(currentUid, targetUid) {
    return db.collection('users').doc(currentUid).get()
      .then(function (meSnap) {
        var meData = meSnap.exists ? meSnap.data() : {};
        var myPetPromise = meData.activePetId
          ? db.collection('users').doc(currentUid).collection('pets').doc(meData.activePetId).get()
          : Promise.resolve(null);

        return myPetPromise.then(function (petSnap) {
          var myPetRef = (petSnap && petSnap.exists) ? petSnap.data().petRef : null;
          var now = firebase.firestore.FieldValue.serverTimestamp();

          return db.collection('users').doc(targetUid).collection('friendRequests').doc(currentUid).set({
            fromUid: currentUid,
            username: meData.username || '',
            trophy: Number(meData.trophy || 0),
            petRef: myPetRef || null,
            sentAt: now,
          });
        });
      });
  }

  function buildFriendActionState(currentUid, friendUid, returnTo) {
    var fromLeaderboard = returnTo === 'leaderboard';
    if (!fromLeaderboard || !currentUid || !friendUid || currentUid === friendUid) {
      return Promise.resolve({
        showAddButton: false,
      });
    }

    return Promise.all([
      db.collection('users').doc(currentUid).collection('friends').doc(friendUid).get(),
      db.collection('users').doc(currentUid).collection('friendRequests').doc(friendUid).get(),
    ]).then(function (snaps) {
      var friendSnap = snaps[0];
      var incomingSnap = snaps[1];

      if (friendSnap.exists) {
        clearSentRequest(currentUid, friendUid);
        return { showAddButton: false };
      }

      if (hasSentRequest(currentUid, friendUid)) {
        return {
          showAddButton: true,
          disabled: true,
          label: 'Requested',
          helperText: '',
        };
      }

      if (incomingSnap.exists) {
        return {
          showAddButton: true,
          disabled: true,
          label: 'Pending',
          helperText: 'This user already sent you a request. Check inbox.',
        };
      }

      return {
        showAddButton: true,
        disabled: false,
        label: 'Add Friend',
        helperText: '',
      };
    });
  }

  function renderFriendAction(actionState, currentUid, friendUid) {
    if (!contentEl || !actionState || !actionState.showAddButton) return;

    var statsGridEl = contentEl.querySelector('.friend-stats-grid');
    if (statsGridEl) statsGridEl.classList.add('friend-stats-grid--compact');

    var actionWrap = buildActionArea();
    var helper = document.createElement('p');
    helper.className = 'friend-profile-action-msg';
    helper.textContent = actionState.helperText || '';

    var btn = buildAddFriendButton(!!actionState.disabled, actionState.label);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Sending...';
      helper.textContent = '';
      helper.classList.remove('friend-profile-action-msg--success', 'friend-profile-action-msg--error');
      sendFriendRequest(currentUid, friendUid)
        .then(function () {
          markSentRequest(currentUid, friendUid);
          btn.textContent = 'Requested';
          helper.textContent = '';
          helper.classList.remove('friend-profile-action-msg--error');
          helper.classList.remove('friend-profile-action-msg--success');
        })
        .catch(function (err) {
          console.error('Send friend request from profile failed:', err);
          btn.disabled = false;
          btn.textContent = 'Add Friend';
          helper.textContent = 'Could not send request right now. Please try again.';
          helper.classList.remove('friend-profile-action-msg--success');
          helper.classList.add('friend-profile-action-msg--error');
        });
    });

    actionWrap.appendChild(btn);
    actionWrap.appendChild(helper);
    contentEl.appendChild(actionWrap);
  }

  function loadFriendProfile(friendUid, currentUid, returnTo) {
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

        var actionPromise = buildFriendActionState(currentUid, friendUid, returnTo);
        if (!activePetId) {
          return actionPromise.then(function (actionState) {
            renderProfile(userData, null, stats);
            renderFriendAction(actionState, currentUid, friendUid);
            return null;
          });
        }

        return userRef
          .collection('pets')
          .doc(activePetId)
          .get()
          .then(function (petSnap) {
            var petData = petSnap.exists ? petSnap.data() : null;
            return actionPromise.then(function (actionState) {
              renderProfile(userData, petData, stats);
              renderFriendAction(actionState, currentUid, friendUid);
            });
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
    var returnTo = getReturnToFromQuery();
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
      loadFriendProfile(friendUid, user.uid, returnTo);
    });
  });
})();
