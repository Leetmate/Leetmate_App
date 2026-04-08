// Account Screen Backend Logic 

// Wait for HTML to fully load before running JS 
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Firebase serivces 
  const auth = firebase.auth();     // authentication (login, password, email)
  const db = firebase.firestore();  // Firestore database

  const backBtn = document.getElementById("back-btn");
  const profileAvatarBtn = document.getElementById("profile-avatar-btn");
  const deleteBtn = document.getElementById("delete-btn");

  const profileAvatar = document.getElementById("profile-avatar");
  const profileImg = document.getElementById("avatar_img");
  const usernameBtn = document.getElementById("username-btn");
  const usernameDisplay = document.getElementById("username-display");
  const emailDisplay = document.getElementById("email-display");

  // Username modal (popup)
  const usernameModal = document.getElementById("username-modal");
  const usernameModalOverlay = document.getElementById("username-modal-overlay");
  const usernameInput = document.getElementById("username-input");
  const saveUsernameBtn = document.getElementById("save-username-btn");
  const cancelUsernameBtn = document.getElementById("cancel-username-btn");

  // Delete modal (popup)
  const deleteModal = document.getElementById("delete-modal");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

  // Email update inputs
  const newEmailInput = document.getElementById("new-email");
  const updateEmailBtn = document.getElementById("update-email-btn");

  // Password update inputs 
  const newPasswordInput = document.getElementById("new-password");
  const confirmPasswordInput = document.getElementById("confirm-password");
  const updatePasswordBtn = document.getElementById("update-password-btn");

  // ---- User State ----
  // Set values once Firebase confirms who is loged in 
  let currentUser = null;   // Firebase Auth user
  let userRef = null;       // Firestore document reference (users/{uid})
  let petRef = null;
  let leetcodeUsername = null;

  // --- Navigation ----
  // Back button logic (in header)
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "../settings-main/index.html";
      }
    });
  }

  // Clicking profile pic -> goes to color picker 
  if (profileAvatarBtn) {
    profileAvatarBtn.addEventListener("click", () => {
      window.location.href = "../settings-profile-color/index.html";
    });
  }

  // ---- Accordion (expand/collapse sections) ---- 
  document.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.parentElement;
      // toggles open/close
      item.classList.toggle("open");
    });
  });

  // ---- Username Modal ----
  // Remove pencil icon and trailing spaces in username text  
  function getCleanUsernameText() {
    return usernameDisplay.textContent.replace(" ✏️", "").trim();
}
  // Open modal and pre-fill with current username 
  function openUsernameModal() {
    usernameInput.value = getCleanUsernameText();
    usernameModal.classList.remove("hidden");
    usernameInput.focus();
    usernameInput.select();
  }

  // Close modal and clear input
  function closeUsernameModal() {
    usernameModal.classList.add("hidden");
    usernameInput.value = "";
  }

  // Click Username label -> opens modal 
  if (usernameBtn) {
    usernameBtn.addEventListener("click", openUsernameModal);
  }

  // Click Cancel -> closes modal
  if (cancelUsernameBtn) {
    cancelUsernameBtn.addEventListener("click", closeUsernameModal);
  }

  // ---- Delete Modal ----

  // Open modal and pre-fill with current username 
  function openDeleteModal() {
    deleteModal.classList.remove("hidden");
  }

  // Close modal and clear input
  function closeDeleteModal() {
    deleteModal.classList.add("hidden");
  }

  // Open modal after clicking delete 
  if (deleteBtn) {
    deleteBtn.addEventListener("click", openDeleteModal);
  }

  // Click Cancel -> closes modal
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  }

  //---- Deleting the Account ----

  // create helper function: delete subcollection
  async function deleteSubcollectionDocs(subcollectionName) {
    try {
      const subcollectionRef = db.collection(`users/${currentUser.uid}/${subcollectionName}`);
      const snapshot = await subcollectionRef.get();

      if (snapshot.empty) {
        console.log(`No documents found in "users/${currentUser.uid}/${subcollectionName}"`);
        return;
      }

      //batch delete
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
        //batch.update(doc.ref, {"order": 2});
      });

      await batch.commit();
      //console.log(`Deleted ${snapshot.size()} documents from users/${currentUser.uid}/${subcollectionName}`);
    } catch (error) {
      console.error("Error deleting subcollection:", error);
    }
  }

  //helper function to store value
  function storeUN(un) {
    leetcodeUsername = un;
  }

  function deleteUser() {
    //testing that the button is being clicked
    //alert("delete account button pressed");

    // this deletes leetcodeAccountClaims
    db.collection("leetcodeAccountClaims").doc(leetcodeUsername).delete().then(() => {
      //deletes the document
    }).catch((error) => {
      console.error("Error removing leetcodeAccountClaims document: ", error);
    });
    
    //delete subcollections
    (async () => {
      await deleteSubcollectionDocs("leetcodeProgress");
    })();

    (async () => {
      await deleteSubcollectionDocs("pets");
    })();
    
    //deletes the user's document too
    db.collection("users").doc(currentUser.uid).delete().then(() => {
      //deletes the user's document
    }).catch((error) => {
      console.error("Error removing user document: ", error);
    });

    //NOTE: this deletes the user, but it doesn't delete the user's document so the data just sits there
    currentUser.delete().then(() => {
      //deletes user auth
    }).catch((error) => {
      //error
      console.error("Error deleting user profile:", error);
    });

    //window.location.href = "../start/index.html";
  }

  confirmDeleteBtn.addEventListener("click", function() {
    //alert("delete button clicked");
    deleteUser();
  });

  // ---- Load User Data From Firestore ----
  async function loadUserProfile() {
    if (!currentUser || !userRef) return;

    try {
      //to get the leetcode account name
      db.collection("users")
      .doc(currentUser.uid)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data();
          let lcusername = data.leetcode.username;
          storeUN(lcusername);
          //console.log("Leetcode ID:", data.leetcode.username); // Access nested field
          //alert(data.leetcode.username);
        }
      });      
      
      const doc = await userRef.get();

      if (doc.exists) {
        
        const data = doc.data();
        
        //await doc.collection("pets").doc(data.activePetId);
        petRef = db.collection("users").doc(data.uid).collection("pets").doc(data.activePetId);
        const petDoc = await petRef.get();

        if (petDoc.exists) {
          const petData = petDoc.data();

          // Use stored username or if cannot find, use default placeholders 
          const username = data.username || data.leetcodeUsername || "USERNAME_001";
          const email = data.email || currentUser.email || "No email";
          const color = data.profileColor || "#d9d9d9";

          //get info for the pet display
          const petRef = petData.petRef || "Cat";
          const petStage = petData.stage || "Adult";
          let petPath = "../../assets";

          //create the path for the pet image
          if (petStage == "Egg" || petStage == "egg") 
            {
            petPath = "../../assets/Eggs/Cubic"+petRef+"Egg.png";
            //"../../assets/spritesheets/CubicFoxAdult.png"
            if(!profileImg.classList.contains("egg")) 
              {
              profileImg.classList.toggle("adult");
              profileImg.classList.toggle("egg");
            }
          }
          else if (petStage == "Baby" || petStage == "baby" || petStage == "Adult" || petStage == "adult")
          {
            if (petStage == "Baby" || petStage == "baby")
            {
              petPath = "../../assets/spritesheets/Cubic"+petRef+"Baby.png";
            }
            if (petStage == "Adult" || petStage == "adult")
            {
              petPath = "../../assets/spritesheets/Cubic"+petRef+"Adult.png";
            }

            if(!profileImg.classList.contains("adult")) 
              {
              profileImg.classList.toggle("egg");
              profileImg.classList.toggle("adult");
            }
          }

          //alert(petPath);

          //get the right image for the active pet
          /*const activePetId = data.activePetId || "na";
          let imageName = "";
          const petData = data.collection("pets").get().then((doc2) => {
            if (doc2.exists) {
              console.log("Document data:", doc2.data());
            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
          })*/

          // Update UI 
          usernameDisplay.textContent = `${username} ✏️`;
          emailDisplay.textContent = email;
          profileAvatar.style.backgroundColor = color;
          //profileImg.src = "../../assets/spritesheets/CubicFoxAdult.png";
          profileImg.src = petPath;
        } else {
          // Fallback if no document exists 
          usernameDisplay.textContent = "USERNAME_001 ✏️";
          emailDisplay.textContent = currentUser.email || "No email";
          profileAvatar.style.backgroundColor = "#d9d9d9";
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      emailDisplay.textContent = currentUser?.email || "No email";
    }
  }

  // ---- Update Username (Firestore only) ----
  async function updateUsername() {
    if (!currentUser || !userRef) {
      alert("Please log in again.");
      return;
    }

    const newUsername = usernameInput.value.trim();

    if (!newUsername) {
      alert("Please enter a username.");
      return;
    }

    const usernameRules = /^[A-Za-z0-9_]{3,20}$/;
    if (!usernameRules.test(newUsername)) {
      alert("Username must be 3-20 characters and contain only letters, numbers, or underscores.");
      return;
    }
  
    try {
      // Get user's old username 
      const userSnap = await userRef.get();
      const userData = userSnap.data() || {};
      const oldUsername = userData.username || "";
  
      // Create pointer to new username   usernames/{newUsername}
      const newUsernameRef = db.collection("usernames").doc(newUsername);

      // Create pointer to old username if have   usernames/{oldUsername}
      const oldUsernameRef = oldUsername
        ? db.collection("usernames").doc(oldUsername)
        : null;
  
      // Run everything atomically (all or nothing)
      await db.runTransaction(async (transaction) => {

        // Check if new username is already taken
        const newUsernameDoc = await transaction.get(newUsernameRef);
        if (newUsernameDoc.exists) {
          const ownerUid = newUsernameDoc.data().uid;

          // If the owner of that username is not the current user -> stop
          if (ownerUid !== currentUser.uid) {
            throw new Error("That username is already taken.");
          }
        }
  
        // Update usernames collection
        transaction.set(newUsernameRef, {
          uid: currentUser.uid,
          username: newUsername, 
          createdAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true}
        );
  
        // Update user's document 
        transaction.update(userRef, {
          username: newUsername,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
  
        // Delete old username in usernames collection 
        if (oldUsernameRef && oldUsername !== newUsername) {
          transaction.delete(oldUsernameRef);
        }
      });
  
      usernameDisplay.textContent = `${newUsername} ✏️`;
      closeUsernameModal();
      alert("Username updated successfully.");

    } catch (error) {
      console.error("Error updating username:", error);
      alert(error.message || "Failed to update username.");
    }
  }

  // Click Save -> saves username  
  if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener("click", updateUsername);
  }

  // Press 'enter' key -> saves username 
  if (usernameInput) {
    usernameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateUsername();
      }
    });
  }

  // ---- Update email ----
  async function updateEmail() {
    if (!currentUser || !userRef) {
      alert("Please log in again.");
      return;
    }
  
    const currentPasswordInput = document.getElementById("current-password-email");
    const currentPassword = currentPasswordInput.value;
    const newEmail = newEmailInput.value.trim();
  
    if (!currentPassword) {
      alert("Please enter your current password.");
      return;
    }
  
    if (!newEmail) {
      alert("Please enter a new email.");
      return;
    }
  
    try {
      // 1. Reauthenticate (required for security) 
      const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
  
      await currentUser.reauthenticateWithCredential(credential);
  
      // 2. Send verification email to new address 
      await currentUser.verifyBeforeUpdateEmail(newEmail);
  
      currentPasswordInput.value = "";
      newEmailInput.value = "";
  
      alert("Verification email sent. Please open the link in your new email inbox to finish changing your email.");
    } catch (error) {
      console.error("Error updating email:", error);
  
      if (error.code === "auth/wrong-password") {
        alert("Current password is incorrect.");
        return;
      }
  
      if (error.code === "auth/unauthorized-continue-uri") {
        alert("Your return URL domain is not authorized in Firebase.");
        return;
      }
  
      alert(error.message || "Failed to start email update.");
    }
  }

   // Click Update in email section -> updates email
   if (updateEmailBtn) {
    updateEmailBtn.addEventListener("click", updateEmail);
  }

  // Sync verified email from Firebase Auth -> Firestore 
  async function syncVerifiedEmailToFirestore() {
    if (!currentUser || !userRef) return;
  
    try {
      await currentUser.reload();
      const verifiedEmail = currentUser.email;
  
      if (verifiedEmail) {
        await userRef.set(
          {
            email: verifiedEmail,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
  
        emailDisplay.textContent = verifiedEmail;
      }
    } catch (error) {
      console.error("Error syncing verified email:", error);
    }
  }

// ---- Auth State Listener ----
// Runs when Firebase determines if user is logged in 
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("No authenticated user found yet.");
      return;
    }
  
    currentUser = user;
    userRef = db.collection("users").doc(user.uid);
    //petRef = db.collection("users").doc(user.uid).collection("pets").doc(user.activePetId);

    //testing alerts
    //alert(user.activePetId);
  
    await currentUser.reload();             // refresh auth data
    await loadUserProfile();                // load Firestore data
    await syncVerifiedEmailToFirestore();   // sync email if changed
  });

  // ---- Update Password ---
  async function updatePassword() {
    if (!currentUser) {
      alert("Please log in again.");
      return;
    }
  
    const currentPasswordInput = document.getElementById("current-password-password");
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
  
    if (!currentPassword) {
      alert("Please enter your current password.");
      return;
    }
  
    if (!newPassword || !confirmPassword) {
      alert("Please fill out both password fields.");
      return;
    }
  
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
  
    try {
      // Reauthenticate first
      const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await currentUser.reauthenticateWithCredential(credential);

      // Then update password
      await currentUser.updatePassword(newPassword);
  
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
  
      alert("Password updated successfully.");
    } catch (error) {
      console.error("Error updating password:", error);
  
      if (error.code === "auth/wrong-password") {
        alert("Current password is incorrect.");
        return;
      }
  
      alert(error.message || "Failed to update password.");
    }
  }

  // Click Update in password section -> updates password 
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener("click", updatePassword);
  }

});