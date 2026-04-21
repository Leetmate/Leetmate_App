//import { startTimeNotif } from 'Leetmate/background.js';

/*notifButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action:"startNotificationTimer"})
});*/

let happinessPercentage = 0;

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

const happinessBtn = document.getElementById("happiness-timer");
if (happinessBtn)
{
    happinessBtn.addEventListener("click", () => {
        chrome.storage.local.get(["leetmate_happiness"]).then((result) => {
            console.log("Value is " + result["leetmate_happiness"]);
        });
    });
}

const happiness0Btn = document.getElementById("happiness-0");
const happiness20Btn = document.getElementById("happiness-20");
const happiness40Btn = document.getElementById("happiness-40");
const happiness60Btn = document.getElementById("happiness-60");
const happiness80Btn = document.getElementById("happiness-80");

if (happiness0Btn) {
    happiness0Btn.addEventListener("click", () => {
        happinessPercentage = 0;
    });
}

if (happiness20Btn) {
    happiness20Btn.addEventListener("click", () => {
        happinessPercentage = 20;
    });
}

if (happiness40Btn) {
    happiness40Btn.addEventListener("click", () => {
        happinessPercentage = 40;
    });
}

if (happiness60Btn) {
    happiness60Btn.addEventListener("click", () => {
        happinessPercentage = 60;
    });
}

if (happiness80Btn) {
    happiness80Btn.addEventListener("click", () => {
        happinessPercentage = 80;
    });
}


/*to do:
calculate the amt of time before reaching each happiness milestone
modify timer based so you can input custom value
create variable to determine which timer you're using
create a submit button so changes aren't made to timer until u submit*/