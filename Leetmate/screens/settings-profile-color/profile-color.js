// Color picker 
const colors = [
    "#FF6B6B", "#4ECDC4", "#1A535C",
    "#FFD166", "#6A4C93", "#00BBF9"
];
  
const grid = document.getElementById("color-grid");
const preview = document.getElementById("preview-avatar");

let selectedColor = null;

// Create color buttons
colors.forEach(color => {
  const div = document.createElement("div");
  div.classList.add("color-option");
  div.style.backgroundColor = color;

  div.addEventListener("click", () => {
    selectedColor = color;
    preview.style.backgroundColor = color;

    document.querySelectorAll(".color-option")
      .forEach(opt => opt.classList.remove("selected"));

    div.classList.add("selected");
  });

  grid.appendChild(div);
});



document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();     // authentication (login, password, email)
  const db = firebase.firestore();  // Firestore database

  const backBtn = document.getElementById("back-btn");
  const updateBtn = document.getElementById("update-btn");
  
  const colorDisplay = document.getElementById("preview-avatar");

  //for updating the color in the firestore
  let currentUser = null;
  let userRef = null;

  //navigation
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "../settings-account/index.html";
      }
    });
  }

  //load color in profile
  async function loadProfileColor() {
    if (!currentUser || !userRef) return;
    try {
      const doc = await userRef.get();
      if(doc.exists) {
        const data = doc.data();

        const profileColor = data.profileColor || "#d9d9d9";
        colorDisplay.background = profileColor;
      }
      else
      {
        colorDisplay.background = "#d9d9d9";
      }
    }
    catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  //logic to "remember" selected color upon update button
  async function updateProfileColor() {
    alert("Updating Profile Color");

    if (!currentUser || !userRef) {
      alert("Please log in again.");
      return;
    }

    const newColor = selectedColor;

    if(!newColor) {
      alert("Please select a color.");
      return;
    }

    try {
      //update firestore doc
      await userRef.set(
        {
          profileColor: newProfileColor,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      //update the ui
      colorDisplay.background = newProfileColor;
    }
    catch (error) {
      console.error("Error updating username:", error);
      alert(error.message || "Failed to update profile color.");
    }
  }

  //when clicking update, the selected color is set in firebase
  if (updateBtn) {
    updateBtn.addEventListender("click", updateProfileColor);
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("No authenticated user found yet.");
      return;
    }
  
    currentUser = user;
    userRef = db.collection("users").doc(user.uid);
  
    await currentUser.reload();             // refresh auth data
    await loadProfileColor();
    //await loadUserProfile();                // load Firestore data
    //await syncVerifiedEmailToFirestore();   // sync email if changed
  });
});