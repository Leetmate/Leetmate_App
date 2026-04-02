// Simple sign out and navigation logic for the settings page
document.addEventListener('DOMContentLoaded', () => {
    if (window.LeetmateEasyMode && typeof window.LeetmateEasyMode.initEasyModeToggle === 'function') {
        window.LeetmateEasyMode.initEasyModeToggle();
    }

    // Handle Sign Out Button
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            if (firebase && firebase.auth) {
                try {
                    await clearAppStorage(); // clear all chrome storage
                    await storageSet({
                        uid: null,
                        leetcodeUsername: null,
                        leetmate_easy_mode: false,
                        leetmate_happiness_easy_snapshot: null,
                    });

                    await firebase.auth().signOut();
                    window.location.replace('../start/index.html');
                } catch (error) {
                    console.error('Sign out error', error);
                }
            }
        });
    }
});

const notifButton = document.getElementById('notif-btn');
notifButton.addEventListener('click', function () {
    window.location.href = '/screens/settings-notifications/index.html';
});

const accountButton = document.getElementById('acc-info-btn');
accountButton.addEventListener('click', function () {
    window.location.href = '/screens/settings-account/index.html';
});