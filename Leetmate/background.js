/**
 * background.js – Event page (runs in background when the popup is closed).
 *
 * Add logic here later, for example:
 *
 * - On install (chrome.runtime.onInstalled): set default storage (pet, coins, happiness).
 * - Daily reminder: use chrome.alarms to fire at a set time; then chrome.notifications
 *   to show "Time for LeetCode!" (options page can save reminder time to storage and
 *   send a message here to reschedule the alarm).
 * - Happiness decay: periodic check; if no LeetCode activity today, decrease pet happiness.
 * - LeetCode detection: chrome.tabs or a content script on leetcode.com to detect
 *   visits/solutions and grant coins or increase happiness.
 * - Badge: chrome.action.setBadgeText / setBadgeBackgroundColor to show streak or happiness on the icon.
 */

//NOTE: temporarily removing this because it just doesn't work (and no file seems to be using it)

importScripts(
	"features/shared/storage-helper.js",
	"features/progression/streak.js",
	"features/pet/pet-evolution.js",
	"features/pet/evolution-notify.js",
	"features/pet/pet-age.js",
	"screens/settings-notifications/notifications.js"
);


(function () {
	'use strict';

	// Queue submissions from content script; Home will sync to Firestore when it loads
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === 'SAVE_LEETCODE_PROGRESS' && Array.isArray(message.payload) && message.payload.length > 0) {
			chrome.storage.local.set({ leetcode_pending_submissions: message.payload });
		}
	});

	// Re-run LeetCode submission fetch on every navigation within leetcode.com (SPA route changes)
	chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
		if (details.url.startsWith('https://leetcode.com/')) {
			chrome.tabs.sendMessage(details.tabId, { type: 'FETCH_SUBMISSIONS' }).catch(() => {
			});
		}
	});

	// ── 1. On install: create the daily alarm ───────────────────────────────────
	chrome.runtime.onInstalled.addListener(() => {
		chrome.alarms.create("dailyStreakCheck", {
			when: getNextAlarmTime(),   // first fire tonight at 11:59pm
			periodInMinutes: 24 * 60   // repeat every 24 hours
		});
		console.log("Leetmate: daily streak alarm created.");
	});

	// ── 2. On browser restart: recreate alarm if it was lost ────────────────────
	chrome.runtime.onStartup.addListener(async () => {
		const alarm = await chrome.alarms.get("dailyStreakCheck");
		if (!alarm) {
			chrome.alarms.create("dailyStreakCheck", {
				when: getNextAlarmTime(),
				periodInMinutes: 24 * 60
			});
			console.log("Leetmate: daily streak alarm recreated on startup.");
		}
	});

	// ── 3. Alarm handler ─────────────────────────────────────────────────────────
	chrome.alarms.onAlarm.addListener(async (alarm) => {
		if (alarm.name !== "dailyStreakCheck") return;
		console.log("Leetmate: daily streak alarm fired.");
		await runDailyStreakCheck();
		await runMidnightPetAgeJob();
	});

	function getNextAlarmTime() {
		const target = new Date(`${getTodayString()}T23:59:00`).getTime();
		return target > Date.now() ? target : target + 24 * 60 * 60 * 1000;
	}
	// pip needs this since it can't access the assets directly
	// basic flow is: url > raw binary > base 64
	async function assetToDataUrl(path) {
		if (!/assets\/spritesheets\/Cubic.+(?:Baby|Adult)\.png$/.test(path)) {
			throw new Error(`Leetmate: invalid PiP sprite path "${path}"`);
		}

		const response = await fetch(chrome.runtime.getURL(path));
		const buffer = await response.arrayBuffer();
		const base64String = new Uint8Array(buffer).toBase64();

		const dataUrl = `data:image/png;base64,${base64String}`// adds the prefix so it can be accessed later
		return dataUrl;
	}

	chrome.runtime.onMessage.addListener((message) => { // gets message from pip or home to minimize or restore

		if (message.type === "openPip") {

			//debugging
			//alert("background msg received");

			chrome.windows.getLastFocused(
				{ populate: true, windowTypes: ["normal"] }, // gets all the tabs in window, ignore popups/dev

				async (win) => {
					const allTabs = win.tabs;
					const activeTab = allTabs.find(tab => tab.active); // find active tab from array

					const { activePetType, activePetStage, leetmate_happiness } =
						await storageGet(['activePetType', 'activePetStage', 'leetmate_happiness']);
					if (!activePetType) {
						console.warn("Leetmate: cannot open PiP without an active pet type.");
						return;
					}
					const normalizedStage = (activePetStage || '').toLowerCase();
					if (!['baby', 'adult'].includes(normalizedStage)) {
						console.warn("Leetmate: PiP is only available for baby or adult pets.");
						return;
					}
					if ((leetmate_happiness ?? 100) <= 0) {
						console.warn("Leetmate: PiP is disabled while the active pet is downed.");
						return;
					}
					const petSpritePath =
						normalizedStage === 'baby'
							? `assets/spritesheets/Cubic${activePetType}Baby.png`
							: `assets/spritesheets/Cubic${activePetType}Adult.png`;
					const petDataUrl = await assetToDataUrl(petSpritePath);

					chrome.scripting.executeScript(
						{ target: { tabId: activeTab.id }, files: ["features/pet/pip.js"] },
						() => {
							chrome.tabs.sendMessage(activeTab.id, { type: "loadPip", petDataUrl });
						}
					)
				}
			);
		}

		if (message.type === "restore") {
			chrome.windows.getAll({ windowTypes: ["normal"] }, (windows) => {
				const mainWin = windows[0]; // logic is a bit weird here but it works 

				chrome.windows.update(mainWin.id, { focused: true }, () => {
					chrome.action.openPopup({ windowId: mainWin.id });
				})
			})
		}
	})

	// ── 4. Timer Based Notification ─────────────────────────────────────────────────────────
	let time = 5; //5 seconds for testing
	let countdown;
	function startTimeNotif() {
		console.log("timer starting");
		//alert("Timer Start!");
		//this starts the timer to give popup notification in 24 hours (for testing this will be set to 5 seconds)
		time = 5; //making sure the timer starts with the right time (modify for heart based)
		clearInterval(countdown);
		countdown = setInterval(() => {
			if (time > 0) {
				console.log("timer:", time);
				time--; //the process of time
			} else {
				//time 0 means the notif should appear
				completeTimer();
			}
		}, 1000);
	}

	//----------------------->
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.action !== "startNotificationTimer") return;

		console.log("Leetmate: startNotificationTimer received.");

		chrome.notifications.create({
			type: "basic",
			iconUrl: chrome.runtime.getURL("assets/icons/leetmate128.png"),
			title: "Button works",
			message: "The click reached background.js",
			priority: 2
		});

		chrome.alarms.create("leetmate-reminder", {
			delayInMinutes: 0.5
		});

		sendResponse({ ok: true });
		// no return true here
	});

	chrome.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name !== "leetmate-reminder") return;

		console.log("Leetmate: reminder alarm fired.");

		chrome.notifications.create({
			type: "basic",
			iconUrl: "assets/icons/leetmate128.png",
			title: "It's time!",
			message: "Make sure to check your leetmate!",
			requireInteraction: true,
			priority: 2
		});
	});
	//----------------------------->

	// function to trigger notification
	function completeTimer() {
		clearInterval(countdown); //stop the countdown
		//reset timer (testing = 5 seconds, real = 24 hours)
		let time = 5;

		//trigger notification
		chrome.notifications.create({
			type: 'basic',
			iconUrl: chrome.runtime.getURL('assets/icons/leetmate128.png'),
			title: "It's time!",
			message: 'Make sure to check your leetmate!',
			requireInteraction: true, //notif stays until user dismisses it,
			priority: 2
		});
	}


	//this works but i need it to be event based. this only works if extension is open the whole time
	/*const notifButton = document.getElementById('test-timer');
	if (notifButton) {
		notifButton.addEventListener('click', function () {
			//alert("button clicked");
			startTimeNotif();
		});
	}*/

	//___________________________________


	// Dummy listener to prevent "Receiving end does not exist" errors
	chrome.runtime.onConnect.addListener(() => { });


})();

