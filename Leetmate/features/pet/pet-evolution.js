/**
 * Pet stage evolution — pure rules only (no storage, no Firestore).
 *
 * Stages match starter docs: Egg, Baby, Adult (see auth-starters).
 * Thresholds use effective day count: age + adjustedDays (same idea as Home age display).
 */
(function (global) {
    'use strict';

    var BABY_MIN_TOTAL_DAYS = 3;
    var ADULT_MIN_TOTAL_DAYS = 10;

    function effectiveEvolutionAge(pet) {
        if (!pet || typeof pet !== 'object') return 0;
        var a = typeof pet.age === 'number' && Number.isFinite(pet.age) ? pet.age : 0;
        var adj =
            typeof pet.adjustedDays === 'number' && Number.isFinite(pet.adjustedDays)
                ? pet.adjustedDays
                : 0;
        return Math.max(0, a + adj);
    }

    function stageLabelForTotalDays(total) {
        if (total >= ADULT_MIN_TOTAL_DAYS) return 'Adult';
        if (total >= BABY_MIN_TOTAL_DAYS) return 'Baby';
        return 'Egg';
    }

    /** @returns {'Egg'|'Baby'|'Adult'} */
    function nextStageFromPet(pet) {
        return stageLabelForTotalDays(effectiveEvolutionAge(pet));
    }

    function sameStageLabel(a, b) {
        return String(a || '').toLowerCase() === String(b || '').toLowerCase();
    }

    /**
     * Returns a new pet object with `stage` set from evolution rules, or the same reference if unchanged.
     * Sets `ableToBattle` true only when the new stage is Adult (false for Egg/Baby).
     */
    function evolvePetStage(pet) {
        if (!pet || typeof pet !== 'object') return pet;
        var next = nextStageFromPet(pet);
        if (sameStageLabel(pet.stage, next)) return pet;
        var patch = {
            stage: next,
            ableToBattle: sameStageLabel(next, 'Adult')
        };
        return Object.assign({}, pet, patch);
    }

    function applyEvolutionToPets(pets) {
        if (!Array.isArray(pets)) return pets;
        return pets.map(function (p) {
            return evolvePetStage(p);
        });
    }

    global.LeetmatePetEvolution = {
        BABY_MIN_TOTAL_DAYS: BABY_MIN_TOTAL_DAYS,
        ADULT_MIN_TOTAL_DAYS: ADULT_MIN_TOTAL_DAYS,
        effectiveEvolutionAge: effectiveEvolutionAge,
        nextStageFromPet: nextStageFromPet,
        evolvePetStage: evolvePetStage,
        applyEvolutionToPets: applyEvolutionToPets
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
