// hearts.js 
// Mangages heart system: tracks heart count, updates UI 
// Plays gain/lose heart animations, and switches pet sprite to fainted when hearts reach zero

let maxHearts = 5;
let heartPercent = 100; // 0-100

// Update heart icons in UI to reflect the current heart count 
function updateHeartsUI(percent) {
    // Store how many FULL hearts we had before update 
    // e.g. heartPercent = 100 -> prevWhole = 5 
    const prevWhole = Math.floor(heartPercent / 20);

    // Keep hearts percentage between 0-100 
    heartPercent = Math.max(0, Math.min(100, percent));

    const hearts = document.querySelectorAll(".hearts-full span img");
    // Convert percentage to heart value
    // e.g. 73% = 3.65 hearts 
    const heartValue = heartPercent / 20;

    hearts.forEach((heart, i) => {
        // Determine how much each heart should be filled 
        // e.g. heartValue = 3.65
        // heart 0-3 = 1  -> full
        // heart 4 = 0.65 -> partial
        // heart 5 = 0 -> empty 
        const fill = Math.max(0, Math.min(1, heartValue - i));
        // Clip percentage of top (full heart) from right  
        heart.style.clipPath = `inset(0 ${(1-fill)*100}% 0 0)`;
    });

    const newWhole = Math.floor(heartPercent / 20);

    // Heart Loss Animation 
    if (newWhole < prevWhole) {
        for (let i = newWhole; i <= prevWhole; i++) {
            hearts[i]?.classList.add("heart-break");
            setTimeout(()=>hearts[i]?.classList.remove("heart-break"),400);
        }
    }

    // Heart Gain Animation 
    if (newWhole > prevWhole) {
        for (let i = prevWhole; i < newWhole; i++) {
            hearts[i]?.classList.add("heart-gain");
            setTimeout(()=>hearts[i]?.classList.remove("heart-gain"),400);
        }
    }
}

// Change to Fainted Pet when below 0 hearts 
function updatePetState() {
    const pet = document.querySelector(".home-hero-pet");

    if (heartPercent === 0) {
        pet.style.animation = "none";
        pet.style.backgroundPosition = "-564px 0";
    } else {
        pet.style.animation = "home-pet-idle 0.8s steps(1) infinite";
        pet.style.backgroundPosition = "0 0";
    }
}

// Heart depletion 
function loseHeart(amount = 1) {
    const percentLoss = (amount / maxHearts) * 100;

    updateHeartsUI(heartPercent - percentLoss);
    updatePetState();
}

// Heart regeneration
function gainHeart(amount = 1) {
    const percentGain = (amount / maxHearts) * 100;

    updateHeartsUI(heartPercent + percentGain);
    updatePetState();
}