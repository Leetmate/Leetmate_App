(function () {
  "use strict";

  const PET_ASSETS = {
    Bat: {
      egg: "../../assets/eggs/CubicBatEgg.png",
      baby: "../../assets/spritesheets/CubicBatBaby.png",
      adult: "../../assets/spritesheets/CubicBatAdult.png",
      defaultName: "Cubic Bat"
    },
    Cat: {
      egg: "../../assets/eggs/CubicCatEgg.png",
      baby: "../../assets/spritesheets/CubicCatBaby.png",
      adult: "../../assets/spritesheets/CubicCatAdult.png",
      defaultName: "Cubic Cat"
    },
    Fish: {
      egg: "../../assets/eggs/CubicFishEgg.png",
      baby: "../../assets/spritesheets/CubicFishBaby.png",
      adult: "../../assets/spritesheets/CubicFishAdult.png",
      defaultName: "Cubic Fish"
    },
    Fox: {
      egg: "../../assets/eggs/CubicFoxEgg.png",
      baby: "../../assets/spritesheets/CubicFoxBaby.png",
      adult: "../../assets/spritesheets/CubicFoxAdult.png",
      defaultName: "Cubic Fox"
    },
    Frog: {
      egg: "../../assets/eggs/CubicFrogEgg.png",
      baby: "../../assets/spritesheets/CubicFrogBaby.png",
      adult: "../../assets/spritesheets/CubicFrogAdult.png",
      defaultName: "Cubic Frog"
    },
    Giraffe: {
      egg: "../../assets/eggs/CubicGiraffeEgg.png",
      baby: "../../assets/spritesheets/CubicGiraffeBaby.png",
      adult: "../../assets/spritesheets/CubicGiraffeAdult.png",
      defaultName: "Cubic Giraffe"
    },
    MicoLeaoDourado: {
      egg: "../../assets/eggs/CubicMicoLeaoDouradoEgg.png",
      baby: "../../assets/spritesheets/CubicMicoLeaoDouradoBaby.png",
      adult: "../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png",
      defaultName: "Golden Tamarin"
    },
    Wolf: {
      egg: "../../assets/eggs/CubicWolfEgg.png",
      baby: "../../assets/spritesheets/CubicWolfBaby.png",
      adult: "../../assets/spritesheets/CubicWolfAdult.png",
      defaultName: "Cubic Wolf"
    }
  };

  let auth = null;
  let db = null;
  let pets = [];
  let currentIndex = 0;
  let modalSelectedPetId = null;

  // turn pet into snapshot in extension storage
  function toCachedPetData(pet) {
    return window.LeetmatePetUI.toCachedPetData(pet, pet.id || null);
  }

  function getActivePetSpritePath(pet) {
    const normalizedStage = (pet?.stage || "").toLowerCase();

    if (pet?.petRef && normalizedStage === "baby") {
      return `assets/spritesheets/Cubic${pet.petRef}Baby.png`;
    }

    if (pet?.petRef && normalizedStage === "adult") {
      return `assets/spritesheets/Cubic${pet.petRef}Adult.png`;
    }

    return null;
  }

  function getEls() {
    return {
      leftSlot: document.getElementById("pet-slot-left"),
      centerSlot: document.getElementById("pet-slot-center"),
      rightSlot: document.getElementById("pet-slot-right"),
      currentName: document.getElementById("pets-current-name"),
      prevBtn: document.getElementById("pets-prev-btn"),
      nextBtn: document.getElementById("pets-next-btn"),
      selectBtn: document.getElementById("pets-select-btn"),
      modalOverlay: document.getElementById("pets-modal-overlay"),
      modalClose: document.getElementById("pets-modal-close"),
      modalConfirm: document.getElementById("pets-modal-confirm"),
      modalName: document.getElementById("pets-modal-name"),
      modalAge: document.getElementById("pets-modal-age"),
      statHp: document.getElementById("pets-stat-hp"),
      statAtk: document.getElementById("pets-stat-atk"),
      statDef: document.getElementById("pets-stat-def"),
      statSpAtk: document.getElementById("pets-stat-spatk"),
      statSpDef: document.getElementById("pets-stat-spdef"),
      statSpd: document.getElementById("pets-stat-spd"),
      loading: document.getElementById("pets-loading")
    };
  }

  // hide the loading text once display renders
  function hideLoading() {
    const { loading } = getEls();
    if (loading) {
      loading.classList.add("hidden");
    }
  }

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.auth && firebase.firestore;
  }

  // use the custom name first, then fall back to the default name
  function getDisplayName(pet) {
    const assetSet = PET_ASSETS[pet.petRef];
    return (pet.customName || "").trim() || assetSet?.defaultName || pet.petRef || "Pet";
  }

  function getPetAge(pet) {
    const storedAge =
      typeof pet.age === "number" && Number.isFinite(pet.age) ? pet.age : 0;
    const adjustedDays = pet.adjustedDays || 0;
    return Math.max(0, storedAge + adjustedDays);
  }

  // each slot can render as an egg or baby/adult sprite sheet
  function renderPetSlot(slotEl, pet, isAnimated) {
    if (!slotEl) return;

    const spriteEl = slotEl.querySelector(".pets-slot-sprite");
    const eggEl = slotEl.querySelector(".pets-slot-egg");
    if (!spriteEl || !eggEl) return;

    slotEl.classList.remove("stage-egg", "stage-baby", "stage-adult", "is-animated");
    spriteEl.style.backgroundImage = "";
    eggEl.src = "";
    spriteEl.style.display = "none";
    eggEl.classList.add("hidden");

    if (!pet) return;

    const assetSet = PET_ASSETS[pet.petRef];
    if (!assetSet) return;

    const stage = (pet.stage || "adult").toLowerCase();
    if (isAnimated) {
      // only the center pet gets idle animation
      slotEl.classList.add("is-animated");
    }

    if (stage === "egg") {
      slotEl.classList.add("stage-egg");
      eggEl.src = assetSet.egg;
      eggEl.classList.remove("hidden");
      return;
    }

    if (stage === "baby") {
      slotEl.classList.add("stage-baby");
      spriteEl.style.backgroundImage = `url("${assetSet.baby}")`;
      spriteEl.style.display = "block";
      return;
    }

    slotEl.classList.add("stage-adult");
    spriteEl.style.backgroundImage = `url("${assetSet.adult}")`;
    spriteEl.style.display = "block";
  }

  // disable arrows when the user only owns one pet
  function updateArrowState() {
    const { prevBtn, nextBtn } = getEls();
    const disabled = pets.length <= 1;
    if (prevBtn) prevBtn.disabled = disabled;
    if (nextBtn) nextBtn.disabled = disabled;
  }

  // render the three visible slots around the current index
  function renderCarousel() {
    const { leftSlot, centerSlot, rightSlot, currentName } = getEls();
    if (!leftSlot || !centerSlot || !rightSlot || !currentName || pets.length === 0) return;

    const length = pets.length;
    const centerPet = pets[currentIndex];
    const leftPet = length === 1 ? null : pets[(currentIndex - 1 + length) % length];
    const rightPet = length === 1 ? null : pets[(currentIndex + 1) % length];

    // show previous, current, and next based on the current index
    renderPetSlot(leftSlot, leftPet, false);
    renderPetSlot(centerSlot, centerPet, true);
    renderPetSlot(rightSlot, rightPet, false);
    currentName.textContent = getDisplayName(centerPet);
    updateArrowState();
    hideLoading();
  }

  // rebuild the carousel from cached storage 
  function renderCachedCarousel() {
    const { prevBtn, nextBtn } = getEls();
    if (!prevBtn || !nextBtn) return Promise.resolve(false);

    return storageGet(["ownedPetsSnapshot", "activePetId"]).then(({ ownedPetsSnapshot, activePetId }) => {
      if (!Array.isArray(ownedPetsSnapshot) || ownedPetsSnapshot.length === 0) return;

      pets = ownedPetsSnapshot.filter((pet) => pet && pet.petRef);
      if (pets.length === 0) return false;

      const activeIndex = pets.findIndex((pet) => pet.id === activePetId);
      currentIndex = activeIndex >= 0 ? activeIndex : 0;
      renderCarousel();
      return true;
    });
  }

  function renderCachedCenterPet() {
    const { centerSlot, currentName } = getEls();
    if (!centerSlot || !currentName) return Promise.resolve(false);

    return storageGet("activePetSnapshot").then(({ activePetSnapshot }) => {
      if (!activePetSnapshot || !activePetSnapshot.petRef) return false;
      renderPetSlot(centerSlot, activePetSnapshot, true);
      currentName.textContent = getDisplayName(activePetSnapshot);
      hideLoading();
      return true;
    });
  }

  function populateModal(pet) {
    const els = getEls();
    const stats = pet.stats || {};

    if (els.modalName) els.modalName.textContent = getDisplayName(pet);
    if (els.modalAge) els.modalAge.textContent = `${getPetAge(pet)}d`;
    if (els.statHp) els.statHp.textContent = stats.hp ?? 0;
    if (els.statAtk) els.statAtk.textContent = stats.atk ?? 0;
    if (els.statDef) els.statDef.textContent = stats.def ?? 0;
    if (els.statSpAtk) els.statSpAtk.textContent = stats.spAtk ?? 0;
    if (els.statSpDef) els.statSpDef.textContent = stats.spDef ?? 0;
    if (els.statSpd) els.statSpd.textContent = stats.spd ?? 0;
  }

  function openModal() {
    const { modalOverlay } = getEls();
    if (!modalOverlay || pets.length === 0) return;
    const selectedPet = pets[currentIndex];
    if (!selectedPet) return;

    // lock the modal to the pet that was centered when Select was pressed
    modalSelectedPetId = selectedPet.id;
    populateModal(selectedPet);
    modalOverlay.classList.remove("hidden");
  }

  function closeModal() {
    const { modalOverlay } = getEls();
    if (!modalOverlay) return;
    modalSelectedPetId = null;
    modalOverlay.classList.add("hidden");
  }

  // confirming the changes the active pet for the whole extension
  async function setActivePet() {
    if (!auth?.currentUser || !db || pets.length === 0) return;

    const selectedPet = pets.find((pet) => pet.id === modalSelectedPetId) || pets[currentIndex];
    if (!selectedPet) return;
    const userRef = db.collection("users").doc(auth.currentUser.uid);

    // write the new active pet id to firestore first
    await userRef.set(
      {
        activePetId: selectedPet.id,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await storageSet({
      // mirror that change into storage so home, playground, and pip update right away
      activePetId: selectedPet.id,
      activePetType: selectedPet.petRef || null,
      activePetStage: selectedPet.stage || null,
      activePetSpritePath: getActivePetSpritePath(selectedPet),
      activePetSnapshot: toCachedPetData(selectedPet),
      ownedPetsSnapshot: pets.map((pet) => toCachedPetData(pet))
    });

    closeModal();
    window.location.href = "../playground-main/index.html";
  }

  async function loadPets() {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const activePetId = userSnap.data().activePetId || null;
    // fetch every pet the user owns
    const petsSnap = await userRef.collection("pets").get();

    // sort by age
    pets = petsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => getPetAge(a) - getPetAge(b));

    if (pets.length === 0) return;

    const activePet = pets.find((pet) => pet.id === activePetId) || pets[0];

    await storageSet({
      ownedPetsSnapshot: pets.map((pet) => toCachedPetData(pet)),
      activePetId: activePet?.id || activePetId || null,
      activePetType: activePet?.petRef || null,
      activePetStage: activePet?.stage || null,
      activePetSpritePath: getActivePetSpritePath(activePet),
      activePetSnapshot: activePet ? toCachedPetData(activePet) : null,
    });

    const activeIndex = pets.findIndex((pet) => pet.id === activePetId);
    currentIndex = activeIndex >= 0 ? activeIndex : 0;
    renderCarousel();
  }

  function setupEvents() {
    const { prevBtn, nextBtn, selectBtn, modalOverlay, modalClose, modalConfirm } = getEls();

    prevBtn?.addEventListener("click", () => {
      if (pets.length <= 1) return;
      currentIndex = (currentIndex - 1 + pets.length) % pets.length;
      renderCarousel();
    });

    nextBtn?.addEventListener("click", () => {
      if (pets.length <= 1) return;
      currentIndex = (currentIndex + 1) % pets.length;
      renderCarousel();
    });

    selectBtn?.addEventListener("click", openModal);
    modalClose?.addEventListener("click", closeModal);
    modalConfirm?.addEventListener("click", async () => {
      try {
        await setActivePet();
      } catch (error) {
        console.error("Failed to change active pet:", error);
      }
    });

    modalOverlay?.addEventListener("click", (event) => {
      if (event.target === modalOverlay) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    });
  }

  async function initPetChangeScreen() {
    const { prevBtn, nextBtn } = getEls();
    if (!prevBtn || !nextBtn) return;

    const renderedCachedCarousel = await renderCachedCarousel();
    if (!renderedCachedCarousel) {
      await renderCachedCenterPet();
    }

    if (!hasFirebase()) {
      console.warn("Firebase not available on pets screen.");
      return;
    }

    auth = firebase.auth();
    db = firebase.firestore();
    setupEvents();

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        await loadPets();
      } catch (error) {
        console.error("Failed to load owned pets:", error);
      }
    });
  }

  window.initPetChangeScreen = initPetChangeScreen;
})();
