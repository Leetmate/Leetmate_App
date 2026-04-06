// Color picker 
const colors = [
  "#ffb5da", // pink
  "#FFADAD", // pastel red
  "#FF3B30", // red
  "#FFD6A5", // pastel orange
  "#FF9500", // orange
  "#FDFFB6", // pastel yellow
  "#FFD60A", // yellow
  "#CAFFBF", // pastel green
  "#34C759", // green
  "#00C7BE", // teal
  "#A0C4FF", // pastel blue
  "#0A84FF", // blue
  "#5E5CE6", // indigo
  "#BF5AF2", // purple
  "#ede2d8", // gray

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

  //this works
  //load color in profile
  async function loadProfileColor() {
    //find the current color for testing
    //const avatar = document.getElementById("preview-avatar");
    //alert(`The color is ${getComputedStyle(avatar).backgroundColor}`); //rgb(217,217,217)
    //alert(`The color is ${colorDisplay.style.backgroundColor}`);

    if (!currentUser || !userRef) return;
    try {
      const doc = await userRef.get();
      if(doc.exists) {
        const data = doc.data();

        const profileColor = data.profileColor || "#d9d9d9";
        colorDisplay.style.backgroundColor = profileColor;
      }
      else
      {
        colorDisplay.style.backgroundColor = "#d9d9d9";
      }
    }
    catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  //logic to "remember" selected color upon update button
  async function updateProfileColor() {
    //alert("Updating Profile Color");

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
          profileColor: newColor,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      //update the ui
      colorDisplay.style.background = newColor;
    }
    catch (error) {
      console.error("Error updating profile color:", error);
      alert(error.message || "Failed to update profile color.");
    }
    backBtn.click();
  }

  //when clicking update, the selected color is set in firebase
  updateBtn.addEventListener("click", function() {
    //alert("button clicked");
    updateProfileColor();
    //window.location.href = "index.html";
  });
  
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