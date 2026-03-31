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
    async function handlePurchase(amount) {
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

