(function () {
  "use strict";

  let activeUid = null;
  let activeDb = null;

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  function getRenameElements() {
    return {
      openBtn: document.querySelector(".playground-rename-btn"),
      overlay: document.getElementById("rename-modal-overlay"),
      closeBtn: document.getElementById("rename-modal-close"),
      confirmBtn: document.getElementById("rename-modal-confirm"),
      input: document.getElementById("rename-input"),
      nameDisplay: document.getElementById("pet-name-display")
    };
  }

  function openRenameModal() {
    const { overlay, input, nameDisplay } = getRenameElements();
    if (!overlay || !input || !nameDisplay) return;

    input.value = nameDisplay.textContent.trim();
    overlay.classList.remove("hidden");
    window.requestAnimationFrame(() => input.focus());
  }

  function closeRenameModal() {
    const { overlay } = getRenameElements();
    if (!overlay) return;
    overlay.classList.add("hidden");
  }

  async function confirmRename() {
    const { input } = getRenameElements();
    if (!input || !activeDb || !activeUid) return;

    const nextName = input.value.trim();
    if (!nextName) {
      input.focus();
      return;
    }

    const userRef = activeDb.collection("users").doc(activeUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const activePetId = userSnap.data().activePetId;
    if (!activePetId) return;

    await userRef.collection("pets").doc(activePetId).set(
      { customName: nextName },
      { merge: true }
    );

    if (typeof storageGet === "function" && typeof storageSet === "function") {
      const { activePetSnapshot, ownedPetsSnapshot } = await storageGet([
        "activePetSnapshot",
        "ownedPetsSnapshot",
      ]);

      const nextSnapshot =
        activePetSnapshot
          ? { ...activePetSnapshot, customName: nextName }
          : null;

      const nextOwnedPets = Array.isArray(ownedPetsSnapshot)
        ? ownedPetsSnapshot.map((pet) =>
            pet?.id === activePetId ? { ...pet, customName: nextName } : pet
          )
        : ownedPetsSnapshot;

      await storageSet({
        activePetSnapshot: nextSnapshot,
        ownedPetsSnapshot: nextOwnedPets,
      });
    }

    if (typeof loadActivePetFromFirestore === "function") {
      await loadActivePetFromFirestore(activeDb, activeUid);
    }

    closeRenameModal();
  }

  function setupRenameModal() {
    const { openBtn, overlay, closeBtn, confirmBtn, input } = getRenameElements();
    if (!openBtn || !overlay || !closeBtn || !confirmBtn || !input) return;

    openBtn.addEventListener("click", openRenameModal);
    closeBtn.addEventListener("click", closeRenameModal);
    confirmBtn.addEventListener("click", confirmRename);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeRenameModal();
      }
    });

    input.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        closeRenameModal();
      } else if (event.key === "Enter") {
        event.preventDefault();
        await confirmRename();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const petsBtn = document.getElementById("playground-pets-btn");
    if (petsBtn) {
      petsBtn.addEventListener("click", () => {
        window.location.href = "../playground-pets/index.html";
      });
    }

    setupRenameModal();

    if (
      window.LeetmatePetUI &&
      typeof window.LeetmatePetUI.loadActivePetFromStorage === "function"
    ) {
      window.LeetmatePetUI.loadActivePetFromStorage().catch((error) => {
        console.warn("Playground could not load cached pet state:", error);
      });
    }

    if (typeof updateHeartsUI === "function") {
      updateHeartsUI().catch((error) => {
        console.warn("Playground could not load cached happiness:", error);
      });
    }

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

        if (typeof loadHappinessFromFirestore === "function") {
          await loadHappinessFromFirestore(db, user.uid);
        }

        if (typeof loadActivePetFromFirestore === "function") {
          await loadActivePetFromFirestore(db, user.uid);
        }

        if (typeof startHappinessDecayTimer === "function") {
          await startHappinessDecayTimer();
        }
      } catch (error) {
        console.error("Playground failed to load pet state:", error);
      }
    });
  });
})();
