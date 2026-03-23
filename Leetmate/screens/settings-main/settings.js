// Simple sign out and navigation logic for the settings page
document.addEventListener('DOMContentLoaded', () => {
    // Handle Sign Out Button
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            if (firebase && firebase.auth) {
                try {
                    await clearAppStorage(); // clear all chrome storage
                    await storageSet({ uid: null, leetcodeUsername: null }); // clear uid and leetcodeUsername from chrome storage
          
                    await firebase.auth().signOut();
                    window.location.replace('../start/index.html');
                } catch (error) {
                    console.error("Sign out error", error);
                }
            }
        });
    }


});

const notifButton = document.getElementById('notif-btn');
notifButton.addEventListener('click', function () {
    window.location.href = "/screens/settings-notifications/index.html"
});

const accountButton = document.getElementById('acc-info-btn');
accountButton.addEventListener('click', function () {
    window.location.href = "/screens/settings-account/index.html"
});