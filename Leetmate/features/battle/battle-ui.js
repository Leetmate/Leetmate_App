(function () {
  'use strict';

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateHpBar(who, cur, max) {
    var pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) * 100 : 0;
    var bar = document.getElementById(who + '-hp-bar');
    var txt = document.getElementById(who + '-hp-text');

    if (bar) {
      bar.style.width = pct + '%';
      bar.style.backgroundColor = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
    }

    if (txt) {
      txt.textContent = Math.max(0, Math.round(cur)) + ' / ' + max;
    }
  }

  function setBattleLog(message) {
    setText('battle-log-text', message);
  }

  function setPersistentGuardFx(who, active) {
    var guardEl = document.getElementById(who + '-guard-fx');
    if (!guardEl) return;
    guardEl.classList.toggle('is-guarding', !!active);
  }

  function holdGuardFx(who, durationMs) {
    var guardEl = document.getElementById(who + '-guard-fx');
    if (!guardEl) return;

    if (guardEl._holdGuardTimer) {
      window.clearTimeout(guardEl._holdGuardTimer);
    }

    guardEl.classList.add('hold-guard');
    guardEl._holdGuardTimer = window.setTimeout(function () {
      guardEl.classList.remove('hold-guard');
      guardEl._holdGuardTimer = null;
    }, durationMs);
  }

  function setPersistentBuffAura(who, active) {
    var auraEl = document.getElementById(who + '-buff-aura');
    if (!auraEl) return;
    auraEl.classList.toggle('is-buffed', !!active);
  }

  function renderPlayerLobby(playerPet, applySprite) {
    var spriteEl = document.getElementById('multi-pet-sprite');
    if (spriteEl && playerPet && playerPet.sprite) {
      applySprite(spriteEl, playerPet.sprite, true);
    }

    setText('multi-pet-name', playerPet ? playerPet.name : '-');

    var stats = playerPet ? playerPet.baseStats : null;
    setText('stat-hp', stats ? stats.hp : '-');
    setText('stat-atk', stats ? stats.atk : '-');
    setText('stat-def', stats ? stats.def : '-');
    setText('stat-spatk', stats ? stats.spAtk : '-');
    setText('stat-spdef', stats ? stats.spDef : '-');
    setText('stat-spd', stats ? stats.spd : '-');
  }

  function renderLobbyAvailability(playerPet) {
    var statsCard = document.getElementById('multi-stats-card');
    var matchBtn = document.getElementById('multi-match-btn');
    var lockedEl = document.getElementById('multi-locked');
    var lockedDesc = document.getElementById('multi-locked-desc');
    var isAdult = !!(playerPet && playerPet.stage === 'adult' && playerPet.ableToBattle);

    if (statsCard) statsCard.style.display = isAdult ? '' : 'none';
    if (matchBtn) matchBtn.style.display = isAdult ? '' : 'none';
    if (lockedEl) lockedEl.style.display = isAdult ? 'none' : '';

    if (!lockedDesc || isAdult) return;

    if (!playerPet) {
      lockedDesc.textContent = 'Choose an active pet to unlock battles.';
      return;
    }

    lockedDesc.textContent = playerPet.stage === 'egg'
      ? playerPet.name + ' has not hatched yet! Keep solving problems to hatch and evolve your pet.'
      : playerPet.name + ' is still a baby! Keep solving problems to evolve and unlock battles.';
  }

  function renderFoundMatch(cpuPet, applySprite) {
    if (!cpuPet) return;

    function statText(value) {
      return value == null ? '-' : value;
    }

    applySprite(document.getElementById('found-cpu-sprite'), cpuPet.sprite, true);
    setText('found-cpu-name', cpuPet.name);
    setText('found-cpu-difficulty', cpuPet.difficulty || 'Normal');
    setText('found-cpu-class', cpuPet.archetype || 'Balanced');
    setText('found-hp', statText(cpuPet.maxHp));
    setText('found-atk', statText(cpuPet.atk));
    setText('found-def', statText(cpuPet.def));
    setText('found-spatk', statText(cpuPet.spAtk));
    setText('found-spdef', statText(cpuPet.spDef));
    setText('found-spd', statText(cpuPet.spd));
  }

  function setBattleActionsEnabled(enabled, battleState, battleBusy, specialChargeCost) {
    var buttons = ['btn-attack', 'btn-special', 'btn-guard', 'btn-buff'];
    var available = battleState && battleState.player
      ? window.LeetmateBattle.battleLogic.getAvailableActions(battleState.player)
      : null;

    buttons.forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;

      var actionName = id.replace('btn-', '');
      var actionEnabled = enabled && (!available || !!available[actionName]);
      button.disabled = !actionEnabled;
    });

    var specialButton = document.getElementById('btn-special');
    var chargeText = document.getElementById('special-charge-text');

    if (specialButton && battleState && battleState.player) {
      var charges = battleState.player.attackCharges;
      var ready = charges >= specialChargeCost;

      if (!enabled || !ready) {
        specialButton.disabled = true;
      }

      specialButton.classList.toggle('on-cooldown', !ready);

      if (chargeText) {
        chargeText.textContent = charges + '/' + specialChargeCost;
        chargeText.classList.add('visible');
      }
    }
  }

  function renderBattleState(battleState, battleBusy, specialChargeCost) {
    if (!battleState) return;

    setText('player-name', battleState.player.name);
    setText('cpu-name', battleState.cpu.name);
    updateHpBar('player', battleState.player.hp, battleState.player.maxHp);
    updateHpBar('cpu', battleState.cpu.hp, battleState.cpu.maxHp);
    setPersistentGuardFx('player', battleState.player.guardActive);
    setPersistentGuardFx('cpu', battleState.cpu.guardActive);
    setPersistentBuffAura('player', battleState.player.buffActive);
    setPersistentBuffAura('cpu', battleState.cpu.buffActive);
    setBattleActionsEnabled(!battleBusy && battleState.turn === 'player', battleState, battleBusy, specialChargeCost);
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.battleUI = {
    setText: setText,
    updateHpBar: updateHpBar,
    setBattleLog: setBattleLog,
    setPersistentGuardFx: setPersistentGuardFx,
    holdGuardFx: holdGuardFx,
    setPersistentBuffAura: setPersistentBuffAura,
    renderPlayerLobby: renderPlayerLobby,
    renderLobbyAvailability: renderLobbyAvailability,
    renderFoundMatch: renderFoundMatch,
    setBattleActionsEnabled: setBattleActionsEnabled,
    renderBattleState: renderBattleState
  };
})();
