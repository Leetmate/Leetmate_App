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

function addXP(xp_amount) {
    let currentXP = getXP();
    currentXP += xp_amount;

    while (currentXP >= MAX_XP) {
        currentXP -= MAX_XP;
        levelUp();
    }

    setXP(currentXP);
}

function levelUpBounce() {
  const levelText = document.querySelector(".level-text");
  if (!levelText) return;

  levelText.classList.remove("level-up");
  requestAnimationFrame(() => {
    levelText.classList.add("level-up");
    
    setTimeout(() => {
        levelText.classList.remove("level-up");
    }, 1500)
  })
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.querySelector(".xp-test-button");
    if (!btn) return;

    updateXPSectionUI();

    btn?.addEventListener("click", () => {
        addXP(30);
        updateXPSectionUI();
    });
})