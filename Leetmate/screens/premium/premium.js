// premium.js

// Frontend only, Firestore will always update to True on click
// No additional setup needed -> Only need test payments link 

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_14AdRa4Kx41X9j2dLPaAw00";

const backBtn = document.getElementById("back-btn");
const premiumBtn = document.getElementById("prem-btn");
const premiumFeedback = document.getElementById("prem-feedback");
const premiumHeader = document.getElementById("prem-header");
const premiumCard = document.querySelector(".premium-card");


// ---- Update UI ----
function applyPremiumUI(isPremium) {
  if (premiumBtn) {
    premiumBtn.style.display = isPremium ? "none" : "";
  }
  if (premiumFeedback) {
    premiumFeedback.textContent = isPremium ? "🌟 You are a Premium Member!" : "";
  }
  if (premiumHeader) {
    premiumHeader.textContent = isPremium
      ? "Congrats! You've Unlocked..."
      : "Go Premium & Unlock:";
  }
  premiumCard?.classList.toggle("is-premium", isPremium);
  console.log("applyPremiumUI:", isPremium);
}

// ---- Write to Chrome Local Storage ----
async function setLocalPremium(isPremium) {
  try {
    await chrome.storage.local.set({ isPremium });
    console.log("setLocalPremium:", isPremium);
  } catch (err) {
    console.error("Failed to save premium state to local storage:", err);
  }
}

// ---- Read from Chrome Local Storage ----
async function getLocalPremium() {
  try {
    const result = await chrome.storage.local.get(["isPremium"]);
    const isPremium = !!result.isPremium;
    console.log("getLocalPremium:", isPremium);
    return isPremium;
  } catch (err) {
    console.error("Failed to read premium state from local storage:", err);
    return false;
  }
}

// ---- Read from Firestore ----
async function getFirestorePremium() {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("getFirestorePremium: no user");
    return null; // important: do not force false here
  }
  try {
    const doc = await firebase.firestore().collection("users").doc(user.uid).get();
    if (!doc.exists) {
      console.log("getFirestorePremium: user doc missing");
      return false;
    }
    const isPremium = !!doc.data().premium;
    console.log("getFirestorePremium:", isPremium);
    return isPremium;
  } catch (err) {
    console.error("Failed to read premium state from Firestore:", err);
    return null;
  }
}

// ---- Write to Firestore ----
async function setFirestorePremium(isPremium) {
  const user = firebase.auth().currentUser;
  if (!user) {
    if (premiumFeedback) {
      premiumFeedback.textContent = "You must be logged in.";
    }
    return false;
  }
  try {
    const userRef = firebase.firestore().collection("users").doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      if (premiumFeedback) {
        premiumFeedback.textContent = "User document not found.";
      }
      return false;
    }
    await userRef.update({ premium: isPremium });
    console.log("setFirestorePremium:", isPremium);
    return true;
  } catch (err) {
    console.error("Failed to update Firestore premium:", err);
    if (premiumFeedback) {
      premiumFeedback.textContent = "Error purchasing premium.";
    }
    return false;
  }
}

// ---- Sync Firestore & Local Storage ----
async function syncPremiumState() {
  // show cached UI first
  const localPremium = await getLocalPremium();
  applyPremiumUI(localPremium);
  // then sync from Firestore
  const firestorePremium = await getFirestorePremium();
  // if auth is not ready or Firestore failed, do not overwrite cache
  if (firestorePremium === null) {
    console.log("syncPremiumState: skipped Firestore overwrite");
    return;
  }
  await setLocalPremium(firestorePremium);
  applyPremiumUI(firestorePremium);
}

// ---- Wait for Firebase auth before syncing ----
document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    console.log("onAuthStateChanged:", !!user, user?.uid);
    await syncPremiumState();
  });
});

// ---- Premium button click handler ----
premiumBtn?.addEventListener("click", async () => {
  try {
    const success = await setFirestorePremium(true);
    if (!success) return;

    await setLocalPremium(true);
    applyPremiumUI(true);

    await chrome.tabs.create({ url: STRIPE_PAYMENT_LINK });
  } catch (err) {
    console.error(err);
    if (premiumFeedback) {
      premiumFeedback.textContent = "Something went wrong.";
    }
  }
});

// ---- Back Navigation ----
if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "../home/index.html";
    }
  });
}