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
importScripts(
	"features/shared/storage-helper.js",
	"features/progression/coins.js",
	"features/progression/streak.js",
	"features/pet/pet-evolution.js",
	"features/pet/evolution-notify.js",
	"features/pet/pet-age.js"
);
(function () {
	'use strict';

	let notifEnabled = null;
	const PIP_SESSION_KEYS = [
		"leetmate_pip_active",
		"leetmate_pip_tab_id",
		"leetmate_pip_pet_sprite_url"
	];

	async function setPipSession(session) {
		await storageSet(session);
	}

	async function clearPipSession() {
		await storageRemove(PIP_SESSION_KEYS);
	}

	async function getPipSession() {
		return storageGet(PIP_SESSION_KEYS);
	}

	async function injectPipIntoTab(tabId, petSpriteUrl, autoOpen = false) {
		try {
			await chrome.scripting.executeScript({
				target: { tabId },
				files: ["features/pet/pip.js"]
			});
			await chrome.tabs.sendMessage(tabId, {
				type: "loadPip",
				petSpriteUrl,
				autoOpen
			});
		} catch (error) {
			console.warn("Leetmate: failed to inject PiP into tab.", error);
		}
	}

	//make service worker persistent
	chrome.runtime.onInstalled.addListener(() => {
		chrome.alarms.create("repeatTask", { periodInMinutes: 0.25 });
	});

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

		//restart notif timer if needed as well
		await chrome.storage.local.get(["leetmate_notifications_enabled"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("notifEnabled", result["leetmate_notifications_enabled"]);
			if (notifEnabled == true) {
				startNotifTimer();
			}
		});
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
	chrome.runtime.onMessage.addListener((message) => { // gets message from pip or home to minimize or restore

		if (message.type === "openPip") {
			chrome.windows.getLastFocused(
				{ populate: true, windowTypes: ["normal"] }, // gets all the tabs in window, ignore popups/dev

				async (win) => {
					const allTabs = win.tabs;
					const activeTab = allTabs.find(tab => tab.active); // find active tab from array

					const {
						activePetType,
						activePetStage,
						activePetSpritePath,
						leetmate_happiness
					} = await storageGet([
						'activePetType',
						'activePetStage',
						'activePetSpritePath',
						'leetmate_happiness'
					]);
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
						activePetSpritePath ||
						(normalizedStage === 'baby'
							? `assets/spritesheets/Cubic${activePetType}Baby.png`
							: `assets/spritesheets/Cubic${activePetType}Adult.png`);
					const petSpriteUrl = chrome.runtime.getURL(petSpritePath);
					await setPipSession({
						leetmate_pip_active: true,
						leetmate_pip_tab_id: activeTab.id,
						leetmate_pip_pet_sprite_url: petSpriteUrl
					});
					await injectPipIntoTab(activeTab.id, petSpriteUrl, false);
				}
			);
		}

		if (message.type === "restore") {
			clearPipSession();
			chrome.windows.getAll({ windowTypes: ["normal"] }, (windows) => {
				const mainWin = windows[0]; // logic is a bit weird here but it works 

				chrome.windows.update(mainWin.id, { focused: true }, () => {
					chrome.action.openPopup({ windowId: mainWin.id });
				})
			})
		}

		if (message.type === "pipClosed") {
			clearPipSession();
		}
	})

	chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
		if (changeInfo.status !== "complete") return;
		const {
			leetmate_pip_active,
			leetmate_pip_tab_id,
			leetmate_pip_pet_sprite_url
		} = await getPipSession();
		if (!leetmate_pip_active || leetmate_pip_tab_id !== tabId || !leetmate_pip_pet_sprite_url) {
			return;
		}
		await injectPipIntoTab(tabId, leetmate_pip_pet_sprite_url, true);
	});

	chrome.tabs.onRemoved.addListener(async (tabId) => {
		const { leetmate_pip_tab_id } = await getPipSession();
		if (leetmate_pip_tab_id === tabId) {
			await clearPipSession();
		}
	});

	//------------------------Notifications-------------------------
	//variables for timers
	let time = 0;
	let countdown = null;
	let customTime = 0;
	let remainingTime = 0;
	let timerType = null;
	let seconds = 0;
	let notifTime = null;
	let notifHealth = null;
	let curHealth = null;
	let calcSecs = 0;
	let curTime = 0;
	let assumedTime = 0;
	let timeFlag = true;

	//loads values from chrome.storage.local.get into variables
	async function loadLocalVars(cusVar, newVal) {
		if (cusVar == "timerType") {
			timerType = newVal;
			//console.log(`timerType is: ${timerType}`);
		}
		else if (cusVar == "notifTime") {
			notifTime = JSON.parse(JSON.stringify(newVal, null, 2));
		}
		else if (cusVar == "notifHealth") {
			notifHealth = newVal;
		}
		else if (cusVar == "curHealth") {
			curHealth = newVal;
		}
		else if (cusVar == "notifEnabled") {
			notifEnabled = newVal;
		}
	}

	//async function calculateTimer() {
	async function startNotifTimer() {
		// //debugger status
		// console.log("Starting startNotifTimer()");

		// await chrome.storage.local.get(["leetmate_notification_mode"]).then((result) => {
		// 	loadLocalVars("timerType", result["leetmate_notification_mode"]);
		// });

		// await chrome.storage.local.get(["leetmate_notification_time"]).then((result) => {
		// 	loadLocalVars("notifTime", result["leetmate_notification_time"]);
		// });

		// await chrome.storage.local.get(["leetmate_health_notification_threshold"]).then((result) => {
		// 	loadLocalVars("notifHealth", result["leetmate_health_notification_threshold"]);
		// });

		// await chrome.storage.local.get(["leetmate_happiness"]).then((result) => {
		// 	loadLocalVars("curHealth", result["leetmate_happiness"]);
		// });

		// await chrome.storage.local.get(["leetmate_notifications_enabled"]).then((result) => {
		// 	loadLocalVars("notifEnabled", result["leetmate_notifications_enabled"]);
		// });

		// //stop timer if enabled = false
		// if (notifEnabled == false) {
		// 	console.log("Canceling startNotifTimer()");
		// 	return;
		// }
		const data = await chrome.storage.local.get([
			"leetmate_notification_mode",
			"leetmate_notification_time",
			"leetmate_health_notification_threshold",
			"leetmate_happiness",
			"leetmate_notifications_enabled"
		]);

		timerType = data.leetmate_notification_mode;
		notifTime = data.leetmate_notification_time;
		notifHealth = data.leetmate_health_notification_threshold;
		curHealth = data.leetmate_happiness;
		notifEnabled = data.leetmate_notifications_enabled;

		if (!notifEnabled) return;
		
		//calculations
		doMath();
		//for debugging: set the calcSecs to 10secs
		//calcSecs = 10;

		//start the timer
		time = Date.now() + calcSecs * 1000;
		clearInterval(countdown);
		countdown = setInterval(() => {
			remainingTime = Math.max(0, Math.round((time - Date.now()) / 1000));

			//Remove if not debugging timer. Causes clutter. //Uncomment to test timer
			//console.log(`Time left: ${remainingTime}s`);

			if (remainingTime <= 0) {
				clearInterval(countdown);
				completeTimer();
			}
		}, 1000);
	}

	function doMath() {
		//math for seconds to time
		calcSecs = 0;
		let periodTime = 0;
		assumedTime = 0;
		if (timerType == "time") {

			//figure out the math for when the time is 24 hr+
			if (notifTime["period"] == "PM") {
				periodTime = 12;
			}

			let assumedHour = Number(notifTime["hour"]);
			let assumedMinute = Number(notifTime["minute"]);

			if (assumedHour == 12) {
				if (notifTime["period"] == "AM") {
					assumedHour += 0;
				}
				else {
					assumedHour = 12;
				}
			}

			assumedTime = (((periodTime + assumedHour) * 3600) + assumedMinute * 60); //seconds to reach a specific time in the day

			curTime = ((Date.now() - 25200000) % 86400000) / 1000; //current time in seconds of the day starting from midnight today UTC

			calcSecs = assumedTime - curTime;

			if (calcSecs < 0) {
				//if the time already passed, add a day
				calcSecs = 86400 - (curTime - assumedTime);
			}
		}
		else if (timerType == "health") {
			//1 pt of health is 1440 seconds
			calcSecs = (curHealth * 1440) - (notifHealth * 20 * 1440);

		}

		calcSecs = Math.trunc(calcSecs);

		//debugger to check math logic
		if (timerType == "time") {
			console.log(`Timer type is ${timerType}, the current time is ${curTime} and alarm should trigger at ${assumedTime}.`);
		}
		else if (timerType == "health") {
			console.log(`Timer type is ${timerType}, the current health is ${curHealth} and alarm should trigger in ${calcSecs} seconds.`);
		}
	}

	function completeTimer() {
		if ((timerType == "time" && timeFlag == true) || (timerType == "health")) {
			chrome.notifications.create({
				type: 'basic',
				iconUrl: chrome.runtime.getURL("assets/icons/leetmate128.png"),
				title: 'Time is up!',
				message: 'Have you done your daily Leetcode?',
				requireInteraction: true, // The notification will stay until the user interacts with it
				priority: 2
			});
		}

		//restart timer
		if (timerType == "time" && notifEnabled == true) {
			//if the timer is time based, it should restart the timer after ending (24 hours)
			timeFlag = !(timeFlag); //to prevent duplicate notifications
			startNotifTimer()
		}
	}

	function stopTimer() {
		//console.log("Trying to stop timer!");
		clearInterval(countdown);
		time = 0;
		remainingTime = 0;
		notifEnabled = false;
	}

	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		// if (message.action == "startTimer") {
		// 	notifEnabled = true;

		// 	chrome.storage.local.get(["leetmate_notifications_enabled"]).then((result) => {
		// 		loadLocalVars("notifEnabled", result["leetmate_notifications_enabled"]);
		// 	});

		// 	if (notifEnabled == true) {
		// 		startNotifTimer();

		// 		chrome.alarms.create("leetmate-reminder", {
		// 			delayInMinutes: 0
		// 		});
		// 	}
		// }
		// else if (message.action == "stopTimer") {
		// 	chrome.alarms.create("stop-timer", {
		// 		delayInMinutes: 0
		// 	});
		// }

		// sendResponse({ ok: true });
		// // no return true here
		// return;

		if (message.action === "startTimer") {
			startNotifTimer().then(() => sendResponse({ ok: true }));
			return true;
		}

		if (message.action === "stopTimer") {
			stopTimer();
			sendResponse({ ok: true });
		}
	});

	chrome.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name == "stop-timer") {
			//console.log("Stop timer alarm heard.");
			stopTimer();
		}
		return;
	});


	// Dummy listener to prevent "Receiving end does not exist" errors
	chrome.runtime.onConnect.addListener(() => { });


})();

