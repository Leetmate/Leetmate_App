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

function getCreatedTimestampMs(petData) {
    return typeof petData.createdTimestamp?.toMillis === 'function'
        ? petData.createdTimestamp.toMillis()
        : petData.createdTimestampMs || petData.createdTimestamp || null;
}

function getActivePetSpritePath(petType, petStage) {
    const normalizedStage = (petStage || '').toLowerCase();

    if (petType && normalizedStage === 'baby') {
        return `assets/spritesheets/Cubic${petType}Baby.png`;
    }

    if (petType && normalizedStage === 'adult') {
        return `assets/spritesheets/Cubic${petType}Adult.png`;
    }

    return null;
}

function toCachedPetData(petData, petId = null) {
    if (!petData) return null;

    return {
        id: petId ?? petData.id ?? null,
        petRef: petData.petRef || null,
        stage: petData.stage || null,
        customName: petData.customName || '',
        adjustedDays: petData.adjustedDays || 0,
        stats: petData.stats || null,
        createdTimestampMs: getCreatedTimestampMs(petData)
    };
}

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
    const petSnap = await petRef.get();
    
    // Sync activePetData to storage for background.js (PIP)
    let allPetsSnap = null;

    if (typeof storageSet === 'function') {
        allPetsSnap = await userRef.collection('pets').get();
        const activePetData = petSnap.exists ? petSnap.data() : null;
        const petType = activePetData?.petRef || null;
        const petStage = activePetData?.stage || null;
        await storageSet({ 
            activePetId,
            activePetType: petType,
            activePetStage: petStage,
            activePetSpritePath: getActivePetSpritePath(petType, petStage)
        });
    }
    
    if (!petSnap.exists) {
        console.warn('Active pet document not found in subcollection.');
        return;
    }
    
    const petData = petSnap.data();
    if (typeof storageSet === 'function') {
        await storageSet({
            activePetSnapshot: toCachedPetData(petData, activePetId),
            ownedPetsSnapshot: allPetsSnap
                ? allPetsSnap.docs.map((doc) => toCachedPetData(doc.data(), doc.id))
                : null
        });
    }
    updatePetUI(petData);
    return petData;
}

async function loadActivePetFromStorage() {
    if (typeof storageGet !== 'function') return null;

    const { activePetSnapshot } = await storageGet('activePetSnapshot');
    if (!activePetSnapshot || !activePetSnapshot.petRef) return null;

    updatePetUI(activePetSnapshot);
    return activePetSnapshot;
}

function updatePetUI(petData) {
    const petSprite = document.getElementById('active-pet');
    const petEgg = document.getElementById('active-pet-egg');
    const petNameDisplay = document.getElementById('pet-name-display');
    const petAgeDisplay = document.getElementById('pet-age-display');
    
    if (!petSprite || !petEgg || !petNameDisplay || !petAgeDisplay) return;
    
    // Set Pet Name
    const petType = petData.petRef;
    if (!petType) {
        console.warn('Active pet is missing petRef.');
        return;
    }
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
    const displayName = (petData.customName || '').trim() || petNames[petType] || petType;
    petNameDisplay.textContent = displayName;
    
    petSprite.classList.remove('stage-egg', 'stage-baby', 'stage-adult', 'stage-downed');
    petSprite.style.backgroundRepeat = 'no-repeat';
    petSprite.style.animation = 'none';
    petSprite.style.willChange = 'transform, background-position';
    
    // Set Pet Age
    const created = getCreatedTimestampMs(petData) || Date.now();
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
		petSprite.style.backgroundSize = '';
		petSprite.style.backgroundPosition = '';
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
    setPetHappinessState,
    loadActivePetFromStorage,
    toCachedPetData
};
