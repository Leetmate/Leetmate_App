//import { startTimeNotif } from 'Leetmate/background.js';

/*notifButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action:"startNotificationTimer"})
});*/

const notifButton = document.getElementById("test-timer");

if (notifButton) {
    notifButton.addEventListener("click", () => {
        console.log("start timer button clicked");

        chrome.runtime.sendMessage({ action: "startNotificationTimer", payload: 10 }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("sendMessage error:", chrome.runtime.lastError.message);
                return;
            }

            console.log("background response:", response);
        });
    });
}

//stop the timer
const stopNotifBtn = document.getElementById("stop-timer");

if (stopNotifBtn) {
    stopNotifBtn.addEventListener("click", () => {
        console.log("stop timer button clicked");

        chrome.runtime.sendMessage({ action: "stopTimer" });
    });
}