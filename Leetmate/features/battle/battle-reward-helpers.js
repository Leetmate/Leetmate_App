(function () {
  'use strict';

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
    if (!firebase || !firebase.firestore || !firebase.auth) {
      return Promise.reject(new Error('Firebase is unavailable.'));
    }

    var user = firebase.auth().currentUser;
    if (!user || !user.uid) {
      return Promise.reject(new Error('No authenticated user for battle rewards.'));
    }

    return firebase
      .firestore()
      .collection('users')
      .doc(user.uid)
      .set(getBattleRewardUpdate(rewards), { merge: true });
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
