// premium.js
// Premium frontend & storage sync (Firestore and Chrome extension local)
// Calls backend to create a Checkout Session when user clicks 'buy premium' button 

// Firebase backend endpoint (functions/index.js)
const CREATE_CHECKOUT_SESSION_URL =
  "https://us-central1-leetmate-b4182.cloudfunctions.net/createCheckoutSession";

const backBtn = document.getElementById("back-btn");
const premiumBtn = document.getElementById("prem-btn");
const premiumFeedback = document.getElementById("prem-feedback");
const premiumHeader = document.getElementById("prem-header");
const premiumCard = document.querySelector(".premium-card");

// ---- Update UI ----
function applyPremiumUI(isPremium) {
  if (premiumBtn) {
    premiumBtn.style.display = isPremium ? "none" : "";
    premiumBtn.disabled = false;
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
}

 // ---- Sync Firestore & Local Storage ----
 async function syncPremiumState() {
  // show cached UI first
  const localPremium = await window.LeetmatePremium.getLocalPremium();
  applyPremiumUI(localPremium);
  // then sync from Firestore
  const firestorePremium = await window.LeetmatePremium.getFirestorePremium();
  // if auth is not ready or Firestore failed, do not overwrite cache
  if (firestorePremium === null) return;
  // only write if changed
  if (localPremium !== firestorePremium) {
    await window.LeetmatePremium.setLocalPremium(firestorePremium);
}  applyPremiumUI(firestorePremium);
}

// ---- Wait for Firebase auth before syncing ----
document.addEventListener("DOMContentLoaded", () => {
  firebase.auth().onAuthStateChanged(async () => {
    await syncPremiumState();
  });
  // Re-sync when the page becomes visible again after Stripe checkout.
  document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
      await syncPremiumState();
    }
  });
});

// ---- Premium button click handler ----
premiumBtn?.addEventListener("click", async () => {
  const user = firebase.auth().currentUser;
  if (!user) {
    premiumFeedback.textContent = "You must be logged in.";
    return;
  }
  try {
    premiumBtn.disabled = true;
    premiumFeedback.textContent = "Redirecting to checkout...";
    const idToken = await user.getIdToken();
    // Send request to backend to create Stripe checkout session 
    const response = await fetch(CREATE_CHECKOUT_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        email: user.email || "",
        purchaseType: "premium"
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data.error || "Could not create checkout session");
    }
    // Redirect to checkout page in new tab 
    await chrome.tabs.create({ url: data.url });

  } catch (err) {
    console.error("Checkout start failed:", err);
    premiumFeedback.textContent = "Could not start checkout.";
    premiumBtn.disabled = false;
  }
}); 

// ---- Back Navigation ----
backBtn?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "../home/index.html";
  }
});