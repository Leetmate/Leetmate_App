if (typeof window !== "undefined") {
  function runPetTest(factory) {
    return Promise.resolve()
      .then(factory)
      .then((result) => {
        console.log("petTest complete:", result);
        return result;
      })
      .catch((error) => {
        console.error("petTest failed:", error);
      });
  }

  window.petTest = {
    async addPet({
      petRef = "Bat",
      customName,
      stage = "Baby",
      stats,
      adjustedDays = 0,
      ageDays = 0,
      setActive = false,
    } = {}) {
      const auth = firebase.auth();
      const db = firebase.firestore();
      const uid = auth.currentUser?.uid;

      if (!uid) {
        throw new Error("No signed-in user");
      }

      const defaults = {
        Bat: {
          customName: "Test Bat",
          stats: { hp: 40, atk: 45, def: 40, spAtk: 60, spDef: 50, spd: 80 },
        },
        Cat: {
          customName: "Test Cat",
          stats: { hp: 50, atk: 55, def: 50, spAtk: 55, spDef: 55, spd: 65 },
        },
        Fox: {
          customName: "Test Fox",
          stats: { hp: 45, atk: 50, def: 45, spAtk: 75, spDef: 60, spd: 70 },
        },
      };

      if (!defaults[petRef]) {
        throw new Error(`Unsupported petRef: ${petRef}`);
      }

      const petId = `pet_test_${Date.now()}`;
      const createdMs = Date.now() - ageDays * 24 * 60 * 60 * 1000;
      const userRef = db.collection("users").doc(uid);
      const petDoc = {
        petRef,
        customName: customName || defaults[petRef].customName,
        age: ageDays,
        stats: stats || defaults[petRef].stats,
        stage,
        ableToBattle: false,
        createdTimestamp: firebase.firestore.Timestamp.fromMillis(createdMs),
        adjustedDays,
      };

      await userRef.collection("pets").doc(petId).set(petDoc);

      if (setActive) {
        await userRef.set(
          {
            activePetId: petId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      console.log("Created test pet:", petId, petDoc);
      return { petId, petDoc };
    },

    addBat(options = {}) {
      return runPetTest(() => this.addPet({ petRef: "Bat", ...options }));
    },

    addCat(options = {}) {
      return runPetTest(() => this.addPet({ petRef: "Cat", ...options }));
    },

    addFox(options = {}) {
      return runPetTest(() => this.addPet({ petRef: "Fox", ...options }));
    },

    add(options = {}) {
      return runPetTest(() => this.addPet(options));
    },
  };
}
