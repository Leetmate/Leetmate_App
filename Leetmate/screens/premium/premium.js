// premium.js

// Toggle premium bool in Firestore on click
const premiumBtn = document.getElementById("prem-btn");
const premiumFeedback = document.getElementById("prem-feedback");

premiumBtn?.addEventListener("click", async () => {
  const user = firebase.auth().currentUser;
  if (!user) {
    premiumFeedback.textContent = "You must be logged in.";
    return;
  }

  const userRef = firebase.firestore().collection("users").doc(user.uid);
  try {
    const doc = await userRef.get();
    if (!doc.exists) {
        premiumFeedback.textContent = "User document not found.";
      return;
    }
    const current = doc.data().premium || false;
    const newValue = !current;

    await userRef.update({
      premium: newValue
    });

    // update UI
    premiumFeedback.textContent = newValue
      ? "✅ Premium enabled!"
      : "❌ Premium disabled!";

  } catch (err) {
    console.error(err);
    premiumFeedback.textContent = "Error updating premium.";
  }
});

// --- Navigation ----
// Back button logic (in header)
const backBtn = document.getElementById("back-btn");
if (backBtn) {
    backBtn.addEventListener("click", () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = "../home/index.html";
        }
    });
}