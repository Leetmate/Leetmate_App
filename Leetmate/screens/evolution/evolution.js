const PET_ASSETS = {
    Bat: {
      egg: '../../assets/eggs/CubicBatEgg.png',
      baby: '../../assets/spritesheets/CubicBatBaby.png',
      adult: '../../assets/spritesheets/CubicBatAdult.png'
    },
    Cat: {
      egg: '../../assets/eggs/CubicCatEgg.png',
      baby: '../../assets/spritesheets/CubicCatBaby.png',
      adult: '../../assets/spritesheets/CubicCatAdult.png'
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
    }
};
  
let activePetContext = {
    petType: null,
    activeStage: null
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
    const bottomBanner = document.getElementById('bottom-banner');
  
    if (!evolutionWrap || !eggStage || !eggEl || !fromPetSprite || !petSprite) {
      return null;
    }
    resetEvolutionDialog();

    topBanner?.classList.add('hidden');
    bottomBanner?.classList.add('hidden');
  
    evolutionWrap.classList.remove('is-hatching');
    eggStage.classList.remove('hatching', 'evolving-child');
    eggStage.classList.remove('hidden');
  
    eggEl.classList.add('hidden');
    eggEl.src = '';
  
    fromPetSprite.classList.add('hidden');
    fromPetSprite.style.backgroundImage = '';
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
      bottomBanner
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
      bottomBanner
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
      bottomBanner?.classList.remove('hidden');
    }, 2200);

    setTimeout(() => {
      typeEvolutionDialog(
        'Congrats, your pet is stronger now! All stats +5.',
        28
      );
    }, 2550);
}
  
function setupButtons() {
    const replayBtn = document.getElementById('replay-btn');
    const homeBtn = document.getElementById('home-btn');
  
    replayBtn?.addEventListener('click', () => {
      if (!activePetContext.petType) {
        console.warn('No active pet loaded yet.');
        return;
      }
  
      playEvolutionAnimation(
        activePetContext.petType,
        activePetContext.activeStage
      );
    });
  
    homeBtn?.addEventListener('click', () => {
      window.location.href = '../home/index.html';
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

      playEvolutionAnimation(petType, payload.fromStage);
    } catch (error) {
      console.error('Failed to load active pet for evolution:', error);
      redirectToHome();
    }
});

window.playEvolutionAnimation = playEvolutionAnimation;
