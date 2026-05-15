(function () {
  'use strict';

  var MAX_XP = 100;
  var LEVEL_UP_COIN_REWARD = 40;

  function safeWholeNumber(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback || 0;
    return Math.max(0, Math.floor(number));
  }

  function normalizeProgress(xp, level) {
    var safeXp = safeWholeNumber(xp, 0);
    var safeLevel = Math.max(1, safeWholeNumber(level, 1));
    var levelUps = Math.floor(safeXp / MAX_XP);

    return {
      xp: safeXp % MAX_XP,
      level: safeLevel + levelUps,
      levelUps: levelUps
    };
  }

  function getBattleRewardUpdate(rewards) {
    var FieldValue = firebase && firebase.firestore && firebase.firestore.FieldValue;

    return {
      trophy: FieldValue.increment(Number(rewards.trophy || 0)),
      coins: FieldValue.increment(Number(rewards.coins || 0)),
      xp: FieldValue.increment(Number(rewards.xp || 0)),
      updatedAt: FieldValue.serverTimestamp()
    };
  }

  function applyCpuBattleRewards(rewards) {
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) {
      return Promise.reject(new Error('Firebase is unavailable.'));
    }

    var user = firebase.auth().currentUser;
    if (!user || !user.uid) {
      return Promise.reject(new Error('No authenticated user for battle rewards.'));
    }

    var db = firebase.firestore();
    var userRef = db.collection('users').doc(user.uid);
    var FieldValue = firebase.firestore.FieldValue;
    var xpDelta = safeWholeNumber(rewards && rewards.xp, 0);
    var coinsDelta = safeWholeNumber(rewards && rewards.coins, 0);
    var trophyDelta = Number(rewards && rewards.trophy) || 0;

    return db.runTransaction(function (transaction) {
      return transaction.get(userRef).then(function (snap) {
        var data = snap.exists ? (snap.data() || {}) : {};
        var progress = normalizeProgress(
          safeWholeNumber(data.xp, 0) + xpDelta,
          data.level
        );
        var coins = safeWholeNumber(data.coins, 0) + coinsDelta + (progress.levelUps * LEVEL_UP_COIN_REWARD);
        var trophy = Number(data.trophy || 0) + trophyDelta;

        transaction.set(userRef, {
          trophy: trophy,
          coins: coins,
          xp: progress.xp,
          level: progress.level,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });
    });
  }

  function applyBattleRewards(rewards) {
    return applyCpuBattleRewards(rewards);
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.battleRewardHelpers = {
    getBattleRewardUpdate: getBattleRewardUpdate,
    applyCpuBattleRewards: applyCpuBattleRewards,
    applyBattleRewards: applyBattleRewards
  };
})();
