/**
 * Pet Loader Logic for Leetmate Home Screen.
 * Fetches the active pet from Firestore and updates the UI.
 */

async function loadActivePetFromFirestore(db, uid) {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) return;
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
        await storageSet({ 
            activePetId,
            activePetType: petType 
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
}

function updatePetUI(petData) {
    const petSprite = document.getElementById('active-pet');
    const petNameDisplay = document.getElementById('pet-name-display');
    const petAgeDisplay = document.getElementById('pet-age-display');
    
    if (!petSprite || !petNameDisplay || !petAgeDisplay) return;
    
    // Set Pet Name
    const petType = petData.petRef || 'LoboGuara';
    const petNames = {
        'Chameleon': 'Cubic Chameleon',
        'LoboGuara': 'Lobo Guara',
        'Unicorn': 'Cubic Unicorn'
    };
    petNameDisplay.textContent = petNames[petType] || petType;
    
    // Set Pet Sprite
    const assetPath = `../../assets/spritesheets/Cubic${petType}.png`;
    petSprite.style.backgroundImage = `url("${assetPath}")`;
    
    // Set Pet Age
    const created = petData.createdTimestamp ? petData.createdTimestamp.toMillis() : Date.now();
    const adjusted = petData.adjustedDays || 0;
    const diffMs = Date.now() - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalAge = diffDays + adjusted;
    petAgeDisplay.textContent = `${totalAge}d`;

    // Unified 9x scale for 84x16 assets (4 frames of 21px)
    petSprite.style.backgroundSize = '756px 144px';

    // FINAL REVEAL: Pet is loaded and styled
    document.body.classList.remove('hidden-on-load');
}
