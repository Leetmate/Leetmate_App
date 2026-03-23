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

const updateButton = document.getElementById('submit-updates');
updateButton.addEventListener('click', function () {
    message = document.getElementById('update-email').value;
    //alert(message);
    alert(storageGet("uid"));
});