(function () {
  'use strict';

  var SPECIAL_CHARGE_COST = 2;
  var MAX_ATTACK_CHARGES = 2;
  var GUARD_DAMAGE_MULTIPLIER = 0.5;
  var BUFF_DAMAGE_MULTIPLIER = 1.30;
  var DAMAGE_VARIANCE_MIN = 0.95;
  var DAMAGE_VARIANCE_MAX = 1.05;
  var BASE_DODGE_CHANCE = 0.05;

  function randFactor(min, max) {
    return min + Math.random() * (max - min);
  }

  function clampHp(value) {
    return Math.max(0, Math.round(value));
  }

  function calculateDodgeChance(combatant, opponent) {
    if (!combatant || !opponent) return BASE_DODGE_CHANCE;
    if (combatant.spd <= opponent.spd) return BASE_DODGE_CHANCE;
    return BASE_DODGE_CHANCE + (Math.sqrt(combatant.spd - opponent.spd) / 100);
  }

  function doesAttackMiss(attacker, defender) {
    var dodgeChance = calculateDodgeChance(defender, attacker);
    var roll = Math.random();
    var dodged = roll < dodgeChance;

    console.log('[Battle] Dodge roll', {
      attacker: attacker ? attacker.name : '-',
      defender: defender ? defender.name : '-',
      attackerSpd: attacker ? attacker.spd : 0,
      defenderSpd: defender ? defender.spd : 0,
      dodgeChance: (dodgeChance * 100).toFixed(2) + '%',
      roll: roll.toFixed(4),
      dodged: dodged
    });

    return dodged;
  }


  function cloneCombatant(source) {
    return {
      name: source.name,
      sprite: source.sprite,
      maxHp: Number(source.maxHp || 0),
      hp: Number(source.maxHp || source.hp || 0),
      atk: Number(source.atk || 0),
      def: Number(source.def || 0),
      spAtk: Number(source.spAtk || 0),
      spDef: Number(source.spDef || 0),
      spd: Number(source.spd || 0),
      guardActive: false,
      buffActive: false,
      attackCharges: 0
    };
  }

  function buildPlayerCombatant(playerPet) {
    var stats = playerPet && playerPet.baseStats ? playerPet.baseStats : {};
    var maxHp = Number(stats.hp || 0);

    return cloneCombatant({
      name: playerPet ? playerPet.name : 'Player',
      sprite: playerPet ? playerPet.sprite : '',
      maxHp: maxHp,
      hp: maxHp,
      atk: Number(stats.atk || 0),
      def: Number(stats.def || 0),
      spAtk: Number(stats.spAtk || 0),
      spDef: Number(stats.spDef || 0),
      spd: Number(stats.spd || 0)
    });
  }

  function calculateAttackDamage(attacker, defender) {
    var scaledDamage = attacker.atk * Math.sqrt(attacker.atk / defender.def) * 1.2;
    return Math.max(1, Math.round(scaledDamage * randFactor(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX)));
  }

  function calculateSpecialDamage(attacker, defender) {
    var scaledDamage = attacker.spAtk * Math.sqrt(attacker.spAtk / defender.spDef) * 2;
    return Math.max(2, Math.round(scaledDamage * randFactor(DAMAGE_VARIANCE_MIN, DAMAGE_VARIANCE_MAX)));
  }

  function finalizeDamage(baseDamage, attacker, defender, useBuff) {
    var finalDamage = baseDamage;

    if (useBuff) {
      finalDamage = Math.round(finalDamage * BUFF_DAMAGE_MULTIPLIER);
    }

    if (defender.guardActive) {
      finalDamage = Math.floor(finalDamage * GUARD_DAMAGE_MULTIPLIER);
      defender.guardActive = false;
    }

    return Math.max(1, finalDamage);
  }

  function consumeBuffOnAttackAttempt(attacker) {
    var hadBuff = !!attacker.buffActive;
    if (hadBuff) {
      attacker.buffActive = false;
    }
    return hadBuff;
  }

  function getAvailableActions(combatant) {
    return {
      attack: true,
      special: combatant.attackCharges >= SPECIAL_CHARGE_COST,
      guard: !combatant.guardActive,
      buff: !combatant.buffActive
    };
  }

  function resolveAction(action, attacker, defender) {
    var result = {
      action: action,
      damage: 0,
      chargesGained: 0,
      specialSpent: 0,
      consumedGuard: false,
      consumedBuff: false,
      dodged: false,
      guarded: false,
      message: ''
    };

    if (action === 'attack') {
      var attackHadBuff = consumeBuffOnAttackAttempt(attacker);
      if (doesAttackMiss(attacker, defender)) {
        result.chargesGained = 1;
        attacker.attackCharges = Math.min(MAX_ATTACK_CHARGES, attacker.attackCharges + 1);
        result.consumedBuff = attackHadBuff;
        result.dodged = true;
        result.message = attacker.name + ' attacked, but ' + defender.name + ' dodged!';
        return result;
      }

      result.guarded = defender.guardActive;
      result.damage = finalizeDamage(calculateAttackDamage(attacker, defender), attacker, defender, attackHadBuff);
      result.chargesGained = 1;
      attacker.attackCharges = Math.min(MAX_ATTACK_CHARGES, attacker.attackCharges + 1);
      attacker.buffActive = false;
      defender.hp = clampHp(defender.hp - result.damage);
      result.message = attacker.name + ' attacked for ' + result.damage + ' damage!';
      result.consumedGuard = !defender.guardActive;
      result.consumedBuff = attackHadBuff;
      return result;
    }

    if (action === 'special') {
      var specialHadBuff = consumeBuffOnAttackAttempt(attacker);
      attacker.attackCharges = Math.max(0, attacker.attackCharges - SPECIAL_CHARGE_COST);
      result.specialSpent = SPECIAL_CHARGE_COST;

      if (doesAttackMiss(attacker, defender)) {
        result.consumedBuff = specialHadBuff;
        result.dodged = true;
        result.message = attacker.name + ' used Special, but ' + defender.name + ' dodged!';
        return result;
      }

      result.guarded = defender.guardActive;
      result.damage = finalizeDamage(calculateSpecialDamage(attacker, defender), attacker, defender, specialHadBuff);
      attacker.buffActive = false;
      defender.hp = clampHp(defender.hp - result.damage);
      result.message = attacker.name + ' used Special for ' + result.damage + ' damage!';
      result.consumedGuard = !defender.guardActive;
      result.consumedBuff = specialHadBuff;
      return result;
    }

    if (action === 'guard') {
      attacker.guardActive = true;
      result.chargesGained = 1;
      attacker.attackCharges = Math.min(MAX_ATTACK_CHARGES, attacker.attackCharges + 1);
      result.message = attacker.name + ' is guarding!';
      return result;
    }

    attacker.buffActive = true;
    result.message = attacker.name + ' powered up their next attack!';
    return result;
  }

  function chooseCpuAction(cpu, player) {
    var random = Math.random();
    var guardChance = 0.15;

    if (cpu.hp < 35) {
      guardChance = 0.3;
    } else if (cpu.hp < 60) {
      guardChance = 0.25;
    }

    if (cpu.attackCharges >= SPECIAL_CHARGE_COST && random < 0.7) {
      return 'special';
    }

    if (!cpu.guardActive && random < guardChance) {
      return 'guard';
    }

    if (!cpu.buffActive && random < 0.25) {
      return 'buff';
    }

    if (player.buffActive && !cpu.guardActive && random < Math.max(guardChance, 0.25)) {
      return 'guard';
    }

    return 'attack';
  }

  function isBattleOver(state) {
    return state.player.hp <= 0 || state.cpu.hp <= 0;
  }

  function getWinner(state) {
    if (state.cpu.hp <= 0) return 'player';
    if (state.player.hp <= 0) return 'cpu';
    return null;
  }

  function createBattleState(playerPet, cpuPet) {
    return {
      player: buildPlayerCombatant(playerPet),
      cpu: cloneCombatant(cpuPet),
      turn: 'player',
      lastLog: 'Your turn! Choose an action.'
    };
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.battleLogic = {
    SPECIAL_CHARGE_COST: SPECIAL_CHARGE_COST,
    MAX_ATTACK_CHARGES: MAX_ATTACK_CHARGES,
    BASE_DODGE_CHANCE: BASE_DODGE_CHANCE,
    createBattleState: createBattleState,
    calculateDodgeChance: calculateDodgeChance,
    getAvailableActions: getAvailableActions,
    resolveAction: resolveAction,
    chooseCpuAction: chooseCpuAction,
    isBattleOver: isBattleOver,
    getWinner: getWinner
  };
})();
