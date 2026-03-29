/**
 * Pet Selection Logic for Leetmate.
 * Handles carousel navigation, pet details modal, and Firestore synchronization.
 */
(function () {
    'use strict';

    // Pet Data Configuration
    const PETS = [
        {
            id: 'Bat',
            name: 'Cubic Bat',
            eggAsset: '../../assets/eggs/CubicBatEgg.png',
            spriteAsset: '../../assets/spritesheets/CubicBatAdult.png',
            description: "A nocturnal ally that navigates through sonar. It's agile and elusive.",
            stats: { hp: 40, atk: 45, def: 40, spAtk: 60, spDef: 50, spd: 80 }
        },
        {
            id: 'Cat',
            name: 'Cubic Cat',
            eggAsset: '../../assets/eggs/CubicCatEgg.png',
            spriteAsset: '../../assets/spritesheets/CubicCatAdult.png',
            description: "A nimble companion with sharp instincts. It's balanced and observant.",
            stats: { hp: 50, atk: 55, def: 50, spAtk: 55, spDef: 55, spd: 65 }
        },
        {
            id: 'Fox',
            name: 'Cubic Fox',
            eggAsset: '../../assets/eggs/CubicFoxEgg.png',
            spriteAsset: '../../assets/spritesheets/CubicFoxAdult.png',
            description: "A clever trickster with a fiery spirit. It's fast and has high special ability power.",
            stats: { hp: 45, atk: 50, def: 45, spAtk: 75, spDef: 60, spd: 70 }
        }
    ];

    let currentIndex = 1;
    let auth = null;
    let db = null;

    // DOM Elements
    const elements = {
        eggLeft: document.getElementById('egg-left'),
        eggCenter: document.getElementById('egg-center'),
        eggRight: document.getElementById('egg-right'),
        petName: document.getElementById('current-pet-name'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        chooseBtn: document.getElementById('choose-btn'),
        
        // Modal
        modal: document.getElementById('pet-modal'),
        modalPetName: document.getElementById('modal-pet-name'),
        modalPetSprite: document.getElementById('pet-actor'),
        modalPetDesc: document.getElementById('pet-description'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        
        // Loading
        loading: document.getElementById('loading-overlay')
    };

    function updateCarousel() {
        const leftIdx = (currentIndex + 2) % 3;
        const centerIdx = currentIndex;
        const rightIdx = (currentIndex + 1) % 3;

        elements.eggLeft.querySelector('img').src = PETS[leftIdx].eggAsset;
        elements.eggCenter.querySelector('img').src = PETS[centerIdx].eggAsset;
        elements.eggRight.querySelector('img').src = PETS[rightIdx].eggAsset;
        
        elements.petName.textContent = PETS[centerIdx].name;

        // Add a small bounce effect to the center egg
        elements.eggCenter.classList.add('egg-pop');
        setTimeout(() => {
            elements.eggCenter.classList.remove('egg-pop');
        }, 300);
    }

    function showModal() {
        const pet = PETS[currentIndex];
        elements.modalPetName.textContent = pet.name;
        elements.modalPetDesc.textContent = pet.description;
        
        // Ensure sprite is set before showing modal
        elements.modalPetSprite.style.backgroundImage = `url("${pet.spriteAsset}")`;
        // The translateX animation handles the frames, but we ensure pos is reset
        elements.modalPetSprite.style.backgroundPosition = '0 0'; 
        
        elements.modal.classList.remove('hidden');
    }

    function hideModal() {
        elements.modal.classList.add('hidden');
    }

    async function saveSelection() {
        if (!auth || !db || !auth.currentUser) {
            alert('Session lost. Please sign in again.');
            window.location.href = '../start/index.html';
            return;
        }

        const user = auth.currentUser;
        const pet = PETS[currentIndex];
        const petId = `pet_${Date.now()}`;
        
        elements.loading.classList.remove('hidden');

        try {
            const batch = db.batch();
            const userRef = db.collection('users').doc(user.uid);
            const petRef = userRef.collection('pets').doc(petId);
            
            const now = firebase.firestore.FieldValue.serverTimestamp();

            // 1. Update User Document
            batch.update(userRef, {
                activePetId: petId,
								lastFedTime: now,
                updatedAt: now
            });

            // 2. Create Pet in subcollection
            batch.set(petRef, {
                petRef: pet.id, // e.g., "LoboGuara"
                age: 0,
                stats: pet.stats,
                stage: "Egg",
                ableToBattle: false,
                createdTimestamp: now,
                adjustedDays: 0
            });

            await batch.commit();
            window.location.href = '../home/index.html';
        } catch (error) {
            console.error('Error saving pet selection:', error);
            alert('Failed to save selection. Please try again.');
            elements.loading.classList.add('hidden');
        }
    }

    // Initialize Firebase
    function initFirebase() {
        if (typeof firebase !== 'undefined') {
            auth = firebase.auth();
            db = firebase.firestore();

            auth.onAuthStateChanged(user => {
                if (!user) {
                    window.location.href = '../start/index.html';
                }
            });
        } else {
            console.error('Firebase not loaded!');
        }
    }

    // Event Listeners
    document.addEventListener('DOMContentLoaded', () => {
        initFirebase();
        updateCarousel();

        elements.prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 2) % 3;
            updateCarousel();
        });

        elements.nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % 3;
            updateCarousel();
        });

        elements.chooseBtn.addEventListener('click', showModal);
        
        elements.modalCancelBtn.addEventListener('click', hideModal);
        
        elements.modalConfirmBtn.addEventListener('click', saveSelection);

        // Click on side eggs also moves carousel
        elements.eggLeft.addEventListener('click', () => {
            currentIndex = (currentIndex + 2) % 3;
            updateCarousel();
        });

        elements.eggRight.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % 3;
            updateCarousel();
        });
        
        // Click on center egg opens modal
        elements.eggCenter.addEventListener('click', showModal);
    });
})();