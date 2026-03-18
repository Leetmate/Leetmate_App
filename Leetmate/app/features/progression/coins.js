// coins.js
// Single source of truth for coin storage, sync, and coin claim animations.

const COINS_KEY = "leetmate_coins";

// ------------------------------
// Local storage
// ------------------------------

async function getLocalCoins() {
  const result = await storageGet(COINS_KEY);
  return Number(result[COINS_KEY] ?? 0);
}

async function setLocalCoins(value) {
  const safeValue = Math.max(0, Math.floor(Number(value) || 0));
  await storageSet({ [COINS_KEY]: safeValue });
  return safeValue;
}

async function addCoins(amount) {
  const current = await getLocalCoins();
  const updated = current + Math.max(0, Math.floor(Number(amount) || 0));
  await setLocalCoins(updated);
  return updated;
}

// ------------------------------
// UI
// ------------------------------

async function updateCoinsUI() {
  const coins = await getLocalCoins();
  const counter = document.getElementById("coin-count");
  if (counter) counter.textContent = String(coins);
}

// ------------------------------
// Firestore
// ------------------------------

async function loadCoinsFromFirestore(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    await setLocalCoins(0);
    return 0;
  }

  const data = snap.data() || {};
  const coins = Number(data.coins ?? 0);

  await setLocalCoins(coins);
  return coins;
}

async function saveCoinsToFirestore(db, uid) {
  const coins = await getLocalCoins();

  await db.collection("users").doc(uid).set(
    {
      coins,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return coins;
}

// ------------------------------
// Coin animations
// ------------------------------

function showCoinReward(amount) {
  const counter = document.getElementById("coinDisplay");
  if (!counter) return;

  const rect = counter.getBoundingClientRect();

  const popup = document.createElement("div");
  popup.className = "coin-reward-popup";
  popup.textContent = `+${amount}`;

  popup.style.left = rect.left + rect.width / 2 + "px";
  popup.style.top = rect.top + "px";

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 900);
}

function flyCoinToCounter(delay = 0) {
  const reward = document.querySelector(".icon-reward");
  const counter = document.getElementById("coinDisplay");
  if (!reward || !counter) return;

  const start = reward.getBoundingClientRect();
  const end = counter.getBoundingClientRect();

  const coin = document.createElement("img");
  coin.src = "../../../assets/icons/coin.png";
  coin.className = "coin-fly";

  const startX = start.left + start.width / 2 - 12;
  const startY = start.top + start.height / 2 - 12;
  const endX = end.left + end.width / 2 - 12;
  const endY = end.top + end.height / 2 - 12;

  const dx = endX - startX;
  const dy = endY - startY;

  coin.style.left = `${startX}px`;
  coin.style.top = `${startY}px`;
  coin.style.setProperty("--dx", `${dx}px`);
  coin.style.setProperty("--dy", `${dy}px`);
  coin.style.animationDelay = `${delay}ms`;

  document.body.appendChild(coin);

  setTimeout(() => {
    coin.remove();
  }, 900 + delay);
}

async function animateCoinCounter(amount) {
  const counter = document.getElementById("coin-count");
  const display = document.getElementById("coinDisplay");
  if (!counter || !display) return;

  const current = parseInt(counter.textContent || "0", 10);
  const target = await getLocalCoins(); // correct value from storage

  let value = current;
  let step = 0;
  const steps = 20;
  const increment = (target - current) / steps;

  const interval = setInterval(() => {
    step += 1;
    value += increment;

    counter.textContent = String(Math.floor(value));
    display.classList.add("coin-bounce");

    setTimeout(() => {
      display.classList.remove("coin-bounce");
    }, 200);

    if (step >= steps) {
      counter.textContent = String(target);
      clearInterval(interval);
    }
  }, 30);
}