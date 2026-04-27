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
    },
		Fish: {
        egg: '../../assets/eggs/CubicFishEgg.png',
        baby: '../../assets/spritesheets/CubicFishBaby.png',
        adult: '../../assets/spritesheets/CubicFishAdult.png'
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

let activePetDataCache = null;
let currentHappinessPercent = 100;
const ACCESSORY_SPRITE_SUFFIX_BY_ITEM_ID = {
    'acc-greyhat': 'GreyHat',
    'acc-brownhat': 'BrownHat',
    'acc-strawhat': 'StrawHat',
    'acc-tophat': 'TopHat',
    'acc-santahat': 'SantaHat',
    'acc-leprechaunhat': 'LeprechaunHat'
};
const accessorySpriteExistenceCache = new Map();

function getCreatedTimestampMs(petData) {
    return typeof petData.createdTimestamp?.toMillis === 'function'
        ? petData.createdTimestamp.toMillis()
        : petData.createdTimestampMs || petData.createdTimestamp || null;
}

function getBaseActivePetSpritePath(petType, petStage) {
    const normalizedStage = (petStage || '').toLowerCase();

    if (petType && normalizedStage === 'baby') {
        return `assets/spritesheets/Cubic${petType}Baby.png`;
    }

    if (petType && normalizedStage === 'adult') {
        return `assets/spritesheets/Cubic${petType}Adult.png`;
    }

    return null;
}

function getAccessorySpriteCandidatePath(petType, equippedItemId) {
    const suffix = ACCESSORY_SPRITE_SUFFIX_BY_ITEM_ID[equippedItemId];
    if (!petType || !suffix) return null;
    return `assets/spritesheets/Cubic${petType}${suffix}.png`;
}

async function canLoadAccessorySprite(path) {
    if (!path || typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
        return false;
    }

    if (accessorySpriteExistenceCache.has(path)) {
        return accessorySpriteExistenceCache.get(path);
    }

    try {
        const response = await fetch(chrome.runtime.getURL(path));
        const exists = response.ok;
        accessorySpriteExistenceCache.set(path, exists);
        return exists;
    } catch (error) {
        accessorySpriteExistenceCache.set(path, false);
        return false;
    }
}

async function resolveActivePetSpritePath(petType, petStage, equippedItemId = null) {
    const basePath = getBaseActivePetSpritePath(petType, petStage);
    const normalizedStage = (petStage || '').toLowerCase();
    if (normalizedStage !== 'adult' || !equippedItemId) {
        return basePath;
    }

    const accessoryPath = getAccessorySpriteCandidatePath(petType, equippedItemId);
    if (!accessoryPath) {
        return basePath;
    }

    return (await canLoadAccessorySprite(accessoryPath)) ? accessoryPath : basePath;
}

function toRenderablePetAssetUrl(path) {
    if (!path) return path;
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL && path.startsWith('assets/')) {
        return chrome.runtime.getURL(path);
    }
    return path;
}

function toCachedPetData(petData, petId = null) {
    if (!petData) return null;

    const age =
        typeof petData.age === 'number' && Number.isFinite(petData.age) ? petData.age : 0;
    const adult = String(petData.stage || '').toLowerCase() === 'adult';
    const ableToBattle =
        typeof petData.ableToBattle === 'boolean' ? petData.ableToBattle : adult;
    return {
        id: petId ?? petData.id ?? null,
        petRef: petData.petRef || null,
        stage: petData.stage || null,
        customName: petData.customName || '',
        age,
        adjustedDays: petData.adjustedDays || 0,
        stats: petData.stats || null,
        createdTimestampMs: getCreatedTimestampMs(petData),
        ableToBattle,
        equippedItemId: petData.equippedItemId || null
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
    const equippedItemId = userData.equippedItemId || null;
    
    if (!activePetId) {
        console.warn('No active pet found for user.');
        // Fallback reveal
        document.body.classList.remove('hidden-on-load');
        return;
    }
    
    const petRef = userRef.collection('pets').doc(activePetId);
    const petSnap = await petRef.get();

    if (!petSnap.exists) {
        console.warn('Active pet document not found in subcollection.');
        if (typeof storageSet === 'function') {
            await storageSet({
                activePetId,
                activePetType: null,
                activePetStage: null,
                activePetSpritePath: null
            });
        }
        return;
    }

    let petData = petSnap.data();
    // Pending midnight job: prefer newer local age and stage until Firestore sync completes.
    if (typeof storageGet === 'function') {
        const { leetmate_pet_age_pending_firestore_sync, ownedPetsSnapshot } = await storageGet([
            'leetmate_pet_age_pending_firestore_sync',
            'ownedPetsSnapshot'
        ]);
        if (leetmate_pet_age_pending_firestore_sync && Array.isArray(ownedPetsSnapshot)) {
            const local = ownedPetsSnapshot.find((p) => p && p.id === activePetId);
            if (local) {
                const localAge = typeof local.age === 'number' && Number.isFinite(local.age) ? local.age : null;
                const remoteAge =
                    typeof petData.age === 'number' && Number.isFinite(petData.age) ? petData.age : 0;
                // Only prefer local age/stage when local is ahead (midnight job not synced yet).
                // If ages match, keep Firestore so manual pet doc fixes are not overwritten.
                if (localAge !== null && localAge > remoteAge) {
                    petData = { ...petData, age: localAge };
                    if (local.stage) {
                        petData = { ...petData, stage: local.stage };
                    }
                }
            }
        }
    }

    if (typeof storageSet === 'function') {
        const allPetsSnap = await userRef.collection('pets').get();
        const petType = petData?.petRef || null;
        const petStage = petData?.stage || null;
        const resolvedSpritePath = await resolveActivePetSpritePath(petType, petStage, equippedItemId);
        await storageSet({
            activePetId,
            activePetType: petType,
            activePetStage: petStage,
            activePetSpritePath: resolvedSpritePath,
            activePetSnapshot: toCachedPetData({ ...petData, equippedItemId }, activePetId),
            ownedPetsSnapshot: allPetsSnap
                ? allPetsSnap.docs.map((doc) => toCachedPetData(doc.data(), doc.id))
                : null
        });
        updatePetUI({
            ...petData,
            equippedItemId,
            _resolvedSpritePath: resolvedSpritePath
        });
        return {
            ...petData,
            equippedItemId,
            _resolvedSpritePath: resolvedSpritePath
        };
    }
    const resolvedSpritePath = await resolveActivePetSpritePath(petData?.petRef || null, petData?.stage || null, equippedItemId);
    updatePetUI({
        ...petData,
        equippedItemId,
        _resolvedSpritePath: resolvedSpritePath
    });
    return {
        ...petData,
        equippedItemId,
        _resolvedSpritePath: resolvedSpritePath
    };
}

async function loadActivePetFromStorage() {
    if (typeof storageGet !== 'function') return null;

    const {
        activePetSnapshot,
        activePetSpritePath
    } = await storageGet([
        'activePetSnapshot',
        'activePetSpritePath'
    ]);
    if (!activePetSnapshot || !activePetSnapshot.petRef) return null;

    const snapshotWithSpritePath = {
        ...activePetSnapshot,
        _resolvedSpritePath: activePetSpritePath || null
    };
    updatePetUI(snapshotWithSpritePath);
    return snapshotWithSpritePath;
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
    
    // Set Pet Age (Firestore `age`, advanced at daily roll; optional adjustedDays offset)
    const storedAge =
        typeof petData.age === 'number' && Number.isFinite(petData.age) ? petData.age : 0;
    const adjusted = petData.adjustedDays || 0;
    const totalAge = Math.max(0, storedAge + adjusted);
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
    const isDowned = (isBaby || isAdult) && currentHappinessPercent === 0;
    const isEggDowned = petStage === 'egg' && currentHappinessPercent === 0;
    const resolvedSpritePath =
        activePetDataCache._resolvedSpritePath ||
        getBaseActivePetSpritePath(petType, petStage) ||
        (isBaby ? assetSet.baby : assetSet.adult);
    const renderableSpritePath = toRenderablePetAssetUrl(resolvedSpritePath);

    petSprite.classList.remove('stage-egg', 'stage-baby', 'stage-adult', 'stage-downed');
    petSprite.style.animation = 'none';
		petSprite.style.backgroundSize = '';
		petSprite.style.backgroundPosition = '';
    petSprite.classList.remove('hidden');
    petEgg.classList.add('hidden');
    petEgg.classList.remove('is-downed');
    petEgg.src = '';

    if (petStage === 'egg') {
        petSprite.classList.add('hidden');
        petEgg.src = assetSet.egg;
        petEgg.classList.remove('hidden');
        if (isEggDowned) {
            petEgg.classList.add('is-downed');
        }
    } else if (isDowned) {
        petSprite.classList.add(isBaby ? 'stage-baby' : 'stage-adult', 'stage-downed');
        petSprite.style.backgroundImage = `url("${renderableSpritePath}")`;
        petSprite.style.backgroundSize = '700% 100%';
        petSprite.style.backgroundPosition = '50% 0%';
    } else if (isBaby) {
        petSprite.classList.add('stage-baby');
        petSprite.style.backgroundImage = `url("${renderableSpritePath}")`;
				petSprite.style.animation = '';
    } else {
        petSprite.classList.add('stage-adult');
        petSprite.style.backgroundImage = `url("${renderableSpritePath}")`;
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
    getPetHappinessState: function () {
        return currentHappinessPercent;
    },
    loadActivePetFromStorage,
    toCachedPetData,
    resolveActivePetSpritePath
};

// Background pet-age job (and others) update activePetSnapshot in chrome.storage — refresh UI without reload.
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local' || !changes.activePetSnapshot) return;
        loadActivePetFromStorage().catch(function () {});
    });
}
