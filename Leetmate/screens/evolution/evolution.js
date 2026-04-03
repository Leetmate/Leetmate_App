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
    }
};
  
let activePetContext = {
    petType: null,
    activeStage: null
};
  
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
  
    const petData = petSnap.data();
    const petType = petData.petRef;
    const activeStage = petData.stage || 'egg';
  
    if (!petType || !PET_ASSETS[petType]) {
      console.warn('Active pet is missing a valid petRef.', petData);
      return null;
    }
  
    return {
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
  
    topBanner?.classList.add('hidden');
    bottomBanner?.classList.add('hidden');
  
    evolutionWrap.classList.remove('is-hatching');
    eggStage.classList.remove('hatching', 'evolving-child');
    eggStage.classList.remove('hidden');
  
    eggEl.classList.add('hidden');
    eggEl.src = '';
  
    fromPetSprite.classList.add('hidden');
    fromPetSprite.style.backgroundImage = '';
    fromPetSprite.style.backgroundPosition = '0% 0%';
  
    petSprite.classList.add('hidden');
    petSprite.classList.remove('hatch-appear');
    petSprite.style.backgroundImage = '';
    petSprite.style.backgroundPosition = '0% 0%';
  
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
      fromPetSprite.style.backgroundPosition = '0% 0%';
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
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '../../index.html';
      }
    });
}
  
window.addEventListener('load', async () => {
    setupButtons();
    try {
      const activePet = await loadActivePetForEvolution();
      if (!activePet) {
        return;
      }
  
      activePetContext.petType = activePet.petType;
      activePetContext.activeStage = activePet.activeStage;
  
      playEvolutionAnimation(
        activePetContext.petType,
        activePetContext.activeStage
      );
    } catch (error) {
      console.error('Failed to load active pet for evolution:', error);
    }
});

window.playEvolutionAnimation = playEvolutionAnimation;