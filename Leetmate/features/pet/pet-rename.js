(function () {
  "use strict";

  function getRenameElements() {
    return {
      openBtn: document.querySelector(".playground-rename-btn"),
      overlay: document.getElementById("rename-modal-overlay"),
      closeBtn: document.getElementById("rename-modal-close"),
      confirmBtn: document.getElementById("rename-modal-confirm"),
      input: document.getElementById("rename-input"),
      nameDisplay: document.getElementById("pet-name-display"),
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

  async function updateRenameSnapshots(activePetId, nextName) {
    const { activePetSnapshot, ownedPetsSnapshot } = await storageGet([
      "activePetSnapshot",
      "ownedPetsSnapshot",
    ]);

    const nextSnapshot = activePetSnapshot
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

  function setupRenameModal(options) {
    const { getDb, getUid, onRenamed } = options;
    const { openBtn, overlay, closeBtn, confirmBtn, input } = getRenameElements();
    if (!openBtn || !overlay || !closeBtn || !confirmBtn || !input) return;

    async function confirmRename() {
      const db = getDb();
      const uid = getUid();
      if (!input || !db || !uid) return;

      const nextName = input.value.trim();
      if (!nextName) {
        input.focus();
        return;
      }

      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return;

      const activePetId = userSnap.data().activePetId;
      if (!activePetId) return;

      await userRef.collection("pets").doc(activePetId).set(
        { customName: nextName },
        { merge: true }
      );

      await updateRenameSnapshots(activePetId, nextName);
      await loadActivePetFromFirestore(db, uid);

      if (typeof onRenamed === "function") {
        await onRenamed({ activePetId, nextName });
      }

      closeRenameModal();
    }

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

  window.LeetmatePetRename = {
    setupRenameModal,
  };
})();
