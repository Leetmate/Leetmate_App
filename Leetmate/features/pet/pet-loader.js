/**
 * Pet Loader Logic for Leetmate Home Screen.
 * Fetches the active pet from Firestore and updates the UI.
 */

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

let activePetDataCache = null;
let currentHappinessPercent = 100;

async function loadActivePetFromFirestore(db, uid) {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
        console.warn('User document not found while loading active pet.');
        return;
    }
    const userData = userSnap.data();
    const activePetId = userData.activePetId;
    
    if (!activePetId) {
        console.warn('No active pet found for user.');
        // Fallback reveal
        document.body.classList.remove('hidden-on-load');
        return;
    }
    
    const petRef = userRef.collection('pets').doc(activePetId);
    let petSnap = null;
    
    // Sync activePetData to storage for background.js (PIP)
    if (typeof storageSet === 'function') {
        petSnap = await petRef.get();
        const petType = petSnap.exists ? petSnap.data().petRef : null;
        const petStage = petSnap.exists ? petSnap.data().stage || null : null;
        const normalizedStage = (petStage || '').toLowerCase();
        const activePetSpritePath =
            petType && normalizedStage === 'baby'
                ? `assets/spritesheets/Cubic${petType}Baby.png`
                : petType && normalizedStage === 'adult'
                    ? `assets/spritesheets/Cubic${petType}Adult.png`
                    : null;
        await storageSet({ 
            activePetId,
            activePetType: petType,
            activePetStage: petStage,
            activePetSpritePath
        });
    } else {
        petSnap = await petRef.get();
    }
    
    if (!petSnap.exists) {
        console.warn('Active pet document not found in subcollection.');
        return;
    }
    
    const petData = petSnap.data();
    updatePetUI(petData);
    return petData;
}

function updatePetUI(petData) {
    const petSprite = document.getElementById('active-pet');
    const petEgg = document.getElementById('active-pet-egg');
    const petNameDisplay = document.getElementById('pet-name-display');
    const petAgeDisplay = document.getElementById('pet-age-display');
    const minimizeBtn = document.querySelector('.minimize-btn');
    
    if (!petSprite || !petEgg || !petNameDisplay || !petAgeDisplay) return;
    
    // Set Pet Name
    const petType = petData.petRef;
    if (!petType) {
        console.warn('Active pet is missing petRef.');
        return;
    }
    const petStage = (petData.stage || 'Adult').toLowerCase();
    const assetSet = PET_ASSETS[petType];
    if (!assetSet) {
        console.warn(`No asset set found for pet type: ${petType}`);
        return;
    }

    activePetDataCache = petData;

    const petNames = {
        'Cat': 'Cubic Cat',
        'Bat': 'Cubic Bat',
        'Fox': 'Cubic Fox'
    };
    petNameDisplay.textContent = petNames[petType] || petType;
    
    petSprite.classList.remove('stage-egg', 'stage-baby', 'stage-adult', 'stage-downed');
    petSprite.style.backgroundRepeat = 'no-repeat';
    petSprite.style.animation = 'none';
    petSprite.style.willChange = 'transform, background-position';
    
    // Set Pet Age
    const created = petData.createdTimestamp ? petData.createdTimestamp.toMillis() : Date.now();
    const adjusted = petData.adjustedDays || 0;
    const diffMs = Date.now() - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalAge = diffDays + adjusted;
    petAgeDisplay.textContent = `${totalAge}d`;

    applyPetVisualState();

    // FINAL REVEAL: Pet is loaded and styled
    document.body.classList.remove('hidden-on-load');
}

function applyPetVisualState() {
    if (!activePetDataCache) return;

    const petSprite = document.getElementById('active-pet');
    const petEgg = document.getElementById('active-pet-egg');
    const minimizeBtn = document.querySelector('.minimize-btn');
    if (!petSprite || !petEgg) return;

    const petType = activePetDataCache.petRef;
    const petStage = (activePetDataCache.stage || 'Adult').toLowerCase();
    const assetSet = PET_ASSETS[petType];
    if (!assetSet) return;

    const isBaby = petStage === 'baby';
    const isAdult = petStage === 'adult';
		// egg has no "downed" state here
    const isDowned = (isBaby || isAdult) && currentHappinessPercent === 0;

    petSprite.classList.remove('stage-egg', 'stage-baby', 'stage-adult', 'stage-downed');
    petSprite.style.animation = 'none';
    petSprite.classList.remove('hidden');
    petEgg.classList.add('hidden');
    petEgg.src = '';

    if (petStage === 'egg') {
        petSprite.classList.add('hidden');
        petEgg.src = assetSet.egg;
        petEgg.classList.remove('hidden');
    } else if (isDowned) {
        petSprite.classList.add(isBaby ? 'stage-baby' : 'stage-adult', 'stage-downed');
        petSprite.style.backgroundImage = `url("${isBaby ? assetSet.baby : assetSet.adult}")`;
        petSprite.style.backgroundSize = '700% 100%';
        petSprite.style.backgroundPosition = '50% 0%';
    } else if (isBaby) {
        petSprite.classList.add('stage-baby');
        petSprite.style.backgroundImage = `url("${assetSet.baby}")`;
				petSprite.style.animation = '';
    } else {
        petSprite.classList.add('stage-adult');
        petSprite.style.backgroundImage = `url("${assetSet.adult}")`;
				petSprite.style.animation = '';
    }

    if (minimizeBtn) {
        const canMinimize = (isBaby || isAdult) && currentHappinessPercent > 0;
        minimizeBtn.disabled = !canMinimize;
        minimizeBtn.setAttribute('aria-disabled', String(!canMinimize));
        minimizeBtn.title = canMinimize
            ? 'Open Pip display'
            : 'Pip display is currently unavailable';
    }
}

function setPetHappinessState(happinessPercent) {
    currentHappinessPercent = Math.max(0, Math.min(100, happinessPercent));
    applyPetVisualState();
}

window.LeetmatePetUI = {
    setPetHappinessState
};
