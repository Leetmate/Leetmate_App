//import { startTimeNotif } from 'Leetmate/background.js';

/*notifButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action:"startNotificationTimer"})
});*/

const notifButton = document.getElementById('test-timer');
if (notifButton) {
    notifButton.addEventListener("click", () => {
        //console.log("button clicked");

        chrome.runtime.sendMessage({ action: "startNotificationTimer" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("sendMessage error:", chrome.runtime.lastError.message);
                return;
            }

            console.log("background response:", response);
        });
    });
}