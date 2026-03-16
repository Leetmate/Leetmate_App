// hearts.js 
// Mangages heart system: tracks heart count, updates UI 
// Plays gain/lose heart animations, and switches pet sprite to fainted when hearts reach zero

let maxHearts = 5;
let currentHearts = 5;

// Update heart icons in UI to reflect the current heart count 
function updateHeartsUI() {
    const hearts = document.querySelectorAll(".hearts img");

    hearts.forEach((heart, index) => {
        if (index < currentHearts) {
            heart.src = "../../assets/icons/heart.png";
            heart.classList.remove("heart-empty");
        } 
        else {
            heart.src = "../../assets/icons/heart_empty.png";
            heart.classList.add("heart-empty");
        }
    });
}

// Change to Fainted Pet when below 0 hearts 
function updatePetState() {
    const pet = document.querySelector(".home-hero-pet");

    if (currentHearts === 0) {
        pet.style.animation = "none";
        pet.style.backgroundPosition = "-564px 0";
    } else {
        pet.style.animation = "home-pet-idle 0.8s steps(1) infinite";
        pet.style.backgroundPosition = "0 0";
    }
}

// Heart depletion 
function loseHeart(amount = 1) {
    const prevHearts = currentHearts;

    // Prevent hearts from going below zero 
    currentHearts = Math.max(0, currentHearts - amount);
    updateHeartsUI();
    updatePetState();

    // Trigger breaking animation on lost hearts
    const hearts = document.querySelectorAll(".hearts img");
    for (let i = currentHearts; i < prevHearts; i++) {
    const heart = hearts[i];
    heart.classList.add("heart-break");

    setTimeout(() => {
        heart.classList.remove("heart-break");
    }, 400);
  }
}

// Heart regeneration
function gainHeart(amount = 1) {
  const prevHearts = currentHearts;

  // Prevent hearts from going above max hearts 
  currentHearts = Math.min(maxHearts, currentHearts + amount);
  updateHeartsUI();
  updatePetState();

  // Trigger heart gain animation
  const hearts = document.querySelectorAll(".hearts img");

  for (let i = prevHearts; i < currentHearts; i++) {
    const heart = hearts[i];

    heart.classList.add("heart-gain");

    setTimeout(() => {
      heart.classList.remove("heart-gain");
    }, 400);

  }
}

