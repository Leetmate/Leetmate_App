// XP Logic

// Max XP is fixed, not scaling
const MAX_XP = 100;

// local storage keys used to store values
const XP_KEY = "leetmate_xp";
const LEVEL_KEY = "leetmate_level";

function getXP() {
    const raw = localStorage.getItem(XP_KEY);
    return raw ? parseInt(raw, 10) : 0;
}

function setXP(value) {
    localStorage.setItem(XP_KEY, String(value))
}

function getLevel() {
    const raw = localStorage.getItem(LEVEL_KEY);
    return raw ? parseInt(raw, 10) : 1;
}

function setLevel(value) {
    localStorage.setItem(LEVEL_KEY, String(value));
}

function levelUp() {
    let currentLevel = getLevel();
    currentLevel += 1;
    setLevel(currentLevel);
}

function updateXPSectionUI() {
    const currentXP = getXP();
    const currentLevel = getLevel();

    const xpFill = document.querySelector(".xp-fill");
    const xpText = document.querySelector(".xp-text");
    const levelText = document.querySelector(".level-text");


    if (!xpFill || !xpText || !levelText) {
        console.warn("XP elements not found (.xp-fill, .xp-text, or .level-text).")
        return;
    }

    xpFill.style.width = currentXP + "%";
    xpText.textContent = `${currentXP} / ${MAX_XP}`;
    levelText.textContent = `Lv. ${currentLevel}`;
}

function addXP(XpAmount) {
    let currentXP = getXP();
    currentXP += XpAmount;

    // While-loop accounts for multiple level ups just in case
    while (currentXP >= MAX_XP) {
        currentXP -= MAX_XP;
        levelUp();
    }

    setXP(currentXP);
}

function animateLevelUp() {
  const levelText = document.querySelector(".level-text");
  if (!levelText) return;

  // Restart the animation by removing and readding the class
  levelText.classList.remove("level-up");
  requestAnimationFrame(() => {
    levelText.classList.add("level-up");
    
    setTimeout(() => {
      levelText.classList.remove("level-up");
    }, 1500)
  })
}

/* Implement database */

function loadXPFromFirestore(db, uid) {
  return db
    .collection("users")
    .doc(uid)
    .get()
    .then((snap) => {
      if (!snap.exists) return;
      const data = snap.data();

      // check data before writing to local storage
      if (Number.isInteger(data.xp)) {
        setXP(data.xp);
      }
      if (Number.isInteger(data.level)) {
        setLevel(data.level);
      }
    })
    .catch((e) => {
      console.error("loadXPFromFirestore failed: ", e);
    });
}

function saveXPToFirestore(db, uid) {
  return db
    .collection("users")
    .doc(uid)
    .set(
    {
      xp: getXP(),
      level: getLevel(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    {
      merge: true
    })
    .catch((e) => {
      console.error("saveXPToFirestore failed: ", e);
    })
}
