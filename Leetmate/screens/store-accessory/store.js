(function () {
  'use strict';

  const COINS_KEY = "leetmate_coins";

  const STORE_DATA = {
    clothing: [
      { id: 'hat3', name: 'Red Hat', price: 50, image: '../../assets/clothes/hat3.png' },
      { id: 'hat17', name: 'Green Hat', price: 100, image: '../../assets/clothes/hat17.png' },
      { id: 'hat19', name: 'Top Hat', price: 120, image: '../../assets/clothes/hat19.png' },
      { id: 'hat20', name: 'Grey Hat', price: 75, image: '../../assets/clothes/hat20.png' },
      { id: 'hat21', name: 'Blue Hat', price: 80, image: '../../assets/clothes/hat21.png' },
      { id: 'hat24', name: 'Straw Hat', price: 60, image: '../../assets/clothes/hat24.png' }
    ],
    food: [
      { id: 'Bread', name: 'Bread', price: 10, image: '../../assets/food/Bread.png' },
      { id: 'Burrito', name: 'Burrito', price: 25, image: '../../assets/food/Burrito.png' },
      { id: 'Cola', name: 'Cola', price: 10, image: '../../assets/food/Cola.png' },
      { id: 'CookedChicken', name: 'Cooked Chicken', price: 35, image: '../../assets/food/Cooked_chicken.png' },
      { id: 'Cookie', name: 'Cookie', price: 5, image: '../../assets/food/Cookie.png' },
      { id: 'Cupcake', name: 'Cupcake', price: 15, image: '../../assets/food/Cupcake.png' },
      { id: 'Egg', name: 'Egg', price: 8, image: '../../assets/food/Egg.png' },
      { id: 'Fries', name: 'French Fries', price: 15, image: '../../assets/food/French_fries.png' },
      { id: 'FriedChicken', name: 'Fried Chicken', price: 30, image: '../../assets/food/Fried_chicken.png' },
      { id: 'Hamburger', name: 'Hamburger', price: 25, image: '../../assets/food/Hamburger.png' },
      { id: 'Hotdog', name: 'Hotdog', price: 20, image: '../../assets/food/Hotdog.png' },
      { id: 'Icecream', name: 'Ice Cream', price: 15, image: '../../assets/food/Icecream.png' },
      { id: 'JamBread', name: 'Jam Bread', price: 12, image: '../../assets/food/Jam_bread.png' },
      { id: 'Kebab', name: 'Kebab', price: 25, image: '../../assets/food/Kebab.png' },
      { id: 'Pancake', name: 'Pancake', price: 20, image: '../../assets/food/Pancake.png' },
      { id: 'Pizza', name: 'Pizza', price: 40, image: '../../assets/food/Pizza.png' },
      { id: 'PizzaSlice', name: 'Pizza Slice', price: 15, image: '../../assets/food/PizzaSlice.png' },
      { id: 'Popcorn', name: 'Popcorn', price: 18, image: '../../assets/food/Popcorn.png' },
      { id: 'Sandwich', name: 'Sandwich', price: 22, image: '../../assets/food/Sandwich.png' },
      { id: 'SuperHamburger', name: 'Super Hamburger', price: 50, image: '../../assets/food/SuperHamburger.png' },
      { id: 'Sushi', name: 'Sushi', price: 45, image: '../../assets/food/Sushi.png' },
      { id: 'Taco', name: 'Taco', price: 20, image: '../../assets/food/Taco.png' },
      { id: 'AlienEgg', name: 'Alien Egg', price: 100, image: '../../assets/food/alienEgg.png' },
      { id: 'Beef', name: 'Beef', price: 40, image: '../../assets/food/beef.png' },
      { id: 'Lemonade', name: 'Lemonade', price: 12, image: '../../assets/food/lemonade.png' },
      { id: 'Milk', name: 'Milk', price: 10, image: '../../assets/food/milk.png' }
    ],
    pets: [
      { id: 'AraraAzul', name: 'Arara Azul', price: 900, image: '../../assets/spritesheets/CubicAraraAzul.png' },
      { id: 'Bat', name: 'Bat', price: 400, image: '../../assets/spritesheets/CubicBat.png' },
      { id: 'Bull', name: 'Bull', price: 650, image: '../../assets/spritesheets/CubicBull.png' },
      { id: 'Bunny', name: 'Bunny', price: 400, image: '../../assets/spritesheets/CubicBunny.png' },
      { id: 'Cat', name: 'Cat', price: 450, image: '../../assets/spritesheets/CubicCat.png' },
      { id: 'Chameleon', name: 'Chameleon', price: 550, image: '../../assets/spritesheets/CubicChameleon.png' },
      { id: 'Chicken', name: 'Chicken', price: 350, image: '../../assets/spritesheets/CubicChicken.png' },
      { id: 'Cow', name: 'Cow', price: 600, image: '../../assets/spritesheets/CubicCow.png' },
      { id: 'Dolphin', name: 'Dolphin', price: 850, image: '../../assets/spritesheets/CubicDolphin.png' },
      { id: 'Duck', name: 'Duck', price: 350, image: '../../assets/spritesheets/CubicDuck.png' },
      { id: 'Elephant', name: 'Elephant', price: 1000, image: '../../assets/spritesheets/CubicElephant.png' },
      { id: 'Fish', name: 'Fish', price: 300, image: '../../assets/spritesheets/CubicFish.png' },
      { id: 'Flamingo', name: 'Flamingo', price: 750, image: '../../assets/spritesheets/CubicFlamingo.png' },
      { id: 'Fox', name: 'Fox', price: 500, image: '../../assets/spritesheets/CubicFox.png' },
      { id: 'Frog', name: 'Frog', price: 350, image: '../../assets/spritesheets/CubicFrog.png' },
      { id: 'Giraffe', name: 'Giraffe', price: 600, image: '../../assets/spritesheets/CubicGiraffe.png' },
      { id: 'Grizzly', name: 'Grizzly Bear', price: 900, image: '../../assets/spritesheets/CubicGrizzly.png' },
      { id: 'Horse', name: 'Horse', price: 800, image: '../../assets/spritesheets/CubicHorse.png' },
      { id: 'Jaguatirica', name: 'Ocelot', price: 850, image: '../../assets/spritesheets/CubicJaguatirica.png' },
      { id: 'Lion', name: 'Lion', price: 1100, image: '../../assets/spritesheets/CubicLion.png' },
      { id: 'LoboGuara', name: 'Maned Wolf', price: 950, image: '../../assets/spritesheets/CubicLoboGuara.png' },
      { id: 'MicoLeaoDourado', name: 'Golden Tamarin', price: 1300, image: '../../assets/spritesheets/CubicMicoLeaoDourado.png' },
      { id: 'Monkey', name: 'Monkey', price: 500, image: '../../assets/spritesheets/CubicMonkey.png' },
      { id: 'Moose', name: 'Moose', price: 850, image: '../../assets/spritesheets/CubicMoose.png' },
      { id: 'Owl', name: 'Owl', price: 600, image: '../../assets/spritesheets/CubicOwl.png' },
      { id: 'Panda', name: 'Panda', price: 700, image: '../../assets/spritesheets/CubicPanda.png' },
      { id: 'Penguin', name: 'Penguin', price: 550, image: '../../assets/spritesheets/CubicPenguin.png' },
      { id: 'Pig', name: 'Pig', price: 400, image: '../../assets/spritesheets/CubicPig.png' },
      { id: 'Polar', name: 'Polar Bear', price: 950, image: '../../assets/spritesheets/CubicPolar.png' },
      { id: 'Racoon', name: 'Racoon', price: 500, image: '../../assets/spritesheets/CubicRacoon.png' },
      { id: 'Rat', name: 'Rat', price: 300, image: '../../assets/spritesheets/CubicRat.png' },
      { id: 'Rhino', name: 'Rhino', price: 1000, image: '../../assets/spritesheets/CubicRhino.png' },
      { id: 'Sheep', name: 'Sheep', price: 450, image: '../../assets/spritesheets/CubicSheep.png' },
      { id: 'Shiba', name: 'Shiba Inu', price: 600, image: '../../assets/spritesheets/CubicShiba.png' },
      { id: 'Snake', name: 'Snake', price: 400, image: '../../assets/spritesheets/CubicSnake.png' },
      { id: 'Toucan', name: 'Toucan', price: 800, image: '../../assets/spritesheets/CubicToucan.png' },
      { id: 'Turtle', name: 'Sea Turtle', price: 550, image: '../../assets/spritesheets/CubicTurtle.png' },
      { id: 'Unicorn', name: 'Unicorn', price: 2000, image: '../../assets/spritesheets/CubicUnicorn.png' },
      { id: 'Wolf', name: 'Wolf', price: 800, image: '../../assets/spritesheets/CubicWolf.png' },
      { id: 'Zebra', name: 'Zebra', price: 750, image: '../../assets/spritesheets/CubicZebra.png' }
    ],
    special: [
      { id: 'BigStatPotion', name: 'Big Stat Potion', price: 500, image: '../../assets/SpecialItems/BigStatPotion.png' },
      { id: 'FrozenGauntlet', name: 'Frozen Gauntlet', price: 800, image: '../../assets/SpecialItems/FrozenGuantletEquipment.png' },
      { id: 'HealthStone', name: 'Health Stone', price: 600, image: '../../assets/SpecialItems/HealthStoneEquipment.png' },
      { id: 'IgnitedGauntlet', name: 'Ignited Gauntlet', price: 850, image: '../../assets/SpecialItems/IgnitedGuantletEquipment.png' },
      { id: 'JugStatPotion', name: 'Jug Stat Potion', price: 700, image: '../../assets/SpecialItems/JugStatPotion.png' },
      { id: 'MagicWand', name: 'Magic Wand', price: 450, image: '../../assets/SpecialItems/MagicWandEquipment.png' },
      { id: 'SacredWater', name: 'Sacred Water', price: 150, image: '../../assets/SpecialItems/SacredWater.png' },
      { id: 'Shield', name: 'Shield', price: 400, image: '../../assets/SpecialItems/ShieldEquipment.png' },
      { id: 'SpeedEq', name: 'Speed Equipment', price: 300, image: '../../assets/SpecialItems/SpeedEquipment.png' },
      { id: 'StreakFreeze', name: 'Streak Freeze', price: 200, image: '../../assets/SpecialItems/StreakFreeze.png' },
      { id: 'StrengthEq', name: 'Strength Equipment', price: 350, image: '../../assets/SpecialItems/StrengthEquipment.png' },
      { id: 'Venomous', name: 'Venomous Potion', price: 450, image: '../../assets/SpecialItems/Venomous Potion.png' },
      { id: 'XPMultiplier', name: 'XP Multiplier', price: 350, image: '../../assets/SpecialItems/XPMultiplier.png' },
      { id: 'IgnitionPotion', name: 'Ignition Potion', price: 550, image: '../../assets/SpecialItems/ignitionPotion.png' },
      { id: 'Immunity', name: 'Immunity', price: 300, image: '../../assets/SpecialItems/inmunity.png' },
      { id: 'Invincibility', name: 'Invincibility', price: 600, image: '../../assets/SpecialItems/invicibilityPotion.png' },
      { id: 'MedHealing', name: 'Medium Healing', price: 150, image: '../../assets/SpecialItems/mediumHealing.png' },
      { id: 'SmallHealing', name: 'Small Healing', price: 75, image: '../../assets/SpecialItems/smallHealing.png' },
      { id: 'SplashHealing', name: 'Splash Healing', price: 250, image: '../../assets/SpecialItems/splashHealing.png' },
      { id: 'StatPotion', name: 'Stat Potion', price: 300, image: '../../assets/SpecialItems/statPotion.png' },
      { id: 'WinterSorbet', name: 'Winter Sorbet', price: 120, image: '../../assets/SpecialItems/winerSorbet.png' }
    ]
  };

  let ownedPetRefs = new Set();
  const UNLOCKED_PETS = new Set(['Cat', 'Bat', 'Fox', 'Fish', 'MicoLeaoDourado', 'Wolf', 'Frog', 'Giraffe']);

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

  /**
   * Render the item grid based on selected category.
   */
  function renderGrid(category) {
    const grid = document.querySelector('.store-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const items = [...(STORE_DATA[category] || [])];

    // --- SORTING: Unlocked pets first ---
    if (category === 'pets') {
      items.sort((a, b) => {
        const aUnlocked = UNLOCKED_PETS.has(a.id);
        const bUnlocked = UNLOCKED_PETS.has(b.id);
        if (aUnlocked && !bUnlocked) return -1;
        if (!aUnlocked && bUnlocked) return 1;
        return 0;
      });
    }

    items.forEach(item => {
      const isOwned = category === 'pets' && ownedPetRefs.has(item.id);
      const isLocked = category === 'pets' && !UNLOCKED_PETS.has(item.id);
      
      const card = document.createElement('div');

      card.className = `store-item-card ${isOwned ? 'owned' : ''} ${isLocked ? 'locked' : ''}`;
      
      let visualHtml = '';
      if (category === 'pets') {
        visualHtml = `<div class="item-visual-box"><div class="pet-thumb" style="background-image: url('${item.image}')"></div></div>`;
      } else {
        visualHtml = `<div class="item-visual-box"><img src="${item.image}" class="item-image" alt="${item.name}" /></div>`;
      }

      let priceHtml = '';
      if (isLocked) {
        priceHtml = `
          <img src="../../assets/icons/lock.png" class="coin-mini" alt="" />
          <span>Locked</span>
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
        <div class="item-price-tag">
          ${priceHtml}
        </div>
      `;
      grid.appendChild(card);
    });
  }


  /**
   * Initialize all store-specific event listeners.
   */
  async function init() {
    if (typeof firebase === 'undefined') return;

    const db = firebase.firestore();
    const auth = firebase.auth();
    let currentUid = null;

    // 1. Initial UI Load from storage helper
    if (typeof updateCoinsUI === 'function') {
      updateCoinsUI();
    }

    // 2. Auth state handling for Firestore sync
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      currentUid = user.uid;
      window.__leetmateAuth = { db, uid: currentUid };

      if (typeof loadCoinsFromFirestore === 'function') {
        await loadCoinsFromFirestore(db, currentUid);
        updateCoinsUI();
      }

      // Fetch owned pets to mark them in the store
      await fetchOwnedPets(db, currentUid);
      // Re-render current category if it was pets
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.getAttribute('data-category') === 'pets') {
        renderGrid('pets');
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
    renderGrid('clothing');

    // 4. Listen for storage changes to keep coins in sync
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[COINS_KEY]) {
          if (typeof updateCoinsUI === 'function') {
            updateCoinsUI();
          }
        }
      });
    }

    // 5. "Buy Coins" shortcut
    const addCoinsBtn = document.getElementById('add-coins-btn');
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


