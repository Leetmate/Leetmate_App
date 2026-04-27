(function () {
  "use strict";

  // Local cache keys that need to stay in sync with feeding updates.
  const LAST_FED_KEY = "leetmate_last_fed";
  const HAPPINESS_STORAGE_KEY = "leetmate_happiness";
  const EASY_MODE_KEY = "leetmate_easy_mode";
  const EASY_HAPPINESS_SNAPSHOT_KEY = "leetmate_happiness_easy_snapshot";

  // Interaction / animation tuning.
  const DRAG_THRESHOLD_PX = 10;
  const FOOD_VISIBLE_MS = 2000;
  const FOOD_FLOOR_TOP = 136;
  const HAPPY_HEART_COUNT = 3;
  const HAPPY_HEART_STAGGER_MS = 160;
  const PET_TRAVEL_MS_PER_PX = 10;
  const FAVORITE_FOOD_BONUS = 10;
  const FAVORITE_FOOD_BY_PET = {
    fox: "food-bacon",
    cat: "food-fish",
    bat: "food-honey",
  };

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  function getTimestampMs(value) {
    if (typeof value?.toMillis === "function") {
      return value.toMillis();
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function createController(options) {
    const {
      getDb,
      getUid,
      getPetSnapshot,
      setStatusText,
      reloadInventory,
    } = options;

    // Controller-local scene state. Only one feeding sequence should exist at a time.
    let dragState = null;
    let sceneFoodEl = null;
    let sceneAuraEl = null;
    let scenePowderEls = [];
    let sequenceActive = false;
    const heartIconSrc =
      typeof chrome?.runtime?.getURL === "function"
        ? chrome.runtime.getURL("assets/icons/heart.png")
        : "../../assets/icons/heart.png";

    // Core scene / pet elements used by the feeding interactions.
    function getEls() {
      return {
        petCard: document.querySelector(".playground-pet-card"),
        scene: document.querySelector(".playground-scene"),
        hero: document.querySelector(".home-hero"),
        petSprite: document.getElementById("active-pet"),
        petEgg: document.getElementById("active-pet-egg"),
      };
    }

    function getCurrentStage() {
      return String(getPetSnapshot()?.stage || "").toLowerCase();
    }

    function getCurrentPetRef() {
      return String(getPetSnapshot()?.petRef || "").toLowerCase();
    }

    function isFavoriteFood(catalogItem) {
      const petRef = getCurrentPetRef();
      if (!petRef || !catalogItem?.id) return false;
      return FAVORITE_FOOD_BY_PET[petRef] === catalogItem.id;
    }

    function getPetCreatedTimeMs() {
      return getTimestampMs(getPetSnapshot()?.createdTimestampMs);
    }

    function getCurrentHappinessPercent() {
      const happiness = window.LeetmatePetUI?.getPetHappinessState?.();
      return Number.isFinite(happiness) ? happiness : 100;
    }

    // Move the active pet by updating the CSS variables the shared Playground
    // sprite styles already use.
    function setPetOffset(x, y = 0) {
      const { petSprite } = getEls();
      if (!petSprite) return;
      petSprite.style.setProperty("--pet-follow-x", `${x}px`);
      petSprite.style.setProperty("--pet-follow-y", `${y}px`);
    }

    // PiP-style facing: rightward travel flips the sprite, leftward travel resets it.
    function setPetFacing(directionX) {
      const { petSprite } = getEls();
      if (!petSprite) return;
      const facingX = directionX > 0 ? -1 : 1;
      petSprite.style.setProperty("--pet-facing-x", String(facingX));
    }

    // Constant horizontal velocity: farther distances simply take proportionally longer.
    function getTravelDurationMs(distancePx) {
      return Math.abs(distancePx) * PET_TRAVEL_MS_PER_PX;
    }

    // Hard reset of all temporary pet animation state.
    function resetPetPose() {
      const { hero, petSprite } = getEls();
      if (!petSprite || !hero) return;
      petSprite.classList.remove("is-walking", "is-happy");
      hero.classList.remove("is-happy-jump");
      petSprite.style.transition = "";
      petSprite.style.removeProperty("--pet-facing-x");
      setPetOffset(0, 0);
    }

    // Remove the floating drag image and clear the active drag session.
    function clearDragGhost() {
      if (!dragState) return;
      dragState.button.classList.remove("is-dragging");
      if (dragState.ghost?.isConnected) {
        dragState.ghost.remove();
      }
      dragState = null;
    }

    // Update the visible inventory slot immediately so feeding feels responsive.
    function applyOptimisticInventoryUpdate(button, inventoryItem) {
      if (!button || !inventoryItem) return false;

      const currentQuantity = Number(inventoryItem.quantity ?? 0);
      if (currentQuantity <= 0) return false;

      const nextQuantity = currentQuantity - 1;
      inventoryItem.quantity = nextQuantity;

      const countEl = button.querySelector(".food-slot-count");
      if (nextQuantity <= 0) {
        button.remove();
        return true;
      }

      if (nextQuantity === 1) {
        countEl?.remove();
        return true;
      }

      if (countEl) {
        countEl.textContent = String(nextQuantity);
      }

      return true;
    }

    // Clear the normal food sprite from the scene.
    function removeSceneFood() {
      if (sceneFoodEl?.isConnected) {
        sceneFoodEl.remove();
      }
      sceneFoodEl = null;
    }

    // Clear the egg-only warming effects.
    function removeEggWarmingScene() {
      if (sceneAuraEl?.isConnected) {
        sceneAuraEl.remove();
      }
      scenePowderEls.forEach((el) => el?.isConnected && el.remove());
      sceneAuraEl = null;
      scenePowderEls = [];
    }

    // Let the aura / powder fade out before doing the hard cleanup.
    async function fadeOutEggWarmingScene() {
      if (sceneAuraEl) {
        sceneAuraEl.classList.remove("is-visible");
      }
      scenePowderEls.forEach((el) => el.classList.remove("is-visible"));

      await wait(220);
      removeEggWarmingScene();
    }

    // Floating hearts are spawned as temporary DOM nodes above the pet.
    function spawnHappyHeart(index) {
      const { scene } = getEls();
      const petRect = getPetRectInScene();
      if (!scene || !petRect) return;

      const heart = document.createElement("img");
      const driftX = (index - 1) * 14;
      const startX = petRect.left + petRect.width * 0.5 - 14 + driftX;
      const startY = petRect.top + Math.max(8, petRect.height * 0.2);

      heart.className = "food-happy-heart";
      heart.src = heartIconSrc;
      heart.alt = "";
      heart.style.left = `${startX}px`;
      heart.style.top = `${startY}px`;
      heart.style.setProperty("--heart-drift-x", `${driftX}px`);
      scene.appendChild(heart);

      window.setTimeout(() => heart.remove(), 1100);
    }

    // The drag ghost is a separate image attached to <body>, not the inventory slot itself.
    function createDragGhost(imageSrc) {
      const ghost = document.createElement("img");
      ghost.className = "food-drag-ghost";
      ghost.src = imageSrc;
      ghost.alt = "";
      document.body.appendChild(ghost);
      return ghost;
    }

    // Keep the ghost centered under the pointer while dragging.
    function positionDragGhost(ghost, x, y) {
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y}px`;
    }

    // Convert the active pet's screen-space box into coordinates local to the scene.
    function getPetRectInScene() {
      const { scene, petSprite, petEgg } = getEls();
      if (!scene) return null;

      const target = getCurrentStage() === "egg" && petEgg && !petEgg.classList.contains("hidden")
        ? petEgg
        : petSprite;

      if (!target) return null;

      const sceneRect = scene.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      return {
        left: targetRect.left - sceneRect.left,
        right: targetRect.right - sceneRect.left,
        top: targetRect.top - sceneRect.top,
        bottom: targetRect.bottom - sceneRect.top,
        width: targetRect.width,
        height: targetRect.height,
      };
    }

    function getFoodFloorTop() {
      return FOOD_FLOOR_TOP;
    }

    // Clamp horizontal placement so the food never hangs outside the pet display.
    function clampFoodX(left) {
      const { scene } = getEls();
      if (!scene) return left;
      return Math.max(8, Math.min(scene.clientWidth - 52, left));
    }

    // Convert a pointer release position into the local x-position for the dropped food.
    function getDropLeft(pointerX) {
      const { scene } = getEls();
      if (!scene) return 8;
      const sceneRect = scene.getBoundingClientRect();
      return clampFoodX(pointerX - sceneRect.left - 22);
    }

    // Plain clicks spawn the food near the pet's mouth instead of at the pointer.
    function getDefaultSpawnLeft() {
      const { scene } = getEls();
      const petRect = getPetRectInScene();
      if (!scene || !petRect) return 8;

      const preferred = petRect.left + petRect.width * 0.34;
      return clampFoodX(preferred);
    }

    async function spawnSceneFood(imageSrc, left, shouldDrop) {
      const { scene } = getEls();
      if (!scene) return null;

      removeSceneFood();

      const sceneFood = document.createElement("img");
      sceneFood.className = "food-scene-item";
      sceneFood.src = imageSrc;
      sceneFood.alt = "";
      sceneFood.style.left = `${clampFoodX(left)}px`;

      const floorTop = getFoodFloorTop();
      if (shouldDrop) {
        sceneFood.style.top = "22px";
      } else {
        sceneFood.style.top = `${floorTop}px`;
      }

      scene.appendChild(sceneFood);
      sceneFoodEl = sceneFood;

      if (shouldDrop) {
        await new Promise((resolve) => {
          const onEnd = () => {
            sceneFood.removeEventListener("transitionend", onEnd);
            resolve();
          };

          sceneFood.addEventListener("transitionend", onEnd);
          window.requestAnimationFrame(() => {
            // Start the CSS transition on the next frame so the browser sees
            // a real "from" position before we move the item to the floor.
            sceneFood.classList.add("is-dropping");
            sceneFood.style.top = `${floorTop}px`;
          });
        });
      }

      return sceneFood;
    }

    async function spawnEggPowderScene() {
      const { scene } = getEls();
      const petRect = getPetRectInScene();
      if (!scene || !petRect) return null;

      // Always start from a clean state so multiple egg effects never stack.
      removeSceneFood();
      removeEggWarmingScene();

      const aura = document.createElement("div");
      aura.className = "egg-warming-aura";
      aura.style.left = "50%";
      aura.style.top = "50%";
      scene.appendChild(aura);
      sceneAuraEl = aura;

      const powderStartX = petRect.left + petRect.width * 0.5;
      const powderEndY = petRect.top + petRect.height * 0.48;

      // Build a fixed number of particles up front so the effect reads as a
      // short shower rather than a continuous emitter.
      scenePowderEls = Array.from({ length: 16 }, (_, index) => {
        const particle = document.createElement("span");
        const drift = (Math.random() * 34) - 17;
        const delay = index * 45;
        const size = 8 + Math.random() * 8;
        const startTop = petRect.top - 16 - Math.random() * 28;
        const deltaY = powderEndY - startTop;

        particle.className = "egg-warming-powder";
        particle.style.left = `${powderStartX + drift}px`;
        particle.style.top = `${startTop}px`;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.setProperty("--powder-drift-x", `${drift * 0.6}px`);
        particle.style.setProperty("--powder-drift-y", `${deltaY}px`);
        particle.style.animationDelay = `${delay}ms`;
        scene.appendChild(particle);
        return particle;
      });

      window.requestAnimationFrame(() => {
        aura.classList.add("is-visible");
        scenePowderEls.forEach((el) => el.classList.add("is-visible"));
      });

      return aura;
    }

    async function walkPetToFood(foodEl) {
      const { scene, petSprite } = getEls();
      if (!scene || !petSprite || !foodEl) return;

      const sceneRect = scene.getBoundingClientRect();
      const petRect = petSprite.getBoundingClientRect();
      const foodRect = foodEl.getBoundingClientRect();
      const currentCenterX = petRect.left - sceneRect.left + petRect.width / 2;
      const targetCenterX = foodRect.left - sceneRect.left + foodRect.width / 2;
      const nextOffsetX = Math.max(-90, Math.min(90, targetCenterX - currentCenterX));
      const durationMs = getTravelDurationMs(nextOffsetX);

      // Facing is based on direction of travel, then the translation animates separately.
      petSprite.classList.add("is-walking");
      setPetFacing(nextOffsetX);
      petSprite.style.transition = `translate ${durationMs}ms linear`;
      // Force the browser to commit the starting pose before we move the pet.
      petSprite.getBoundingClientRect();
      setPetOffset(nextOffsetX, 0);

      await wait(durationMs + 20);

      petSprite.style.transition = "";
      petSprite.classList.remove("is-walking");
    }

    async function walkPetHome() {
      const { petSprite } = getEls();
      if (!petSprite) return;

      const currentOffset = parseFloat(
        getComputedStyle(petSprite).getPropertyValue("--pet-follow-x")
      ) || 0;

      const durationMs = getTravelDurationMs(currentOffset);
      petSprite.classList.add("is-walking");
      setPetFacing(-currentOffset);
      petSprite.style.transition = `translate ${durationMs}ms linear`;
      // Same forced layout as walk-to-food so the first return animation does not collapse.
      petSprite.getBoundingClientRect();
      setPetOffset(0, 0);

      await wait(durationMs + 20);

      petSprite.style.transition = "";
      petSprite.classList.remove("is-walking");
    }

    // The jump itself is CSS-driven; JS only toggles classes and times the hearts.
    async function playHappyReaction({ showHearts = true, showJump = true } = {}) {
      const { hero, petSprite } = getEls();
      if (!hero || !petSprite) return;

      // Removing then re-adding the classes guarantees the keyframe restarts cleanly.
      hero.classList.remove("is-happy-jump");
      petSprite.classList.remove("is-happy");
      void hero.offsetWidth;
      await nextFrame();

      if (showJump) {
        hero.classList.add("is-happy-jump");
      }
      petSprite.classList.add("is-happy");
      if (showHearts) {
        for (let index = 0; index < HAPPY_HEART_COUNT; index += 1) {
          window.setTimeout(() => spawnHappyHeart(index), index * HAPPY_HEART_STAGGER_MS);
        }
      }
      await wait(1000);
      hero.classList.remove("is-happy-jump");
      petSprite.classList.remove("is-happy");
    }

    // Firestore transaction: inventory decrement and happiness update must commit together.
    async function consumeFood(inventoryItem, catalogItem) {
      const db = getDb();
      const uid = getUid();
      if (!db || !uid) return false;

      const baseRecoveryAmount = Number(
        inventoryItem.recoveryAmount ?? catalogItem.recoveryAmount ?? 0
      );
      const recoveryAmount = baseRecoveryAmount + (isFavoriteFood(catalogItem) ? FAVORITE_FOOD_BONUS : 0);
      if (recoveryAmount <= 0) return false;

      const decayApi = window.LeetmateHappinessDecay;
      if (!decayApi) {
        throw new Error("Happiness decay helpers are unavailable");
      }

      const userRef = db.collection("users").doc(uid);
      const inventoryRef = userRef.collection("inventory").doc(inventoryItem.id);
      const nowMs = Date.now();

      const result = await db.runTransaction(async (tx) => {
        const [userSnap, inventorySnap] = await Promise.all([
          tx.get(userRef),
          tx.get(inventoryRef),
        ]);

        if (!inventorySnap.exists) {
          throw new Error("Food item is no longer in inventory");
        }

        const currentQuantity = Number(inventorySnap.data()?.quantity ?? 0);
        if (currentQuantity <= 0) {
          throw new Error("Food item is out of stock");
        }

        const userData = userSnap.data() || {};
        const lastFedTimeMs = getTimestampMs(userData.lastFedTime);
        const currentHappiness = decayApi.calculateDisplayHappiness(
          userData.happiness ?? 100,
          lastFedTimeMs,
          nowMs,
          getPetCreatedTimeMs()
        );
        const nextHappiness = Math.min(100, currentHappiness + recoveryAmount);
        const nextLastFedTimeMs = nowMs;
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

        tx.set(
          userRef,
          {
            happiness: nextHappiness,
            lastFedTime: new Date(nextLastFedTimeMs),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          nextHappiness,
          nextLastFedTimeMs,
        };
      });

      // Keep local caches aligned with the transaction result so the UI updates
      // immediately instead of waiting for another Firestore read.
      const storagePayload = {
        [LAST_FED_KEY]: result.nextLastFedTimeMs,
        [HAPPINESS_STORAGE_KEY]: result.nextHappiness,
      };

      const { [EASY_MODE_KEY]: easyModeEnabled } = await storageGet([EASY_MODE_KEY]);
      if (easyModeEnabled) {
        storagePayload[EASY_HAPPINESS_SNAPSHOT_KEY] = result.nextHappiness;
      }

      await storageSet(storagePayload);
      await updateHeartsUI();
      return true;
    }

    // Normal foods default to baby/adult only. Special items can override that with usableStages.
    function canUseItem(catalogItem) {
      const stage = getCurrentStage();
      if (!stage) {
        return false;
      }

      if (getCurrentHappinessPercent() <= 0) {
        return false;
      }

      if (catalogItem?.id === "food-magicpowder") {
        return stage === "egg";
      }

      return stage !== "egg";
    }

    function syncFoodSlotState(button, catalogItem) {
      const usable = canUseItem(catalogItem);
      button.classList.toggle("is-unusable", !usable);
      button.disabled = !usable;
      button.setAttribute("aria-disabled", usable ? "false" : "true");
      return usable;
    }

    // Full feeding flow:
    // 1. lock interaction
    // 2. spawn the scene effect
    // 3. kick off the backend consume work
    // 4. run pet animation
    // 5. clean up / unlock
    async function runFeedingSequence(
      inventoryItem,
      catalogItem,
      spawnLeft,
      shouldDrop,
      sourceButton
    ) {
      if (sequenceActive) return;
      sequenceActive = true;
      document.body.classList.add("food-sequence-active");

      try {
        const imageSrc = catalogItem.image;
        const usable = canUseItem(catalogItem);
        const feedable = usable;
        const isEggPowder = catalogItem.sceneType === "egg-powder";
        const favoriteFood = isFavoriteFood(catalogItem);
        const shouldWalkToFood = feedable && shouldDrop && !isEggPowder;
        const shouldJumpAtFood = feedable && !isEggPowder;

        if (!usable) {
          return;
        }

        if (feedable) {
          applyOptimisticInventoryUpdate(sourceButton, inventoryItem);
        }

        const sceneFood = isEggPowder
          ? await spawnEggPowderScene()
          : await spawnSceneFood(imageSrc, spawnLeft, shouldDrop);
        if (!sceneFood) return;

        // Start the backend update immediately, but do not block the walk/jump animation on it.
        const consumePromise = feedable
          ? consumeFood(inventoryItem, catalogItem)
          : Promise.resolve(true);

        if (shouldWalkToFood) {
          await walkPetToFood(sceneFood);
        }

        if (shouldJumpAtFood) {
          await playHappyReaction({
            showHearts: true,
            showJump: favoriteFood,
          });
        }

        if (feedable) {
          const consumed = await consumePromise;
          if (!consumed) {
            await reloadInventory();
            await wait(180);
            removeSceneFood();
            resetPetPose();
            return;
          }

          await reloadInventory();
        }

        if (isEggPowder) {
          await wait(FOOD_VISIBLE_MS);
          await fadeOutEggWarmingScene();
        } else {
          removeSceneFood();
        }

        if (shouldWalkToFood) {
          await walkPetHome();
        }

        resetPetPose();
      } finally {
        sequenceActive = false;
        document.body.classList.remove("food-sequence-active");
      }
    }

    function pointerIsInsidePetDisplay(pointerX, pointerY) {
      const { petCard } = getEls();
      if (!petCard) return false;
      const rect = petCard.getBoundingClientRect();
      return pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    }

    // Decide whether the interaction was a click or a real drag/drop when the pointer is released.
    async function handlePointerUp(event) {
      if (!dragState) return;

      const wasDragging = dragState.isDragging;
      const { inventoryItem, catalogItem, button } = dragState;

      clearDragGhost();
      setStatusText();

      if (!wasDragging) {
        await runFeedingSequence(
          inventoryItem,
          catalogItem,
          getDefaultSpawnLeft(),
          false,
          button
        );
        return;
      }

      if (!pointerIsInsidePetDisplay(event.clientX, event.clientY)) {
        return;
      }

      await runFeedingSequence(
        inventoryItem,
        catalogItem,
        getDropLeft(event.clientX),
        true,
        button
      );
    }

    // Drag starts only after the pointer has moved far enough from the initial press.
    function handlePointerMove(event) {
      if (!dragState) return;

      const distance = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY
      );

      if (!dragState.isDragging && distance >= DRAG_THRESHOLD_PX) {
        dragState.isDragging = true;
        dragState.ghost = createDragGhost(dragState.imageSrc);
        dragState.button.classList.add("is-dragging");
      }

      if (!dragState.isDragging) return;
      positionDragGhost(dragState.ghost, event.clientX, event.clientY);
    }

    // The page renders the button; this method adds the Food-page-specific interaction behavior.
    function attachFoodSlot(button, inventoryItem, catalogItem) {
      const recovery = Number(
        inventoryItem.recoveryAmount ?? catalogItem.recoveryAmount ?? 0
      );
      const hoverText =
        catalogItem.statusText || (recovery > 0 ? `+${recovery} Health` : "Food");

      syncFoodSlotState(button, catalogItem);

      button.addEventListener("mouseenter", () => {
        if (!syncFoodSlotState(button, catalogItem)) {
          setStatusText();
          return;
        }
        setStatusText(hoverText);
      });
      button.addEventListener("mouseleave", () => {
        if (!dragState) setStatusText();
      });
      button.addEventListener("focus", () => {
        if (!syncFoodSlotState(button, catalogItem)) {
          setStatusText();
          return;
        }
        setStatusText(hoverText);
      });
      button.addEventListener("blur", () => {
        if (!dragState) setStatusText();
      });

      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || sequenceActive) return;
        if (!syncFoodSlotState(button, catalogItem)) return;
        event.preventDefault();

        clearDragGhost();

        dragState = {
          startX: event.clientX,
          startY: event.clientY,
          isDragging: false,
          imageSrc: catalogItem.image,
          inventoryItem,
          catalogItem,
          button,
          ghost: null,
        };

        button.classList.add("is-dragging");
        button.setPointerCapture(event.pointerId);
      });

      button.addEventListener("pointermove", handlePointerMove);
      button.addEventListener("pointerup", handlePointerUp);
      button.addEventListener("pointercancel", () => {
        clearDragGhost();
        setStatusText();
      });
    }

    return {
      attachFoodSlot,
      syncFoodSlotState,
      resetPetPose,
    };
  }

  window.FeedingLogic = {
    createController,
  };
})();
