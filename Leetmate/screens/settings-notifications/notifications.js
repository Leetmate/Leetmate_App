//import { startTimeNotif } from 'Leetmate/background.js';

const notifButton = document.getElementById('test-timer');
if (notifButton) {
    notifButton.addEventListener('click', function () {
        chrome.runtime.sendMessage(
            { action: "startNotificationTimer" });
    });
}