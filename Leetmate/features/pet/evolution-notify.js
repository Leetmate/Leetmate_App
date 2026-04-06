/**
 * Bridges pet stage changes to a future congratulations UI (e.g. screens/evolution).
 *
 * Flow:
 * 1. Service worker (pet-age job) detects stage change after evolution → enqueue events here.
 * 2. Next time Home loads (popup is visible), home.js consumes the event for the active pet
 *    and redirects to screens/evolution with JSON in sessionStorage.
 *
 * Contract for screens/evolution:
 *   sessionStorage key: leetmate_evolution_payload
 *   shape: { petId, petRef, customName, fromStage, toStage, at }
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'leetmate_evolution_queue';

    function stageChanged(from, to) {
        return String(from || '').toLowerCase() !== String(to || '').toLowerCase();
    }

    /**
     * @param {Array<{id?:string,stage?:string,petRef?:string,customName?:string}>} olderPets  after age+1, before evolvePetStage
     * @param {Array<{id?:string,stage?:string,petRef?:string,customName?:string}>} newerPets  after applyEvolutionToPets
     */
    function collectEvolutionEvents(olderPets, newerPets) {
        var byId = new Map();
        (olderPets || []).forEach(function (p) {
            if (p && p.id) byId.set(p.id, p);
        });
        var out = [];
        (newerPets || []).forEach(function (after) {
            if (!after || !after.id) return;
            var before = byId.get(after.id);
            var fromStage = before ? before.stage : null;
            var toStage = after.stage;
            if (stageChanged(fromStage, toStage)) {
                out.push({
                    petId: after.id,
                    petRef: after.petRef || null,
                    customName: after.customName || '',
                    fromStage: fromStage,
                    toStage: toStage,
                    at: Date.now()
                });
            }
        });
        return out;
    }

    async function enqueueEvolutionEvents(olderPets, newerPets) {
        if (typeof storageGet !== 'function' || typeof storageSet !== 'function') return;
        var batch = collectEvolutionEvents(olderPets, newerPets);
        if (batch.length === 0) return;

        var prev = await storageGet([STORAGE_KEY]);
        var queue = Array.isArray(prev[STORAGE_KEY]) ? prev[STORAGE_KEY].slice() : [];
        queue.push.apply(queue, batch);
        var setObj = {};
        setObj[STORAGE_KEY] = queue;
        await storageSet(setObj);
    }

    async function peekEvolutionQueue() {
        if (typeof storageGet !== 'function') return [];
        var data = await storageGet([STORAGE_KEY]);
        return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY].slice() : [];
    }

    /** Remove and return the first queued event for this pet id, or null. */
    async function consumeEventForPetId(petId) {
        if (!petId || typeof storageGet !== 'function' || typeof storageSet !== 'function') {
            return null;
        }
        var data = await storageGet([STORAGE_KEY]);
        var queue = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
        var idx = queue.findIndex(function (e) {
            return e && e.petId === petId;
        });
        if (idx === -1) return null;
        var event = queue[idx];
        var next = queue.slice(0, idx).concat(queue.slice(idx + 1));
        var setObj = {};
        setObj[STORAGE_KEY] = next;
        await storageSet(setObj);
        return event;
    }

    global.LeetmateEvolutionNotify = {
        STORAGE_KEY: STORAGE_KEY,
        collectEvolutionEvents: collectEvolutionEvents,
        enqueueEvolutionEvents: enqueueEvolutionEvents,
        peekEvolutionQueue: peekEvolutionQueue,
        consumeEventForPetId: consumeEventForPetId
    };
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
          ? self
          : typeof window !== 'undefined'
            ? window
            : this
);
