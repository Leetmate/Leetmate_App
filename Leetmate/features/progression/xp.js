// XP Logic

// Max XP is fixed, not scaling
const MAX_XP = 100;
const LEVEL_UP_COIN_REWARD = 40;

// local storage keys used to store values
const XP_KEY = "leetmate_xp";
const LEVEL_KEY = "leetmate_level";

async function getXP() {
  const result = await storageGet(XP_KEY);
  return result[XP_KEY] ?? 0;
}

async function setXP(value) {
  await storageSet({ [XP_KEY]: value });
}

async function getLevel() {
  const result = await storageGet(LEVEL_KEY);
  return result[LEVEL_KEY] ?? 1;
}

// Alias used in rewards.js for the level-up animation check
async function getLocalLevel() {
  return getLevel();
}

async function setLevel(value) {
  await storageSet({ [LEVEL_KEY]: value });
}

async function levelUp() {
  const current = await getLevel();
  await setLevel(current + 1);
  if (typeof addCoins === "function") {
    await addCoins(LEVEL_UP_COIN_REWARD);
  }
}

async function addXP(amount) {
  let currentXP = await getXP();
  currentXP += amount;
  while (currentXP >= MAX_XP) {
    currentXP -= MAX_XP;
    await levelUp();
  }
  await setXP(currentXP);
}

async function updateXPSectionUI() {
  const [currentXP, currentLevel] = await Promise.all([getXP(), getLevel()]);
  const xpFill   = document.querySelector(".xp-fill");
  const xpText   = document.querySelector(".xp-text");
  const levelText = document.querySelector(".level-text");
  if (!xpFill || !xpText || !levelText) return;
  xpFill.style.width    = currentXP + "%";
  xpText.textContent    = `${currentXP} / ${MAX_XP}`;
  levelText.textContent = `Lv. ${currentLevel}`;
}

async function loadXPFromFirestore(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return;
  const data = snap.data();
  if (Number.isInteger(data.xp))    await setXP(data.xp);
  if (Number.isInteger(data.level)) await setLevel(data.level);
}

async function saveXPToFirestore(db, uid) {
  const [xp, level] = await Promise.all([getXP(), getLevel()]);
  return db.collection("users").doc(uid).set(
    { xp, level, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}
