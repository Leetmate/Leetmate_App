(function () {
  "use strict";

  function accessoryItem(id, name, price, image, flavorText, description) {
    return {
      id,
      category: "accessory",
      name,
      price,
      image,
      flavorText,
      description,
    };
  }

  function foodItem(id, name, price, image, flavorText, description, recoveryAmount, options = {}) {
    return {
      id,
      category: "food",
      name,
      price,
      image,
			description,
      flavorText,
      recoveryAmount,
      ...options,
    };
  }

  function petItem(id, name, price, image, flavorText, description, stats, requiredLevel = null, premiumRequired = false) {
    return {
      id,
      petRef: id,
      category: "pets",
      name,
      price,
      image,
      flavorText,
      description,
      stats,
      requiredLevel,
      premiumRequired,
    };
  }

  function specialItem(id, name, price, image, flavorText, description, options = {}) {
    return {
      id,
      category: "special",
      name,
      price,
      image,
      flavorText,
      description,
      ...options,
    };
  }

  const ITEM_CATALOG = {
    accessory: [
      accessoryItem("acc-greyhat", "Grey Hat", 100, "../../assets/store/acc-greyhat.png", "Simple and calm.", "A neutral hat that fits almost any outfit."),
      accessoryItem("acc-brownhat", "Brown Hat", 100, "../../assets/store/acc-brownhat.png", "Soft and earthy.", "A cozy brown hat with an easy everyday feel."),
      accessoryItem("acc-strawhat", "Straw Hat", 150, "../../assets/store/acc-strawhat.png", "Light and breezy.", "A sun-ready straw hat made for warm days outdoors."),
			accessoryItem("acc-tophat", "Top Hat", 200, "../../assets/store/acc-tophat.png", "Classic and classy.", "A polished top hat for pets with a formal style."),
      accessoryItem("acc-santahat", "Santa Hat", 250, "../../assets/store/acc-santahat.png", "Festive and bright.", "A cheerful holiday hat that gives your pet a warm winter look."),
      accessoryItem("acc-leprechaunhat", "Leprechaun Hat", 250, "../../assets/store/acc-leprechaunhat.png", "Lucky and loud.", "A bright green hat with a playful shape and a little extra charm."),
    ],
    food: [
      foodItem("food-magicpowder", "Magic Powder", 10, "../../assets/store/food-magicpowder.png", "A soft dust with a gentle warmth.", "Eggs only. Recovers 10 health.", 10, { usableStages: ["egg"], sceneType: "egg-powder", statusText: "+10 Health" }),
      foodItem("food-milk", "Milk", 10, "../../assets/store/food-milk.png", "Cool, simple, and always reliable.", "Recovers 10 health.", 10),
      foodItem("food-egg", "Fried Egg", 10, "../../assets/store/food-egg.png", "Simple, warm, and cooked just right.", "Recovers 10 health.", 10),
      foodItem("food-honey", "Honey", 10, "../../assets/store/food-honey.png", "Golden, sticky, and naturally sweet.", "Recovers 10 health.", 10),
      foodItem("food-cheese", "Cheese", 10, "../../assets/store/food-cheese.png", "Rich, creamy, and full of comfort.", "Recovers 10 health.", 10),
      foodItem("food-cookie", "Cookie", 10, "../../assets/store/food-cookie.png", "Sweet, soft, and gone in a bite.", "Recovers 10 health.", 10),
			foodItem("food-bacon", "Bacon", 15, "../../assets/store/food-bacon.png", "Crispy, smoky, and hard to resist.", "Recovers 15 health.", 15),
      foodItem("food-croissant", "Croissant", 15, "../../assets/store/food-croissant.png", "Buttery layers with a soft middle.", "Recovers 15 health.", 15),
      foodItem("food-icecream", "Icecream", 15, "../../assets/store/food-icecream.png", "A chilly treat your pet would adore.", "Recovers 15 health.", 15),
      foodItem("food-popcorn", "Popcorn", 15, "../../assets/store/food-popcorn.png", "Tiny bites with big snack energy.", "Recovers 15 health.", 15),
      foodItem("food-pretzel", "Pretzel", 15, "../../assets/store/food-pretzel.png", "Chewy, salty, and baked to a golden brown.", "Recovers 15 health.", 15),
      foodItem("food-bread", "Bread", 20, "../../assets/store/food-bread.png", "Fresh from the oven and still warm to the touch.", "Recovers 20 health.", 20),
      foodItem("food-donut", "Donut", 20, "../../assets/store/food-donut.png", "Sweet, round, and impossible to ignore.", "Recovers 20 health.", 20),
      foodItem("food-fish", "Fish", 20, "../../assets/store/food-fish.png", "Light, fresh, and easy to enjoy.", "Recovers 20 health.", 20),
      foodItem("food-pancake", "Pancake", 20, "../../assets/store/food-pancake.png", "Fluffy, golden, and made for slow mornings.", "Recovers 20 health.", 20),
      foodItem("food-soup", "Soup", 20, "../../assets/store/food-soup.png", "Warm and soothing after a long day.", "Recovers 20 health.", 20),
      foodItem("food-cookedmeat", "Cooked Meat", 25, "../../assets/store/food-cookedmeat.png", "Smoky, savory, and filling.", "Recovers 25 health.", 25),
      foodItem("food-hamburger", "Hamburger", 25, "../../assets/store/food-hamburger.png", "A classic meal stacked with flavor.", "Recovers 25 health.", 25),
      foodItem("food-hotdog", "Hotdog", 25, "../../assets/store/food-hotdog.png", "Quick, messy, and worth it every time.", "Recovers 25 health.", 25),
      foodItem("food-pizza", "Pizza", 25, "../../assets/store/food-pizza.png", "Cheesy, hot, and full of comfort.", "Recovers 25 health.", 25),
      foodItem("food-sandwich", "Sandwich", 25, "../../assets/store/food-sandwich.png", "Simple, filling, and ready anytime.", "Recovers 25 health.", 25),
      foodItem("food-sushi", "Sushi", 25, "../../assets/store/food-sushi.png", "Fresh, neat, and carefully prepared.", "Recovers 25 health.", 25),
      foodItem("food-taco", "Taco", 25, "../../assets/store/food-taco.png", "Crunchy, bold, and full of fun.", "Recovers 25 health.", 25),
      foodItem("food-burrito", "Burrito", 30, "../../assets/store/food-burrito.png", "Packed tight with a big, hearty bite.", "Recovers 30 health.", 30),
      foodItem("food-chicken", "Chicken", 30, "../../assets/store/food-chicken.png", "A warm meal that always hits the spot.", "Recovers 30 health.", 30),
    ],
    pets: [
      petItem("Bat", "Bat", 300, "../../assets/spritesheets/CubicBatAdult.png", "Swift and watchful.", "A fast companion that leans into speed and special attack.", { hp: 40, atk: 45, def: 40, spAtk: 60, spDef: 50, spd: 80 }, 1),
      petItem("Cat", "Cat", 300, "../../assets/spritesheets/CubicCatAdult.png", "Balanced and curious.", "A steady pet with reliable all-around stats and a calm pace.", { hp: 50, atk: 55, def: 50, spAtk: 55, spDef: 55, spd: 65 }, 1),
      petItem("Fox", "Fox", 300, "../../assets/spritesheets/CubicFoxAdult.png", "Clever and fiery.", "A quick pet with strong special power and sharp instincts.", { hp: 45, atk: 50, def: 45, spAtk: 75, spDef: 60, spd: 70 }, 1),
      petItem("Bunny", "Bunny", 500, "../../assets/spritesheets/CubicBunnyAdult.png", "Light on its feet.", "A cheerful companion built around quick reactions and nimble movement.", { hp: 42, atk: 46, def: 42, spAtk: 48, spDef: 46, spd: 84 }, 2),
      petItem("Frog", "Frog", 800, "../../assets/spritesheets/CubicFrogAdult.png", "Bouncy and lively.", "A nimble pet with good speed and balanced growth.", { hp: 42, atk: 46, def: 42, spAtk: 50, spDef: 48, spd: 72 }, 3),
      petItem("Rat", "Rat", 800, "../../assets/spritesheets/CubicRatAdult.png", "Tiny and relentless.", "A glass-cannon pick that wins through speed and constant pressure.", { hp: 36, atk: 52, def: 34, spAtk: 46, spDef: 38, spd: 90 }, 4),
      petItem("Owl", "Owl", 900, "../../assets/spritesheets/CubicOwlAdult.png", "Wise and watchful.", "A sharp special attacker with strong instincts and excellent aerial speed.", { hp: 46, atk: 38, def: 42, spAtk: 78, spDef: 66, spd: 76 }, 5),
      petItem("Giraffe", "Giraffe", 1000, "../../assets/spritesheets/CubicGiraffeAdult.png", "Tall and steady.", "A sturdy pet with strong defense and solid staying power.", { hp: 60, atk: 45, def: 65, spAtk: 40, spDef: 55, spd: 45 }, 6),
      petItem("Penguin", "Penguin", 700, "../../assets/spritesheets/CubicPenguinAdult.png", "Cool and composed.", "A sturdy little battler with balanced bulk and solid special defense.", { hp: 58, atk: 46, def: 60, spAtk: 62, spDef: 70, spd: 42 }, 7),
			petItem("Wolf", "Wolf", 800, "../../assets/spritesheets/CubicWolfAdult.png", "Fierce and loyal.", "A strong pet built around high attack and solid speed.", { hp: 58, atk: 72, def: 55, spAtk: 42, spDef: 48, spd: 68 }, 8),
			petItem("Elephant", "Elephant", 1000, "../../assets/spritesheets/CubicElephantAdult.png", "Massive and patient.", "A heavy defensive pet with immense endurance and a slow, steady pace.", { hp: 78, atk: 52, def: 82, spAtk: 34, spDef: 68, spd: 24 }, 9),
      petItem("Flamingo", "Flamingo", 1000, "../../assets/spritesheets/CubicFlamingoAdult.png", "Graceful and flashy.", "A high-speed special striker that thrives on momentum and precise timing.", { hp: 44, atk: 42, def: 40, spAtk: 74, spDef: 58, spd: 82 }, 9),
      petItem("MicoLeaoDourado", "Golden Tamarin", 1300, "../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png", "Rare and radiant.", "A rare pet with high overall growth and strong late-game value.", { hp: 68, atk: 70, def: 62, spAtk: 76, spDef: 68, spd: 78 }, 10),
			petItem("Grizzly", "Grizzly", 1400, "../../assets/spritesheets/CubicGrizzlyAdult.png", "Brutal and immovable.", "A hulking bruiser with massive attack and enough bulk to stay in the fight.", { hp: 74, atk: 82, def: 64, spAtk: 34, spDef: 48, spd: 36 }, 11),
      petItem("Sheep", "Sheep", 700, "../../assets/spritesheets/CubicSheepAdult.png", "Soft but dependable.", "A calm pet with even stats and better staying power than it first appears.", { hp: 56, atk: 44, def: 58, spAtk: 50, spDef: 64, spd: 48 }, null, true),
      petItem("Turtle", "Turtle", 1100, "../../assets/spritesheets/CubicTurtleAdult.png", "Slow and unshakable.", "An ultra-defensive wall that trades speed for extreme staying power.", { hp: 72, atk: 38, def: 78, spAtk: 40, spDef: 82, spd: 22 }, null, true),
      petItem("Lion", "Lion", 1300, "../../assets/spritesheets/CubicLionAdult.png", "Bold and regal.", "A proud all-round attacker with reliable damage and solid speed.", { hp: 62, atk: 78, def: 58, spAtk: 50, spDef: 52, spd: 66 }, null, true),
      petItem("Unicorn", "Unicorn", 1800, "../../assets/spritesheets/CubicUnicornAdult.png", "Mythic and radiant.", "A rare premium-tier battler with standout stats across the board.", { hp: 70, atk: 74, def: 68, spAtk: 80, spDef: 76, spd: 74 }, null, true),
    ],
    special: [
			specialItem("spec-streakfreeze", "Streak Freeze", 200, "../../assets/store/spec-streakfreeze.png", "A little breathing room.", "Prevents your streak from resetting for 1 calendar day.", { effect: "streak-freeze", durationDays: 1 }),
			specialItem("spec-tonicpotion1", "Power Tonic I", 300, "../../assets/store/spec-tonicpotion1.png", "A small boost in a bottle.", "Choose 1 stat to increase by 10. Adult pets only.", { effect: "power-tonic", statPoints: 1 }),
			specialItem("spec-wateroflife", "Water of Life", 500, "../../assets/store/spec-wateroflife.png", "A bright sip that stirs sleeping spirits.", "Revives a downed pet to 50 health.", { effect: "revive", reviveAmount: 50 }),
			specialItem("spec-magiclamp", "Magic Lamp", 600, "../../assets/store/spec-magiclamp.png", "Time moves a little faster here.", "Increases your pet's age by 1.", { effect: "age-up", ageIncrease: 1 }),
			specialItem("spec-tonicpotion2", "Power Tonic II", 700, "../../assets/store/spec-tonicpotion2.png", "A stronger spark of growth.", "Choose 3 stat boosts of +10 each. Adult pets only.", { effect: "power-tonic", statPoints: 3 }),
    ],
  };

  function getStoreItems(category) {
    return ITEM_CATALOG[category] ? [...ITEM_CATALOG[category]] : [];
  }

  function getStoreItemById(category, itemId) {
    return getStoreItems(category).find((item) => item.id === itemId) || null;
  }

  window.LeetmateStoreCatalog = {
    ITEM_CATALOG,
    getStoreItems,
    getStoreItemById,
  };
})();
