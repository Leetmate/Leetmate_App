(function () {
  'use strict';

  var battleAudio = new Audio('../../assets/audio/battleMusic.mp3');
  battleAudio.loop = true;
  battleAudio.preload = 'auto';

  var STORAGE_VOLUME = 'leetmate_music_volume';
  var STORAGE_MUTED = 'leetmate_music_muted';
  var DEFAULT_VOLUME = 0.14;

  var SCREEN_IDS = {
    lobby: 'screen-lobby',
    matchmaking: 'screen-matchmaking',
    found: 'screen-found',
    battle: 'screen-battle',
    win: 'screen-win',
    lose: 'screen-lose'
  };

  var BATTLE_SCREENS = [
    SCREEN_IDS.matchmaking,
    SCREEN_IDS.found,
    SCREEN_IDS.battle,
    SCREEN_IDS.win,
    SCREEN_IDS.lose
  ];

  var state = {
    currentScreen: SCREEN_IDS.lobby,
    playerPet: null,
    currentCpu: null,
    rematchCpu: null,
    battle: null,
    battleBusy: false,
    lastBattleRewards: null,
    battleCompleted: false
  };

  var HIT_REACTION_MS = 580;
  var DODGE_REACTION_MS = 900;
  var GUARDED_HIT_MS = 700;
  var SPECIAL_FX_MS = 800;
  var DODGE_FX_DELAY_MS = 120;

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

  function showScreen(id) {
    document.querySelectorAll('.battle-screen').forEach(function (screen) {
      screen.classList.remove('is-active');
    });
    var el = document.getElementById(id);
    if (el) el.classList.add('is-active');
    state.currentScreen = id;
    setBattleBg(BATTLE_SCREENS.indexOf(id) !== -1);
  }

  function handleBack() {
    if (state.currentScreen === SCREEN_IDS.lobby) {
      window.location.href = '../community-main/index.html';
      return;
    }
    goToLobby();
  }

  function goToLobby() {
    stopBattleMusic();
    showScreen(SCREEN_IDS.lobby);
  }

  function applySprite(el, src, animated) {
    if (!el || !src) return;
    el.style.backgroundImage = 'url("' + src + '")';
    if (animated) {
      el.classList.add('is-animated');
    } else {
      el.classList.remove('is-animated');
    }
  }

  function showFx(targetWho, iconSrc, type) {
    var el = document.getElementById(targetWho + '-fx');
    if (!el) return;

    var img = el.querySelector('img');
    if (img && iconSrc) {
      img.src = iconSrc;
    }

    el.classList.remove('pop', 'pop-scratch', 'pop-super');
    void el.offsetWidth;

    var cls = type === 'scratch'
      ? 'pop-scratch'
      : type === 'super'
        ? 'pop-super'
        : 'pop';

    el.classList.add(cls, 'pop');
  }

  function clearFx(who) {
    var fxEl = document.getElementById(who + '-fx');
    var wrapEl = document.getElementById(who + '-wrap');

    if (fxEl) {
      fxEl.classList.remove('pop', 'pop-scratch', 'pop-super');
      var img = fxEl.querySelector('img');
      if (img) img.removeAttribute('src');
    }

    if (wrapEl) {
      wrapEl.classList.remove('react-hit-left', 'react-hit-right', 'react-dodge-left', 'react-dodge-right');
    }

    clearSpritePose(who);
  }

  function resetBattleVisualState() {
    clearFx('player');
    clearFx('cpu');

    var playerGuard = document.getElementById('player-guard-fx');
    var cpuGuard = document.getElementById('cpu-guard-fx');
    var playerBuff = document.getElementById('player-buff-aura');
    var cpuBuff = document.getElementById('cpu-buff-aura');

    if (playerGuard) playerGuard.classList.remove('is-guarding', 'hold-guard');
    if (cpuGuard) cpuGuard.classList.remove('is-guarding', 'hold-guard');
    if (playerBuff) playerBuff.classList.remove('is-buffed');
    if (cpuBuff) cpuBuff.classList.remove('is-buffed');
  }

  function showBattleEffect(action, actorWho, defenderWho, result) {
    if (action === 'buff') return;

    if (!result || (result.damage <= 0 && !result.dodged)) return;

    if (action === 'attack') {
      showFx(defenderWho, '../../assets/icons/battle-hit.png', 'scratch');
      return;
    }

    if (action === 'special') {
      showFx(defenderWho, '../../assets/icons/SuperAttack.png', 'super');
    }
  }

  function runActionVisuals(action, actorWho, defenderWho, result) {
    if (!result) return;

    if (result.dodged) {
      applyBattleReaction(action, defenderWho, result);
      window.setTimeout(function () {
        showBattleEffect(action, actorWho, defenderWho, result);
      }, DODGE_FX_DELAY_MS);
      return;
    }

    showBattleEffect(action, actorWho, defenderWho, result);
    preserveGuardDuringHit(defenderWho, result);
    applyBattleReaction(action, defenderWho, result);
  }

  function setSpritePose(who, pose) {
    var sprite = document.getElementById(who + '-sprite');
    if (!sprite) return;

    sprite.classList.remove('pose-downed', 'pose-happy-jump');
    if (pose === 'downed') {
      sprite.classList.add('pose-downed');
    } else if (pose === 'happy-jump') {
      sprite.classList.add('pose-happy-jump');
    }
  }

  function clearSpritePose(who) {
    var sprite = document.getElementById(who + '-sprite');
    if (!sprite) return;
    sprite.classList.remove('pose-downed', 'pose-happy-jump');
  }

  function animateBattleReaction(who, reaction) {
    var wrap = document.getElementById(who + '-wrap');
    if (!wrap) return;

    var hitClass = who === 'player' ? 'react-hit-left' : 'react-hit-right';
    var dodgeClass = who === 'player' ? 'react-dodge-left' : 'react-dodge-right';

    wrap.classList.remove('react-hit-left', 'react-hit-right', 'react-dodge-left', 'react-dodge-right');
    void wrap.offsetWidth;

    if (reaction === 'hit') {
      setSpritePose(who, 'downed');
      wrap.classList.add(hitClass);
      window.setTimeout(function () {
        wrap.classList.remove(hitClass);
        clearSpritePose(who);
      }, 430);
      return;
    }

    if (reaction === 'dodge') {
      setSpritePose(who, 'happy-jump');
      wrap.classList.add(dodgeClass);
      window.setTimeout(function () {
        wrap.classList.remove(dodgeClass);
        clearSpritePose(who);
      }, DODGE_REACTION_MS);
    }
  }

  function applyBattleReaction(action, defenderWho, result) {
    if (!result) return;

    if (result.dodged) {
      animateBattleReaction(defenderWho, 'dodge');
      return;
    }

    if ((action === 'attack' || action === 'special') && result.damage > 0 && !result.guarded) {
      animateBattleReaction(defenderWho, 'hit');
    }
  }

  function preserveGuardDuringHit(defenderWho, result) {
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!ui || !result || !result.guarded || result.damage <= 0) return;
    ui.holdGuardFx(defenderWho, GUARDED_HIT_MS);
  }

  function getBattleAnimationDuration(action, result) {
    if (!result) return 0;
    if (result.dodged) return DODGE_REACTION_MS;
    if (result.guarded && result.damage > 0) return GUARDED_HIT_MS;
    if (action === 'special' && result.damage > 0) return SPECIAL_FX_MS;
    if ((action === 'attack' || action === 'special') && result.damage > 0) return HIT_REACTION_MS;
    return 0;
  }

  function renderBattleSprites() {
    if (state.playerPet && state.playerPet.sprite) {
      applySprite(document.getElementById('player-sprite'), state.playerPet.sprite, true);
      applySprite(document.getElementById('win-sprite'), state.playerPet.sprite, false);
      applySprite(document.getElementById('lose-sprite'), state.playerPet.sprite, false);
    }

    if (state.currentCpu && state.currentCpu.sprite) {
      applySprite(document.getElementById('cpu-sprite'), state.currentCpu.sprite, true);
      applySprite(document.getElementById('win-cpu-sprite'), state.currentCpu.sprite, false);
    }
  }

  function renderResultRewards(won) {
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!ui || !state.lastBattleRewards) return;
    ui.renderBattleRewards(won ? 'win' : 'lose', state.lastBattleRewards);
  }

  function persistBattleRewards(rewards) {
    var helpers = window.LeetmateBattle && window.LeetmateBattle.battleRewardHelpers;
    if (!helpers || !rewards) {
      return Promise.resolve(null);
    }

    return helpers.applyCpuBattleRewards(rewards).catch(function (error) {
      console.error('Battle reward persistence failed:', error);
      return null;
    });
  }

  function completeBattle(delayMs) {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var rewards = window.LeetmateBattle && window.LeetmateBattle.battleRewards;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!logic || !state.battle || state.battleCompleted) return;

    state.battleCompleted = true;
    state.battleBusy = false;
    if (ui) {
      ui.renderBattleState(state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);
    }

    var won = logic.getWinner(state.battle) === 'player';
    state.lastBattleRewards = rewards
      ? rewards.getCpuBattleRewards(state.currentCpu.difficulty, won)
      : null;
    renderResultRewards(won);
    persistBattleRewards(state.lastBattleRewards);

    window.setTimeout(function () {
      if (won) {
        showScreen(SCREEN_IDS.win);
      } else {
        showScreen(SCREEN_IDS.lose);
      }
    }, delayMs || 0);
  }

  function runCpuTurn() {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!logic || !ui || !state.battle) return;

    state.battleBusy = true;
    ui.setBattleActionsEnabled(false, state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);

    window.setTimeout(function () {
      var cpuAction = logic.chooseCpuAction(state.battle.cpu, state.battle.player);
      var result = logic.resolveAction(cpuAction, state.battle.cpu, state.battle.player);
      runActionVisuals(cpuAction, 'cpu', 'player', result);
      state.battle.turn = logic.isBattleOver(state.battle) ? state.battle.turn : 'player';
      state.battle.lastLog = result.message;
      ui.setBattleLog('Enemy turn: ' + result.message);
      ui.renderBattleState(state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);

      if (logic.isBattleOver(state.battle)) {
        completeBattle(getBattleAnimationDuration(cpuAction, result));
        return;
      }

      state.battleBusy = false;
      state.battle.turn = 'player';
      ui.renderBattleState(state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);
    }, 900);
  }

  function performPlayerAction(action) {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!logic || !ui || !state.battle || state.battleBusy || state.battle.turn !== 'player') return;

    var available = logic.getAvailableActions(state.battle.player);
    if (!available[action]) return;

    state.battleBusy = true;
    ui.setBattleActionsEnabled(false, state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);

    var result = logic.resolveAction(action, state.battle.player, state.battle.cpu);
    runActionVisuals(action, 'player', 'cpu', result);
    state.battle.lastLog = result.message;
    state.battle.turn = logic.isBattleOver(state.battle) ? state.battle.turn : 'cpu';
    ui.setBattleLog('Your turn: ' + result.message);
    ui.renderBattleState(state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);

    if (logic.isBattleOver(state.battle)) {
      completeBattle(getBattleAnimationDuration(action, result));
      return;
    }

    window.setTimeout(function () {
      runCpuTurn();
    }, 850);
  }

  function loadPlayerPet() {
    var loader = window.LeetmateBattle && window.LeetmateBattle.battleLoader;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;

    if (!loader || !ui) {
      state.playerPet = null;
      return;
    }

    loader.loadPlayerPetFromStorage().then(function (playerPet) {
      state.playerPet = playerPet;
      ui.renderPlayerLobby(state.playerPet, applySprite);
      ui.renderLobbyAvailability(state.playerPet);
    });
  }

  function generateCpuForMatch() {
    if (!state.playerPet || !state.playerPet.baseStats) return null;

    var generator = window.LeetmateBattle && window.LeetmateBattle.cpuStats;
    if (!generator || typeof generator.generateCpuFromPlayer !== 'function') {
      console.warn('CPU generator unavailable.');
      return null;
    }

    return generator.generateCpuFromPlayer(state.playerPet.baseStats, state.playerPet.petRef);
  }

  function startMatchmaking() {
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;

    startBattleMusic();
    showScreen(SCREEN_IDS.matchmaking);

    if (state.playerPet && state.playerPet.sprite) {
      applySprite(document.getElementById('mm-pet-sprite'), state.playerPet.sprite, true);
      if (ui) {
        ui.setText('mm-pet-name', state.playerPet.name);
      }
    }

    window.setTimeout(function () {
      state.currentCpu = generateCpuForMatch();
      state.rematchCpu = state.currentCpu ? Object.assign({}, state.currentCpu) : null;
      if (!state.currentCpu) {
        goToLobby();
        return;
      }
      if (ui) {
        ui.renderFoundMatch(state.currentCpu, applySprite);
      }
      showScreen(SCREEN_IDS.found);
    }, 2000);
  }

  function beginBattle() {
    var logic = window.LeetmateBattle && window.LeetmateBattle.battleLogic;
    var ui = window.LeetmateBattle && window.LeetmateBattle.battleUI;
    if (!logic || !ui || !state.playerPet || !state.currentCpu) return;

    state.lastBattleRewards = null;
    state.battleCompleted = false;
    state.battle = logic.createBattleState(state.playerPet, state.currentCpu);
    console.log('[Battle] Dodge rates', {
      player: {
        name: state.battle.player.name,
        dodgeRate: (logic.calculateDodgeChance(state.battle.player, state.battle.cpu) * 100).toFixed(2) + '%',
        spd: state.battle.player.spd
      },
      cpu: {
        name: state.battle.cpu.name,
        dodgeRate: (logic.calculateDodgeChance(state.battle.cpu, state.battle.player) * 100).toFixed(2) + '%',
        spd: state.battle.cpu.spd
      }
    });
    state.battleBusy = false;
    resetBattleVisualState();
    renderBattleSprites();
    ui.renderBattleState(state.battle, state.battleBusy, logic.SPECIAL_CHARGE_COST);
    ui.setBattleLog(state.battle.lastLog);
    showScreen(SCREEN_IDS.battle);
  }

  function rerollCpu() {
    startMatchmaking();
  }

  function rematchCpu() {
    if (!state.rematchCpu) return;
    state.currentCpu = Object.assign({}, state.rematchCpu);
    beginBattle();
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (!changes[STORAGE_VOLUME] && !changes[STORAGE_MUTED]) return;
      loadBattleAudioPrefs();
    });
  }

  window.addEventListener('pagehide', stopBattleMusic);
  window.addEventListener('beforeunload', stopBattleMusic);

  document.addEventListener('DOMContentLoaded', function () {
    loadBattleAudioPrefs();
    loadPlayerPet();

    document.getElementById('community-back-btn')?.addEventListener('click', handleBack);
    document.getElementById('multi-match-btn')?.addEventListener('click', startMatchmaking);
    document.getElementById('found-back-btn')?.addEventListener('click', goToLobby);
    document.getElementById('found-fight-btn')?.addEventListener('click', beginBattle);
    document.getElementById('found-reroll-btn')?.addEventListener('click', rerollCpu);
    document.getElementById('btn-attack')?.addEventListener('click', function () { performPlayerAction('attack'); });
    document.getElementById('btn-special')?.addEventListener('click', function () { performPlayerAction('special'); });
    document.getElementById('btn-guard')?.addEventListener('click', function () { performPlayerAction('guard'); });
    document.getElementById('btn-buff')?.addEventListener('click', function () { performPlayerAction('buff'); });
    document.getElementById('win-again-btn')?.addEventListener('click', rematchCpu);
    document.getElementById('lose-again-btn')?.addEventListener('click', rematchCpu);
    document.getElementById('win-home-btn')?.addEventListener('click', goToLobby);
    document.getElementById('lose-home-btn')?.addEventListener('click', goToLobby);
  });
})();
