/**
 * Friends Screen
 * Loads the current user's friends subcollection and renders friend cards.
 * Handles add-friend flow via live username search + friend request system.
 * Inbox shows incoming friend requests with Accept button.
 */
(function () {
  'use strict';

  // Pet spritesheet map (petRef -> asset path)
  var PET_SPRITES = {
    Bat:             '../../assets/spritesheets/CubicBatAdult.png',
    Cat:             '../../assets/spritesheets/CubicCatAdult.png',
    Fox:             '../../assets/spritesheets/CubicFoxAdult.png',
    Fish:            '../../assets/spritesheets/CubicFishAdult.png',
    Frog:            '../../assets/spritesheets/CubicFrogAdult.png',
    Wolf:            '../../assets/spritesheets/CubicWolfAdult.png',
    Giraffe:         '../../assets/spritesheets/CubicGiraffeAdult.png',
    MicoLeaoDourado: '../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png',
  };

  var auth = null;
  var db   = null;

  // ── DOM refs – friends list ───────────────────────────
  var backBtn         = document.getElementById('community-back-btn');
  var friendsList     = document.getElementById('friends-list');
  var friendsEmpty    = document.getElementById('friends-empty');
  var friendsLoading  = document.getElementById('friends-loading');
  var addFriendBtn    = document.getElementById('add-friend-btn');
  var inboxBtn        = document.getElementById('inbox-btn');
  var inboxBadge      = document.getElementById('inbox-badge');

  // ── DOM refs – add friend modal ───────────────────────
  var addModal        = document.getElementById('add-friend-modal');
  var addBackdrop     = document.getElementById('add-friend-backdrop');
  var addCloseBtn     = document.getElementById('add-friend-close-btn');
  var addInput        = document.getElementById('add-friend-input');
  var addMsg          = document.getElementById('add-friend-msg');
  var addResults      = document.getElementById('add-friend-results');

  // ── DOM refs – remove confirm modal ──────────────────
  var removeModal     = document.getElementById('remove-confirm-modal');
  var removeBackdrop  = document.getElementById('remove-confirm-backdrop');
  var removeCancelBtn = document.getElementById('remove-confirm-cancel');
  var removeOkBtn     = document.getElementById('remove-confirm-ok');
  var removeNameEl    = document.getElementById('remove-confirm-name');

  // Pending removal state
  var pendingRemove   = null; // { friendUid, cardEl, removeBtn }

  function openRemoveModal(friendUid, username, cardEl, removeBtn) {
    if (!removeModal) return;
    pendingRemove = { friendUid: friendUid, cardEl: cardEl, removeBtn: removeBtn };
    if (removeNameEl) removeNameEl.textContent = username || 'this friend';
    removeModal.classList.remove('hidden');
  }

  function closeRemoveModal() {
    if (!removeModal) return;
    removeModal.classList.add('hidden');
    if (pendingRemove && pendingRemove.removeBtn) {
      pendingRemove.removeBtn.disabled = false;
    }
    pendingRemove = null;
  }

  if (removeCancelBtn) removeCancelBtn.addEventListener('click', closeRemoveModal);
  if (removeBackdrop)  removeBackdrop.addEventListener('click', closeRemoveModal);

  if (removeOkBtn) {
    removeOkBtn.addEventListener('click', function () {
      if (!pendingRemove) return;
      removeOkBtn.disabled = true;
      var p = pendingRemove;
      pendingRemove = null;
      removeModal.classList.add('hidden');
      removeFriend(p.friendUid, p.cardEl);
    });
  }

  // ── DOM refs – inbox modal ────────────────────────────
  var inboxModal      = document.getElementById('inbox-modal');
  var inboxBackdrop   = document.getElementById('inbox-backdrop');
  var inboxCloseBtn   = document.getElementById('inbox-close-btn');
  var inboxList       = document.getElementById('inbox-list');
  var inboxEmptyEl    = document.getElementById('inbox-empty');
  var inboxLoadingEl  = document.getElementById('inbox-loading');

  var searchDebounce  = null;
  var sentRequestUids = {}; // UIDs we sent a request to this session
  var friendUidSet    = {}; // UIDs that are already friends

  // ── Navigation ────────────────────────────────────────
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.href = '../community-main/index.html';
    });
  }

  // ── Add Friend modal ──────────────────────────────────
  function openAddModal() {
    if (!addModal) return;
    if (addInput) addInput.value = '';
    hideAddMsg();
    if (addResults) addResults.innerHTML = '';
    addModal.classList.remove('hidden');
    setTimeout(function () { if (addInput) addInput.focus(); }, 50);
  }

  function closeAddModal() {
    if (!addModal) return;
    addModal.classList.add('hidden');
  }

  function showAddMsg(text, isError) {
    if (!addMsg) return;
    addMsg.textContent = text;
    addMsg.className = 'friends-modal__msg ' + (isError ? 'friends-modal__msg--error' : 'friends-modal__msg--success');
    addMsg.classList.remove('hidden');
  }

  function hideAddMsg() {
    if (!addMsg) return;
    addMsg.classList.add('hidden');
  }

  if (addFriendBtn) addFriendBtn.addEventListener('click', openAddModal);
  if (addCloseBtn)  addCloseBtn.addEventListener('click', closeAddModal);
  if (addBackdrop)  addBackdrop.addEventListener('click', closeAddModal);

  // ── Inbox modal ───────────────────────────────────────
  function openInboxModal(uid) {
    if (!inboxModal) return;
    inboxModal.classList.remove('hidden');
    loadInbox(uid);
  }

  function closeInboxModal() {
    if (!inboxModal) return;
    inboxModal.classList.add('hidden');
  }

  if (inboxBtn) {
    inboxBtn.addEventListener('click', function () {
      if (auth && auth.currentUser) openInboxModal(auth.currentUser.uid);
    });
  }
  if (inboxCloseBtn) inboxCloseBtn.addEventListener('click', closeInboxModal);
  if (inboxBackdrop) inboxBackdrop.addEventListener('click', closeInboxModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (removeModal && !removeModal.classList.contains('hidden')) closeRemoveModal();
      if (addModal && !addModal.classList.contains('hidden')) closeAddModal();
      if (inboxModal && !inboxModal.classList.contains('hidden')) closeInboxModal();
    }
  });

  // ── Friends list render helpers ───────────────────────
  function showLoading() {
    friendsLoading.classList.remove('hidden');
    friendsList.classList.add('hidden');
    friendsEmpty.classList.add('hidden');
  }

  function showList(hasItems) {
    friendsLoading.classList.add('hidden');
    if (hasItems) {
      friendsList.classList.remove('hidden');
      friendsEmpty.classList.add('hidden');
    } else {
      friendsList.classList.add('hidden');
      friendsEmpty.classList.remove('hidden');
    }
  }

  function buildFriendCard(friendData) {
    var li = document.createElement('li');
    li.className = 'friend-card';

    var avatar = document.createElement('div');
    avatar.className = 'friend-card__avatar';
    var sprite = PET_SPRITES[friendData.petRef];
    if (sprite) {
      avatar.style.backgroundImage = 'url("' + sprite + '")';
    } else {
      avatar.classList.add('friend-card__avatar--empty');
      avatar.textContent = '🥚';
    }

    var info = document.createElement('div');
    info.className = 'friend-card__info';

    var name = document.createElement('span');
    name.className = 'friend-card__name';
    name.textContent = friendData.username || 'Unknown';

    var trophy = document.createElement('div');
    trophy.className = 'friend-card__trophy';

    var trophyIcon = document.createElement('img');
    trophyIcon.src = '../../assets/icons/trophy.png';
    trophyIcon.className = 'friend-card__trophy-icon';
    trophyIcon.alt = '';

    var trophyCount = document.createElement('span');
    trophyCount.className = 'friend-card__trophy-count';
    trophyCount.textContent = Number(friendData.trophy || 0).toLocaleString();

    trophy.appendChild(trophyIcon);
    trophy.appendChild(trophyCount);
    info.appendChild(name);
    info.appendChild(trophy);

    var matchBtn = document.createElement('button');
    matchBtn.type = 'button';
    matchBtn.className = 'friend-card__match-btn';
    matchBtn.setAttribute('aria-label', 'Match against ' + (friendData.username || 'friend'));

    var matchIcon = document.createElement('img');
    matchIcon.src = '../../assets/icons/swords.png';
    matchIcon.className = 'friend-card__match-icon';
    matchIcon.alt = '';

    var matchLabel = document.createElement('span');
    matchLabel.textContent = 'Match';

    matchBtn.appendChild(matchIcon);
    matchBtn.appendChild(matchLabel);
    matchBtn.addEventListener('click', function () {
      window.location.href = '../community-multiplayer/index.html';
    });

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'friend-card__remove-btn';
    removeBtn.setAttribute('aria-label', 'Remove ' + (friendData.username || 'friend'));
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function () {
      removeBtn.disabled = true;
      openRemoveModal(friendData.friendUid, friendData.username, li, removeBtn);
    });

    li.appendChild(avatar);
    li.appendChild(info);
    li.appendChild(matchBtn);
    li.appendChild(removeBtn);
    return li;
  }

  function removeFriend(friendUid, cardEl) {
    var currentUid = auth.currentUser.uid;
    var batch = db.batch();
    batch.delete(db.collection('users').doc(currentUid).collection('friends').doc(friendUid));
    batch.delete(db.collection('users').doc(friendUid).collection('friends').doc(currentUid));
    batch.commit()
      .then(function () {
        delete friendUidSet[friendUid];
        if (cardEl) cardEl.remove();
        if (friendsList && friendsList.children.length === 0) showList(false);
      })
      .catch(function (err) {
        console.error('Remove friend error:', err);
        var btn = cardEl ? cardEl.querySelector('.friend-card__remove-btn') : null;
        if (btn) btn.disabled = false;
        if (removeOkBtn) removeOkBtn.disabled = false;
      });
  }

  // ── Load friends ──────────────────────────────────────
  function loadFriends(uid) {
    showLoading();

    db.collection('users').doc(uid).collection('friends')
      .get()
      .then(function (snap) {
        friendsList.innerHTML = '';
        var friends = [];

        friendUidSet = {};
        snap.forEach(function (doc) {
          if (doc.id === '_meta') return;
          var data = doc.data();
          if (data.friendUid) {
            friends.push(data);
            friendUidSet[data.friendUid] = true;
          }
        });

        friends.sort(function (a, b) {
          return (a.username || '').localeCompare(b.username || '');
        });

        friends.forEach(function (f) {
          friendsList.appendChild(buildFriendCard(f));
        });
        showList(friends.length > 0);
      })
      .catch(function (err) {
        console.error('Failed to load friends:', err);
        showList(false);
      });
  }

  // ── Inbox badge ───────────────────────────────────────
  function loadBadge(uid) {
    if (!db || !inboxBadge) return;
    db.collection('users').doc(uid).collection('friendRequests').get()
      .then(function (snap) {
        var count = snap.size;
        if (count > 0) {
          inboxBadge.textContent = count > 99 ? '99+' : String(count);
          inboxBadge.classList.remove('hidden');
        } else {
          inboxBadge.classList.add('hidden');
        }
      })
      .catch(function (err) { console.error('Badge load error:', err); });
  }

  // ── Inbox ─────────────────────────────────────────────
  function loadInbox(uid) {
    if (!inboxList || !inboxEmptyEl || !inboxLoadingEl) return;
    inboxList.innerHTML = '';
    inboxEmptyEl.classList.add('hidden');
    inboxLoadingEl.classList.remove('hidden');

    db.collection('users').doc(uid).collection('friendRequests').get()
      .then(function (snap) {
        inboxLoadingEl.classList.add('hidden');
        if (snap.empty) {
          inboxEmptyEl.classList.remove('hidden');
          return;
        }
        snap.forEach(function (doc) {
          var data = doc.data();
          data._id = doc.id;
          inboxList.appendChild(buildRequestCard(data, uid));
        });
      })
      .catch(function (err) {
        console.error('Load inbox error:', err);
        inboxLoadingEl.classList.add('hidden');
        inboxEmptyEl.classList.remove('hidden');
      });
  }

  function buildRequestCard(reqData, currentUid) {
    var li = document.createElement('li');
    li.className = 'inbox-card';

    var avatar = document.createElement('div');
    avatar.className = 'inbox-card__avatar';
    var sprite = PET_SPRITES[reqData.petRef];
    if (sprite) {
      avatar.style.backgroundImage = 'url("' + sprite + '")';
      avatar.style.backgroundSize = '700% auto';
      avatar.style.backgroundPosition = '0% 0%';
      avatar.style.backgroundRepeat = 'no-repeat';
      avatar.style.imageRendering = 'pixelated';
    } else {
      avatar.textContent = '🥚';
    }

    var info = document.createElement('div');
    info.className = 'inbox-card__info';

    var name = document.createElement('span');
    name.className = 'inbox-card__name';
    name.textContent = reqData.username || 'Unknown';

    var trophyDiv = document.createElement('div');
    trophyDiv.className = 'inbox-card__trophy';

    var trophyIcon = document.createElement('img');
    trophyIcon.src = '../../assets/icons/trophy.png';
    trophyIcon.className = 'inbox-card__trophy-icon';
    trophyIcon.alt = '';

    var trophyCount = document.createElement('span');
    trophyCount.className = 'inbox-card__trophy-count';
    trophyCount.textContent = Number(reqData.trophy || 0).toLocaleString();

    trophyDiv.appendChild(trophyIcon);
    trophyDiv.appendChild(trophyCount);
    info.appendChild(name);
    info.appendChild(trophyDiv);

    var rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'inbox-card__reject-btn';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', function () {
      rejectBtn.disabled = true;
      rejectRequest(currentUid, reqData._id, li);
    });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inbox-card__accept-btn';
    btn.textContent = 'Accept';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      rejectBtn.disabled = true;
      btn.textContent = '...';
      acceptRequest(currentUid, reqData, li);
    });

    li.appendChild(avatar);
    li.appendChild(info);
    li.appendChild(rejectBtn);
    li.appendChild(btn);
    return li;
  }

  function rejectRequest(currentUid, requestId, cardEl) {
    db.collection('users').doc(currentUid).collection('friendRequests').doc(requestId).delete()
      .then(function () {
        if (cardEl) cardEl.remove();
        if (inboxList && inboxList.children.length === 0 && inboxEmptyEl) {
          inboxEmptyEl.classList.remove('hidden');
        }
        loadBadge(currentUid);
      })
      .catch(function (err) {
        console.error('Reject request error:', err);
        var btn = cardEl ? cardEl.querySelector('.inbox-card__reject-btn') : null;
        if (btn) btn.disabled = false;
      });
  }

  function acceptRequest(currentUid, reqData, cardEl) {
    var fromUid = reqData._id || reqData.fromUid;

    db.collection('users').doc(currentUid).get()
      .then(function (snap) {
        var meData = snap.exists ? snap.data() : {};
        var myPetPromise = meData.activePetId
          ? db.collection('users').doc(currentUid).collection('pets').doc(meData.activePetId).get()
          : Promise.resolve(null);

        return myPetPromise.then(function (petSnap) {
          var myPetRef = (petSnap && petSnap.exists) ? petSnap.data().petRef : null;
          var now = firebase.firestore.FieldValue.serverTimestamp();
          var batch = db.batch();

          // Add them to my friends
          batch.set(
            db.collection('users').doc(currentUid).collection('friends').doc(fromUid),
            {
              friendUid: fromUid,
              username:  reqData.username || '',
              trophy:    Number(reqData.trophy || 0),
              petRef:    reqData.petRef || null,
              addedAt:   now,
            }
          );

          // Add me to their friends (requires the special Firestore rule below)
          batch.set(
            db.collection('users').doc(fromUid).collection('friends').doc(currentUid),
            {
              friendUid: currentUid,
              username:  meData.username || '',
              trophy:    Number(meData.trophy || 0),
              petRef:    myPetRef || null,
              addedAt:   now,
            }
          );

          // Delete the request
          batch.delete(
            db.collection('users').doc(currentUid).collection('friendRequests').doc(fromUid)
          );

          return batch.commit();
        });
      })
      .then(function () {
        if (cardEl) cardEl.remove();
        // Show empty state if no more requests
        if (inboxList && inboxList.children.length === 0 && inboxEmptyEl) {
          inboxEmptyEl.classList.remove('hidden');
        }
        if (auth && auth.currentUser) {
          loadBadge(auth.currentUser.uid);
          loadFriends(auth.currentUser.uid);
        }
      })
      .catch(function (err) {
        console.error('Accept request error:', err);
        var btn = cardEl ? cardEl.querySelector('.inbox-card__accept-btn') : null;
        if (btn) { btn.disabled = false; btn.textContent = 'Accept'; }
      });
  }

  // ── Live username search ──────────────────────────────
  function searchUsers(query, currentUid) {
    if (!addResults) return;
    query = query.trim();

    if (query.length < 2) {
      addResults.innerHTML = '';
      return;
    }

    addResults.innerHTML = '<li class="inbox-card" style="justify-content:center;background:none;border:none;box-shadow:none;padding:8px 0"><span style="color:#7a6a55;font-size:13px;">Searching…</span></li>';

    db.collection('usernames')
      .orderBy('username')
      .startAt(query)
      .endAt(query + '\uf8ff')
      .limit(6)
      .get()
      .then(function (snap) {
        var users = [];
        snap.forEach(function (doc) {
          var data = doc.data();
          if (data.uid !== currentUid && !friendUidSet[data.uid]) {
            users.push({ uid: data.uid, username: data.username || doc.id });
          }
        });

        if (users.length === 0) {
          addResults.innerHTML = '<li class="inbox-card" style="justify-content:center;background:none;border:none;box-shadow:none;padding:8px 0"><span style="color:#7a6a55;font-size:13px;">No users found</span></li>';
          return;
        }

        // Fetch each user's doc + active pet doc for trophy and sprite
        return Promise.all(users.map(function (u) {
          return db.collection('users').doc(u.uid).get()
            .then(function (uSnap) {
              var uData = uSnap.exists ? uSnap.data() : {};
              var petPromise = uData.activePetId
                ? db.collection('users').doc(u.uid).collection('pets').doc(uData.activePetId).get()
                : Promise.resolve(null);
              return petPromise.then(function (petSnap) {
                return {
                  uid:      u.uid,
                  username: u.username,
                  trophy:   Number(uData.trophy || 0),
                  petRef:   (petSnap && petSnap.exists) ? petSnap.data().petRef : null,
                };
              });
            })
            .catch(function (err) {
              console.error('[community] Failed to fetch user/pet data for uid:', u.uid, err);
              return { uid: u.uid, username: u.username, trophy: 0, petRef: null };
            });
        })).then(function (enriched) {
          addResults.innerHTML = '';
          enriched.forEach(function (userData) {
            addResults.appendChild(buildSearchResultCard(userData, currentUid));
          });
        });
      })
      .catch(function (err) {
        console.error('Search error:', err);
        addResults.innerHTML = '<li class="inbox-card" style="justify-content:center;background:none;border:none;box-shadow:none;padding:8px 0"><span style="color:#7a6a55;font-size:13px;">Search failed. Try again.</span></li>';
      });
  }

  function buildSearchResultCard(userData, currentUid) {
    var li = document.createElement('li');
    li.className = 'inbox-card';

    var avatar = document.createElement('div');
    avatar.className = 'inbox-card__avatar';
    var sprite = PET_SPRITES[userData.petRef];
    if (sprite) {
      avatar.style.backgroundImage = 'url("' + sprite + '")';
      avatar.style.backgroundSize = '700% auto';
      avatar.style.backgroundPosition = '0% 0%';
      avatar.style.backgroundRepeat = 'no-repeat';
      avatar.style.imageRendering = 'pixelated';
    } else {
      avatar.textContent = '🥚';
    }

    var info = document.createElement('div');
    info.className = 'inbox-card__info';

    var name = document.createElement('span');
    name.className = 'inbox-card__name';
    name.textContent = userData.username;

    var trophyDiv = document.createElement('div');
    trophyDiv.className = 'inbox-card__trophy';

    var trophyIcon = document.createElement('img');
    trophyIcon.src = '../../assets/icons/trophy.png';
    trophyIcon.className = 'inbox-card__trophy-icon';
    trophyIcon.alt = '';

    var trophyCount = document.createElement('span');
    trophyCount.className = 'inbox-card__trophy-count';
    trophyCount.textContent = Number(userData.trophy || 0).toLocaleString();

    trophyDiv.appendChild(trophyIcon);
    trophyDiv.appendChild(trophyCount);
    info.appendChild(name);
    info.appendChild(trophyDiv);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inbox-card__request-btn';
    if (sentRequestUids[userData.uid]) {
      btn.textContent = 'Requested';
      btn.disabled = true;
    } else {
      btn.textContent = 'Send Request';
      btn.addEventListener('click', function () {
        btn.disabled = true;
        sendFriendRequest(currentUid, userData, btn);
      });
    }

    li.appendChild(avatar);
    li.appendChild(info);
    li.appendChild(btn);
    return li;
  }

  // Wire up live search
  if (addInput) {
    addInput.addEventListener('input', function () {
      var val = addInput.value;
      clearTimeout(searchDebounce);
      if (!val || val.trim().length < 2) {
        if (addResults) addResults.innerHTML = '';
        return;
      }
      searchDebounce = setTimeout(function () {
        if (auth && auth.currentUser) searchUsers(val, auth.currentUser.uid);
      }, 300);
    });
  }

  // ── Send friend request ───────────────────────────────
  function sendFriendRequest(currentUid, targetData, btn) {
    hideAddMsg();

    // Check already friends, then fetch my data and send request
    // (We cannot read another user's friendRequests subcollection per security rules)
    db.collection('users').doc(currentUid).collection('friends').doc(targetData.uid).get()
      .then(function (friendSnap) {
        if (friendSnap.exists) throw { friendlyMsg: targetData.username + ' is already your friend!' };
        return db.collection('users').doc(currentUid).get();
      })
      .then(function (meSnap) {
        var meData = meSnap.exists ? meSnap.data() : {};
        var myPetPromise = meData.activePetId
          ? db.collection('users').doc(currentUid).collection('pets').doc(meData.activePetId).get()
          : Promise.resolve(null);

        return myPetPromise.then(function (petSnap) {
          var myPetRef = (petSnap && petSnap.exists) ? petSnap.data().petRef : null;
          var now = firebase.firestore.FieldValue.serverTimestamp();

          return db.collection('users').doc(targetData.uid).collection('friendRequests').doc(currentUid).set({
            fromUid:  currentUid,
            username: meData.username || '',
            trophy:   Number(meData.trophy || 0),
            petRef:   myPetRef || null,
            sentAt:   now,
          });
        });
      })
      .then(function () {
        sentRequestUids[targetData.uid] = true;
        btn.textContent = 'Requested';
        showAddMsg('Request sent to ' + targetData.username + '!', false);
      })
      .catch(function (err) {
        if (err && err.friendlyMsg) {
          showAddMsg(err.friendlyMsg, true);
        } else {
          console.error('Send request error:', err);
          showAddMsg('Something went wrong. Please try again.', true);
        }
        btn.disabled = false;
      });
  }

  // ── Firebase init ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase === 'undefined') {
      console.error('Firebase not loaded');
      showList(false);
      return;
    }

    auth = firebase.auth();
    db   = firebase.firestore();

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = '../start/index.html';
        return;
      }
      loadFriends(user.uid);
      loadBadge(user.uid);
    });
  });
})();
