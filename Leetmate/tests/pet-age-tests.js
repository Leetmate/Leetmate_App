// ── Dev helpers (Home console only) ───────────────────────────────────────────
// Requires: storage-helper, streak.js, pet-evolution.js, pet-age.js,
//           evolution-notify.js (Home script order).
//
// Evolution screen (Egg → Baby at age 3):
//   Home only redirects if the queued event’s petId matches storage activePetId.
//   Presets that use id "demo-pet-1" will NOT open screens/evolution — use:
//     await petAgeTest.runEvolutionScreenTest()
//   (Load Home once while signed in so activePetId is set, then run in DevTools.)
//
// Other examples:
//   await petAgeTest.presetAllowsJob(); await petAgeTest.runMidnightJob()  // logs only (demo id)
//   await petAgeTest.presetBabyAlmostAdult(); await petAgeTest.runMidnightJob()
//   petAgeTest.previewEvolutionAtAge(2, "Egg")
//   await petAgeTest.status()

if (typeof window !== "undefined") {
  window.petAgeTest = {
    _basePet(overrides) {
      return Object.assign(
        {
          id: "demo-pet-1",
          petRef: "Cat",
          customName: "",
          stats: null,
          createdTimestampMs: null
        },
        overrides
      );
    },

    /** Egg at age 2 → one midnight tick hits baby threshold (3). */
    _demoPetEggAlmostBaby() {
      return this._basePet({ stage: "Egg", age: 2, adjustedDays: 0 });
    },

    /** Baby at age 9 → one tick hits adult threshold (10). */
    _demoPetBabyAlmostAdult() {
      return this._basePet({ stage: "Baby", age: 9, adjustedDays: 0 });
    },

    /** In-between baby (no stage change on +1 age). */
    _demoPetBabyMid() {
      return this._basePet({ stage: "Baby", age: 7, adjustedDays: 0 });
    },

    _yesterdayCa() {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    },

    _logEvolutionLine(pet, label) {
      const ev = typeof LeetmatePetEvolution !== "undefined" ? LeetmatePetEvolution : null;
      if (!ev || !pet) {
        console.log(label, "(no pet or LeetmatePetEvolution missing)");
        return;
      }
      const eff = ev.effectiveEvolutionAge(pet);
      const next = ev.nextStageFromPet(pet);
      console.log(
        `${label}stage=${pet.stage} age=${pet.age} adj=${pet.adjustedDays ?? 0} effDays=${eff} | rules→${next}`
      );
    },

    /** Sets happiness 0 + yesterday rollover so canUpdatePetAge() is false. */
    async presetBlockedByHappiness() {
      const pet = this._demoPetEggAlmostBaby();
      await storageSet({
        uid: "demo-local-uid",
        leetmate_happiness: 0,
        leetmate_pet_age_last_rollover: this._yesterdayCa(),
        ownedPetsSnapshot: [pet],
        activePetId: pet.id,
        leetmate_pet_age_pending_firestore_sync: false
      });
      console.log(
        "Pet age: happiness=0, lastRollover=yesterday — job should skip (canUpdatePetAge false)."
      );
      this._logEvolutionLine(pet, "snapshot ");
    },

    /** Egg age 2 + happiness — one job should give age 3 + Baby. */
    async presetAllowsJob() {
      const pet = this._demoPetEggAlmostBaby();
      await storageSet({
        uid: "demo-local-uid",
        leetmate_happiness: 100,
        leetmate_pet_age_last_rollover: this._yesterdayCa(),
        ownedPetsSnapshot: [pet],
        activePetId: pet.id,
        leetmate_pet_age_pending_firestore_sync: false
      });
      console.log(
        "Pet age: Egg @ age 2 — runMidnightJob should → age 3, stage Baby (see thresholds on LeetmatePetEvolution)."
      );
      this._logEvolutionLine(pet, "before job ");
    },

    /** Baby age 9 — one job should give age 10 + Adult. */
    async presetBabyAlmostAdult() {
      const pet = this._demoPetBabyAlmostAdult();
      await storageSet({
        uid: "demo-local-uid",
        leetmate_happiness: 100,
        leetmate_pet_age_last_rollover: this._yesterdayCa(),
        ownedPetsSnapshot: [pet],
        activePetId: pet.id,
        leetmate_pet_age_pending_firestore_sync: false
      });
      console.log(
        "Pet age: Baby @ age 9 — runMidnightJob should → age 10, stage Adult."
      );
      this._logEvolutionLine(pet, "before job ");
    },

    async setHappiness(value) {
      await storageSet({ leetmate_happiness: value });
      console.log("leetmate_happiness set to:", value);
    },

    /**
     * Sets YOUR active pet (from storage) to Egg @ age 2 + yesterday rollover so one job hits age 3 / Baby.
     * Does not change Firestore until the next Home load syncs pending pet data.
     */
    async presetEggAlmostBabyForActivePet() {
      const snap = await storageGet([
        "activePetId",
        "activePetSnapshot",
        "ownedPetsSnapshot",
        "uid"
      ]);
      const id = snap.activePetId;
      if (!id) {
        console.warn(
          "No activePetId in storage. Open Home once while signed in (pet loads) then try again."
        );
        return false;
      }
      const ref =
        snap.activePetSnapshot?.petRef ||
        (Array.isArray(snap.ownedPetsSnapshot) ? snap.ownedPetsSnapshot[0]?.petRef : null) ||
        "Cat";
      const pet = this._basePet({
        id,
        petRef: ref,
        stage: "Egg",
        age: 2,
        adjustedDays: 0
      });
      const payload = {
        leetmate_happiness: 100,
        leetmate_pet_age_last_rollover: this._yesterdayCa(),
        ownedPetsSnapshot: [pet],
        activePetId: id,
        leetmate_pet_age_pending_firestore_sync: false
      };
      if (snap.uid) payload.uid = snap.uid;
      await storageSet(payload);
      console.log(
        "Preset for YOUR active pet (Egg, age 2). Next: await petAgeTest.runMidnightJob() then reload Home, or runEvolutionScreenTest()."
      );
      this._logEvolutionLine(pet, "before job ");
      return true;
    },

    /**
     * End-to-end: preset active pet → midnight job (queues evolution) → reload Home → redirects to screens/evolution.
     */
    async runEvolutionScreenTest() {
      const ok = await this.presetEggAlmostBabyForActivePet();
      if (!ok) return;

      await runMidnightPetAgeJob();

      const notify = typeof LeetmateEvolutionNotify !== "undefined" ? LeetmateEvolutionNotify : null;
      if (notify && notify.peekEvolutionQueue) {
        const q = await notify.peekEvolutionQueue();
        console.log("leetmate_evolution_queue after job:", q);
        if (!q.length) {
          console.warn(
            "Queue empty — job may have skipped (happiness / rollover / uid). Check petAgeTest.status()."
          );
          return;
        }
      }

      console.log(
        "Reloading Home… You should land on screens/evolution (then Continue returns to Home). This will sync age/stage to Firestore."
      );
      window.location.reload();
    },

    async peekEvolutionQueue() {
      const notify = typeof LeetmateEvolutionNotify !== "undefined" ? LeetmateEvolutionNotify : null;
      if (!notify || !notify.peekEvolutionQueue) {
        console.warn("LeetmateEvolutionNotify not loaded.");
        return;
      }
      const q = await notify.peekEvolutionQueue();
      console.log("leetmate_evolution_queue:", q);
      return q;
    },

    /**
     * Console-only preview using LeetmatePetEvolution (no storage).
     * Example: petAgeTest.previewEvolutionAtAge(2, "Egg")
     */
    previewEvolutionAtAge(age, stage = "Egg", adjustedDays = 0) {
      const ev = LeetmatePetEvolution;
      if (!ev) {
        console.warn("LeetmatePetEvolution not loaded.");
        return;
      }
      const pet = { id: "preview", petRef: "Cat", stage, age, adjustedDays };
      console.group(`previewEvolutionAtAge(${age}, "${stage}", adj=${adjustedDays})`);
      console.log("thresholds:", {
        babyMin: ev.BABY_MIN_TOTAL_DAYS,
        adultMin: ev.ADULT_MIN_TOTAL_DAYS
      });
      this._logEvolutionLine(pet, "current ");
      const evolved = ev.evolvePetStage(pet);
      console.log("evolvePetStage →", evolved.stage, evolved === pet ? "(same ref)" : "(new object)");
      const aged = Object.assign({}, pet, { age: pet.age + 1 });
      const afterTick = ev.applyEvolutionToPets([aged])[0];
      console.log("if age+1 then applyEvolutionToPets →", afterTick.stage, "age", afterTick.age);
      console.groupEnd();
    },

    async runMidnightJob() {
      const before = await storageGet(["ownedPetsSnapshot"]);
      const p0 = Array.isArray(before.ownedPetsSnapshot) ? before.ownedPetsSnapshot[0] : null;

      console.group("runMidnightPetAgeJob");
      this._logEvolutionLine(p0, "before ");

      await runMidnightPetAgeJob();

      const after = await storageGet(["ownedPetsSnapshot"]);
      const p1 = Array.isArray(after.ownedPetsSnapshot) ? after.ownedPetsSnapshot[0] : null;
      this._logEvolutionLine(p1, "after  ");

      const beforeAge = p0?.age;
      const afterAge = p1?.age;
      const beforeStage = p0?.stage;
      const afterStage = p1?.stage;

      console.log(`summary: age ${beforeAge} → ${afterAge}, stage "${beforeStage}" → "${afterStage}"`);
      if (beforeAge === afterAge && beforeStage === afterStage) {
        console.log("No change (job skipped or no pets).");
      } else if (beforeStage !== afterStage) {
        console.log("Stage changed (LeetmatePetEvolution.applyEvolutionToPets in pet-age job).");
      }
      console.groupEnd();
    },

    async status() {
      const snap = await storageGet([
        "uid",
        "leetmate_happiness",
        "leetmate_pet_age_last_rollover",
        "leetmate_pet_age_pending_firestore_sync",
        "ownedPetsSnapshot",
        "activePetId"
      ]);
      const p0 = Array.isArray(snap.ownedPetsSnapshot) ? snap.ownedPetsSnapshot[0] : null;

      console.group("Pet age (storage + evolution)");
      console.log("uid:", snap.uid);
      console.log("leetmate_happiness:", snap.leetmate_happiness);
      console.log("leetmate_pet_age_last_rollover:", snap.leetmate_pet_age_last_rollover);
      console.log("today (getTodayString):", getTodayString());
      console.log("leetmate_pet_age_pending_firestore_sync:", snap.leetmate_pet_age_pending_firestore_sync);
      console.log("activePetId:", snap.activePetId);
      if (p0) {
        console.log("ownedPetsSnapshot[0]:", {
          stage: p0.stage,
          age: p0.age,
          adjustedDays: p0.adjustedDays ?? 0
        });
        if (typeof LeetmatePetEvolution !== "undefined") {
          const ev = LeetmatePetEvolution;
          console.log("effectiveEvolutionAge:", ev.effectiveEvolutionAge(p0));
          console.log("nextStageFromPet (for current age):", ev.nextStageFromPet(p0));
        }
      } else {
        console.log("ownedPetsSnapshot[0]: (none)");
      }
      console.groupEnd();
    }
  };
}
