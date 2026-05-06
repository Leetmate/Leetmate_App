(function () {
  'use strict';

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

  function buildFallbackSpritePath(snapshot) {
    if (!snapshot || !snapshot.petRef) return null;

    var stage = String(snapshot.stage || 'adult').toLowerCase();
    var assetSet = PET_ASSETS[snapshot.petRef];
    if (!assetSet) return null;
    if (stage === 'egg') return assetSet.egg;
    if (stage === 'baby') return assetSet.baby;
    return assetSet.adult;
  }

  function buildDefaultPetName(petRef) {
    if (!petRef) return 'Pet';
    if (petRef === 'MicoLeaoDourado') return 'Golden Tamarin';
    return 'Cubic ' + petRef;
  }

  function buildPlayerPet(snapshot, spritePath) {
    if (!snapshot) return null;

    var stats = snapshot.stats || {};
    return {
      petRef: snapshot.petRef || null,
      name: (snapshot.customName || '').trim() || buildDefaultPetName(snapshot.petRef),
      sprite: spritePath ? '../../' + spritePath : buildFallbackSpritePath(snapshot),
      stage: String(snapshot.stage || '').toLowerCase(),
      ableToBattle: snapshot.ableToBattle !== false,
      baseStats: {
        hp: Number(stats.hp || 0),
        atk: Number(stats.atk || 0),
        def: Number(stats.def || 0),
        spAtk: Number(stats.spAtk || 0),
        spDef: Number(stats.spDef || 0),
        spd: Number(stats.spd || 0)
      }
    };
  }

  function loadPlayerPetFromStorage() {
    if (typeof storageGet !== 'function') {
      return Promise.resolve(null);
    }

    return storageGet(['activePetSnapshot', 'activePetSpritePath']).then(function (data) {
      return buildPlayerPet(data.activePetSnapshot, data.activePetSpritePath);
    }).catch(function () {
      return null;
    });
  }

  window.LeetmateBattle = window.LeetmateBattle || {};
  window.LeetmateBattle.battleLoader = {
    buildFallbackSpritePath: buildFallbackSpritePath,
    buildDefaultPetName: buildDefaultPetName,
    buildPlayerPet: buildPlayerPet,
    loadPlayerPetFromStorage: loadPlayerPetFromStorage
  };
})();
