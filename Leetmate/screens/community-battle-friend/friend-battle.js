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
  battleAudio.preload = 'auto';

  var STORAGE_VOLUME = 'leetmate_music_volume';
  var STORAGE_MUTED = 'leetmate_music_muted';
  var DEFAULT_VOLUME = 0.14;

  function clamp01(x) {
    if (typeof x !== 'number' || isNaN(x)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(1, x));
  }

  function applyBattleAudioPrefs(volume01, muted) {
    battleAudio.volume = muted ? 0 : clamp01(volume01);
  }

  function loadBattleAudioPrefs(cb) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      applyBattleAudioPrefs(DEFAULT_VOLUME, false);
      if (cb) cb(false);
      return;
    }

    chrome.storage.local.get([STORAGE_VOLUME, STORAGE_MUTED], function (items) {
      var vol =
        typeof items[STORAGE_VOLUME] === 'number'
          ? items[STORAGE_VOLUME]
          : DEFAULT_VOLUME;
      var muted = !!items[STORAGE_MUTED];
      applyBattleAudioPrefs(vol, muted);
      if (cb) cb(muted);
    });
  }

  function startBattleMusic() {
    if (window.LeetmateBGMusic) window.LeetmateBGMusic.pause();
    /*
      battleAudio.currentTime = 0;
      battleAudio.play().catch(function () {});
    */
    loadBattleAudioPrefs(function (muted) {
      battleAudio.currentTime = 0;
      if (muted) return;
      battleAudio.play().catch(function () {});
    });
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
  var rewardedBattleSessionId = null;
  var lastFriendBattleRewards = null;
  /** True once this tab has seen an in-progress battle; avoids showing stale `finished` from a prior match when reopening the lobby. */
  var sawBattlePhaseThisLoad = false;

  /*
    var REWARD_WIN_COINS = 20;
    var REWARD_WIN_XP = 5;
    var REWARD_WIN_TROPHY = 5;
    var REWARD_LOSE_COINS = 0;
    var REWARD_LOSE_XP = 5;
    var REWARD_LOSE_TROPHY = -4;
  */

  var BATTLE_SCREENS = ['screen-matchmaking', 'screen-battle', 'screen-win', 'screen-lose'];

  var ACCESSORY_SUFFIX = {
    'acc-greyhat': 'GreyHat',
    'acc-brownhat': 'BrownHat',
    'acc-strawhat': 'StrawHat',
    'acc-tophat': 'TopHat',
    'acc-santahat': 'SantaHat',
    'acc-leprechaunhat': 'LeprechaunHat'
  };

  var PET_ASSETS = {
    Bat: { egg: '../../assets/eggs/CubicBatEgg.png', baby: '../../assets/spritesheets/CubicBatBaby.png', adult: '../../assets/spritesheets/CubicBatAdult.png' },
    Bunny: { egg: '../../assets/eggs/CubicBunnyEgg.png', baby: '../../assets/spritesheets/CubicBunnyBaby.png', adult: '../../assets/spritesheets/CubicBunnyAdult.png' },
    Cat: { egg: '../../assets/eggs/CubicCatEgg.png', baby: '../../assets/spritesheets/CubicCatBaby.png', adult: '../../assets/spritesheets/CubicCatAdult.png' },
    Elephant: { egg: '../../assets/eggs/CubicElephantEgg.png', baby: '../../assets/spritesheets/CubicElephantBaby.png', adult: '../../assets/spritesheets/CubicElephantAdult.png' },
    Flamingo: { egg: '../../assets/eggs/CubicFlamingoEgg.png', baby: '../../assets/spritesheets/CubicFlamingoBaby.png', adult: '../../assets/spritesheets/CubicFlamingoAdult.png' },
    Fox: { egg: '../../assets/eggs/CubicFoxEgg.png', baby: '../../assets/spritesheets/CubicFoxBaby.png', adult: '../../assets/spritesheets/CubicFoxAdult.png' },
    Frog: { egg: '../../assets/eggs/CubicFrogEgg.png', baby: '../../assets/spritesheets/CubicFrogBaby.png', adult: '../../assets/spritesheets/CubicFrogAdult.png' },
    Giraffe: { egg: '../../assets/eggs/CubicGiraffeEgg.png', baby: '../../assets/spritesheets/CubicGiraffeBaby.png', adult: '../../assets/spritesheets/CubicGiraffeAdult.png' },
    Grizzly: { egg: '../../assets/eggs/CubicGrizzlyEgg.png', baby: '../../assets/spritesheets/CubicGrizzlyBaby.png', adult: '../../assets/spritesheets/CubicGrizzlyAdult.png' },
    Lion: { egg: '../../assets/eggs/CubicLionEgg.png', baby: '../../assets/spritesheets/CubicLionBaby.png', adult: '../../assets/spritesheets/CubicLionAdult.png' },
    MicoLeaoDourado: { egg: '../../assets/eggs/CubicMicoLeaoDouradoEgg.png', baby: '../../assets/spritesheets/CubicMicoLeaoDouradoBaby.png', adult: '../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png' },
    Owl: { egg: '../../assets/eggs/CubicOwlEgg.png', baby: '../../assets/spritesheets/CubicOwlBaby.png', adult: '../../assets/spritesheets/CubicOwlAdult.png' },
    Penguin: { egg: '../../assets/eggs/CubicPenguinEgg.png', baby: '../../assets/spritesheets/CubicPenguinBaby.png', adult: '../../assets/spritesheets/CubicPenguinAdult.png' },
    Rat: { egg: '../../assets/eggs/CubicRatEgg.png', baby: '../../assets/spritesheets/CubicRatBaby.png', adult: '../../assets/spritesheets/CubicRatAdult.png' },
    Sheep: { egg: '../../assets/eggs/CubicSheepEgg.png', baby: '../../assets/spritesheets/CubicSheepBaby.png', adult: '../../assets/spritesheets/CubicSheepAdult.png' },
    Turtle: { egg: '../../assets/eggs/CubicTurtleEgg.png', baby: '../../assets/spritesheets/CubicTurtleBaby.png', adult: '../../assets/spritesheets/CubicTurtleAdult.png' },
    Unicorn: { egg: '../../assets/eggs/CubicUnicornEgg.png', baby: '../../assets/spritesheets/CubicUnicornBaby.png', adult: '../../assets/spritesheets/CubicUnicornAdult.png' },
    Wolf: { egg: '../../assets/eggs/CubicWolfEgg.png', baby: '../../assets/spritesheets/CubicWolfBaby.png', adult: '../../assets/spritesheets/CubicWolfAdult.png' }
  };

  var SINGLE_ROW_RE = /CubicFish|CubicJaguatirica/;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
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

  function goToFriends() {
    stopBattleMusic();
    window.location.href = '../community-friends/index.html';
  }

  function handleBack() {
    var active = document.querySelector('.battle-screen.is-active');
    if (!active || active.id === 'screen-lobby') {
      cancelOutgoingInvite().finally(function () {
        goToFriends();
      });
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
    if (active.id === 'screen-win' || active.id === 'screen-lose') {
      goToFriends();
      return;
    }
    goToLobby();
  }

  function renderResultRewards(won) {
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!ui || !lastFriendBattleRewards) return;
    ui.renderBattleRewards(won ? 'win' : 'lose', lastFriendBattleRewards);
  }

  function syncFriendTrophyMirror(nextTrophy) {
    if (!db || !myUid) return Promise.resolve();

    return db.collection('users').doc(myUid).collection('friends').get().then(function (snap) {
      if (snap.empty) return;
      var batch = db.batch();
      var count = 0;

      snap.forEach(function (doc) {
        if (doc.id === '_meta') return;
        var fid = (doc.data() && doc.data().friendUid) ? String(doc.data().friendUid) : doc.id;
        if (!fid) return;
        var ref = db.collection('users').doc(fid).collection('friends').doc(myUid);
        batch.set(ref, { trophy: nextTrophy }, { merge: true });
        count++;
      });

      if (count > 0) return batch.commit();
    });
  }

  function applyFriendBattleOutcomeRewards(won) {
    var rewards = window.LeetmateBattle && window.LeetmateBattle.battleRewards;
    var helpers = window.LeetmateBattle && window.LeetmateBattle.battleRewardHelpers;

    if (!db || !myUid || !rewards || !helpers) {
      console.warn('Friend battle rewards: shared battle reward modules not loaded.');
      return Promise.resolve();
    }

    /*
    var coinsDelta = won ? REWARD_WIN_COINS : REWARD_LOSE_COINS;
    var xpDelta = won ? REWARD_WIN_XP : REWARD_LOSE_XP;
    var trophyDelta = won ? REWARD_WIN_TROPHY : REWARD_LOSE_TROPHY;
    */

    var rewardDeltas = rewards.getFriendBattleRewards(won);
    lastFriendBattleRewards = rewardDeltas;

    var userRef = db.collection('users').doc(myUid);

    return helpers.applyBattleRewards(rewardDeltas)
      .then(function () { return userRef.get(); })
      .then(function (userSnap) {
        var nextTrophy = userSnap.exists ? Number((userSnap.data() || {}).trophy || 0) : 0;
        return syncFriendTrophyMirror(nextTrophy);
      })
      .catch(function (err) {
      console.error('Friend battle rewards sync failed:', err);
      });
  }

  function maybeGrantFriendBattleRewards(d) {
    if (!d || d.phase !== 'finished' || !d.winnerUid) return;
    var sid = d.sessionId != null ? d.sessionId : ('fin_' + String(d.winnerUid) + '_' + String(d.actionSeq != null ? d.actionSeq : 0));
    if (sid === rewardedBattleSessionId) return;
    rewardedBattleSessionId = sid;
    var won = d.winnerUid === myUid;
    applyFriendBattleOutcomeRewards(won);
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
    var assetSet = PET_ASSETS[pet.petRef];
    if (!assetSet) return null;
    if (stage === 'egg') return assetSet.egg;
    if (stage === 'baby') return assetSet.baby;
    return assetSet.adult;
  }

  function opponentSpriteFromFirestore(petRef, equippedItemId, stage) {
    var ref = petRef || 'Cat';
    var st = (stage || 'adult').toLowerCase();
    var assetSet = PET_ASSETS[ref];
    var suffix = equippedItemId && ACCESSORY_SUFFIX[equippedItemId];
    if (suffix && st === 'adult') {
      return '../../assets/spritesheets/Cubic' + ref + suffix + '.png';
    }
    if (!assetSet) return null;
    if (st === 'egg') return assetSet.egg;
    if (st === 'baby') return assetSet.baby;
    return assetSet.adult;
  }

  function clampAttackCharges(val) {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var maxC = logic && logic.MAX_ATTACK_CHARGES != null ? logic.MAX_ATTACK_CHARGES : 2;
    var n = Math.floor(Number(val) || 0);
    return Math.max(0, Math.min(maxC, n));
  }

  function canBattlePet(pet) {
    if (!pet) return false;
    var isAdult = String(pet.stage || '').toLowerCase() === 'adult';
    var ableToBattle =
      typeof pet.ableToBattle === 'boolean'
        ? pet.ableToBattle
        : isAdult;
    return isAdult && ableToBattle;
  }

  /** Align Firestore pet blobs with shared battle-logic combatants (legacy: guarding/superCd). */
  function normalizeCombatPet(p) {
    if (!p || typeof p !== 'object') return p;

    if (p.guardActive === undefined && p.guarding !== undefined) {
      p.guardActive = !!p.guarding;
    }
    if (p.guardActive === undefined) p.guardActive = false;
    if (p.buffActive === undefined) p.buffActive = false;
    if (p.attackCharges === undefined || p.attackCharges === null) {
      p.attackCharges = 0;
    } else {
      p.attackCharges = clampAttackCharges(p.attackCharges);
    }
    if ('guarding' in p) delete p.guarding;
    if ('superCd' in p) delete p.superCd;
    return p;
  }

  function battleEntityFromStats(name, sprite, stats, uidTag) {
    var hpBase = stats.hp != null ? stats.hp : 50;
    return {
      uid: uidTag,
      name: name,
      sprite: sprite,
      /*
        maxHp: hpBase * 4,
        hp: hpBase * 4,
      */
      maxHp: hpBase,
      hp: hpBase,
      atk: stats.atk != null ? stats.atk : 45,
      def: stats.def != null ? stats.def : 40,
      spAtk: stats.spAtk != null ? stats.spAtk : 40,
      spDef: stats.spDef != null ? stats.spDef : 40,
      spd: stats.spd != null ? stats.spd : 45,
      guardActive: false,
      buffActive: false,
      attackCharges: 0
    };
  }

  function clonePetMap(petByUid) {
    var out = {};
    Object.keys(petByUid || {}).forEach(function (k) {
      var raw = petByUid[k];
      var p = normalizeCombatPet(JSON.parse(JSON.stringify(raw)));
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
        guardActive: !!p.guardActive,
        buffActive: !!p.buffActive,
        attackCharges: clampAttackCharges(p.attackCharges)
      };
    });
    return out;
  }

  function resetHpClone(petByUid) {
    var c = clonePetMap(petByUid);
    Object.keys(c).forEach(function (k) {
      c[k].hp = c[k].maxHp;
      c[k].guardActive = false;
      c[k].buffActive = false;
      c[k].attackCharges = 0;
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
        var ableToBattle =
          typeof pd.ableToBattle === 'boolean'
            ? pd.ableToBattle
            : stage === 'adult';
        var name = (pd.customName || '').trim() || ('Cubic ' + (pd.petRef || 'Pet'));
        var sprite = opponentSpriteFromFirestore(pd.petRef, pd.equippedItemId, stage);
        var stats = pd.stats || {};
        var ent = battleEntityFromStats(name, sprite, stats, uid);
        ent.stage = stage;
        ent.ableToBattle = ableToBattle;
        return ent;
      });
    });
  }

  function initLobby() {
    if (typeof storageGet !== 'function') return;
    storageGet(['activePetSnapshot', 'activePetSpritePath']).then(function (data) {
      var pet = data.activePetSnapshot;
      var path = data.activePetSpritePath;
      if (!pet) {
        lobbyPlayerPet = null;
        return;
      }

      var stage = (pet.stage || '').toLowerCase();
      var isAdult = canBattlePet(pet);
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
      var lockedEl = document.getElementById('multi-locked');
      var lockedDesc = document.getElementById('multi-locked-desc');

      if (isAdult) {
        if (statsCard) statsCard.style.display = '';
        if (lockedEl) lockedEl.style.display = 'none';

        var stats = pet.stats || {};
        lobbyPlayerPet = battleEntityFromStats(name, src, stats, myUid);
        lobbyPlayerPet.stage = stage;
        lobbyPlayerPet.ableToBattle =
          typeof pet.ableToBattle === 'boolean'
            ? pet.ableToBattle
            : stage === 'adult';

        var m = {
          'stat-hp': stats.hp, 'stat-atk': stats.atk, 'stat-def': stats.def,
          'stat-spatk': stats.spAtk, 'stat-spdef': stats.spDef, 'stat-spd': stats.spd
        };
        Object.keys(m).forEach(function (id) {
          setText(id, m[id] != null ? m[id] : '—');
        });

        fetchUserPetForBattle(opponentUid).then(function (opp) {
          opponentPreviewPet = opp;
          renderInviteAwaitingVsUi();
        }).catch(function () {
          opponentPreviewPet = null;
          renderInviteAwaitingVsUi();
        });
      } else {
        lobbyPlayerPet = null;
        if (statsCard) statsCard.style.display = 'none';
        if (lockedEl) lockedEl.style.display = '';
        if (lockedDesc) {
          lockedDesc.textContent = stage === 'egg'
            ? name + ' hasn\'t hatched yet! Evolve to unlock friend battles.'
            : name + ' is still a baby! Evolve to unlock friend battles.';
        }
      }
    }).catch(function (e) { console.warn('Friend battle lobby:', e); })
      .finally(function () {
        refreshOutgoingInviteUi();
        if (lobbyPlayerPet && !getAcceptFromQuery()) {
          sendBattleInvitationFromLobby();
        }
      });
  }

  var DODGE_REACTION_MS = 900;

  function animateBattleReaction(whoPrefix, reaction) {
    var wrap = document.getElementById(whoPrefix + '-wrap');
    if (!wrap) return;

    var hitClass = whoPrefix === 'player' ? 'react-hit-left' : 'react-hit-right';
    var dodgeClass = whoPrefix === 'player' ? 'react-dodge-left' : 'react-dodge-right';

    wrap.classList.remove('react-hit-left', 'react-hit-right', 'react-dodge-left', 'react-dodge-right');
    void wrap.offsetWidth;

    if (reaction === 'hit') {
      wrap.classList.add(hitClass);
      window.setTimeout(function () {
        wrap.classList.remove(hitClass);
      }, 430);
      return;
    }

    if (reaction === 'dodge') {
      wrap.classList.add(dodgeClass);
      window.setTimeout(function () {
        wrap.classList.remove(dodgeClass);
      }, DODGE_REACTION_MS);
    }
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
    var defenderPrefix = isMe ? 'cpu' : 'player';
    var actorPrefix = isMe ? 'player' : 'cpu';
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;

    var actionFx = lastAction.action;
    if (actionFx === 'scratch') actionFx = 'attack';
    if (actionFx === 'super') actionFx = 'special';

    var dmgVal =
      typeof lastAction.damage === 'number'
        ? lastAction.damage
        : typeof lastAction.dmg === 'number'
          ? lastAction.dmg
          : 0;

    if (actionFx === 'buff') return;

    if (lastAction.dodged) {
      animateBattleReaction(defenderPrefix, 'dodge');
      return;
    }

    if (actionFx === 'guard') {
      showFx(actorPrefix, '../../assets/icons/guard.png', 'guard');
      flashSprite(actorPrefix + '-sprite', 'guard');
      return;
    }

    if (actionFx === 'attack') {
      showFx(defenderPrefix, '../../assets/icons/battle-hit.png', 'scratch');
      flashSprite(defenderPrefix + '-sprite', 'hit');
      if (ui && lastAction.guarded && dmgVal > 0) {
        ui.holdGuardFx(defenderPrefix, 700);
      }
      if (!lastAction.guarded && dmgVal > 0) {
        animateBattleReaction(defenderPrefix, 'hit');
      }
      return;
    }

    if (actionFx === 'special') {
      showFx(defenderPrefix, '../../assets/icons/SuperAttack.png', 'super');
      flashSprite(defenderPrefix + '-sprite', 'super');
      if (dmgVal > 0) flashArena();
      if (ui && lastAction.guarded && dmgVal > 0) {
        ui.holdGuardFx(defenderPrefix, 700);
      }
      if (!lastAction.guarded && dmgVal > 0) {
        animateBattleReaction(defenderPrefix, 'hit');
      }
    }
  }

  function renderBattleShell(d) {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    var pets = d.petByUid || {};
    var me = normalizeCombatPet(JSON.parse(JSON.stringify(pets[myUid] || null)));
    var opp = normalizeCombatPet(JSON.parse(JSON.stringify(pets[opponentUid] || null)));
    if (!me || !opp || !logic || !ui) return;

    var cpuEl = document.getElementById('cpu-sprite');
    var plEl = document.getElementById('player-sprite');
    if (cpuEl) applySprite(cpuEl, opp.sprite, true);
    if (plEl) applySprite(plEl, me.sprite, true);

    ui.setBattleLog(d.battleLog || '—');

    var viewState = {
      player: me,
      cpu: opp,
      turn: d.turnUid === myUid ? 'player' : 'cpu'
    };
    var busy = d.phase !== 'battle';
    ui.renderBattleState(viewState, busy, logic.SPECIAL_CHARGE_COST);
  }

  function renderInviteAwaitingVsUi() {
    var wrap = document.getElementById('friend-invite-vs');
    if (!wrap || wrap.classList.contains('hidden')) return;

    var youSp = document.getElementById('friend-invite-your-sprite');
    var oppSp = document.getElementById('friend-invite-opponent-sprite');
    var youNameEl = document.getElementById('friend-invite-your-name');
    var oppNameEl = document.getElementById('friend-invite-opponent-name');
    if (!youSp || !oppSp) return;

    var shadow = 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.72))';

    if (lobbyPlayerPet && lobbyPlayerPet.sprite) {
      applySprite(youSp, lobbyPlayerPet.sprite, true);
      var st = String(lobbyPlayerPet.stage || '').toLowerCase();
      youSp.style.filter = st !== 'adult'
        ? 'grayscale(.7) brightness(.7) ' + shadow
        : '';
    } else {
      youSp.style.backgroundImage = '';
      youSp.classList.remove('is-animated', 'sprite-single');
      youSp.style.filter = '';
    }

    oppSp.classList.remove('friend-invite-vs__sprite--pending');
    if (opponentPreviewPet && opponentPreviewPet.sprite) {
      applySprite(oppSp, opponentPreviewPet.sprite, true);
      oppSp.style.filter = '';
    } else {
      oppSp.style.backgroundImage = '';
      oppSp.classList.remove('is-animated', 'sprite-single');
      oppSp.style.filter = 'none';
      oppSp.classList.add('friend-invite-vs__sprite--pending');
    }

    if (youNameEl) {
      youNameEl.textContent = (lobbyPlayerPet && lobbyPlayerPet.name) ? lobbyPlayerPet.name : 'You';
    }
    if (oppNameEl) {
      oppNameEl.textContent = (opponentPreviewPet && opponentPreviewPet.name)
        ? opponentPreviewPet.name
        : friendDisplayName;
    }
  }

  function setLobbyInviteAwaitingLayout(waiting) {
    var vs = document.getElementById('friend-invite-vs');
    var fighter = document.getElementById('multi-fighter');
    var label = document.getElementById('friend-battle-opponent-label');
    var statsCard = document.getElementById('multi-stats-card');
    if (waiting) {
      if (vs) {
        vs.classList.remove('hidden');
        vs.setAttribute('aria-hidden', 'false');
      }
      if (fighter) fighter.classList.add('hidden');
      if (label) label.classList.add('hidden');
      if (statsCard) statsCard.classList.add('hidden');
      renderInviteAwaitingVsUi();
    } else {
      if (vs) {
        vs.classList.add('hidden');
        vs.setAttribute('aria-hidden', 'true');
      }
      if (fighter) fighter.classList.remove('hidden');
      if (label) label.classList.remove('hidden');
      if (statsCard) statsCard.classList.remove('hidden');
    }
  }

  function refreshOutgoingInviteUi() {
    if (!inviteRef || !lobbyPlayerPet) return;
    inviteRef.get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      var waiting = !!(d && d.status === 'pending' && d.fromUid === myUid);
      var cancelBtn = document.getElementById('multi-cancel-invite-btn');
      var hint = document.getElementById('friend-invite-waiting');
      setLobbyInviteAwaitingLayout(waiting);
      if (waiting) {
        if (cancelBtn) cancelBtn.classList.remove('hidden');
        if (hint) {
          hint.textContent = 'Waiting for ' + friendDisplayName + ' to accept your invitation…';
          hint.classList.remove('hidden');
        }
      } else {
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (hint) hint.classList.add('hidden');
      }
    }).catch(function () {});
  }

  function cancelOutgoingInvite() {
    if (!inviteRef) return Promise.resolve();
    return inviteRef.get().then(function (snap) {
      var d = snap.exists ? snap.data() : null;
      if (d && d.status === 'pending' && d.fromUid === myUid) {
        return inviteRef.delete();
      }
    }).catch(function (err) {
      console.warn('cancelInvite:', err);
    });
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
          goToFriends();
          return;
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
        if (!canBattlePet(inviterPet)) {
          return Promise.reject(new Error('INVITER_PET'));
        }
        if (!canBattlePet(accepterPet)) {
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
        sawBattlePhaseThisLoad = true;
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
        if (!sawBattlePhaseThisLoad) {
          return;
        }
        stopBattleMusic();
        var won = d.winnerUid === myUid;
        var rewards = window.LeetmateBattle && window.LeetmateBattle.battleRewards;
        lastFriendBattleRewards = rewards ? rewards.getFriendBattleRewards(won) : null;
        maybeGrantFriendBattleRewards(d);
        var pets = d.petByUid || {};
        var me = pets[myUid];
        var opp = pets[opponentUid];

        if (won) {
          var winSprite = document.getElementById('win-sprite');
          var winCpuSprite = document.getElementById('win-cpu-sprite');
          if (winSprite && me && me.sprite) applySprite(winSprite, me.sprite, false);
          if (winCpuSprite && opp && opp.sprite) applySprite(winCpuSprite, opp.sprite, false);
        } else {
          var loseSprite = document.getElementById('lose-sprite');
          if (loseSprite && me && me.sprite) applySprite(loseSprite, me.sprite, false);
        }

        renderResultRewards(won);
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

      if (!canBattlePet(theirs)) {
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
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    if (!battleRef || moveSubmitBusy || !logic) return;
    moveSubmitBusy = true;

    db.runTransaction(function (t) {
      return t.get(battleRef).then(function (doc) {
        if (!doc.exists) return;
        var d = doc.data();
        if (!d || d.phase !== 'battle' || d.turnUid !== myUid) return;

        var pets = clonePetMap(d.petByUid);
        var actorUid = myUid;
        var defenderUid = opponentUid;

        var avail = logic.getAvailableActions(pets[actorUid]);
        if (!avail[action]) return;

        var result = logic.resolveAction(action, pets[actorUid], pets[defenderUid]);

        var winnerUid = null;
        if (pets[defenderUid].hp <= 0) {
          pets[defenderUid].hp = 0;
          winnerUid = actorUid;
        }

        var nextTurn = defenderUid;
        var actionCount = (d.actionCount != null ? d.actionCount : 0) + 1;
        var actionSeq = (d.actionSeq != null ? d.actionSeq : 0) + 1;

        var patch = {
          petByUid: pets,
          turnUid: winnerUid ? d.turnUid : nextTurn,
          battleLog: result.message,
          actionSeq: actionSeq,
          actionCount: actionCount,
          lastAction: {
            actorUid: actorUid,
            action: action,
            damage: result.damage,
            dodged: !!result.dodged,
            guarded: !!result.guarded
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
    loadBattleAudioPrefs();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        if (changes[STORAGE_VOLUME] || changes[STORAGE_MUTED]) {
          loadBattleAudioPrefs();
        }
      });
    }

    document.getElementById('community-back-btn')?.addEventListener('click', handleBack);
    document.getElementById('battle-exit-btn')?.addEventListener('click', handleBack);
    document.getElementById('multi-cancel-invite-btn')?.addEventListener('click', function () {
      cancelOutgoingInvite().finally(function () {
        goToFriends();
      });
    });

    document.getElementById('btn-attack')?.addEventListener('click', function () { submitMove('attack'); });
    document.getElementById('btn-special')?.addEventListener('click', function () { submitMove('special'); });
    document.getElementById('btn-guard')?.addEventListener('click', function () { submitMove('guard'); });
    document.getElementById('btn-buff')?.addEventListener('click', function () { submitMove('buff'); });

    document.getElementById('win-again-btn')?.addEventListener('click', rematch);
    document.getElementById('win-home-btn')?.addEventListener('click', goToFriends);
    document.getElementById('lose-again-btn')?.addEventListener('click', rematch);
    document.getElementById('lose-home-btn')?.addEventListener('click', goToFriends);

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
    stopBattleMusic();
    if (unsub) unsub();
    if (unsubInvite) unsubInvite();
  });

  window.addEventListener('pagehide', stopBattleMusic);
})();
