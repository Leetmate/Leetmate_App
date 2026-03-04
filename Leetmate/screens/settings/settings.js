// Simple sign out and navigation logic for the settings page
document.addEventListener('DOMContentLoaded', () => {
    // Handle Sign Out Button
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
            if (firebase && firebase.auth) {
                firebase.auth().signOut().then(() => {
                    window.location.replace('../../popup.html');
                }).catch((error) => {
                    console.error("Sign out error", error);
                });
            }
        });
    }

    // Handle Back Button
    const backBtn = document.querySelector('.settings-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
});
