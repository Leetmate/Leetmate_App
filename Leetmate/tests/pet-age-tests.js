// ── Dev helpers (Home console, signed in) ─────────────────────────────────────
//
// Scripted demos (Firestore + storage + midnight job):
//   await petAgeTest.demoEggToBabyEvolution()
//     Egg age 2, last rollover = yesterday, happiness > 0 → job → Baby + reload → evolution screen
//   await petAgeTest.demoBabySkippedWhenUnhappy()
//     Baby age 9, yesterday rollover, happiness = 0 → job does nothing (no age/stage change)
//   await petAgeTest.demoBabyToAdultEvolution()
//     Baby age 9, yesterday rollover, happiness > 0 → job → Adult + reload → evolution screen
//
// Low-level:
//   await petAgeTest.setActivePet({ age, stage })
//   await petAgeTest.syncFromFirestore()
//   await petAgeTest.runMidnightJob()
//   petAgeTest.previewEvolutionAtAge(2, "Egg")

if (typeof window !== "undefined") {
  window.petAgeTest = {
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

    /**
     * @returns {{ db: firebase.firestore.Firestore, uid: string } | null}
     */
    async _authDb() {
      if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
        console.warn("petAgeTest: Firebase not available.");
        return null;
      }
      const user = firebase.auth().currentUser;
      if (!user) {
        console.warn("petAgeTest: Sign in on Home first.");
        return null;
      }
      return { db: firebase.firestore(), uid: user.uid };
    },

    /**
     * Reads activePetId from the user document (source of truth).
     */
    async _getActivePetId(db, uid) {
      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) {
        console.warn("petAgeTest: User document missing.");
        return null;
      }
      const id = userSnap.data().activePetId;
      if (!id) {
        console.warn("petAgeTest: No activePetId on user document.");
        return null;
      }
      return id;
    },

    /**
     * Merge fields onto the active pet in Firestore, clear pending-age override,
     * reload pet list + Home UI from Firestore.
     *
     * @param {Partial<{ age: number, stage: string, adjustedDays: number, customName: string }>} fields
     */
    async setActivePet(fields) {
      const ctx = await this._authDb();
      if (!ctx) return false;

      const petId = await this._getActivePetId(ctx.db, ctx.uid);
      if (!petId) return false;

      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(patch).length === 0) {
        console.warn("petAgeTest.setActivePet: no fields to write.");
        return false;
      }

      if (patch.stage !== undefined && patch.ableToBattle === undefined) {
        patch.ableToBattle = String(patch.stage).toLowerCase() === "adult";
      }

      const FieldValue = firebase.firestore.FieldValue;
      await ctx.db
        .collection("users")
        .doc(ctx.uid)
        .collection("pets")
        .doc(petId)
        .set(
          {
            ...patch,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

      if (typeof storageSet === "function") {
        await storageSet({ leetmate_pet_age_pending_firestore_sync: false });
      }

      if (typeof loadActivePetFromFirestore === "function") {
        await loadActivePetFromFirestore(ctx.db, ctx.uid);
      } else {
        console.warn("petAgeTest: loadActivePetFromFirestore not defined — reload Home.");
      }

      console.log("petAgeTest: Firestore active pet updated + UI refreshed:", patch);
      return true;
    },

    /** Pull all pets from Firestore into storage and refresh the Home pet UI. */
    async syncFromFirestore() {
      const ctx = await this._authDb();
      if (!ctx) return false;
      if (typeof storageSet === "function") {
        await storageSet({ leetmate_pet_age_pending_firestore_sync: false });
      }
      if (typeof loadActivePetFromFirestore === "function") {
        await loadActivePetFromFirestore(ctx.db, ctx.uid);
        console.log("petAgeTest: synced from Firestore.");
        return true;
      }
      console.warn("petAgeTest: loadActivePetFromFirestore missing.");
      return false;
    },

    /** Preset: Egg @ age 2 (one midnight tick → Baby if rollover allows). */
    eggAlmostBaby() {
      return this.setActivePet({ age: 2, stage: "Egg", adjustedDays: 0 });
    },

    /** Preset: Baby @ age 9 (one tick → Adult). */
    babyAlmostAdult() {
      return this.setActivePet({ age: 9, stage: "Baby", adjustedDays: 0 });
    },

    /** Local happiness (midnight job skips when ≤ 0, if lastRollover is already set). */
    async setHappiness(value) {
      await storageSet({ leetmate_happiness: value });
      console.log("leetmate_happiness:", value);
    },

    /** Clear queued evolution toasts so demos start clean. */
    async clearEvolutionQueue() {
      await storageSet({ leetmate_evolution_queue: [] });
      console.log("petAgeTest: leetmate_evolution_queue cleared.");
    },

    /**
     * After runMidnightPetAgeJob: reload Home if an evolution event exists for the active pet.
     * @returns {Promise<boolean>} true if reload was triggered
     */
    async _reloadHomeIfEvolutionQueuedForActivePet() {
      const { activePetId } = await storageGet(["activePetId"]);
      const notify = typeof LeetmateEvolutionNotify !== "undefined" ? LeetmateEvolutionNotify : null;
      if (!notify?.peekEvolutionQueue || !activePetId) {
        console.warn("petAgeTest: cannot peek evolution queue or no activePetId.");
        return false;
      }
      const q = await notify.peekEvolutionQueue();
      const evt = (q || []).find((e) => e && e.petId === activePetId);
      console.log("leetmate_evolution_queue (active pet):", evt || "(none)");
      if (!evt) {
        return false;
      }
      console.log("Reloading Home → evolution screen…");
      window.location.reload();
      return true;
    },

    /**
     * Demo 1 — Egg @ age 2, rollover yesterday, happiness > 0 → age 3 Baby + evolution screen.
     */
    async demoEggToBabyEvolution() {
      console.group("petAgeTest.demoEggToBabyEvolution");
      await this.clearEvolutionQueue();
      const ok = await this.eggAlmostBaby();
      if (!ok) {
        console.groupEnd();
        return;
      }
      await storageSet({
        leetmate_happiness: 100,
        leetmate_pet_age_last_rollover: this._yesterdayCa()
      });
      console.log("Setup: Egg age 2, lastRollover=yesterday, happiness=100 → runMidnightPetAgeJob");
      await runMidnightPetAgeJob();
      const reloaded = await this._reloadHomeIfEvolutionQueuedForActivePet();
      if (!reloaded) {
        console.warn(
          "No evolution queued — job may have skipped (uid / rollover / happiness). Run petAgeTest.status()."
        );
      }
      console.groupEnd();
    },

    /**
     * Demo 2 — Baby @ age 9, rollover yesterday, happiness = 0 → job must not run (no change).
     */
    async demoBabySkippedWhenUnhappy() {
      console.group("petAgeTest.demoBabySkippedWhenUnhappy");
      await this.clearEvolutionQueue();
      const ok = await this.babyAlmostAdult();
      if (!ok) {
        console.groupEnd();
        return;
      }
      const yesterdayStr = this._yesterdayCa();
      const before = await storageGet(["ownedPetsSnapshot", "activePetId"]);
      const pets0 = Array.isArray(before.ownedPetsSnapshot) ? before.ownedPetsSnapshot : [];
      const a0 = pets0.find((p) => p && p.id === before.activePetId) || pets0[0];

      await storageSet({
        leetmate_happiness: 0,
        leetmate_pet_age_last_rollover: yesterdayStr
      });
      console.log("Setup: Baby age 9, lastRollover=yesterday, happiness=0 → runMidnightPetAgeJob (expect skip)");

      await runMidnightPetAgeJob();

      const after = await storageGet(["ownedPetsSnapshot", "leetmate_pet_age_last_rollover"]);
      const pets1 = Array.isArray(after.ownedPetsSnapshot) ? after.ownedPetsSnapshot : [];
      const a1 = pets1.find((p) => p && p.id === before.activePetId) || pets1[0];

      const sameAge = a0?.age === a1?.age;
      const sameStage = String(a0?.stage || "") === String(a1?.stage || "");
      // If the job had run, rollover would advance to today — it must stay the value we set.
      const rolloverStillYesterday =
        after.leetmate_pet_age_last_rollover === yesterdayStr;

      if (sameAge && sameStage && rolloverStillYesterday) {
        console.log(
          "OK: Pet unchanged and rollover still yesterday — job correctly skipped when happiness ≤ 0."
        );
      } else {
        console.warn("Unexpected: pet or rollover changed despite happiness 0.", {
          beforePet: { age: a0?.age, stage: a0?.stage },
          afterPet: { age: a1?.age, stage: a1?.stage },
          expectedRollover: yesterdayStr,
          actualRollover: after.leetmate_pet_age_last_rollover,
          rolloverStillYesterday
        });
      }
      console.groupEnd();
    },

    /**
     * Demo 3 — Baby @ age 9, rollover yesterday, happiness > 0 → age 10 Adult + evolution screen.
     */
    async demoBabyToAdultEvolution() {
      console.group("petAgeTest.demoBabyToAdultEvolution");
      await this.clearEvolutionQueue();
      const ok = await this.babyAlmostAdult();
      if (!ok) {
        console.groupEnd();
        return;
      }
      await storageSet({
        leetmate_happiness: 100,
        leetmate_pet_age_last_rollover: this._yesterdayCa()
      });
      console.log("Setup: Baby age 9, lastRollover=yesterday, happiness=100 → runMidnightPetAgeJob");
      await runMidnightPetAgeJob();
      const reloaded = await this._reloadHomeIfEvolutionQueuedForActivePet();
      if (!reloaded) {
        console.warn(
          "No evolution queued — job may have skipped. Run petAgeTest.status()."
        );
      }
      console.groupEnd();
    },

    /** @deprecated Use demoEggToBabyEvolution() */
    async runEvolutionScreenTest() {
      return this.demoEggToBabyEvolution();
    },

    async peekEvolutionQueue() {
      const notify = typeof LeetmateEvolutionNotify !== "undefined" ? LeetmateEvolutionNotify : null;
      if (!notify?.peekEvolutionQueue) {
        console.warn("LeetmateEvolutionNotify not loaded.");
        return;
      }
      const q = await notify.peekEvolutionQueue();
      console.log("leetmate_evolution_queue:", q);
      return q;
    },

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
      const before = await storageGet(["ownedPetsSnapshot", "activePetId"]);
      const pets = Array.isArray(before.ownedPetsSnapshot) ? before.ownedPetsSnapshot : [];
      const active = pets.find((p) => p && p.id === before.activePetId) || pets[0];

      console.group("runMidnightPetAgeJob");
      this._logEvolutionLine(active, "before ");

      await runMidnightPetAgeJob();

      const afterSnap = await storageGet(["ownedPetsSnapshot", "activePetId"]);
      const pets2 = Array.isArray(afterSnap.ownedPetsSnapshot) ? afterSnap.ownedPetsSnapshot : [];
      const active2 = pets2.find((p) => p && p.id === afterSnap.activePetId) || pets2[0];
      this._logEvolutionLine(active2, "after  ");

      console.log(
        `active pet: age ${active?.age} → ${active2?.age}, stage "${active?.stage}" → "${active2?.stage}"`
      );
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
      const pets = Array.isArray(snap.ownedPetsSnapshot) ? snap.ownedPetsSnapshot : [];
      const active = pets.find((p) => p && p.id === snap.activePetId) || pets[0];

      console.group("petAgeTest.status (chrome.storage)");
      console.log("activePetId:", snap.activePetId);
      console.log("happiness:", snap.leetmate_happiness, "| lastRollover:", snap.leetmate_pet_age_last_rollover);
      console.log("today:", typeof getTodayString === "function" ? getTodayString() : "(n/a)");
      console.log("pending_firestore_sync:", snap.leetmate_pet_age_pending_firestore_sync);
      if (active) {
        console.log("active snapshot:", {
          stage: active.stage,
          age: active.age,
          adjustedDays: active.adjustedDays ?? 0
        });
        if (typeof LeetmatePetEvolution !== "undefined") {
          const ev = LeetmatePetEvolution;
          console.log("effectiveEvolutionAge:", ev.effectiveEvolutionAge(active));
          console.log("nextStageFromPet:", ev.nextStageFromPet(active));
        }
      } else {
        console.log("active snapshot: (none — run await petAgeTest.syncFromFirestore())");
      }
      console.log("Tip: await petAgeTest.setActivePet({ age, stage }) to write Firestore + refresh UI.");
      console.groupEnd();
    }
  };
}
