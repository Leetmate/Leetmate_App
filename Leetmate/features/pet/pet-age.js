/**
 * Daily pet age rollover (runs in the extension service worker).
 * Ages are stored in chrome.storage and synced to Firestore subcollection
 * `users/{uid}/pets/{petId}` when Home loads via syncPendingPetAgeToFirestore.
 */

function normalizePetSnapshot(pet) {
    if (!pet) return null;
    const age = typeof pet.age === 'number' && Number.isFinite(pet.age) ? pet.age : 0;
    const stageStr = String(pet.stage || '').toLowerCase();
    const ableToBattle =
        typeof pet.ableToBattle === 'boolean'
            ? pet.ableToBattle
            : stageStr === 'adult';
    return {
        id: pet.id ?? null,
        petRef: pet.petRef || null,
        stage: pet.stage || null,
        customName: pet.customName || '',
        age,
        adjustedDays: pet.adjustedDays || 0,
        stats: pet.stats || null,
        createdTimestampMs: pet.createdTimestampMs ?? null,
        ableToBattle
    };
}

async function canUpdatePetAge() {
    const today = getTodayString();
    const { leetmate_pet_age_last_rollover: lastRollover } = await storageGet([
        'leetmate_pet_age_last_rollover'
    ]);
    if (!lastRollover) return true;

    const { leetmate_happiness } = await storageGet(['leetmate_happiness']);
    const happiness = leetmate_happiness ?? 100;
    return lastRollover !== today && happiness > 0;
}

async function loadAllPetsFromStorage() {
    const { ownedPetsSnapshot } = await storageGet(['ownedPetsSnapshot']);
    if (!ownedPetsSnapshot || !Array.isArray(ownedPetsSnapshot)) return [];
    return ownedPetsSnapshot.map((p) => normalizePetSnapshot(p)).filter(Boolean);
}

function incrementAllPetsAge(pets) {
    return pets.map((pet) => {
        const age = typeof pet.age === 'number' && Number.isFinite(pet.age) ? pet.age : 0;
        return { ...pet, age: age + 1 };
    });
}

async function runMidnightPetAgeJob() {
    try {
        const { uid } = await storageGet(['uid']);
        if (!uid) {
            console.log('No uid in storage, skipping pet age job.');
            return;
        }

        if (!(await canUpdatePetAge())) {
            console.log('Pet age update not allowed, skipping.');
            return;
        }

        const pets = await loadAllPetsFromStorage();
        if (pets.length === 0) {
            console.log('No owned pets in storage, skipping pet age job.');
            return;
        }

        const agedPets = incrementAllPetsAge(pets);
        const updatedPets = LeetmatePetEvolution.applyEvolutionToPets(agedPets);
        const evolvedCount =
            typeof LeetmateEvolutionNotify !== 'undefined' &&
            LeetmateEvolutionNotify.collectEvolutionEvents
                ? LeetmateEvolutionNotify.collectEvolutionEvents(agedPets, updatedPets).length
                : 0;
        const rewardEach =
            typeof LeetmatePetEvolution !== 'undefined' &&
            typeof LeetmatePetEvolution.EVOLUTION_COIN_REWARD === 'number'
                ? LeetmatePetEvolution.EVOLUTION_COIN_REWARD
                : 100;
        const evolutionCoinBonus = evolvedCount * rewardEach;
        if (typeof LeetmateEvolutionNotify !== 'undefined' && LeetmateEvolutionNotify.enqueueEvolutionEvents) {
            await LeetmateEvolutionNotify.enqueueEvolutionEvents(agedPets, updatedPets);
        }
        const today = getTodayString();
        const { activePetId, leetmate_pending_evolution_coins: priorPendingEvolutionCoins } =
            await storageGet(['activePetId', 'leetmate_pending_evolution_coins']);

        const payload = {
            ownedPetsSnapshot: updatedPets,
            leetmate_pet_age_last_rollover: today,
            leetmate_pet_age_pending_firestore_sync: true
        };
        if (evolutionCoinBonus > 0) {
            const curPending = Math.max(
                0,
                Math.floor(Number(priorPendingEvolutionCoins) || 0)
            );
            payload.leetmate_pending_evolution_coins = curPending + evolutionCoinBonus;
        }

        if (activePetId) {
            const active = updatedPets.find((p) => p && p.id === activePetId);
            if (active) {
                payload.activePetSnapshot = active;
            }
        }

        await storageSet(payload);
        console.log('Pet age incremented locally; pending Firestore sync on next Home load.');
    } catch (e) {
        console.error('runMidnightPetAgeJob failed:', e);
    }
}

/**
 * Pushes locally incremented ages to Firestore (Home / extension pages only).
 */
async function syncPendingPetAgeToFirestore(db, uid) {
    if (typeof firebase === 'undefined' || !db || !uid) return;

    const { leetmate_pet_age_pending_firestore_sync, ownedPetsSnapshot } = await storageGet([
        'leetmate_pet_age_pending_firestore_sync',
        'ownedPetsSnapshot'
    ]);

    if (!leetmate_pet_age_pending_firestore_sync || !Array.isArray(ownedPetsSnapshot) || ownedPetsSnapshot.length === 0) {
        return;
    }

    const userRef = db.collection('users').doc(uid);
    const FieldValue = firebase.firestore.FieldValue;

    try {
        await Promise.all(
            ownedPetsSnapshot.map((pet) => {
                if (!pet || !pet.id) return Promise.resolve();
                const adult = String(pet.stage || '').toLowerCase() === 'adult';
                const ableToBattle =
                    typeof pet.ableToBattle === 'boolean' ? pet.ableToBattle : adult;
                return userRef.collection('pets').doc(pet.id).set(
                    {
                        age: pet.age,
                        stage: pet.stage,
                        ableToBattle,
                        updatedAt: FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );
            })
        );
        await storageSet({ leetmate_pet_age_pending_firestore_sync: false });
    } catch (e) {
        console.error('syncPendingPetAgeToFirestore failed:', e);
    }
}

if (typeof window !== 'undefined') {
    window.syncPendingPetAgeToFirestore = syncPendingPetAgeToFirestore;
}
