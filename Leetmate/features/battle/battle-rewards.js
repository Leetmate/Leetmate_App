(function () {
  'use strict';

  var XP_PER_BATTLE = 5;
  var COINS_ON_WIN = 10;

  var CPU_BATTLE_REWARDS = {
    Easy: {
      win: { trophy: 1, coins: COINS_ON_WIN, xp: XP_PER_BATTLE },
      loss: { trophy: -3, coins: 0, xp: XP_PER_BATTLE }
    },
    Normal: {
      win: { trophy: 2, coins: COINS_ON_WIN, xp: XP_PER_BATTLE },
      loss: { trophy: -2, coins: 0, xp: XP_PER_BATTLE }
    },
    Hard: {
      win: { trophy: 3, coins: COINS_ON_WIN, xp: XP_PER_BATTLE },
      loss: { trophy: -1, coins: 0, xp: XP_PER_BATTLE }
    }
  };

  function getCpuBattleRewards(difficulty, won) {
    return won
      ? CPU_BATTLE_REWARDS[difficulty].win
      : CPU_BATTLE_REWARDS[difficulty].loss;
  }

  function getRewardOutcomeLabel(won) {
    return won ? 'win' : 'loss';
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.battleRewards = {
    XP_PER_BATTLE: XP_PER_BATTLE,
    COINS_ON_WIN: COINS_ON_WIN,
    CPU_BATTLE_REWARDS: CPU_BATTLE_REWARDS,
    getCpuBattleRewards: getCpuBattleRewards,
    getRewardOutcomeLabel: getRewardOutcomeLabel
  };
})();
