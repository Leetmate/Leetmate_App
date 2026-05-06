(function () {
  'use strict';

  var DIFFICULTIES = [
    { name: 'Easy', multiplier: .80 },
    { name: 'Normal', multiplier: 1 },
    { name: 'Hard', multiplier: 1.05}
  ];

  var ARCHETYPES = {
    Balanced: { hp: 18, atk: 18, spAtk: 16, def: 15, spDef: 15, spd: 18 },
    Berserker: { hp: 18, atk: 28, spAtk: 10, def: 12, spDef: 12, spd: 20 },
    Tank: { hp: 21, atk: 12, spAtk: 8, def: 27, spDef: 18, spd: 14},
    Mage: { hp: 18, atk: 10, spAtk: 28, def: 12, spDef: 12, spd: 20 }
  };

  var CPU_PETS = [
    { petRef: 'Bat', name: 'Cubic Bat', sprite: '../../assets/spritesheets/CubicBatAdult.png' },
    { petRef: 'Cat', name: 'Cubic Cat', sprite: '../../assets/spritesheets/CubicCatAdult.png' },
    { petRef: 'Fox', name: 'Cubic Fox', sprite: '../../assets/spritesheets/CubicFoxAdult.png' },
    { petRef: 'Frog', name: 'Cubic Frog', sprite: '../../assets/spritesheets/CubicFrogAdult.png' },
    { petRef: 'Giraffe', name: 'Cubic Giraffe', sprite: '../../assets/spritesheets/CubicGiraffeAdult.png' },
    { petRef: 'MicoLeaoDourado', name: 'Golden Tamarin', sprite: '../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png' },
    { petRef: 'Wolf', name: 'Cubic Wolf', sprite: '../../assets/spritesheets/CubicWolfAdult.png' }
  ];

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomKey(obj) {
    return randomItem(Object.keys(obj));
  }

  function calculatePlayerPower(stats) {
    return (stats.hp / 10) + stats.atk + stats.spAtk + stats.def + stats.spDef + stats.spd;
  }

  function distributeStats(totalPower, profile) {
    var exactStats = {
      hp: totalPower * (profile.hp / 100),
      atk: totalPower * (profile.atk / 100),
      spAtk: totalPower * (profile.spAtk / 100),
      def: totalPower * (profile.def / 100),
      spDef: totalPower * (profile.spDef / 100)
    };

    var roundedStats = {
      hp: Math.round(exactStats.hp),
      atk: Math.round(exactStats.atk),
      spAtk: Math.round(exactStats.spAtk),
      def: Math.round(exactStats.def),
      spDef: Math.round(exactStats.spDef)
    };

    roundedStats.spd = Math.round(totalPower - (
      roundedStats.hp +
      roundedStats.atk +
      roundedStats.spAtk +
      roundedStats.def +
      roundedStats.spDef
    ));

    if (roundedStats.spd < 0) {
      roundedStats.spd = 0;
    }

    return roundedStats;
  }

  function getEligibleCpuPets(playerPetRef) {
    if (!playerPetRef) return CPU_PETS;

    var eligiblePets = CPU_PETS.filter(function (pet) {
      return pet.petRef !== playerPetRef;
    });

    return eligiblePets.length ? eligiblePets : CPU_PETS;
  }

  function generateCpuFromPlayer(playerStats, playerPetRef) {
    var playerPower = calculatePlayerPower(playerStats);
    var difficulty = randomItem(DIFFICULTIES);
    var archetypeName = randomKey(ARCHETYPES);
    var archetype = ARCHETYPES[archetypeName];
    var species = randomItem(getEligibleCpuPets(playerPetRef));
    var enemyPower = playerPower * difficulty.multiplier;
    var stats = distributeStats(enemyPower, archetype);
    var hp = stats.hp * 10;

    return {
      name: species.name,
      sprite: species.sprite,
      difficulty: difficulty.name,
      archetype: archetypeName,
      power: Math.round(enemyPower),
      maxHp: hp,
      hp: hp,
      atk: stats.atk,
      def: stats.def,
      spAtk: stats.spAtk,
      spDef: stats.spDef,
      spd: stats.spd,
      baseHpStat: stats.hp
    };
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.cpuStats = {
    DIFFICULTIES: DIFFICULTIES,
    ARCHETYPES: ARCHETYPES,
    CPU_PETS: CPU_PETS,
    calculatePlayerPower: calculatePlayerPower,
    getEligibleCpuPets: getEligibleCpuPets,
    generateCpuFromPlayer: generateCpuFromPlayer
  };
})();
