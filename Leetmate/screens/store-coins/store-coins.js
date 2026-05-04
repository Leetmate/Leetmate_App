//create checkout url
const CREATE_CHECKOUT_SESSION_URL =
  "https://us-central1-leetmate-b4182.cloudfunctions.net/createCheckoutSession";

//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined') return;

    const db = firebase.firestore();
    const auth = firebase.auth();
    let currentUid = null;

    // 1. Initial UI Load from storage helper
    if (typeof updateCoinsUI === 'function') {
      updateCoinsUI();
    }

    // 2. Auth state handling for Firestore sync
    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      currentUid = user.uid;
      window.__leetmateAuth = { db, uid: currentUid };

      // Sync with Firestore on load to ensure we have the server-side balance
      if (typeof loadCoinsFromFirestore === 'function') {
        await loadCoinsFromFirestore(db, currentUid);
        updateCoinsUI();
      }
    });

    // 3. Purchase Logic
    /*async function handlePurchase(amount) {
      const amountNum = Number(amount);
      if (isNaN(amountNum)) return;

      // Use shared addCoins logic (local storage)
      if (typeof addCoins === 'function') {
        await addCoins(amountNum);

        // Sync to Firestore immediately
        if (currentUid && typeof saveCoinsToFirestore === 'function') {
          await saveCoinsToFirestore(db, currentUid);
        }

        // Refresh UI
        updateCoinsUI();
      }
    }*/

    async function handlePurchase(amount) {
      //new change
      //handle payment processing
      const user = firebase.auth().currentUser;
      const coinsFeedback = document.getElementById("coins-feedback");


      try {
        coinsFeedback.textContent = "Redirecting to checkout...";
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
            purchaseType: "coins",
            packageId: "coins_50"
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
        coinsFeedback.textContent = "Could not start checkout.";
      }

      const amountNum = Number(amount);
      if (isNaN(amountNum)) return;

      // Use shared addCoins logic (local storage)
      if (typeof addCoins === 'function') {
        await addCoins(amountNum);

        // Sync to Firestore immediately
        if (currentUid && typeof saveCoinsToFirestore === 'function') {
          await saveCoinsToFirestore(db, currentUid);
        }

        // Refresh UI
        updateCoinsUI();
      }
    }

    /*async function handlePurchase(amount) {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price: 'price_1TT9Z5LsGO8cnbzcMv58y5Vd',
            quantity: 1,
          },
        ],
        mode: 'payment',
        //success_url: `${YOUR_DOMAIN}/success.html`,
      });
    }*/

    // Back to Store
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '../store-accessory/index.html';
      });
    }

    // Bind price buttons
    const priceButtons = document.querySelectorAll('.price-btn');
    priceButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = btn.getAttribute('data-amount');
        if (amount) {
          handlePurchase(amount);

          // Visual feedback
          btn.style.filter = 'brightness(1.5)';
          setTimeout(() => btn.style.filter = '', 200);
        }
      });
    });

    // Reveal
    document.body.classList.remove('hidden-on-load');
  });
})();

