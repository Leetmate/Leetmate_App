(function () {
  "use strict";

  const DEFAULT_STATUS_TEXT = "Food";
  const FOOD_INVENTORY_SNAPSHOT_KEY = "foodInventorySnapshot";
  let activeUid = null;
  let activeDb = null;
  let currentPetSnapshot = null;
  let feedingController = null;

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  function getFoodElements() {
    return {
      grid: document.getElementById("food-grid"),
      empty: document.getElementById("food-empty"),
      statusPill: document.getElementById("food-status-pill"),
      gridWrap: document.getElementById("food-grid-wrap"),
    };
  }

  async function refreshCurrentPetSnapshot() {
    const { activePetSnapshot } = await storageGet("activePetSnapshot");
    currentPetSnapshot = activePetSnapshot || null;
    return currentPetSnapshot;
  }

  function setStatusText(text = DEFAULT_STATUS_TEXT) {
    const { statusPill } = getFoodElements();
    if (!statusPill) return;
    statusPill.textContent = text;
  }

  function getFoodCatalogMap() {
    const items = window.LeetmateStoreCatalog?.getStoreItems("food") || [];
    return new Map(items.map((item) => [item.id, item]));
  }

  function getPurchasedTimeMs(item) {
    if (typeof item.purchasedAt?.toMillis === "function") {
      return item.purchasedAt.toMillis();
    }

    const raw = Number(item.purchasedAt);
    return Number.isFinite(raw) ? raw : 0;
  }

  function toCachedFoodItem(item) {
    return {
      id: item.id || null,
      category: item.category || null,
      quantity: Number(item.quantity ?? 0) || 0,
      recoveryAmount: Number(item.recoveryAmount ?? 0) || 0,
      purchasedAtMs: getPurchasedTimeMs(item),
    };
  }

  function createFoodSlot(entry, catalogItem) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "food-slot";
    button.setAttribute("aria-label", catalogItem.name);

    const img = document.createElement("img");
    img.className = "food-slot-img";
    img.src = catalogItem.image;
    img.alt = catalogItem.name;
    button.appendChild(img);

    feedingController?.attachFoodSlot(button, entry, catalogItem);

    if (Number(entry.quantity) > 1) {
      const count = document.createElement("span");
      count.className = "food-slot-count";
      count.textContent = String(entry.quantity);
      button.appendChild(count);
    }

    return button;
  }

  function renderFoodInventory(foods) {
    const { grid, empty, gridWrap } = getFoodElements();
    if (!grid || !empty || !gridWrap) return;

    const catalogById = getFoodCatalogMap();
    grid.innerHTML = "";

    foods.forEach((entry) => {
      const catalogItem = catalogById.get(entry.id);
      if (!catalogItem) return;
      grid.appendChild(createFoodSlot(entry, catalogItem));
    });

    empty.classList.toggle("hidden", grid.children.length > 0);
    gridWrap.classList.remove("is-loading");
  }

  async function renderCachedFoodInventory() {
    const { foodInventorySnapshot } = await storageGet([FOOD_INVENTORY_SNAPSHOT_KEY]);
    if (!Array.isArray(foodInventorySnapshot) || foodInventorySnapshot.length === 0) {
      return false;
    }

    renderFoodInventory(
      foodInventorySnapshot
        .filter((item) => item && item.category === "Food")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a))
    );
    return true;
  }

  async function loadFoodInventory(db, uid) {
    const { grid, empty, gridWrap } = getFoodElements();
    if (!grid || !empty || !gridWrap) return;

    try {
      const snap = await db.collection("users").doc(uid).collection("inventory").get();
      const foods = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.category === "Food")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a));

      renderFoodInventory(foods);
      await storageSet({
        [FOOD_INVENTORY_SNAPSHOT_KEY]: foods.map((item) => toCachedFoodItem(item)),
      });
    } finally {
      gridWrap.classList.remove("is-loading");
    }
  }

  function initFeedingController() {
    if (!window.FeedingLogic) {
      throw new Error("Food feeding module is unavailable");
    }

    feedingController = window.FeedingLogic.createController({
      getDb: () => activeDb,
      getUid: () => activeUid,
      getPetSnapshot: () => currentPetSnapshot,
      setStatusText,
      reloadInventory: async () => {
        if (!activeDb || !activeUid) return;
        await loadFoodInventory(activeDb, activeUid);
      },
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("food-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "../playground-main/index.html";
      });
    }

    window.LeetmatePetRename.setupRenameModal({
      getDb: () => activeDb,
      getUid: () => activeUid,
      onRenamed: async () => {
        await refreshCurrentPetSnapshot();
      },
    });
    setStatusText();
    initFeedingController();
    renderCachedFoodInventory().catch((error) => {
      console.warn("Food page could not load cached inventory:", error);
    });

    window.LeetmatePetUI.loadActivePetFromStorage()
      .then(refreshCurrentPetSnapshot)
      .catch((error) => {
        console.warn("Food page could not load cached pet state:", error);
      });

    updateHeartsUI().catch((error) => {
      console.warn("Food page could not load cached happiness:", error);
    });

    if (!hasFirebase()) {
      console.warn("Firebase not available on food page.");
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
          loadFoodInventory(db, user.uid),
        ]);

        await refreshCurrentPetSnapshot();
        feedingController?.resetPetPose();
        await startHappinessDecayTimer();
      } catch (error) {
        console.error("Food page failed to load:", error);
      }
    });
  });
})();
