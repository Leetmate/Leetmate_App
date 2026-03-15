const COINS_KEY = "leetmate_coins";

async function getLocalCoins() {
  const result = await storageGet(COINS_KEY);
  return result[COINS_KEY] ?? 0;
}

async function setLocalCoins(value) {
  await storageSet({ [COINS_KEY]: value });
}

async function addCoins(amount) {
  const current = await getLocalCoins();
  await setLocalCoins(current + amount);
}

async function updateCoinsUI() {
  const coins = await getLocalCoins();
  const coinsElement = document.querySelector(".coins-amount");
  if (coinsElement) coinsElement.textContent = coins;
}

async function loadCoinsFromFirestore(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return;
  const data = snap.data();
  if (Number.isInteger(data.coins)) await setLocalCoins(data.coins);
}

async function saveCoinsToFirestore(db, uid) {
  const coins = await getLocalCoins();
  return db.collection("users").doc(uid).set(
    { coins, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}