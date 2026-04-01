(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("pets-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "../playground-main/index.html";
      });
    }

    if (typeof initPetChangeScreen === "function") {
      initPetChangeScreen();
    }
  });
})();
