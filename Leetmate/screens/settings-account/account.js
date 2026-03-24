document.addEventListener("DOMContentLoaded", () => {
    const profileClick = document.getElementById("profile-click");
    const backBtn = document.getElementById("back-btn");

    if (profileClick) {
        profileClick.addEventListener("click", () => {
        window.location.href = "../settings-profile-color/index.html";
        });
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = "../settings-main/index.html";
            }
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const updateButton = document.getElementById('submit-updates');
  
    if (updateButton) {
      updateButton.addEventListener('click', () => {
        const message = document.getElementById('update-email').value;
        alert(storageGet("uid"));
      });
    }
});

document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
        const item = header.parentElement;

        item.classList.toggle("open");
    });
});