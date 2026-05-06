// ---- Write to Chrome Local Storage ----
async function setLocalPremium(isPremium) {
    try {
      await chrome.storage.local.set({ isPremium });
    } catch (err) {
      console.error("Failed to save premium state to local storage:", err);
    }
  }
  
  // ---- Read from Chrome Local Storage ----
  async function getLocalPremium() {
    try {
      const result = await chrome.storage.local.get(["isPremium"]);
      return !!result.isPremium;
    } catch (err) {
      console.error("Failed to read premium state from local storage:", err);
      return false;
    }
  }
  
  // ---- Read from Firestore ----
  async function getFirestorePremium() {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    try {
      const doc = await firebase.firestore().collection("users").doc(user.uid).get();
      if (!doc.exists) return false;
      return !!doc.data().premium;
    } catch (err) {
      console.error("Failed to read premium state from Firestore:", err);
      return null;
    }
  }

  window.LeetmatePremium = {
    setLocalPremium,
    getLocalPremium,
    getFirestorePremium
  };
  
 