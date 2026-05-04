(function () {
  'use strict';

  /**
   * Real-time friend battles sync through Firestore document:
   *   friendPvPBattles/{minUid}_{maxUid}
   *
   * Rules should verify `uids` (sorted pair) contains request.auth.uid, e.g.:
   *
   *   match /friendPvPBattles/{docId} {
   *     allow create: if request.auth != null
   *       && request.resource.data.uids is list
   *       && request.resource.data.uids.hasAny([request.auth.uid]);
   *     allow read, update, delete: if request.auth != null
   *       && resource.data.uids.hasAny([request.auth.uid]);
   *   }
   *
   * Pending invites: friendBattleInvites/{minUid}_{maxUid}
   *   match /friendBattleInvites/{docId} {
   *     allow create: if request.auth != null
   *       && request.resource.data.uids is list
   *       && request.resource.data.uids.hasAny([request.auth.uid]);
   *     allow read, update, delete: if request.auth != null
   *       && resource.data.uids.hasAny([request.auth.uid]);
   *   }
   */

  var battleAudio = new Audio('../../assets/audio/battleMusic.mp3');
  battleAudio.loop = true;
  battleAudio.volume = 0.14;

  function startBattleMusic() {
    if (window.LeetmateBGMusic) window.LeetmateBGMusic.pause();
    battleAudio.currentTime = 0;
    battleAudio.play().catch(function () {});
  }

  function stopBattleMusic() {
    battleAudio.pause();
    battleAudio.currentTime = 0;
    if (window.LeetmateBGMusic) window.LeetmateBGMusic.resume();
  }

  function setBattleBg(on) {
    var card = document.querySelector('.community-card');
    if (card) card.classList.toggle('battle-mode', !!on);
    var navDrawer = document.getElementById('nav-drawer');
    if (navDrawer) navDrawer.style.display = on ? 'none' : '';
  }

  var db = null;
  var auth = null;
  var myUid = '';
  var opponentUid = '';
  var pairDocId = '';
  var battleRef = null;
  var inviteRef = null;
  var unsub = null;
  var unsubInvite = null;

  var friendDisplayName = 'Friend';
  var lobbyPlayerPet = null;
  var opponentPreviewPet = null;

  var renderedActionSeq = -1;
  var moveSubmitBusy = false;

  var BATTLE_SCREENS = ['screen-matchmaking', 'screen-battle', 'screen-win', 'screen-lose'];

  var ACCESSORY_SUFFIX = {
    'acc-greyhat': 'GreyHat',
    'acc-brownhat': 'BrownHat',
    'acc-strawhat': 'StrawHat',
    'acc-tophat': 'TopHat',
    'acc-santahat': 'SantaHat',
    'acc-leprechaunhat': 'LeprechaunHat'
  };

  var SINGLE_ROW_RE = /CubicFish|CubicJaguatirica/;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function randF(a, b) { return a + Math.random() * (b - a); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
  function setText(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }

  function isSingleRow(src) { return !!(src && SINGLE_ROW_RE.test(src)); }

  function applySprite(el, src, animated) {
    if (!el || !src) return;
    el.style.backgroundImage = 'url("' + src + '")';
    el.classList.toggle('sprite-single', isSingleRow(src));
    if (animated) el.classList.add('is-animated');
  }

  function getOpponentUidFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return (params.get('uid') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function getAcceptFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      return params.get('accept') === '1';
    } catch (e) {
      return false;
    }
  }

  function stripAcceptQueryParam() {
    try {
      var u = new URL(window.location.href);
      u.searchParams.delete('accept');
      var next = u.pathname + (u.search || '');
      history.replaceState(null, '', next);
    } catch (e) { /* ignore */ }
  }

  function showScreen(id) {
    document.querySelectorAll('.battle-screen').forEach(function (s) { s.classList.remove('is-active'); });
    var el = document.getElementById(id);
    if (el) el.classList.add('is-active');
    setBattleBg(BATTLE_SCREENS.indexOf(id) !== -1);
  }

  function goToLobby() {
    stopBattleMusic();
    renderedActionSeq = -1;
    showScreen('screen-lobby');
    initLobby();
  }

  function handleBack() {
    var active = document.querySelector('.battle-screen.is-active');
    if (!active || active.id === 'screen-lobby') {
      cancelOutgoingInvite();
      window.location.href = '../community-friends/index.html';
      return;
    }
    if (active.id === 'screen-battle' || active.id === 'screen-matchmaking') {
      if (confirm('Leave this battle? Your friend will see that you left.')) {
        abandonBattleDoc().finally(function () {
          goToLobby();
        });
      }
      return;
    }
    goToLobby();
  }

  function abandonBattleDoc() {
    if (!battleRef) return Promise.resolve();
    return battleRef.get().then(function (snap) {
      if (!snap.exists) return;
      var d = snap.data();
      if (!d) return;
      if (d.phase === 'battle' || d.phase === 'waiting_friend') {
        return battleRef.update({
          phase: 'cancelled',
          cancelledBy: myUid,
          cancelledAt: Date.now()
        });
      }
    }).catch(function (err) { console.warn('abandonBattleDoc:', err); });
  }

  function buildSpritePathFromPet(pet) {
    if (!pet || !pet.petRef) return null;
    var stage = (pet.stage || 'adult').toLowerCase();
    return '../../assets/spritesheets/Cubic' + pet.petRef + (stage === 'egg' ? 'Baby' : capitalize(stage)) + '.png';
  }

  function opponentSpriteFromFirestore(petRef, equippedItemId, stage) {
    var ref = petRef || 'Cat';
    var st = (stage || 'adult').toLowerCase();
    var suffix = equippedItemId && ACCESSORY_SUFFIX[equippedItemId];
    if (suffix && st === 'adult') {
      return '../../assets/spritesheets/Cubic' + ref + suffix + '.png';
    }
    if (st === 'egg') return '../../assets/eggs/Cubic' + ref + 'Egg.png';
    if (st === 'baby') return '../../assets/spritesheets/Cubic' + ref + 'Baby.png';
    return '../../assets/spritesheets/Cubic' + ref + 'Adult.png';
  }

  function battleEntityFromStats(name, sprite, stats, uidTag) {
    var hpBase = stats.hp != null ? stats.hp : 50;
    return {
      uid: uidTag,
      name: name,
      sprite: sprite,
      maxHp: hpBase * 4,
      hp: hpBase * 4,
      atk: stats.atk != null ? stats.atk : 45,
      def: stats.def != null ? stats.def : 40,
      spAtk: stats.spAtk != null ? stats.spAtk : 40,
      spDef: stats.spDef != null ? stats.spDef : 40,
      spd: stats.spd != null ? stats.spd : 45,
      guarding: false,
      superCd: 0
    };
  }

  function clonePetMap(petByUid) {
    var out = {};
    Object.keys(petByUid || {}).forEach(function (k) {
      var p = petByUid[k];
      out[k] = {
        uid: p.uid,
        name: p.name,
        sprite: p.sprite,
        maxHp: p.maxHp,
        hp: p.hp,
        atk: p.atk,
        def: p.def,
        spAtk: p.spAtk,
        spDef: p.spDef,
        spd: p.spd,
        guarding: !!p.guarding,
        superCd: p.superCd != null ? p.superCd : 0
      };
    });
    return out;
  }

  function resetHpClone(petByUid) {
    var c = clonePetMap(petByUid);
    Object.keys(c).forEach(function (k) {
      c[k].hp = c[k].maxHp;
      c[k].guarding = false;
      c[k].superCd = 0;
    });
    return c;
  }

  function pickFirstTurnUid(petByUid, uidSmall, uidLarge) {
    var a = petByUid[uidSmall];
    var b = petByUid[uidLarge];
    if (!a || !b) return uidSmall;
    if (b.spd > a.spd) return uidLarge;
    if (a.spd > b.spd) return uidSmall;
    return uidSmall;
  }

  function loadFriendUsername() {
    db.collection('users').doc(myUid).collection('friends').doc(opponentUid).get()
      .then(function (snap) {
        var data = snap.exists ? snap.data() : {};
        friendDisplayName = (data && data.username) ? String(data.username) : 'Friend';
        var el = document.getElementById('friend-battle-opponent-label');
        if (el) el.textContent = 'VS ' + friendDisplayName;
      })
      .catch(function () {
        var el = document.getElementById('friend-battle-opponent-label');
        if (el) el.textContent = 'VS Friend';
      });
  }

  function fetchUserPetForBattle(uid) {
    var userRef = db.collection('users').doc(uid);
    return userRef.get().then(function (uSnap) {
      if (!uSnap.exists) return null;
      var uData = uSnap.data() || {};
      var petId = uData.activePetId;
      if (!petId) return null;
      return userRef.collection('pets').doc(petId).get().then(function (petSnap) {
        if (!petSnap.exists) return null;
        var pd = petSnap.data() || {};
        var stage = (pd.stage || 'adult').toLowerCase();
        var name = (pd.customName || '').trim() || ('Cubic ' + (pd.petRef || 'Pet'));
        var sprite = opponentSpriteFromFirestore(pd.petRef, pd.equippedItemId, stage);
        var stats = pd.stats || {};
        var ent = battleEntityFromStats(name, sprite, stats, uid);
        ent.stage = stage;
        return ent;
      });
    });
  }

  function initLobby() {
    if (typeof storageGet !== 'function') return;
    var matchBtnPre = document.getElementById('multi-match-btn');
    if (matchBtnPre) matchBtnPre.disabled = true;
    storageGet(['activePetSnapshot', 'activePetSpritePath']).then(function (data) {
      var pet = data.activePetSnapshot;
      var path = data.activePetSpritePath;
      if (!pet) {
        lobbyPlayerPet = null;
        if (matchBtnPre) matchBtnPre.disabled = true;
        return;
      }

      var stage = (pet.stage || '').toLowerCase();
      var isAdult = stage === 'adult';
      var src = path ? ('../../' + path) : buildSpritePathFromPet(pet);
      var name = (pet.customName || '').trim() || ('Cubic ' + (pet.petRef || 'Pet'));

      var sp = document.getElementById('multi-pet-sprite');
      if (sp && src) {
        applySprite(sp, src, true);
        if (!isAdult) sp.style.filter = 'grayscale(.7) brightness(.7)';
        else sp.style.filter = '';
      }
      setText('multi-pet-name', name);

      var statsCard = document.getElementById('multi-stats-card');
      var matchBtn = document.getElementById('multi-match-btn');
      var lockedEl = document.getElementById('multi-locked');
      var lockedDesc = document.getElementById('multi-locked-desc');

      if (isAdult) {
        if (statsCard) statsCard.style.display = '';
        if (matchBtn) matchBtn.style.display = '';
        if (lockedEl) lockedEl.style.display = 'none';

        var stats = pet.stats || {};
        lobbyPlayerPet = battleEntityFromStats(name, src, stats, myUid);
        lobbyPlayerPet.stage = stage;

        var m = {
          'stat-hp': stats.hp, 'stat-atk': stats.atk, 'stat-def': stats.def,
          'stat-spatk': stats.spAtk, 'stat-spdef': stats.spDef, 'stat-spd': stats.spd
        };
        Object.keys(m).forEach(function (id) {
          setText(id, m[id] != null ? m[id] : '—');
        });

        fetchUserPetForBattle(opponentUid).then(function (opp) {
          opponentPreviewPet = opp;
        }).catch(function () { opponentPreviewPet = null; });
        if (matchBtn) matchBtn.disabled = false;
      } else {
        lobbyPlayerPet = null;
        if (statsCard) statsCard.style.display = 'none';
        if (matchBtn) matchBtn.style.display = 'none';
        if (matchBtn) matchBtn.disabled = true;
        if (lockedEl) lockedEl.style.display = '';
        if (lockedDesc) {
          lockedDesc.textContent = stage === 'egg'
            ? name + ' hasn\'t hatched yet! Evolve to unlock friend battles.'
            : name + ' is still a baby! Evolve to unlock friend battles.';
        }
      }
    }).catch(function (e) { console.warn('Friend battle lobby:', e); })
      .finally(function () { refreshOutgoingInviteUi(); });
  }

  function calcScratch(atk, def) {
    return Math.max(1, Math.round(Math.max(2, atk - def * 0.50) * randF(0.85, 1.15)));
  }

  function calcSuper(spA, spD) {
    return Math.max(2, Math.round(Math.max(3, spA - spD * 0.30) * randF(1.2, 1.5)));
  }

  function applyMoveToPets(pets, actorUid, defenderUid, action) {
    var attacker = pets[actorUid];
    var defender = pets[defenderUid];
    var dmg = 0;
    var log = '';

    if (action === 'scratch') {
      dmg = calcScratch(attacker.atk, defender.def);
      if (defender.guarding) {
        dmg = Math.floor(dmg * 0.5);
        defender.guarding = false;
      }
      defender.hp -= dmg;
      log = attacker.name + ' scratched for ' + dmg + ' damage!';
    } else if (action === 'guard') {
      attacker.guarding = true;
      log = attacker.name + ' braced for impact!';
    } else if (action === 'super') {
      attacker.superCd = 2;
      dmg = calcSuper(attacker.spAtk, defender.spDef);
      if (defender.guarding) {
        dmg = Math.floor(dmg * 0.5);
        defender.guarding = false;
      }
      defender.hp -= dmg;
      log = attacker.name + ' unleashed Super Attack! (' + dmg + ' dmg)';
    }

    return { dmg: dmg, log: log };
  }

  function showFx(who, icon, type) {
    var el = document.getElementById(who + '-fx');
    if (!el) return;
    var img = el.querySelector('img');
    if (img) img.src = icon;
    el.classList.remove('pop', 'pop-scratch', 'pop-guard', 'pop-super');
    void el.offsetWidth;
    var cls = type === 'scratch' ? 'pop-scratch' : type === 'guard' ? 'pop-guard' : type === 'super' ? 'pop-super' : 'pop';
    el.classList.add(cls);
  }

  function flashSprite(spriteId, type) {
    var el = document.getElementById(spriteId);
    if (!el) return;
    el.classList.remove('fx-hit', 'fx-guard', 'fx-super');
    void el.offsetWidth;
    el.classList.add(type === 'hit' ? 'fx-hit' : type === 'guard' ? 'fx-guard' : 'fx-super');
    setTimeout(function () {
      el.classList.remove('fx-hit', 'fx-guard', 'fx-super');
    }, 700);
  }

  function flashArena() {
    var arena = document.querySelector('.battle-arena-zone');
    if (!arena) return;
    var f = document.createElement('div');
    f.style.cssText = 'position:absolute;inset:0;z-index:98;pointer-events:none;border-radius:8px;background:rgba(255,220,30,.55);animation:battle-flash-fade .55s ease forwards;';
    arena.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 620);
  }

  function playSyncedFx(lastAction) {
    if (!lastAction || !lastAction.actorUid) return;
    var actor = lastAction.actorUid;
    var isMe = actor === myUid;

    if (lastAction.action === 'scratch') {
      showFx(isMe ? 'cpu' : 'player', '../../assets/icons/scratch.png', 'scratch');
      flashSprite((isMe ? 'cpu' : 'player') + '-sprite', 'hit');
    } else if (lastAction.action === 'guard') {
      showFx(isMe ? 'player' : 'cpu', '../../assets/icons/guard.png', 'guard');
      flashSprite((isMe ? 'player' : 'cpu') + '-sprite', 'guard');
    } else if (lastAction.action === 'super') {
      showFx(isMe ? 'cpu' : 'player', '../../assets/icons/SuperAttack.png', 'super');
      flashSprite((isMe ? 'cpu' : 'player') + '-sprite', 'super');
      flashArena();
    }
  }

  function updateHpBar(who, cur, max) {
    var pct = Math.max(0, Math.min(1, cur / max)) * 100;
    var bar = document.getElementById(who + '-hp-bar');
    var txt = document.getElementById(who + '-hp-text');
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.backgroundColor = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    }
    if (txt) txt.textContent = Math.max(0, Math.round(cur)) + ' / ' + max;
  }

  function renderBattleShell(d) {
    var pets = d.petByUid || {};
    var me = pets[myUid];
    var opp = pets[opponentUid];
    if (!me || !opp) return;

    var cpuEl = document.getElementById('cpu-sprite');
    var plEl = document.getElementById('player-sprite');
    if (cpuEl) applySprite(cpuEl, opp.sprite, true);
    if (plEl) applySprite(plEl, me.sprite, true);

    setText('cpu-name', opp.name);
    setText('player-name', me.name);
    updateHpBar('cpu', opp.hp, opp.maxHp);
    updateHpBar('player', me.hp, me.maxHp);
    setText('battle-log-text', d.battleLog || '—');

    var turnMine = d.turnUid === myUid;
    var sb = document.getElementById('btn-super');
    var scd = document.getElementById('super-cd-text');
    document.querySelectorAll('.battle-btn').forEach(function (b) { b.disabled = !turnMine || d.phase !== 'battle'; });
    if (turnMine && me.superCd > 0 && sb) {
      sb.disabled = true;
      sb.classList.add('on-cooldown');
      if (scd) {
        scd.textContent = me.superCd;
        scd.classList.add('visible');
      }
    } else if (sb) {
      sb.classList.remove('on-cooldown');
      if (scd) {
        scd.textContent = '';
        scd.classList.remove('visible');
      }
    }
  }

  function refreshOutgoingInviteUi() {
    if (!inviteRef || !lobbyPlayerPet) return;
    inviteRef.get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      var waiting = !!(d && d.status === 'pending' && d.fromUid === myUid);
      var matchBtn = document.getElementById('multi-match-btn');
      var cancelBtn = document.getElementById('multi-cancel-invite-btn');
      var hint = document.getElementById('friend-invite-waiting');
      if (waiting) {
        if (matchBtn) matchBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        if (hint) {
          hint.textContent = 'Waiting for ' + friendDisplayName + ' to accept your invitation…';
          hint.classList.remove('hidden');
        }
      } else {
        if (matchBtn) {
          matchBtn.style.display = '';
          if (lobbyPlayerPet) matchBtn.disabled = false;
        }
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (hint) hint.classList.add('hidden');
      }
    }).catch(function () {});
  }

  function cancelOutgoingInvite() {
    if (!inviteRef) return;
    inviteRef.get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      if (d && d.status === 'pending' && d.fromUid === myUid) {
        return inviteRef.delete();
      }
    }).catch(function (err) { console.warn('cancelInvite:', err); });
  }

  function writePendingBattleInvite(fromUsername) {
    if (!inviteRef || !battleRef) return Promise.reject(new Error('no ref'));
    var uidSmall = myUid < opponentUid ? myUid : opponentUid;
    var uidLarge = myUid < opponentUid ? opponentUid : myUid;
    return db.runTransaction(function (t) {
      return t.get(battleRef).then(function (bDoc) {
        return t.get(inviteRef).then(function (iDoc) {
          var b = bDoc.exists ? bDoc.data() : null;
          if (b && b.phase === 'battle') {
            throw new Error('busy_battle');
          }
          var iv = iDoc.exists ? iDoc.data() : null;
          if (iv && iv.status === 'pending' && iv.fromUid === opponentUid) {
            throw new Error('incoming_first');
          }
          t.set(inviteRef, {
            uids: [uidSmall, uidLarge],
            fromUid: myUid,
            fromUsername: fromUsername || '',
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: false });
        });
      });
    });
  }

  function attachInviteListener() {
    if (unsubInvite) unsubInvite();
    if (!inviteRef) return;
    unsubInvite = inviteRef.onSnapshot(function (snap) {
      if (!snap.exists) {
        refreshOutgoingInviteUi();
        return;
      }
      var d = snap.data();
      if (!d) return;
      if (d.status === 'declined') {
        if (d.fromUid === myUid) {
          alert(friendDisplayName + ' declined your battle invitation.');
          inviteRef.delete().catch(function () {});
        }
        refreshOutgoingInviteUi();
        return;
      }
      refreshOutgoingInviteUi();
    }, function (err) { console.error('Invite listener:', err); });
  }

  function processAcceptInvite() {
    if (!inviteRef || !battleRef) {
      return Promise.reject(new Error('NO_REF'));
    }
    return inviteRef.get().then(function (invSnap) {
      if (!invSnap.exists) {
        return Promise.reject(new Error('NO_INVITE'));
      }
      var inv = invSnap.data();
      if (!inv || inv.status !== 'pending') {
        return Promise.reject(new Error('NOT_PENDING'));
      }
      if (inv.fromUid !== opponentUid) {
        return Promise.reject(new Error('WRONG_INVITER'));
      }
      return Promise.all([
        fetchUserPetForBattle(opponentUid),
        fetchUserPetForBattle(myUid)
      ]).then(function (pair) {
        var inviterPet = pair[0];
        var accepterPet = pair[1];
        if (!inviterPet || inviterPet.stage !== 'adult') {
          return Promise.reject(new Error('INVITER_PET'));
        }
        if (!accepterPet || accepterPet.stage !== 'adult') {
          return Promise.reject(new Error('YOUR_PET'));
        }
        var uidSmall = myUid < opponentUid ? myUid : opponentUid;
        var uidLarge = myUid < opponentUid ? opponentUid : myUid;
        var petByUid = {};
        petByUid[opponentUid] = JSON.parse(JSON.stringify(inviterPet));
        petByUid[myUid] = JSON.parse(JSON.stringify(accepterPet));
        petByUid[opponentUid].uid = opponentUid;
        petByUid[myUid].uid = myUid;
        delete petByUid[opponentUid].stage;
        delete petByUid[myUid].stage;

        var turnUid = pickFirstTurnUid(petByUid, uidSmall, uidLarge);

        return db.runTransaction(function (t) {
          return t.get(inviteRef).then(function (s) {
            if (!s.exists) {
              throw new Error('NO_INVITE');
            }
            var iv = s.data();
            if (!iv || iv.status !== 'pending' || iv.fromUid !== opponentUid) {
              throw new Error('INVITE_CHANGED');
            }
            t.delete(inviteRef);
            t.set(battleRef, {
              uids: [uidSmall, uidLarge],
              sessionId: Date.now(),
              phase: 'battle',
              startedBy: opponentUid,
              acceptedBy: myUid,
              petByUid: petByUid,
              turnUid: turnUid,
              winnerUid: null,
              battleLog: 'Battle accepted — fight!',
              actionSeq: 0,
              actionCount: 0,
              lastAction: null
            }, { merge: false });
          });
        });
      });
    }).then(function () {
      stripAcceptQueryParam();
    });
  }

  function attachSnapshotListener() {
    if (unsub) unsub();
    unsub = battleRef.onSnapshot(function (snap) {
      var d = snap.exists ? snap.data() : null;

      if (!d) {
        return;
      }

      if (d.phase === 'cancelled') {
        if (d.cancelledBy && d.cancelledBy !== myUid) {
          alert(friendDisplayName + ' left the battle.');
        }
        battleRef.delete().catch(function () {});
        goToLobby();
        return;
      }

      if (d.phase === 'battle') {
        refreshOutgoingInviteUi();
        if (!document.getElementById('screen-battle').classList.contains('is-active')) {
          startBattleMusic();
          showScreen('screen-battle');
          renderedActionSeq = -1;
        }

        var seq = d.actionSeq != null ? d.actionSeq : 0;
        if (d.lastAction && seq > renderedActionSeq) {
          renderedActionSeq = seq;
          playSyncedFx(d.lastAction);
        }

        renderBattleShell(d);
        return;
      }

      if (d.phase === 'finished') {
        stopBattleMusic();
        var won = d.winnerUid === myUid;
        var elWin = document.getElementById(won ? 'win-sprite' : 'lose-sprite');
        var pets = d.petByUid || {};
        var me = pets[myUid];
        if (elWin && me && me.sprite) applySprite(elWin, me.sprite, false);
        showScreen(won ? 'screen-win' : 'screen-lose');
        return;
      }
    }, function (err) {
      console.error('Battle listener:', err);
    });
  }

  function sendBattleInvitationFromLobby() {
    if (!battleRef || !inviteRef) {
      alert('Battle is not ready yet. Please refresh the page.');
      return;
    }
    if (!lobbyPlayerPet) {
      alert('Still loading your pet from storage. Wait a second and try again — or make sure you have an adult pet selected.');
      return;
    }

    Promise.all([
      Promise.resolve(lobbyPlayerPet),
      fetchUserPetForBattle(opponentUid),
      db.collection('users').doc(myUid).get()
    ]).then(function (tri) {
      var mine = tri[0];
      var theirs = tri[1];
      var meSnap = tri[2];
      var myUsername = (meSnap.exists && meSnap.data()) ? (meSnap.data().username || '') : '';

      if (!theirs || theirs.stage !== 'adult') {
        alert(friendDisplayName + '\'s pet isn\'t ready for battle (needs an adult pet).');
        return;
      }

      return writePendingBattleInvite(myUsername);
    }).then(function () {
      refreshOutgoingInviteUi();
    }).catch(function (err) {
      if (err && err.message === 'busy_battle') {
        alert('A battle is already in progress for this pair.');
        return;
      }
      if (err && err.message === 'incoming_first') {
        alert(friendDisplayName + ' already invited you! Accept their invite on the Friends screen.');
        return;
      }
      if (err && (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED')) {
        alert('Firestore blocked the invite (permission denied). Merge the friendBattleInvites and friendPvPBattles rules from firestore.rules.example in the Leetmate folder into your Firestore rules.');
        return;
      }
      console.error('sendBattleInvitationFromLobby:', err);
      alert('Could not send invitation. Check the browser console for details.');
    });
  }

  function submitMove(action) {
    if (!battleRef || moveSubmitBusy) return;
    moveSubmitBusy = true;

    db.runTransaction(function (t) {
      return t.get(battleRef).then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        if (!d || d.phase !== 'battle' || d.turnUid !== myUid) return;

        var pets = clonePetMap(d.petByUid);
        var actorUid = myUid;
        var defenderUid = opponentUid;

        if (action === 'super' && pets[actorUid].superCd > 0) return;

        var result = applyMoveToPets(pets, actorUid, defenderUid, action);

        var winnerUid = null;
        if (pets[defenderUid].hp <= 0) {
          pets[defenderUid].hp = 0;
          winnerUid = actorUid;
        }

        var nextTurn = defenderUid;
        var actionCount = (d.actionCount != null ? d.actionCount : 0) + 1;
        if (actionCount % 2 === 0) {
          Object.keys(pets).forEach(function (k) {
            if (pets[k].superCd > 0) pets[k].superCd--;
          });
        }

        var actionSeq = (d.actionSeq != null ? d.actionSeq : 0) + 1;

        var patch = {
          petByUid: pets,
          turnUid: winnerUid ? d.turnUid : nextTurn,
          battleLog: result.log,
          actionSeq: actionSeq,
          actionCount: actionCount,
          lastAction: {
            actorUid: actorUid,
            action: action,
            dmg: result.dmg
          }
        };

        if (winnerUid) {
          patch.phase = 'finished';
          patch.winnerUid = winnerUid;
          patch.turnUid = d.turnUid;
        }

        t.update(battleRef, patch);
      });
    }).catch(function (e) { console.warn('submitMove:', e); })
      .finally(function () { moveSubmitBusy = false; });
  }

  function rematch() {
    if (!battleRef) return;
    db.runTransaction(function (t) {
      return t.get(battleRef).then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        if (!d || d.phase !== 'finished' || !d.petByUid) return;

        var pets = resetHpClone(d.petByUid);
        var uidSmall = d.uids && d.uids[0] ? d.uids[0] : myUid;
        var uidLarge = d.uids && d.uids[1] ? d.uids[1] : opponentUid;
        var turnUid = pickFirstTurnUid(pets, uidSmall, uidLarge);

        t.update(battleRef, {
          phase: 'battle',
          petByUid: pets,
          turnUid: turnUid,
          winnerUid: null,
          battleLog: 'Rematch — fight!',
          actionSeq: 0,
          actionCount: 0,
          lastAction: null,
          sessionId: (d.sessionId != null ? d.sessionId : 0) + 1
        });
      });
    }).catch(function (e) { console.warn('rematch:', e); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      console.warn('Firebase not available');
      return;
    }

    auth = firebase.auth();
    db = firebase.firestore();

    document.getElementById('community-back-btn')?.addEventListener('click', handleBack);
    document.getElementById('battle-exit-btn')?.addEventListener('click', handleBack);
    document.getElementById('multi-match-btn')?.addEventListener('click', sendBattleInvitationFromLobby);
    document.getElementById('multi-cancel-invite-btn')?.addEventListener('click', function () {
      cancelOutgoingInvite();
      refreshOutgoingInviteUi();
    });

    document.getElementById('btn-scratch')?.addEventListener('click', function () { submitMove('scratch'); });
    document.getElementById('btn-guard')?.addEventListener('click', function () { submitMove('guard'); });
    document.getElementById('btn-super')?.addEventListener('click', function () { submitMove('super'); });

    document.getElementById('win-again-btn')?.addEventListener('click', rematch);
    document.getElementById('win-home-btn')?.addEventListener('click', goToLobby);
    document.getElementById('lose-again-btn')?.addEventListener('click', rematch);
    document.getElementById('lose-home-btn')?.addEventListener('click', goToLobby);

    auth.onAuthStateChanged(function (user) {
      if (!user) return;
      myUid = user.uid;
      opponentUid = getOpponentUidFromQuery();
      if (!opponentUid || opponentUid === myUid) {
        window.location.href = '../community-friends/index.html';
        return;
      }

      pairDocId = myUid < opponentUid ? (myUid + '_' + opponentUid) : (opponentUid + '_' + myUid);
      battleRef = db.collection('friendPvPBattles').doc(pairDocId);
      inviteRef = db.collection('friendBattleInvites').doc(pairDocId);

      db.collection('users').doc(myUid).collection('friends').doc(opponentUid).get()
        .then(function (snap) {
          if (!snap.exists) {
            alert('This player is not on your friends list.');
            window.location.href = '../community-friends/index.html';
            return null;
          }
          loadFriendUsername();
          initLobby();
          if (getAcceptFromQuery()) {
            return processAcceptInvite().catch(function (err) {
              var code = err && err.message;
              if (code === 'NO_INVITE' || code === 'NOT_PENDING' || code === 'INVITE_CHANGED') {
                alert('This invitation is no longer available or was cancelled.');
              } else if (code === 'WRONG_INVITER') {
                alert('This invite does not match this friend.');
              } else if (code === 'INVITER_PET' || code === 'YOUR_PET') {
                alert('Both players need an adult pet to battle.');
              } else {
                alert('Could not accept the invitation.');
              }
              stripAcceptQueryParam();
            });
          }
          return null;
        })
        .then(function () {
          attachInviteListener();
          attachSnapshotListener();
        })
        .catch(function () {
          window.location.href = '../community-friends/index.html';
        });
    });
  });

  window.addEventListener('beforeunload', function () {
    if (unsub) unsub();
    if (unsubInvite) unsubInvite();
  });
})();
