(function () {
  "use strict";

  let activeUid = null;
  let activeDb = null;

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const petsBtn = document.getElementById("playground-pets-btn");
    if (petsBtn) {
      petsBtn.addEventListener("click", () => {
        window.location.href = "../playground-pets/index.html";
      });
    }

    const foodBtn = document.getElementById("playground-food-btn");
    if (foodBtn) {
      foodBtn.addEventListener("click", () => {
        window.location.href = "../playground-food/index.html";
      });
    }
		
    const itemsBtn = document.getElementById("playground-items-btn");
    if (itemsBtn) {
      itemsBtn.addEventListener("click", () => {
        window.location.href = "../playground-items/index.html";
      });
    }

    window.LeetmatePetRename.setupRenameModal({
      getDb: () => activeDb,
      getUid: () => activeUid,
    });

		// read from snapshot in extension storage first
    window.LeetmatePetUI.loadActivePetFromStorage().catch((error) => {
      console.warn("Playground could not load cached pet state:", error);
    });

    updateHeartsUI().catch((error) => {
      console.warn("Playground could not load cached happiness:", error);
    });

    if (!hasFirebase()) {
      console.warn("Firebase not available on playground.");
      return;
    }

    const db = firebase.firestore();
    const auth = firebase.auth();
    activeDb = db;

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        activeUid = user.uid;

        await loadHappinessFromFirestore(db, user.uid);

        await loadActivePetFromFirestore(db, user.uid);

        await startHappinessDecayTimer();
      } catch (error) {
        console.error("Playground failed to load pet state:", error);
      }
    });
  });
})();
