(function () {
  'use strict';

  function buildFallbackSpritePath(snapshot) {
    if (!snapshot || !snapshot.petRef) return null;

    var stage = String(snapshot.stage || 'adult').toLowerCase();
    if (stage === 'egg') {
      return '../../assets/eggs/Cubic' + snapshot.petRef + 'Egg.png';
    }

    if (stage === 'baby') {
      return '../../assets/spritesheets/Cubic' + snapshot.petRef + 'Baby.png';
    }

    return '../../assets/spritesheets/Cubic' + snapshot.petRef + 'Adult.png';
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
