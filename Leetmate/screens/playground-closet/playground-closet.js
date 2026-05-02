(function () {
  "use strict";

  const DEFAULT_STATUS_TEXT = "Closet";
  const ACCESSORY_INVENTORY_SNAPSHOT_KEY = "accessoryInventorySnapshot";
  let activeUid = null;
  let activeDb = null;
  let currentPetSnapshot = null;

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  function getClosetElements() {
    return {
      grid: document.getElementById("closet-grid"),
      empty: document.getElementById("closet-empty"),
      statusPill: document.getElementById("closet-status-pill"),
      gridWrap: document.getElementById("closet-grid-wrap"),
    };
  }

  async function refreshCurrentPetSnapshot() {
    const { activePetSnapshot } = await storageGet("activePetSnapshot");
    currentPetSnapshot = activePetSnapshot || null;
    return currentPetSnapshot;
  }

  function setStatusText(text = DEFAULT_STATUS_TEXT) {
    const { statusPill } = getClosetElements();
    if (!statusPill) return;
    statusPill.textContent = text;
  }

  function getAccessoryCatalogMap() {
    const items = window.LeetmateStoreCatalog?.getStoreItems("accessory") || [];
    return new Map(items.map((item) => [item.id, item]));
  }

  function getPurchasedTimeMs(item) {
    if (typeof item.purchasedAt?.toMillis === "function") {
      return item.purchasedAt.toMillis();
    }

    const raw = Number(item.purchasedAt ?? item.purchasedAtMs);
    return Number.isFinite(raw) ? raw : 0;
  }

  function toCachedAccessoryItem(item) {
    return {
      id: item.id || null,
      category: item.category || null,
      quantity: Number(item.quantity ?? 0) || 0,
      purchasedAtMs: getPurchasedTimeMs(item),
    };
  }

  function canUseAccessoryItem() {
    const stage = String(currentPetSnapshot?.stage || "").toLowerCase();
    const happiness = window.LeetmatePetUI?.getPetHappinessState?.();
    const dead = Number.isFinite(happiness) ? happiness <= 0 : false;
    return stage === "adult" && !dead;
  }

  function syncClosetSlotState(button) {
    const usable = canUseAccessoryItem();
    const equipped = button.dataset.itemId === currentPetSnapshot?.equippedItemId;
    button.classList.toggle("is-unusable", !usable);
    button.classList.toggle("is-equipped", equipped);
    button.disabled = !usable;
    button.setAttribute("aria-disabled", usable ? "false" : "true");
    return usable;
  }

  async function updateEquippedAccessory(itemId, itemName) {
    if (!activeDb || !activeUid || !currentPetSnapshot?.petRef) return;

    const nextEquippedItemId =
      currentPetSnapshot.equippedItemId === itemId ? null : itemId;
    const resolvedSpritePath = await window.LeetmatePetUI.resolveActivePetSpritePath(
      currentPetSnapshot.petRef,
      currentPetSnapshot.stage,
      nextEquippedItemId
    );

    await activeDb.collection("users").doc(activeUid).set(
      {
        equippedItemId: nextEquippedItemId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const nextSnapshot = currentPetSnapshot
      ? { ...currentPetSnapshot, equippedItemId: nextEquippedItemId }
      : null;

    await storageSet({
      activePetSpritePath: resolvedSpritePath,
      activePetSnapshot: nextSnapshot,
    });

    currentPetSnapshot = nextSnapshot;
    refreshRenderedClosetSlotStates();
    setStatusText(nextEquippedItemId ? `${itemName} equipped` : `${itemName} removed`);
  }

  function createClosetSlot(entry, catalogItem) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "closet-slot";
    button.setAttribute("aria-label", catalogItem.name);
    button.dataset.itemId = entry.id;

    const img = document.createElement("img");
    img.className = "closet-slot-img";
    img.src = catalogItem.image;
    img.alt = catalogItem.name;
    button.appendChild(img);

    if (Number(entry.quantity) > 1) {
      const count = document.createElement("span");
      count.className = "closet-slot-count";
      count.textContent = String(entry.quantity);
      button.appendChild(count);
    }

    syncClosetSlotState(button);

    button.addEventListener("mouseenter", () => {
      if (!syncClosetSlotState(button)) {
        setStatusText();
        return;
      }
      setStatusText(catalogItem.name);
    });
    button.addEventListener("mouseleave", () => setStatusText());
    button.addEventListener("focus", () => {
      if (!syncClosetSlotState(button)) {
        setStatusText();
        return;
      }
      setStatusText(catalogItem.name);
    });
    button.addEventListener("blur", () => setStatusText());
    button.addEventListener("click", async () => {
      if (!syncClosetSlotState(button)) return;

      try {
        await updateEquippedAccessory(entry.id, catalogItem.name);
      } catch (error) {
        console.error("Failed to update equipped accessory:", error);
        setStatusText("Closet");
      }
    });

    return button;
  }

  function refreshRenderedClosetSlotStates() {
    const { grid } = getClosetElements();
    if (!grid) return;

    grid.querySelectorAll(".closet-slot").forEach((button) => {
      syncClosetSlotState(button);
    });
  }

  function renderAccessoryInventory(items) {
    const { grid, empty, gridWrap } = getClosetElements();
    if (!grid || !empty || !gridWrap) return;

    const catalogById = getAccessoryCatalogMap();
    grid.innerHTML = "";

    items.forEach((entry) => {
      const catalogItem = catalogById.get(entry.id);
      if (!catalogItem) return;
      grid.appendChild(createClosetSlot(entry, catalogItem));
    });

    empty.classList.toggle("hidden", grid.children.length > 0);
    gridWrap.classList.remove("is-loading");
    refreshRenderedClosetSlotStates();
  }

  async function renderCachedAccessoryInventory() {
    const { accessoryInventorySnapshot } = await storageGet([ACCESSORY_INVENTORY_SNAPSHOT_KEY]);
    if (!Array.isArray(accessoryInventorySnapshot) || accessoryInventorySnapshot.length === 0) {
      return false;
    }

    renderAccessoryInventory(
      accessoryInventorySnapshot
        .filter((item) => item && String(item.category || "").toLowerCase() === "accessory")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a))
    );
    return true;
  }

  async function loadAccessoryInventory(db, uid) {
    const { grid, empty, gridWrap } = getClosetElements();
    if (!grid || !empty || !gridWrap) return;

    try {
      const snap = await db.collection("users").doc(uid).collection("inventory").get();
      const items = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => String(item.category || "").toLowerCase() === "accessory")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a));

      renderAccessoryInventory(items);
      await storageSet({
        [ACCESSORY_INVENTORY_SNAPSHOT_KEY]: items.map((item) => toCachedAccessoryItem(item)),
      });
    } finally {
      gridWrap.classList.remove("is-loading");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("closet-back-btn");
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
    renderCachedAccessoryInventory().catch((error) => {
      console.warn("Closet page could not load cached inventory:", error);
    });

    window.LeetmatePetUI.loadActivePetFromStorage()
      .then(refreshCurrentPetSnapshot)
      .catch((error) => {
        console.warn("Closet page could not load cached pet state:", error);
      });

    updateHeartsUI().catch((error) => {
      console.warn("Closet page could not load cached happiness:", error);
    });

    if (!hasFirebase()) {
      console.warn("Firebase not available on closet page.");
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
          loadAccessoryInventory(db, user.uid),
        ]);

        await refreshCurrentPetSnapshot();
        refreshRenderedClosetSlotStates();
        await startHappinessDecayTimer();
      } catch (error) {
        console.error("Closet page failed to load:", error);
      }
    });

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "local") return;
        if (!changes.activePetSnapshot && !changes.leetmate_happiness) return;
        await refreshCurrentPetSnapshot().catch(() => {});
        refreshRenderedClosetSlotStates();
      });
    }
  });
})();
