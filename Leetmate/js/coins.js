// Coins logic
const COINS_KEY = "leetmate_coins";


function getLocalCoins() {
    const raw = localStorage.getItem(COINS_KEY);
    return raw ? parseInt(raw, 10) : 0;
}

function setLocalCoins(value) {
    localStorage.setItem(COINS_KEY, String(value));
}

function addCoins(amount) {
    const current = getLocalCoins();
    setLocalCoins(current + amount);
}

function updateCoinsUI() {
    const coins = getLocalCoins();

    const coinsElement = document.querySelector(".coins-amount");
    if (coinsElement) {
        coinsElement.textContent = coins;
    }
    else return;
}

function loadCoinsFromFirestore(db, uid) {
    return db
    .collection("users")
    .doc(uid)
    .get()
    .then((snap) => {
        if (!snap.exists) return;

        const data = snap.data();

        if (Number.isInteger(data.coins)) {
            setLocalCoins(data.coins);
        }
    })
    .catch((e) => { 
        console.error("loadCoinsFromFirestore failed: ", e);
        return null;
    })
}

function saveCoinsToFirestore(db, uid, coins) {
    return db
    .collection("users")
    .doc(uid)
    .set({ coins: getLocalCoins(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()}, 
        { merge: true })
    .catch((e) => {
        console.error("saveCoinsToFirestore failed: ", e);
    })
}
