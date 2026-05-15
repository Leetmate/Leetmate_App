const PET_ASSETS = {
    Bat: {
      egg: '../../assets/eggs/CubicBatEgg.png',
      baby: '../../assets/spritesheets/CubicBatBaby.png',
      adult: '../../assets/spritesheets/CubicBatAdult.png'
    },
    Bunny: {
      egg: '../../assets/eggs/CubicBunnyEgg.png',
      baby: '../../assets/spritesheets/CubicBunnyBaby.png',
      adult: '../../assets/spritesheets/CubicBunnyAdult.png'
    },
    Cat: {
      egg: '../../assets/eggs/CubicCatEgg.png',
      baby: '../../assets/spritesheets/CubicCatBaby.png',
      adult: '../../assets/spritesheets/CubicCatAdult.png'
    },
    Elephant: {
      egg: '../../assets/eggs/CubicElephantEgg.png',
      baby: '../../assets/spritesheets/CubicElephantBaby.png',
      adult: '../../assets/spritesheets/CubicElephantAdult.png'
    },
    Flamingo: {
      egg: '../../assets/eggs/CubicFlamingoEgg.png',
      baby: '../../assets/spritesheets/CubicFlamingoBaby.png',
      adult: '../../assets/spritesheets/CubicFlamingoAdult.png'
    },
    Fox: {
      egg: '../../assets/eggs/CubicFoxEgg.png',
      baby: '../../assets/spritesheets/CubicFoxBaby.png',
      adult: '../../assets/spritesheets/CubicFoxAdult.png'
    },
    Frog: {
      egg: '../../assets/eggs/CubicFrogEgg.png',
      baby: '../../assets/spritesheets/CubicFrogBaby.png',
      adult: '../../assets/spritesheets/CubicFrogAdult.png'
    },
    Grizzly: {
      egg: '../../assets/eggs/CubicGrizzlyEgg.png',
      baby: '../../assets/spritesheets/CubicGrizzyBaby.png',
      adult: '../../assets/spritesheets/CubicGrizzlyAdult.png'
    },
    Wolf: {
      egg: '../../assets/eggs/CubicWolfEgg.png',
      baby: '../../assets/spritesheets/CubicWolfBaby.png',
      adult: '../../assets/spritesheets/CubicWolfAdult.png'
    },
    Giraffe: {
      egg: '../../assets/eggs/CubicGiraffeEgg.png',
      baby: '../../assets/spritesheets/CubicGiraffeBaby.png',
      adult: '../../assets/spritesheets/CubicGiraffeAdult.png'
    },
    MicoLeaoDourado: {
      egg: '../../assets/eggs/CubicMicoLeaoDouradoEgg.png',
      baby: '../../assets/spritesheets/CubicMicoLeaoDouradoBaby.png',
      adult: '../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png'
    },
    Lion: {
      egg: '../../assets/eggs/CubicLionEgg.png',
      baby: '../../assets/spritesheets/CubicLionBaby.png',
      adult: '../../assets/spritesheets/CubicLionAdult.png'
    },
    Owl: {
      egg: '../../assets/eggs/CubicOwlEgg.png',
      baby: '../../assets/spritesheets/CubicOwlBaby.png',
      adult: '../../assets/spritesheets/CubicOwlAdult.png'
    },
    Penguin: {
      egg: '../../assets/eggs/CubicPenguinEgg.png',
      baby: '../../assets/spritesheets/CubicPenguinBaby.png',
      adult: '../../assets/spritesheets/CubicPenguinAdult.png'
    },
    Rat: {
      egg: '../../assets/eggs/CubicRatEgg.png',
      baby: '../../assets/spritesheets/CubicRatBaby.png',
      adult: '../../assets/spritesheets/CubicRatAdult.png'
    },
    Sheep: {
      egg: '../../assets/eggs/CubicSheepEgg.png',
      baby: '../../assets/spritesheets/CubicSheepBaby.png',
      adult: '../../assets/spritesheets/CubicSheepAdult.png'
    },
    Turtle: {
      egg: '../../assets/eggs/CubicTurtleEgg.png',
      baby: '../../assets/spritesheets/CubicTurtleBaby.png',
      adult: '../../assets/spritesheets/CubicTurtleAdult.png'
    },
    Unicorn: {
      egg: '../../assets/eggs/CubicUnicornEgg.png',
      baby: '../../assets/spritesheets/CubicUnicornBaby.png',
      adult: '../../assets/spritesheets/CubicUnicornAdult.png'
    }
};
  
let activePetContext = {
    petType: null,
    activeStage: null,
    petData: null,
    oldStats: null,
    newStats: null
};
  
function redirectToHome() {
    const homeUrl =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL('screens/home/index.html')
            : '../../screens/home/index.html';
    window.location.replace(homeUrl);
}

function evolutionStagesMatch(a, b) {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function readEvolutionSessionPayload() {
    try {
        const raw = sessionStorage.getItem('leetmate_evolution_payload');
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || typeof o.petId !== 'string' || !o.petId) return null;
        if (o.fromStage == null || o.toStage == null) return null;
        return o;
    } catch {
        return null;
    }
}

function getEvolutionStages(activeStage = 'egg') {
    const normalizedStage = String(activeStage || 'egg').toLowerCase();
  
    if (normalizedStage === 'egg') {
      return { fromStage: 'egg', toStage: 'baby' };
    }
  
    if (normalizedStage === 'baby' || normalizedStage === 'child') {
      return { fromStage: 'baby', toStage: 'adult' };
    }
  
    return { fromStage: 'egg', toStage: 'baby' };
}
  
async function waitForAuthenticatedUser(timeoutMs = 5000) {
    return new Promise((resolve) => {
        const auth = firebase.auth();
        const existingUser = auth.currentUser;

        if (existingUser) {
        resolve(existingUser);
        return;
        }
  
        const timeoutId = setTimeout(() => {
            unsubscribe();
            resolve(null);
        }, timeoutMs);
    
        const unsubscribe = auth.onAuthStateChanged((user) => {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(user || null);
        });
    });
  }
  
async function loadActivePetForEvolution() {
    const user = await waitForAuthenticatedUser();
  
    if (!user) {
      console.warn('No signed-in user found.');
      return null;
    }
  
    const db = firebase.firestore();
    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();
  
    if (!userSnap.exists) {
      console.warn('User document not found.');
      return null;
    }
  
    const userData = userSnap.data();
    const activePetId = userData.activePetId;
  
    if (!activePetId) {
      console.warn('No activePetId found on user document.');
      return null;
    }
  
    const petSnap = await userRef.collection('pets').doc(activePetId).get();
  
    if (!petSnap.exists) {
      console.warn('Active pet document not found.');
      return null;
    }
  
    let petData = petSnap.data();

    if (typeof storageGet === 'function') {
        const { leetmate_pet_age_pending_firestore_sync, ownedPetsSnapshot } =
            await storageGet([
                'leetmate_pet_age_pending_firestore_sync',
                'ownedPetsSnapshot'
            ]);
        if (
            leetmate_pet_age_pending_firestore_sync &&
            Array.isArray(ownedPetsSnapshot)
        ) {
            const local = ownedPetsSnapshot.find((p) => p && p.id === activePetId);
            if (local) {
                const localAge =
                    typeof local.age === 'number' && Number.isFinite(local.age)
                        ? local.age
                        : null;
                const remoteAge =
                    typeof petData.age === 'number' && Number.isFinite(petData.age)
                        ? petData.age
                        : 0;
                if (localAge !== null && localAge > remoteAge) {
                    petData = { ...petData, age: localAge };
                    if (local.stage) {
                        petData = { ...petData, stage: local.stage };
                    }
                }
            }
        }
    }

    const petType = petData.petRef;
    const activeStage = petData.stage || 'egg';
  
    if (!petType || !PET_ASSETS[petType]) {
      console.warn('Active pet is missing a valid petRef.', petData);
      return null;
    }
  
    return {
      petId: activePetId,
      petType,
      activeStage,
      petData
    };
}
  
function resetEvolutionState() {
    const evolutionWrap = document.querySelector('.evolution-wrap');
    const eggStage = document.getElementById('egg-stage');
    const eggEl = document.getElementById('active-pet-egg');
    const fromPetSprite = document.getElementById('active-from-pet');
    const petSprite = document.getElementById('active-pet');
    const topBanner = document.getElementById('top-banner');
    const statsDialog = document.getElementById('stats-dialog');
    const statsGrid = document.getElementById('stats-grid');
  
    if (!evolutionWrap || !eggStage || !eggEl || !fromPetSprite || !petSprite) {
      return null;
    }
    resetEvolutionDialog();

    topBanner?.classList.add('hidden');
    statsDialog?.classList.add('hidden');
    
    if (statsGrid) {
      statsGrid.innerHTML = '';
    }  
    evolutionWrap.classList.remove('is-hatching');
    eggStage.classList.remove('hatching', 'evolving-child');
    eggStage.classList.remove('hidden');
  
    eggEl.classList.add('hidden');
    eggEl.src = '';
  
    fromPetSprite.classList.add('hidden');
    fromPetSprite.style.backgroundImage = '';
    fromPetSprite.style.backgroundPosition = '0% 100%';
    fromPetSprite.style.backgroundPosition = '0% 100%';
  
    petSprite.classList.add('hidden');
    petSprite.classList.remove('hatch-appear');
    petSprite.style.backgroundImage = '';
    petSprite.style.backgroundPosition = '0% 100%';  
    return {
      evolutionWrap,
      eggStage,
      eggEl,
      fromPetSprite,
      petSprite,
      topBanner,
    };
}

let typewriterTimeout = null;

function resetEvolutionDialog() {
    const dialog = document.getElementById('evolution-dialog');
    const dialogText = document.getElementById('evolution-dialog-text');

    if (typewriterTimeout) {
      clearTimeout(typewriterTimeout);
      typewriterTimeout = null;
    }

    dialog?.classList.add('hidden');
    dialog?.classList.remove('typing');

    if (dialogText) {
      dialogText.textContent = '';
    }
}

function typeEvolutionDialog(message, speed = 28) {
    const dialog = document.getElementById('evolution-dialog');
    const dialogText = document.getElementById('evolution-dialog-text');

    if (!dialog || !dialogText) {
      return;
    }

    dialog.classList.remove('hidden');
    dialog.classList.add('typing');
    dialogText.textContent = '';

    let index = 0;

    function step() {
      dialogText.textContent = message.slice(0, index);
      index += 1;

      if (index <= message.length) {
        typewriterTimeout = setTimeout(step, speed);
      } else {
        dialog.classList.remove('typing');
        typewriterTimeout = null;
      }
    }

    step();
}

function showStatsDialog(oldStats = {}, newStats = {}) {
  const dialog = document.getElementById('stats-dialog');
  const grid = document.getElementById('stats-grid');

  if (!dialog || !grid) return;

  const statRows = [
    ['HP', 'hp'],
    ['ATK', 'atk'],
    ['DEF', 'def'],
    ['SP ATK', 'spAtk'],
    ['SP DEF', 'spDef'],
    ['SPD', 'spd']
  ];

  grid.innerHTML = statRows
    .map(([label, key]) => {
      const oldValue = oldStats[key] ?? 0;
      const newValue = newStats[key] ?? oldValue + 5;

      return `
        <div class="stat-label">${label}</div>
        <div class="stat-value" data-new-value="${newValue}">${oldValue}</div>
        <div class="stat-increase">+5</div>
      `;
    })
    .join('');

  dialog.classList.remove('hidden');

  setTimeout(() => {
    grid.querySelectorAll('.stat-value').forEach((valueEl, index) => {
      valueEl.textContent = valueEl.dataset.newValue;
      valueEl.style.animationDelay = `${index * 120}ms`; // stagger effect
      valueEl.classList.add('stat-value-boosted');
    });
  
    grid.querySelectorAll('.stat-increase').forEach((increaseEl) => {
      increaseEl.classList.add('stat-increase-hide');
    });
  }, 1500);
}
  
function playEvolutionAnimation(petType, activeStage = 'egg') {
    const els = resetEvolutionState();
    const assetSet = PET_ASSETS[petType];
    const stages = getEvolutionStages(activeStage);
  
    if (!els || !assetSet) {
      return;
    }
  
    const {
      evolutionWrap,
      eggStage,
      eggEl,
      fromPetSprite,
      petSprite,
      topBanner,
    } = els;
  
    const { fromStage, toStage } = stages;
  
    petSprite.style.backgroundImage = `url("${assetSet[toStage]}")`;
  
    if (fromStage === 'egg') {
      eggEl.src = assetSet.egg;
      eggEl.classList.remove('hidden');
  
      void eggStage.offsetWidth;
      evolutionWrap.classList.add('is-hatching');
      eggStage.classList.add('hatching');
    } else {
      fromPetSprite.style.backgroundImage = `url("${assetSet.baby}")`;
      fromPetSprite.style.backgroundPosition = '0% 100%';      
      fromPetSprite.classList.remove('hidden');
  
      void eggStage.offsetWidth;
      evolutionWrap.classList.add('is-hatching');
      eggStage.classList.add('evolving-child');
    }
  
    const revealDelay = fromStage === 'baby' ? 1000 : 1600;
  
    setTimeout(() => {
      eggStage.classList.add('hidden');
      petSprite.classList.remove('hidden');
      petSprite.classList.add('hatch-appear');
    }, revealDelay);
  
    setTimeout(() => {
      topBanner?.classList.remove('hidden');
    }, 2200);

    setTimeout(() => {
      const petName = activePetContext.petData?.customName || 'your pet';
      typeEvolutionDialog(
        `Congrats, ${petName} is stronger now! All stats boosted.`,
        28
      );
    }, 2550);

    setTimeout(() => {
      showStatsDialog(
        activePetContext.oldStats,
        activePetContext.newStats
      );
    }, 4200);
}

async function incrementPetStats(petId, currentStats = {}) {
  const user = firebase.auth().currentUser;
  if (!user || !petId) return currentStats;

  const updatedStats = {
    hp: (currentStats.hp || 0) + 5,
    atk: (currentStats.atk || 0) + 5,
    def: (currentStats.def || 0) + 5,
    spAtk: (currentStats.spAtk || 0) + 5,
    spDef: (currentStats.spDef || 0) + 5,
    spd: (currentStats.spd || 0) + 5
  };

  const db = firebase.firestore();
  const petRef = db
    .collection('users')
    .doc(user.uid)
    .collection('pets')
    .doc(petId);

  await petRef.update({
    stats: updatedStats,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return updatedStats;
}
  
function setupButtons() {
    const closeBtn = document.getElementById('close-btn');
    closeBtn?.addEventListener('click', () => {
      redirectToHome();
    });
}
  
window.addEventListener('load', async () => {
    setupButtons();
    try {
      const payload = readEvolutionSessionPayload();
      if (!payload) {
        redirectToHome();
        return;
      }

      const activePet = await loadActivePetForEvolution();
      if (!activePet) {
        redirectToHome();
        return;
      }

      if (payload.petId !== activePet.petId) {
        redirectToHome();
        return;
      }

      if (!evolutionStagesMatch(activePet.activeStage, payload.toStage)) {
        redirectToHome();
        return;
      }

      const petType = payload.petRef || activePet.petType;
      if (!petType || !PET_ASSETS[petType]) {
        redirectToHome();
        return;
      }

    if (
      payload.petRef &&
      activePet.petType &&
      !evolutionStagesMatch(payload.petRef, activePet.petType)
    ) {
      redirectToHome();
      return;
    }

      const oldStats = activePet.petData?.stats || {};
      const updatedStats = await incrementPetStats(payload.petId, oldStats);

      activePetContext.oldStats = oldStats;
      activePetContext.newStats = updatedStats;

      if (
        typeof LeetmateEvolutionNotify !== 'undefined' &&
        LeetmateEvolutionNotify.consumeEventForPetId
      ) {
        await LeetmateEvolutionNotify.consumeEventForPetId(payload.petId);
      }

      try {
        sessionStorage.removeItem('leetmate_evolution_payload');
      } catch (_) {}

    activePetContext.petType = petType;
    activePetContext.activeStage = payload.fromStage;
    activePetContext.petData = {
      ...activePet.petData,
      stats: updatedStats
    };

      playEvolutionAnimation(petType, payload.fromStage);
    } catch (error) {
      console.error('Failed to load active pet for evolution:', error);
      redirectToHome();
    }
});

window.playEvolutionAnimation = playEvolutionAnimation;
