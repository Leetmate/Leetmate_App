(function () {
  "use strict";

  const DEFAULT_STATUS_TEXT = "Items";
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

    await loadActivePetFromFirestore(activeDb, activeUid);
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


  function getItemCatalogMap() {
    const items = window.LeetmateStoreCatalog?.getStoreItems("special") || [];
    return new Map(items.map((item) => [item.id, item]));
  }

  function getPurchasedTimeMs(item) {
    if (typeof item.purchasedAt?.toMillis === "function") {
      return item.purchasedAt.toMillis();
    }

    const raw = Number(item.purchasedAt);
    return Number.isFinite(raw) ? raw : 0;
  }

  function createItemSlot(entry, catalogItem) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-slot";
    button.setAttribute("aria-label", catalogItem.name);

    const img = document.createElement("img");
    img.className = "item-slot-img";
    img.src = catalogItem.image;
    img.alt = catalogItem.name;
    button.appendChild(img);

    if (Number(entry.quantity) > 1) {
      const count = document.createElement("span");
      count.className = "item-slot-count";
      count.textContent = String(entry.quantity);
      button.appendChild(count);
    }

    return button;
  }

  async function loadItemInventory(db, uid) {
    const grid = document.getElementById("item-grid");
    const empty = document.getElementById("item-empty");
    if (!grid || !empty) return;

    const catalogById = getItemCatalogMap();
    const snap = await db.collection("users").doc(uid).collection("inventory").get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.category === "Special")
      .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a));

    grid.innerHTML = "";

    items.forEach((entry) => {
      const catalogItem = catalogById.get(entry.id);
      if (!catalogItem) return;
      grid.appendChild(createItemSlot(entry, catalogItem));
    });

    empty.classList.toggle("hidden", grid.children.length > 0);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("item-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "../playground-main/index.html";
      });
    }

    setupRenameModal();

    window.LeetmatePetUI.loadActivePetFromStorage().catch((error) => {
      console.warn("Item page could not load cached pet state:", error);
    });

    updateHeartsUI().catch((error) => {
      console.warn("Item page could not load cached happiness:", error);
    });

    if (!hasFirebase()) {
      console.warn("Firebase not available on item page.");
      return;
    }

    const db = firebase.firestore();
    const auth = firebase.auth();
    activeDb = db;

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        activeUid = user.uid;
        await Promise.all([
          loadHappinessFromFirestore(db, user.uid),
          loadActivePetFromFirestore(db, user.uid),
          loadItemInventory(db, user.uid),
        ]);

        await startHappinessDecayTimer();
      } catch (error) {
        console.error("Item page failed to load:", error);
      }
    });
  });
})();
