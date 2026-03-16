// coins.js
// Logic for coin animations after claiming reward in home screen 

// FLOATING +COINS AMOUNT
function showCoinReward(amount) {
    // Find coin counter 
    const counter = document.getElementById("coinDisplay");
    if (!counter) return;
  
    // Get the counter's screen position {left, top, width, height}
    const rect = counter.getBoundingClientRect();
  
    // Create the popup element 
    const popup = document.createElement("div");
    popup.className = "coin-reward-popup";
    popup.textContent = `+${amount}`;
  
    // Position the popup in the center of the coin counter 
    popup.style.left = rect.left + rect.width / 2 + "px";
    popup.style.top = rect.top + "px";
  
    // Add popup to page 
    document.body.appendChild(popup);
  
    // Remove popup after animation 
    setTimeout(() => {
      popup.remove();
    }, 900);
}
  
// COIN FLYING ANIMATION 
function flyCoinToCounter(delay = 0) {
    // Find start (reward icon) and end (coin counter) elements 
    const reward = document.querySelector(".icon-reward");
    const counter = document.getElementById("coinDisplay");
    if (!reward || !counter) return;
  
    // Get their screen positions 
    const start = reward.getBoundingClientRect();
    const end = counter.getBoundingClientRect();
  
    // Create the flying coin 
    const coin = document.createElement("img");
    coin.src = "../../assets/icons/coin.png";
    coin.className = "coin-fly";
  
    // Start roughly from the center of the reward icon
    const startX = start.left + start.width / 2 - 12;
    const startY = start.top + start.height / 2 - 12;
  
    // End roughly at the center of the counter
    const endX = end.left + end.width / 2 - 12;
    const endY = end.top + end.height / 2 - 12;
  
    // Calculate movement distance 
    const dx = endX - startX;
    const dy = endY - startY;
  
    coin.style.left = `${startX}px`;
    coin.style.top = `${startY}px`;

    // Set CSS animation variables 
    // transform: translate(var(--dx), var(--dy))
    coin.style.setProperty("--dx", `${dx}px`);
    coin.style.setProperty("--dy", `${dy}px`);
    coin.style.animationDelay = `${delay}ms`;
  
    // Add coin to page 
    document.body.appendChild(coin);
  
    // Remove after animation 
    setTimeout(() => {
      coin.remove();
    }, 900 + delay);
  }
  
// COIN COUNTER ANIMATION - Increment the coin number with bounce effect
function animateCoinCounter(amount) {
    const counter = document.getElementById("coin-count");
    const display = document.getElementById("coinDisplay");
    if (!counter) return;

    // Read current coins 
    let current = parseInt(counter.textContent, 10);
    // Calculate new target 
    let target = current + amount;

    // Set up animation steps 
    let step = 0;
    const steps = 20;
    const increment = (target - current) / steps;

    const interval = setInterval(() => {
        step++;

        current += increment;
        counter.textContent = Math.floor(current);
        display.classList.add("coin-bounce");

        setTimeout(() => {
        display.classList.remove("coin-bounce");
        }, 200);

        if (step >= steps) {
        counter.textContent = target;
        clearInterval(interval);
        }
    }, 30);
}
  