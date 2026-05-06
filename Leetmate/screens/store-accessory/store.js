(function () {
  'use strict';

  const COINS_KEY = "leetmate_coins";
  const LEVEL_KEY = "leetmate_level";

  let ownedPetRefs = new Set();
  let ownedAccessoryIds = new Set();
  const storeCatalog = window.LeetmateStoreCatalog || null;
  const storePurchases = window.LeetmateStorePurchases || null;
  let activeCategory = 'accessory';
  let activeDb = null;
  let activeUid = null;
  let selectedItem = null;
  let currentLevel = 1;
  let currentPremium = false;

  function getStoreItems(category) {
    if (!storeCatalog) return [];
    return storeCatalog.getStoreItems(category);
  }

  function getEls() {
    return {
      modal: document.getElementById('store-item-modal'),
      modalTitle: document.getElementById('store-item-modal-title'),
      modalPrice: document.getElementById('store-item-modal-price-value'),
      modalBuyLabel: document.getElementById('store-item-modal-buy-label'),
      modalFlavor: document.getElementById('store-item-modal-flavor'),
      modalDescription: document.getElementById('store-item-modal-description'),
      modalImage: document.getElementById('store-item-modal-image'),
      modalPetThumb: document.getElementById('store-item-modal-pet-thumb'),
      modalBuyBtn: document.getElementById('store-item-modal-buy-btn'),
      modalClose: document.getElementById('store-item-modal-close'),
      addCoinsBtn: document.getElementById('add-coins-btn'),
    };
  }

  async function getCurrentCoins() {
    if (typeof getLocalCoins === 'function') {
      return getLocalCoins();
    }

    const counter = document.getElementById('coin-count');
    return Number(counter?.textContent ?? 0);
  }

  async function loadCurrentLevel() {
    if (typeof storageGet !== 'function') {
      currentLevel = 1;
      return currentLevel;
    }

    const result = await storageGet(LEVEL_KEY);
    currentLevel = Math.max(1, Number(result[LEVEL_KEY] ?? 1));
    return currentLevel;
  }

  function isItemOwned(item) {
    if (item.category === 'pets') {
      return ownedPetRefs.has(item.id);
    }

    if (item.category === 'accessory') {
      return ownedAccessoryIds.has(item.id);
    }

    return false;
  }

  function isItemLocked(item) {
    if (item.category !== 'pets') return false;
    if (item.premiumRequired) return !currentPremium;
    return Number.isFinite(item.requiredLevel) && currentLevel < item.requiredLevel;
  }

  function getLockedLabel(item) {
    if (item.premiumRequired) return 'Premium';
    return Number.isFinite(item.requiredLevel) ? `Lv. ${item.requiredLevel}` : 'Locked';
  }

  function isPremiumLocked(item) {
    return item.category === 'pets' && !!item.premiumRequired && !currentPremium;
  }

  async function updateBuyButtonState() {
    const { modalBuyBtn, modalBuyLabel } = getEls();
    if (!modalBuyBtn || !modalBuyLabel || !selectedItem) return;

    const coins = await getCurrentCoins();
    const notEnoughCoins = coins < selectedItem.price;
    const isOwned = isItemOwned(selectedItem);
    const isLocked = isItemLocked(selectedItem);

    modalBuyBtn.disabled = notEnoughCoins || isOwned || isLocked;
    modalBuyLabel.textContent = isOwned
      ? 'Owned'
      : isLocked
        ? getLockedLabel(selectedItem)
        : notEnoughCoins
          ? 'Need More Coins'
          : 'Buy';
  }

  async function openItemModal(item) {
    const { modal, modalTitle, modalPrice, modalFlavor, modalDescription, modalImage, modalPetThumb } = getEls();
    if (!modal || !modalTitle || !modalPrice || !modalFlavor || !modalDescription || !modalImage || !modalPetThumb) return;

    selectedItem = item;
    modalTitle.textContent = item.name;
    modalPrice.textContent = String(item.price);
    modalFlavor.textContent = item.flavorText || '';
    modalFlavor.classList.toggle('hidden', !item.flavorText);
    modalDescription.textContent = item.description || 'No description yet.';
    modalDescription.classList.toggle('hidden', !item.description);

    modalImage.classList.add('hidden');
    modalPetThumb.classList.add('hidden');
    modalImage.src = '';
    modalImage.alt = '';
    modalPetThumb.style.backgroundImage = '';

    if (item.category === 'pets') {
      modalPetThumb.style.backgroundImage = `url('${item.image}')`;
      modalPetThumb.classList.remove('hidden');
    } else {
      modalImage.src = item.image;
      modalImage.alt = item.name;
      modalImage.classList.remove('hidden');
    }

    await updateBuyButtonState();

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeItemModal() {
    const { modal, modalBuyBtn, modalBuyLabel } = getEls();
    if (!modal) return;

    selectedItem = null;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (modalBuyBtn && modalBuyLabel) {
      modalBuyBtn.disabled = false;
      modalBuyLabel.textContent = 'Buy';
    }
  }

  async function handleBuy() {
    const { modalBuyBtn, modalBuyLabel } = getEls();
    if (!selectedItem || !storePurchases || !activeDb || !activeUid || !modalBuyBtn || !modalBuyLabel) return;

    modalBuyBtn.disabled = true;
    modalBuyLabel.textContent = 'Buying...';

    try {
      const result = await storePurchases.purchaseStoreItem({
        db: activeDb,
        uid: activeUid,
        category: selectedItem.category,
        itemId: selectedItem.id,
      });

      if (typeof setLocalCoins === 'function' && Number.isFinite(result?.coins)) {
        await setLocalCoins(result.coins);
      } else if (typeof loadCoinsFromFirestore === 'function') {
        await loadCoinsFromFirestore(activeDb, activeUid);
      }

      if (selectedItem.category === 'pets') {
        await fetchOwnedPets(activeDb, activeUid);
      } else if (selectedItem.category === 'accessory') {
        await fetchOwnedAccessories(activeDb, activeUid);
      }

      if (typeof updateCoinsUI === 'function') {
        await updateCoinsUI();
      }

      renderGrid(activeCategory);
      closeItemModal();
    } catch (error) {
      console.error('Error buying store item:', error);
      await updateBuyButtonState();
    }
  }

  function setupModalEvents() {
    const { modal, modalBuyBtn, modalClose } = getEls();
    if (!modal || !modalBuyBtn || !modalClose) return;

    modalClose.addEventListener('click', closeItemModal);
    modalBuyBtn.addEventListener('click', handleBuy);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeItemModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeItemModal();
      }
    });
  }

  /**
   * Fetch user's owned pets from Firestore and trigger a re-render.
   */
  async function fetchOwnedPets(db, uid) {
    try {
      const snap = await db.collection('users').doc(uid).collection('pets').get();
      ownedPetRefs.clear();
      snap.forEach(doc => {
        const data = doc.data();
        if (data.petRef) ownedPetRefs.add(data.petRef);
      });
      console.log('Owned pets fetched:', Array.from(ownedPetRefs));
    } catch (e) {
      console.error('Error fetching owned pets:', e);
    }
  }

  async function fetchOwnedAccessories(db, uid) {
    try {
      const snap = await db.collection('users').doc(uid).collection('inventory').get();
      ownedAccessoryIds.clear();
      const accessoryInventorySnapshot = [];
      snap.forEach((doc) => {
        const data = doc.data() || {};
        if (data.category === 'Accessory') {
          ownedAccessoryIds.add(doc.id);
          accessoryInventorySnapshot.push({
            id: doc.id,
            category: data.category,
            quantity: Number(data.quantity ?? 0) || 0,
            purchasedAtMs:
              typeof data.purchasedAt?.toMillis === 'function'
                ? data.purchasedAt.toMillis()
                : Number(data.purchasedAt ?? data.purchasedAtMs ?? 0) || 0,
          });
        }
      });

      if (typeof storageSet === 'function') {
        await storageSet({ accessoryInventorySnapshot });
      }
    } catch (e) {
      console.error('Error fetching owned accessories:', e);
    }
  }

  /**
   * Render the item grid based on selected category.
   */
  function renderGrid(category) {
    const grid = document.querySelector('.store-grid');
    if (!grid) return;
    
    activeCategory = category;
    grid.innerHTML = '';
    const items = getStoreItems(category);

    // --- SORTING: Unlocked pets first ---
    if (category === 'pets') {
      items.sort((a, b) => {
        const aUnlocked = !isItemLocked(a);
        const bUnlocked = !isItemLocked(b);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0;
      });
    }

    items.forEach(item => {
      const isOwned = isItemOwned(item);
      const isLocked = isItemLocked(item);
      
      const card = document.createElement('div');

      card.className = `store-item-card ${isOwned ? 'owned' : ''} ${isLocked ? 'locked' : ''}`;
      card.dataset.itemId = item.id;
      card.dataset.category = category;
      
      let visualHtml = '';
      if (category === 'pets') {
        visualHtml = `<div class="item-visual-box"><div class="pet-thumb" style="background-image: url('${item.image}')"></div></div>`;
      } else {
        visualHtml = `<div class="item-visual-box"><img src="${item.image}" class="item-image" alt="${item.name}" /></div>`;
      }

      let priceHtml = '';
      const premiumLocked = isPremiumLocked(item);
      if (isLocked) {
        priceHtml = `
          <img src="../../assets/icons/lock.png" class="coin-mini ${premiumLocked ? 'coin-mini--premium-lock' : ''}" alt="" />
          <span>${getLockedLabel(item)}</span>
        `;
      } else if (isOwned) {
        priceHtml = `
          <img src="../../assets/icons/coin.png" class="coin-mini" style="display:none" alt="" />
          <span>Owned</span>
        `;
      } else {
        priceHtml = `
          <img src="../../assets/icons/coin.png" class="coin-mini" alt="" />
          <span>${item.price}</span>
        `;
      }

      card.innerHTML = `
        ${visualHtml}
        <div class="item-price-tag ${premiumLocked ? 'item-price-tag--premium-lock' : ''}">
          ${priceHtml}
        </div>
      `;
      card.addEventListener('click', () => {
        openItemModal(item);
      });
      grid.appendChild(card);
    });
  }

  function applyStorePremiumUI(isPremium) {
    currentPremium = !!isPremium;
    const storeCard = document.querySelector(".store-card");
    storeCard?.classList.toggle("is-premium", isPremium);
    if (isPremium) {
      enhancePremiumBanner();
    } else {
      resetPromoBanner();
    }
    renderGrid(activeCategory);
    updateBuyButtonState();
  }

  async function syncPremiumState() {
    const localPremium = await window.LeetmatePremium.getLocalPremium();
    applyStorePremiumUI(localPremium);

    const firestorePremium = await window.LeetmatePremium.getFirestorePremium();
    if (firestorePremium === null) return;

    if (localPremium !== firestorePremium) {
      await window.LeetmatePremium.setLocalPremium(firestorePremium);
    }

    applyStorePremiumUI(firestorePremium);
  }


  /**
   * Initialize all store-specific event listeners.
   */
  async function init() {
    if (typeof firebase === 'undefined') return;
    if (!storeCatalog) {
      console.error('Store catalog not loaded.');
      return;
    }

    const db = firebase.firestore();
    const auth = firebase.auth();
    activeDb = db;

    // 1. Initial UI Load from storage helper
    if (typeof updateCoinsUI === 'function') {
      updateCoinsUI();
    }

    await loadCurrentLevel();

    setupModalEvents();

    // 2. Auth state handling for Firestore sync
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      activeUid = user.uid;
      window.__leetmateAuth = { db, uid: activeUid };

      if (typeof loadCoinsFromFirestore === 'function') {
        await loadCoinsFromFirestore(db, activeUid);
        updateCoinsUI();
      }

      // Fetch owned pets to mark them in the store
      await fetchOwnedPets(db, activeUid);
      await fetchOwnedAccessories(db, activeUid);
      if (window.LeetmatePremium) {
        await syncPremiumState();
      }
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        renderGrid(activeTab.getAttribute('data-category'));
      }
    });


    // 3. Category Tabs Toggle
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const category = tab.getAttribute('data-category');
        renderGrid(category);
      });
    });

    // Initial grid render
    renderGrid('accessory');

    // 4. Listen for storage changes to keep coins in sync
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[COINS_KEY]) {
          if (typeof updateCoinsUI === 'function') {
            updateCoinsUI();
          }
        }

        if (areaName === 'local' && changes[LEVEL_KEY]) {
          currentLevel = Math.max(1, Number(changes[LEVEL_KEY].newValue ?? 1));
          renderGrid(activeCategory);
          updateBuyButtonState();
        }

        if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'isPremium')) {
          currentPremium = !!changes.isPremium.newValue;
          renderGrid(activeCategory);
          updateBuyButtonState();
        }
      });
    }

    // 5. "Buy Coins" shortcut
    const { addCoinsBtn } = getEls();
    if (addCoinsBtn) {
      addCoinsBtn.addEventListener('click', () => {
        window.location.href = '../store-coins/index.html';
      });
    }
    
    // Safety reveal
    document.body.classList.remove('hidden-on-load');
  }

  // Handle initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


// Update promotional premium banner for premium user
const ORIGINAL_PROMO_HTML = `
  <div class="banner-pet-wrap">
    <div class="banner-pet CubicFox"></div>
  </div>
  <div class="sparkles" aria-hidden="true"></div>
  <div class="unlock-all-btn shiny-btn" id="prem-btn">
    Unlock All<br>
    Pets & Items
  </div>
  <div class="banner-pet-wrap">
    <div class="banner-pet CubicCat"></div>
  </div>
`;

function resetPromoBanner() {
  const promo = document.querySelector(".promo-content");
  if (!promo) return;
  promo.innerHTML = ORIGINAL_PROMO_HTML;
  promo.dataset.enhanced = "";

  const premiumBtn = document.getElementById("prem-btn");
  premiumBtn?.addEventListener("click", () => {
    window.location.href = "../premium/index.html";
  });
}

function enhancePremiumBanner() {
  const promo = document.querySelector(".promo-content");
  const premiumBtn = document.getElementById("prem-btn");
  if (!promo || !premiumBtn) return;
  if (promo.dataset.enhanced === "true") return;
  promo.dataset.enhanced = "true";

  premiumBtn.outerHTML = `
    <div class="premium-center-pets">
      <div class="banner-pet-wrap">
        <div class="banner-pet CubicFox"></div>
      </div>
      <div class="banner-pet-wrap">
        <div class="banner-pet CubicCat"></div>
      </div>
    </div>
  `;

  const pets = ["CubicFlamingo", "CubicElephant", "CubicLoboGuara", "CubicGiraffe"];
  const petWraps = promo.querySelectorAll(".banner-pet-wrap");
  petWraps.forEach((wrap, i) => {
    const pet = wrap.querySelector(".banner-pet");
    if (pet && pets[i]) {
      pet.className = `banner-pet ${pets[i]}`;
    }
  });
}

/* Premium button navigation */
const premiumBtn = document.getElementById("prem-btn");
premiumBtn?.addEventListener("click", () => {
    window.location.href = "../premium/index.html";
});
