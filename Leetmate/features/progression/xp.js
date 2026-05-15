// XP Logic

// Max XP is fixed, not scaling
const MAX_XP = 100;
const LEVEL_UP_COIN_REWARD = 40;

// local storage keys used to store values
const XP_KEY = "leetmate_xp";
const LEVEL_KEY = "leetmate_level";

function safeWholeNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function normalizeXPProgress(xp, level) {
  const safeXp = safeWholeNumber(xp, 0);
  const safeLevel = Math.max(1, safeWholeNumber(level, 1));
  const levelUps = Math.floor(safeXp / MAX_XP);

  return {
    xp: safeXp % MAX_XP,
    level: safeLevel + levelUps,
    levelUps,
  };
}

async function getXP() {
  const result = await storageGet(XP_KEY);
  return safeWholeNumber(result[XP_KEY], 0);
}

async function setXP(value) {
  await storageSet({ [XP_KEY]: safeWholeNumber(value, 0) });
}

async function getLevel() {
  const result = await storageGet(LEVEL_KEY);
  return Math.max(1, safeWholeNumber(result[LEVEL_KEY], 1));
}

// Alias used in rewards.js for the level-up animation check
async function getLocalLevel() {
  return getLevel();
}

async function setLevel(value) {
  await storageSet({ [LEVEL_KEY]: Math.max(1, safeWholeNumber(value, 1)) });
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
  currentXP += safeWholeNumber(amount, 0);
  while (currentXP >= MAX_XP) {
    currentXP -= MAX_XP;
    await levelUp();
  }
  await setXP(currentXP);
}

async function updateXPSectionUI() {
  const [storedXP, storedLevel] = await Promise.all([getXP(), getLevel()]);
  const normalized = normalizeXPProgress(storedXP, storedLevel);
  if (normalized.xp !== storedXP || normalized.level !== storedLevel) {
    await Promise.all([setXP(normalized.xp), setLevel(normalized.level)]);
  }

  const currentXP = normalized.xp;
  const currentLevel = normalized.level;
  const xpFill   = document.querySelector(".xp-fill");
  const xpText   = document.querySelector(".xp-text");
  const levelText = document.querySelector(".level-text");
  if (!xpFill || !xpText || !levelText) return;
  xpFill.style.width    = Math.min(100, currentXP) + "%";
  xpText.textContent    = `${currentXP} / ${MAX_XP}`;
  levelText.textContent = `Lv. ${currentLevel}`;
}

async function repairXPOverflowInFirestore(db, uid) {
  const userRef = db.collection("users").doc(uid);
  let repaired = null;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists) {
      repaired = normalizeXPProgress(0, 1);
      return;
    }

    const data = snap.data() || {};
    const progress = normalizeXPProgress(data.xp, data.level);
    const rawXp = safeWholeNumber(data.xp, 0);
    const rawLevel = Math.max(1, safeWholeNumber(data.level, 1));
    const needsRepair = progress.xp !== rawXp || progress.level !== rawLevel;

    repaired = {
      xp: progress.xp,
      level: progress.level,
      coins: safeWholeNumber(data.coins, 0) + (needsRepair ? progress.levelUps * LEVEL_UP_COIN_REWARD : 0),
    };

    if (!needsRepair) return;

    transaction.set(
      userRef,
      {
        xp: repaired.xp,
        level: repaired.level,
        coins: repaired.coins,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return repaired;
}

async function loadXPFromFirestore(db, uid) {
  const data = await repairXPOverflowInFirestore(db, uid);
  if (!data) return;

  await Promise.all([setXP(data.xp), setLevel(data.level)]);
  if (typeof setLocalCoins === "function" && Number.isInteger(data.coins)) {
    await setLocalCoins(data.coins);
  }
}

async function saveXPToFirestore(db, uid) {
  const [storedXP, storedLevel] = await Promise.all([getXP(), getLevel()]);
  const progress = normalizeXPProgress(storedXP, storedLevel);
  if (progress.xp !== storedXP || progress.level !== storedLevel) {
    await Promise.all([setXP(progress.xp), setLevel(progress.level)]);
  }

  return db.collection("users").doc(uid).set(
    {
      xp: progress.xp,
      level: progress.level,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
