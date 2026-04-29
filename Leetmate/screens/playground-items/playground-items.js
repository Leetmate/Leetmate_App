(function () {
  "use strict";

  const DEFAULT_STATUS_TEXT = "Items";
  const EFFECT_DURATION_MS = 1600;
  const ITEM_INVENTORY_SNAPSHOT_KEY = "itemInventorySnapshot";
  const REVIVE_AMOUNT = 50;
  const POWER_TONIC_STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "spd"];
  const POWER_TONIC_STAT_LABELS = {
    hp: "HP",
    atk: "ATK",
    def: "DEF",
    spAtk: "SP ATK",
    spDef: "SP DEF",
    spd: "SPD",
  };

  let activeUid = null;
  let activeDb = null;
  let currentPetSnapshot = null;
  let selectedInventoryItem = null;
  let selectedCatalogItem = null;
  let tonicSelection = [];
  let sceneEffectEls = [];
  let useInFlight = false;

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

  function getItemElements() {
    return {
      grid: document.getElementById("item-grid"),
      empty: document.getElementById("item-empty"),
      status: document.getElementById("item-status-pill"),
      gridWrap: document.getElementById("item-grid-wrap"),
      modalOverlay: document.getElementById("item-modal-overlay"),
      modalClose: document.getElementById("item-modal-close"),
      modalTitle: document.getElementById("item-modal-title"),
      modalImage: document.getElementById("item-modal-image"),
      modalDescription: document.getElementById("item-modal-description"),
      modalUse: document.getElementById("item-modal-use"),
      tonicOverlay: document.getElementById("tonic-modal-overlay"),
      tonicClose: document.getElementById("tonic-modal-close"),
      tonicCopy: document.getElementById("tonic-modal-copy"),
      tonicPicks: document.getElementById("tonic-picks"),
      tonicGrid: document.getElementById("tonic-stat-grid"),
      tonicConfirm: document.getElementById("tonic-modal-confirm"),
    };
  }

  function getSceneElements() {
    return {
      petCard: document.querySelector(".playground-pet-card"),
      scene: document.querySelector(".playground-scene"),
      petSprite: document.getElementById("active-pet"),
      petEgg: document.getElementById("active-pet-egg"),
    };
  }

  function setStatusText(text = DEFAULT_STATUS_TEXT) {
    const { status } = getItemElements();
    if (status) {
      status.textContent = text;
    }
  }

  function getCurrentStage() {
    return String(currentPetSnapshot?.stage || "").toLowerCase();
  }

  function getCurrentHappinessPercent() {
    const value = window.LeetmatePetUI?.getPetHappinessState?.();
    return Number.isFinite(value) ? value : 100;
  }

  function isPetDead() {
    return getCurrentHappinessPercent() <= 0;
  }

  async function refreshCurrentPetSnapshot() {
    const { activePetSnapshot } = await storageGet(["activePetSnapshot"]);
    currentPetSnapshot = activePetSnapshot || null;
    return currentPetSnapshot;
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
    await refreshCurrentPetSnapshot();
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

  function toCachedItem(item) {
    return {
      id: item.id || null,
      category: item.category || null,
      quantity: Number(item.quantity ?? 0) || 0,
      purchasedAtMs: getPurchasedTimeMs(item),
    };
  }

  function canUseSpecialItem(catalogItem) {
    if (!catalogItem) return false;

    const effect = catalogItem.effect;
    const stage = getCurrentStage();
    const dead = isPetDead();

    if (dead) {
      return effect === "revive";
    }

    if (effect === "power-tonic") {
      return stage === "adult";
    }

    if (effect === "streak-freeze") {
      return true;
    }

    if (effect === "age-up") {
      return true;
    }

    if (effect === "revive") {
      return false;
    }

    return false;
  }

  function syncItemSlotState(button, catalogItem) {
    const usable = canUseSpecialItem(catalogItem);
    button.classList.toggle("is-unusable", !usable);
    button.disabled = !usable;
    button.setAttribute("aria-disabled", usable ? "false" : "true");
    return usable;
  }

  function createItemSlot(inventoryItem, catalogItem) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "item-slot";
    button.setAttribute("aria-label", catalogItem.name);
    button.dataset.itemId = inventoryItem.id;

    const img = document.createElement("img");
    img.className = "item-slot-img";
    img.src = catalogItem.image;
    img.alt = catalogItem.name;
    button.appendChild(img);

    if (Number(inventoryItem.quantity) > 1) {
      const count = document.createElement("span");
      count.className = "item-slot-count";
      count.textContent = String(inventoryItem.quantity);
      button.appendChild(count);
    }

    syncItemSlotState(button, catalogItem);

    button.addEventListener("mouseenter", () => {
      setStatusText(catalogItem.name);
    });
    button.addEventListener("mouseleave", () => {
      setStatusText();
    });
    button.addEventListener("focus", () => {
      setStatusText(catalogItem.name);
    });
    button.addEventListener("blur", () => {
      setStatusText();
    });
    button.addEventListener("click", () => {
      if (useInFlight || document.body.classList.contains("item-sequence-active")) {
        return;
      }
      openItemModal(inventoryItem, catalogItem);
    });

    return button;
  }

  function refreshRenderedItemSlotStates() {
    const { grid } = getItemElements();
    if (!grid) return;

    const catalogById = getItemCatalogMap();
    grid.querySelectorAll(".item-slot").forEach((button) => {
      const itemId = button.dataset.itemId;
      const catalogItem = catalogById.get(itemId);
      if (catalogItem) {
        syncItemSlotState(button, catalogItem);
      }
    });
  }

  function renderItemInventory(items) {
    const { grid, empty, gridWrap } = getItemElements();
    if (!grid || !empty || !gridWrap) return;

    const catalogById = getItemCatalogMap();
    grid.innerHTML = "";

    items.forEach((inventoryItem) => {
      const catalogItem = catalogById.get(inventoryItem.id);
      if (!catalogItem) return;
      grid.appendChild(createItemSlot(inventoryItem, catalogItem));
    });

    empty.classList.toggle("hidden", grid.children.length > 0);
    gridWrap.classList.remove("is-loading");
    refreshRenderedItemSlotStates();
  }

  async function renderCachedItemInventory() {
    const { itemInventorySnapshot } = await storageGet([ITEM_INVENTORY_SNAPSHOT_KEY]);
    if (!Array.isArray(itemInventorySnapshot) || itemInventorySnapshot.length === 0) {
      return false;
    }

    renderItemInventory(
      itemInventorySnapshot
        .filter((item) => item && item.category === "Special")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a))
    );
    return true;
  }

  async function loadItemInventory(db, uid) {
    const { grid, empty, gridWrap } = getItemElements();
    if (!grid || !empty || !gridWrap) return;

    try {
      const snap = await db.collection("users").doc(uid).collection("inventory").get();
      const items = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.category === "Special")
        .sort((a, b) => getPurchasedTimeMs(b) - getPurchasedTimeMs(a));

      renderItemInventory(items);
      await storageSet({
        [ITEM_INVENTORY_SNAPSHOT_KEY]: items.map((item) => toCachedItem(item)),
      });
    } finally {
      gridWrap.classList.remove("is-loading");
    }
  }

  function openItemModal(inventoryItem, catalogItem) {
    const {
      modalOverlay,
      modalTitle,
      modalImage,
      modalDescription,
      modalUse,
    } = getItemElements();

    if (
      !modalOverlay ||
      !modalTitle ||
      !modalImage ||
      !modalDescription ||
      !modalUse ||
      useInFlight ||
      document.body.classList.contains("item-sequence-active")
    ) {
      return;
    }

    selectedInventoryItem = inventoryItem;
    selectedCatalogItem = catalogItem;

    modalTitle.textContent = catalogItem.name;
    modalImage.src = catalogItem.image;
    modalImage.alt = catalogItem.name;
    modalDescription.textContent = catalogItem.description || catalogItem.flavorText || "";
    modalUse.disabled = !canUseSpecialItem(catalogItem) || useInFlight;

    modalOverlay.classList.remove("hidden");
  }

  function closeItemModal() {
    const { modalOverlay } = getItemElements();
    if (!modalOverlay) return;

    modalOverlay.classList.add("hidden");
    selectedInventoryItem = null;
    selectedCatalogItem = null;
    tonicSelection = [];
  }

  function hideItemModal() {
    const { modalOverlay } = getItemElements();
    if (!modalOverlay) return;
    modalOverlay.classList.add("hidden");
  }

  function closeTonicModal() {
    const { tonicOverlay } = getItemElements();
    if (!tonicOverlay) return;

    tonicOverlay.classList.add("hidden");
    tonicSelection = [];
  }

  function renderTonicSelection() {
    const { tonicPicks, tonicConfirm } = getItemElements();
    const targetCount = Number(selectedCatalogItem?.statPoints ?? 1);
    if (!tonicPicks || !tonicConfirm) return;

    tonicPicks.innerHTML = "";
    tonicSelection.forEach((statKey) => {
      const chip = document.createElement("span");
      chip.className = "item-tonic-pick";
      chip.textContent = POWER_TONIC_STAT_LABELS[statKey] || statKey;
      tonicPicks.appendChild(chip);
    });

    tonicConfirm.disabled = tonicSelection.length !== targetCount || useInFlight;
  }

  function openTonicModal() {
    const { tonicOverlay, tonicCopy, tonicGrid } = getItemElements();
    const targetCount = Number(selectedCatalogItem?.statPoints ?? 1);
    if (!tonicOverlay || !tonicCopy || !tonicGrid) return;

    tonicSelection = [];
    tonicCopy.textContent =
      targetCount === 1
        ? "Choose 1 stat to boost by 10."
        : `Choose ${targetCount} stat boosts of +10. You can pick the same stat more than once.`;

    tonicGrid.innerHTML = "";
    POWER_TONIC_STAT_KEYS.forEach((statKey) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "item-tonic-stat-btn";
      button.textContent = POWER_TONIC_STAT_LABELS[statKey] || statKey;
      button.addEventListener("click", () => {
        if (useInFlight || tonicSelection.length >= targetCount) return;
        tonicSelection.push(statKey);
        renderTonicSelection();
      });
      tonicGrid.appendChild(button);
    });

    renderTonicSelection();
    tonicOverlay.classList.remove("hidden");
  }

  function setupItemModal() {
    const {
      modalOverlay,
      modalClose,
      modalUse,
      tonicOverlay,
      tonicClose,
      tonicConfirm,
    } = getItemElements();
    if (!modalOverlay || !modalClose || !modalUse || !tonicOverlay || !tonicClose || !tonicConfirm) return;

    modalClose.addEventListener("click", closeItemModal);
    modalOverlay.addEventListener("click", (event) => {
      if (event.target === modalOverlay) {
        closeItemModal();
      }
    });
    modalUse.addEventListener("click", async () => {
      if (!selectedInventoryItem || !selectedCatalogItem || useInFlight) return;
      await useSelectedItem();
    });

    tonicClose.addEventListener("click", () => {
      closeTonicModal();
      closeItemModal();
    });
    tonicOverlay.addEventListener("click", (event) => {
      if (event.target === tonicOverlay) {
        closeTonicModal();
        closeItemModal();
      }
    });
    tonicConfirm.addEventListener("click", async () => {
      if (!selectedInventoryItem || !selectedCatalogItem || useInFlight) return;
      await useSelectedItem();
    });
  }

  function getSceneRectForTarget() {
    const { scene, petSprite, petEgg } = getSceneElements();
    if (!scene) return null;

    const target =
      getCurrentStage() === "egg" && petEgg && !petEgg.classList.contains("hidden")
        ? petEgg
        : petSprite;

    if (!target) return null;

    const sceneRect = scene.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    return {
      scene,
      targetRect: {
        left: targetRect.left - sceneRect.left,
        top: targetRect.top - sceneRect.top,
        width: targetRect.width,
        height: targetRect.height,
      },
    };
  }

  function clearSceneEffects() {
    sceneEffectEls.forEach((el) => el?.remove());
    sceneEffectEls = [];
  }

  function setItemSequenceActive(isActive) {
    document.body.classList.toggle("item-sequence-active", Boolean(isActive));
  }

  function registerEffectEl(el) {
    sceneEffectEls.push(el);
    return el;
  }

  async function playBoostEffect(boostTone = "boost-red", durationMs = EFFECT_DURATION_MS) {
    const rectData = getSceneRectForTarget();
    if (!rectData) return;

    clearSceneEffects();
    const { scene, targetRect } = rectData;

    const aura = registerEffectEl(document.createElement("div"));
    aura.className = `item-scene-effect item-boost-aura ${boostTone}`;
    aura.style.left = `${targetRect.left - targetRect.width * 0.04}px`;
    aura.style.top = `${targetRect.top - targetRect.height * 0.02}px`;
    aura.style.width = `${targetRect.width * 1.08}px`;
    aura.style.height = `${targetRect.height * 0.92}px`;
    scene.appendChild(aura);

    const overlay = registerEffectEl(document.createElement("div"));
    overlay.className = "item-scene-effect";
    const clusterWidth = targetRect.width * 0.82;
    overlay.style.left = `${targetRect.left + (targetRect.width - clusterWidth) / 2}px`;
    overlay.style.top = `${targetRect.top - 18}px`;
    overlay.style.width = `${clusterWidth}px`;
    overlay.style.height = `${targetRect.height + 28}px`;

    for (let index = 0; index < 14; index += 1) {
      const spike = document.createElement("span");
      spike.className = `item-boost-spike ${boostTone}`;
      spike.style.left = `${Math.random() * Math.max(8, clusterWidth - 4)}px`;
      spike.style.height = `${24 + Math.random() * 26}px`;
      spike.style.animationDelay = `${Math.random() * 120}ms`;
      spike.style.transform = `rotate(${(Math.random() - 0.5) * 18}deg)`;
      overlay.appendChild(spike);
      window.requestAnimationFrame(() => spike.classList.add("is-visible"));
    }

    scene.appendChild(overlay);
    window.requestAnimationFrame(() => aura.classList.add("is-visible"));
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    clearSceneEffects();
  }

  async function playFreezeEffect(durationMs = EFFECT_DURATION_MS) {
    const rectData = getSceneRectForTarget();
    if (!rectData) return;

    clearSceneEffects();
    const { petCard, scene, targetRect } = { ...getSceneElements(), ...rectData };
    const shell = registerEffectEl(document.createElement("div"));
    shell.className = "item-scene-effect item-freeze-shell";
    shell.style.left = "0px";
    shell.style.top = "0px";
    shell.style.width = petCard ? `${petCard.clientWidth}px` : `${scene.clientWidth}px`;
    shell.style.height = petCard ? `${petCard.clientHeight}px` : `${scene.clientHeight}px`;
    (petCard || scene).appendChild(shell);

    const shardPositions = [
      [24, 22, -24, -18, -26],
      [scene.clientWidth * 0.28, 14, -10, -30, -12],
      [scene.clientWidth * 0.68, 12, 12, -28, 14],
      [scene.clientWidth - 24, 20, 24, -12, 24],
      [18, scene.clientHeight - 22, -22, 20, -18],
      [scene.clientWidth * 0.54, scene.clientHeight - 12, 8, 26, 16],
      [scene.clientWidth - 26, scene.clientHeight - 24, 24, 18, 28],
      [scene.clientWidth * 0.48, scene.clientHeight * 0.48, 0, -36, 36],
      [scene.clientWidth * 0.18, scene.clientHeight * 0.28, -30, -16, -32],
      [scene.clientWidth * 0.82, scene.clientHeight * 0.26, 28, -20, 34],
      [scene.clientWidth * 0.22, scene.clientHeight * 0.72, -26, 24, -24],
      [scene.clientWidth * 0.78, scene.clientHeight * 0.7, 30, 22, 30],
    ];

    shardPositions.forEach(([left, top, dx, dy, rot], index) => {
      const shard = registerEffectEl(document.createElement("span"));
      shard.className = "item-scene-effect item-freeze-shard";
      shard.style.left = `${left}px`;
      shard.style.top = `${top}px`;
      shard.style.setProperty("--shard-dx", `${dx}px`);
      shard.style.setProperty("--shard-dy", `${dy}px`);
      shard.style.setProperty("--shard-rot", `${rot}deg`);
      shard.style.animationDelay = `${120 + index * 18}ms`;
      scene.appendChild(shard);
      window.requestAnimationFrame(() => shard.classList.add("is-visible"));
    });

    window.requestAnimationFrame(() => shell.classList.add("is-visible"));
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    clearSceneEffects();
  }

  async function playAgeEffect(durationMs = EFFECT_DURATION_MS) {
    const rectData = getSceneRectForTarget();
    if (!rectData) return;

    clearSceneEffects();
    const { scene, targetRect } = rectData;
    const glow = registerEffectEl(document.createElement("div"));
    glow.className = "item-scene-effect item-age-glow";
    glow.style.left = `${targetRect.left + targetRect.width * 0.02}px`;
    glow.style.top = `${targetRect.top + targetRect.height * 0.14}px`;
    glow.style.width = `${targetRect.width * 0.96}px`;
    glow.style.height = `${targetRect.height * 1.08}px`;
    scene.appendChild(glow);

    for (let index = 0; index < 12; index += 1) {
      const spark = registerEffectEl(document.createElement("span"));
      spark.className = "item-scene-effect item-age-spark";
      spark.style.left = `${targetRect.left + 12 + Math.random() * Math.max(16, targetRect.width - 24)}px`;
      spark.style.top = `${targetRect.top + targetRect.height * 0.6 + Math.random() * 24}px`;
      spark.style.animationDelay = `${index * 70}ms`;
      scene.appendChild(spark);
      window.requestAnimationFrame(() => spark.classList.add("is-visible"));
    }

    window.requestAnimationFrame(() => glow.classList.add("is-visible"));
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    clearSceneEffects();
  }

  async function playReviveEffect(durationMs = EFFECT_DURATION_MS) {
    const rectData = getSceneRectForTarget();
    if (!rectData) return;

    clearSceneEffects();
    const { scene, targetRect } = rectData;
    const glow = registerEffectEl(document.createElement("div"));
    glow.className = "item-scene-effect item-revive-glow";
    glow.style.left = `${targetRect.left + targetRect.width * 0.08}px`;
    glow.style.top = `${targetRect.top + targetRect.height * 0.06}px`;
    glow.style.width = `${targetRect.width * 0.84}px`;
    glow.style.height = `${targetRect.height * 0.84}px`;
    scene.appendChild(glow);

    for (let index = 0; index < 14; index += 1) {
      const spark = registerEffectEl(document.createElement("span"));
      spark.className = "item-scene-effect item-revive-spark";
      spark.style.left = `${targetRect.left + 8 + Math.random() * Math.max(16, targetRect.width - 16)}px`;
      spark.style.top = `${targetRect.top + targetRect.height * 0.44 + Math.random() * 12}px`;
      spark.style.animationDelay = `${index * 55}ms`;
      scene.appendChild(spark);
      window.requestAnimationFrame(() => spark.classList.add("is-visible"));
    }

    window.requestAnimationFrame(() => glow.classList.add("is-visible"));
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    clearSceneEffects();
  }

  function getTomorrowLosAngelesDateString(durationDays = 1) {
    const date = new Date();
    date.setDate(date.getDate() + durationDays);
    return date.toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
  }

  function consumeInventoryEntry(tx, inventoryRef, inventorySnap) {
    if (!inventorySnap.exists) {
      throw new Error("Item is no longer in inventory");
    }

    const currentQuantity = Number(inventorySnap.data()?.quantity ?? 0);
    if (currentQuantity <= 0) {
      throw new Error("Item is out of stock");
    }

    const nextQuantity = currentQuantity - 1;
    if (nextQuantity > 0) {
      tx.set(
        inventoryRef,
        {
          quantity: nextQuantity,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      tx.delete(inventoryRef);
    }
  }

  async function applyPowerTonic(inventoryItem, selectedStats) {
    const statBoosts = Array.isArray(selectedStats) ? selectedStats.filter(Boolean) : [];
    if (!statBoosts.length) {
      throw new Error("No stat boosts selected");
    }
    const boostTone = inventoryItem?.id === "spec-tonicpotion2" ? "boost-purple" : "boost-red";
    const effectPromise = playBoostEffect(boostTone);

    const userRef = activeDb.collection("users").doc(activeUid);
    const userSnap = await userRef.get();
    const activePetId = userSnap.data()?.activePetId;
    if (!activePetId) {
      throw new Error("No active pet selected");
    }

    const petRef = userRef.collection("pets").doc(activePetId);
    const inventoryRef = userRef.collection("inventory").doc(inventoryItem.id);

    await activeDb.runTransaction(async (tx) => {
      const [petSnap, inventorySnap] = await Promise.all([
        tx.get(petRef),
        tx.get(inventoryRef),
      ]);

      if (!petSnap.exists) {
        throw new Error("Active pet not found");
      }

      consumeInventoryEntry(tx, inventoryRef, inventorySnap);

      const petData = petSnap.data() || {};
      const nextStats = { ...(petData.stats || {}) };
      statBoosts.forEach((key) => {
        const currentValue = Number(nextStats[key] ?? 0);
        nextStats[key] = currentValue + 10;
      });

      tx.set(
        petRef,
        {
          stats: nextStats,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await effectPromise;
    await loadItemInventory(activeDb, activeUid);
    await loadActivePetFromFirestore(activeDb, activeUid);
    await refreshCurrentPetSnapshot();
  }

  async function applyStreakFreeze(inventoryItem) {
    const userRef = activeDb.collection("users").doc(activeUid);
    const inventoryRef = userRef.collection("inventory").doc(inventoryItem.id);
    const freezeEnd = getTomorrowLosAngelesDateString(1);
    const effectPromise = playFreezeEffect();

    await activeDb.runTransaction(async (tx) => {
      const inventorySnap = await tx.get(inventoryRef);
      consumeInventoryEntry(tx, inventoryRef, inventorySnap);

      tx.set(
        userRef,
        {
          streakFreezeEnd: freezeEnd,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await effectPromise;
    await storageSet({ leetmate_streak_freeze_end: freezeEnd });
    await loadItemInventory(activeDb, activeUid);
  }

  async function applyAgeUp(inventoryItem, catalogItem) {
    const ageIncrease = Number(catalogItem.ageIncrease ?? 1);
    const userRef = activeDb.collection("users").doc(activeUid);
    const userSnap = await userRef.get();
    const activePetId = userSnap.data()?.activePetId;
    if (!activePetId) {
      throw new Error("No active pet selected");
    }

    const petRef = userRef.collection("pets").doc(activePetId);
    const inventoryRef = userRef.collection("inventory").doc(inventoryItem.id);

    const evolutionResult = await activeDb.runTransaction(async (tx) => {
      const [petSnap, inventorySnap] = await Promise.all([
        tx.get(petRef),
        tx.get(inventoryRef),
      ]);

      if (!petSnap.exists) {
        throw new Error("Active pet not found");
      }

      consumeInventoryEntry(tx, inventoryRef, inventorySnap);

      const petData = petSnap.data() || {};
      const currentAge = Number(petData.age ?? 0);
      const fromStage = petData.stage ?? null;
      const agedPet = window.LeetmatePetEvolution?.evolvePetStage
        ? window.LeetmatePetEvolution.evolvePetStage({
            ...petData,
            age: currentAge + ageIncrease,
          })
        : { ...petData, age: currentAge + ageIncrease };

      tx.set(
        petRef,
        {
          age: currentAge + ageIncrease,
          stage: agedPet.stage ?? petData.stage,
          ableToBattle:
            typeof agedPet.ableToBattle === "boolean"
              ? agedPet.ableToBattle
              : String(agedPet.stage || petData.stage || "").toLowerCase() === "adult",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        didEvolve:
          String(fromStage || "").toLowerCase() !==
          String(agedPet.stage || fromStage || "").toLowerCase(),
        payload: {
          petId: activePetId,
          petRef: petData.petRef || null,
          customName: petData.customName || "",
          fromStage,
          toStage: agedPet.stage ?? fromStage,
          at: Date.now(),
        },
      };
    });

    if (evolutionResult?.didEvolve && evolutionResult.payload.fromStage && evolutionResult.payload.toStage) {
      await loadItemInventory(activeDb, activeUid);
      await loadActivePetFromFirestore(activeDb, activeUid);
      await refreshCurrentPetSnapshot();
      try {
        sessionStorage.setItem(
          "leetmate_evolution_payload",
          JSON.stringify(evolutionResult.payload)
        );
      } catch (_) {}

      const evolutionUrl =
        typeof chrome !== "undefined" && chrome.runtime?.getURL
          ? chrome.runtime.getURL("screens/evolution/index.html")
          : "../evolution/index.html";
      window.location.replace(evolutionUrl);
      return;
    }

    await playAgeEffect();
    await loadItemInventory(activeDb, activeUid);
    await loadActivePetFromFirestore(activeDb, activeUid);
    await refreshCurrentPetSnapshot();
  }

  async function applyRevive(inventoryItem, catalogItem) {
    const reviveAmount = Number(catalogItem.reviveAmount ?? REVIVE_AMOUNT);
    const userRef = activeDb.collection("users").doc(activeUid);
    const inventoryRef = userRef.collection("inventory").doc(inventoryItem.id);
    const nowMs = Date.now();
    const effectPromise = playReviveEffect();

    await activeDb.runTransaction(async (tx) => {
      const inventorySnap = await tx.get(inventoryRef);
      consumeInventoryEntry(tx, inventoryRef, inventorySnap);

      tx.set(
        userRef,
        {
          happiness: reviveAmount,
          lastFedTime: new Date(nowMs),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await effectPromise;
    await storageSet({
      leetmate_happiness: reviveAmount,
      leetmate_last_fed: nowMs,
    });
    await updateHeartsUI();
    await loadItemInventory(activeDb, activeUid);
  }

  async function useSelectedItem() {
    if (!selectedInventoryItem || !selectedCatalogItem || !activeDb || !activeUid) return;
    if (!canUseSpecialItem(selectedCatalogItem)) return;
    const inventoryItem = selectedInventoryItem;
    const catalogItem = selectedCatalogItem;

    if (catalogItem.effect === "power-tonic" && tonicSelection.length === 0) {
      hideItemModal();
      openTonicModal();
      return;
    }

    const { modalUse, tonicConfirm } = getItemElements();
    useInFlight = true;
    setItemSequenceActive(true);
    if (modalUse) {
      modalUse.disabled = true;
      modalUse.textContent = "Using...";
    }
    if (tonicConfirm) {
      tonicConfirm.disabled = true;
      tonicConfirm.textContent = "Using...";
    }

    try {
      switch (catalogItem.effect) {
        case "power-tonic": {
          const targetCount = Number(catalogItem.statPoints ?? 1);
          if (tonicSelection.length !== targetCount) {
            throw new Error("Stat selection is incomplete");
          }
          const selectedStats = tonicSelection.slice();
          closeTonicModal();
          closeItemModal();
          await applyPowerTonic(inventoryItem, selectedStats);
          break;
        }
        case "streak-freeze":
          closeItemModal();
          await applyStreakFreeze(inventoryItem);
          break;
        case "age-up":
          closeItemModal();
          await applyAgeUp(inventoryItem, catalogItem);
          break;
        case "revive":
          closeItemModal();
          await applyRevive(inventoryItem, catalogItem);
          break;
        default:
          throw new Error("Unsupported item effect");
      }
    } catch (error) {
      console.error("Failed to use special item:", error);
      await loadItemInventory(activeDb, activeUid).catch(() => {});
    } finally {
      useInFlight = false;
      setItemSequenceActive(false);
      if (modalUse) {
        modalUse.disabled = false;
        modalUse.textContent = "Use";
      }
      if (tonicConfirm) {
        tonicConfirm.disabled = tonicSelection.length !== Number(selectedCatalogItem?.statPoints ?? 1);
        tonicConfirm.textContent = "Confirm";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("item-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "../playground-main/index.html";
      });
    }

    setupRenameModal();
    setupItemModal();
    renderCachedItemInventory().catch((error) => {
      console.warn("Item page could not load cached inventory:", error);
    });

    window.LeetmatePetUI.loadActivePetFromStorage().then(refreshCurrentPetSnapshot).catch((error) => {
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
        await refreshCurrentPetSnapshot();
        refreshRenderedItemSlotStates();
        await startHappinessDecayTimer();
      } catch (error) {
        console.error("Item page failed to load:", error);
      }
    });

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== "local") return;
        if (!changes.activePetSnapshot && !changes.leetmate_happiness) return;
        await refreshCurrentPetSnapshot().catch(() => {});
        refreshRenderedItemSlotStates();
      });
    }
  });
})();
