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
	"features/progression/streak.js",
	"features/pet/pet-evolution.js",
	"features/pet/evolution-notify.js",
	"features/pet/pet-age.js"
);
(function () {
	'use strict';

	let notifEnabled = null;

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
		});
		
		if (notifEnabled == true) {
			startNotifTimer();
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

	async function loadLocalVars(cusVar, newVal) {
		if (cusVar == "timerType") {
			timerType = newVal;
			//console.log(`timerType is: ${timerType}`);
		}
		else if (cusVar == "notifTime") {
			notifTime = JSON.parse(JSON.stringify(newVal, null, 2));
			//notifTime = JSON.stringify(newVal, null, 2);
			//console.log(`notifTime is: ${notifTime}`);
			//console.log(`notifTime is: ${notifTime}`);
		}
		else if (cusVar == "notifHealth") {
			notifHealth = newVal;
			//console.log(`notifHealth is: ${notifHealth}`);
		}
		else if (cusVar == "curHealth") {
			curHealth = newVal;
			//console.log(`curHealth is: ${curHealth}`);
		}
		else if (cusVar == "notifEnabled") {
			notifEnabled = newVal;
			console.log(`notifEnabled is: ${notifEnabled}`);
		}
	}

	//async function calculateTimer() {
	async function startNotifTimer() {
		//debugger status
		console.log("Starting startNotifTimer()");

		await chrome.storage.local.get(["leetmate_notification_mode"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("timerType", result["leetmate_notification_mode"]);
		});

		await chrome.storage.local.get(["leetmate_notification_time"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("notifTime", result["leetmate_notification_time"]);
		});

		await chrome.storage.local.get(["leetmate_health_notification_threshold"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("notifHealth", result["leetmate_health_notification_threshold"]);
		});

		await chrome.storage.local.get(["leetmate_happiness"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("curHealth", result["leetmate_happiness"]);
		});

		await chrome.storage.local.get(["leetmate_notifications_enabled"]).then((result) => {
			//console.log("Value is " + result.key);
			loadLocalVars("notifEnabled", result["leetmate_notifications_enabled"]);
		});

		//calculations
		doMath();
		//for debugging: set the calcSecs to 10secs
		//calcSecs = 10;

		//start the timer
		time = Date.now() + calcSecs * 1000; //set as calculation for actual time later
		//console.log(`assumedTime: ${assumedTime}; time: ${time}`);
		clearInterval(countdown);
		countdown = setInterval(() => {
			remainingTime = Math.max(0, Math.round((time - Date.now()) / 1000));

			//Remove if not debugging timer. Causes clutter.
			console.log(`Time left: ${remainingTime}s`);

			if (remainingTime <= 0) {
				clearInterval(countdown);
				completeTimer();
			}
		}, 1000);
	}



	/*function getFromStorage(keys) {
		return new Promise((resolve, reject) => {
			try {
				chrome.storage.local.get(keys, (result) => {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					}
					else {
						resolve(result);
					}
				});
			} catch (err) {
				reject(err);
			}
		});
	}

	async function calculateTimer() {
		try {
			timerType = await getFromStorage(["leetmate_notification_mode"]);
			notifTime = await getFromStorage(["leetmate_notification_time"]);
			notifHealth = await getFromStorage(["leetmate_health_notification_threshold"]);
			curHealth = await getFromStorage(["leetmate_happiness"]);
			notifEnabled = await getFromStorage(["leetmate_notifications_enabled"]);

			doMath();
		} catch (error) {
			console.error('Error getting storage data:', error);
		}
	}*/

	function doMath() {
		//("doMath() is running");

		//debugger to check math
		if (timerType == "time") {
			//console.log(`Timer type is ${timerType}, the current time is ${Date.now() * 1000} and alarm should trigger at ${notifTime["hour"]}.`);
		}
		else if (timerType == "health") {
			//console.log(`Timer type is ${timerType}, the current health is ${curHealth} and alarm should trigger at ${notifHealth * 20}.`);
		}

		//math for seconds to time
		calcSecs = 0;
		let periodTime = 0;
		assumedTime = 0;
		if (timerType == "time") {

			//figure out the math for when the time is 24 hr+
			if (notifTime["period"] == "PM") {
				periodTime = 12;
			}
			//console.log(`periodTime: ${periodTime}`);

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

			//time zone is UTC+7
			//assumedTime = assumedTime + 25200; //this is local time

			//console.log(`notifTime["period"]: ${notifTime["period"]}`);
			//console.log(`assumedHour: ${assumedHour}`)
			//console.log(`assumedMinute: ${assumedMinute}`)
			//console.log(`Time based alarm should run trigger at ${calcSecs}`);

			curTime = ((Date.now() - 25200000) % 86400000) / 1000; //current time in seconds of the day starting from midnight today UTC
			//curTime = curTime + 25200; //make local time PST
			console.log(`It is currently ${curTime} in PST and will be ${assumedTime} in PST (in seconds).`);

			//let startDay = (Date.now() - Date.now()%86400000)/86400000; //trying to determine number of whole days since 1/1/1970
			let startDay = (Date.now() - Date.now() % 86400000); //trying to determine number of whole days since 1/1/1970
			console.log(`It has been ${startDay} milliseconds since January 1, 1970.`);
			//console.log(`It has been ${startDay} milliseconds since midnight.`);
			calcSecs = assumedTime - curTime;
			console.log(`seconds from midnight: ${calcSecs}`);

			if (calcSecs < 0) {
				//if the time already passed, add a day
				//calcSecs = calcSecs + 86400;
				/*while (calcSecs == 86400 || calcSecs == 0)
				{
					calcSecs = 86400 - (curTime - assumedTime);
				}*/
				calcSecs = 86400 - (curTime - assumedTime);
			}
		}
		else if (timerType == "health") {
			//1 pt of health is 1440 seconds
			calcSecs = (curHealth * 1440) - (notifHealth * 20 * 1440);

		}

		//console.log(`Timer should run for ${calcSecs} seconds.`)
		calcSecs = Math.trunc(calcSecs);
		console.log(`calcSecs after Trunc: ${calcSecs}`);

		//debugger to check math logic
		if (timerType == "time") {
			console.log(`Timer type is ${timerType}, the current time is ${curTime} and alarm should trigger at ${assumedTime}.`);
		}
		else if (timerType == "health") {
			console.log(`Timer type is ${timerType}, the current health is ${curHealth} and alarm should trigger in ${calcSecs} seconds.`);
		}
		//return calcSecs;
	}

	/*async function startNotifTimer() {
		console.log("Starting Timer!");

		//await calculateTimer();
		//calcSecs = 10;
		await calculateTimer();

		time = Date.now() + calcSecs * 1000; //set as calculation for actual time later
		console.log(`assumedTime: ${assumedTime}; time: ${time}`);
		clearInterval(countdown);
		countdown = setInterval(() => {
			remainingTime = Math.max(0, Math.round((time - Date.now()) / 1000));

			//Remove if not debugging timer. Causes clutter.
			console.log(`Time left: ${remainingTime}s`);

			if (remainingTime <= 0) {
				clearInterval(countdown);
				completeTimer();
			}
		}, 1000);
	}*/

	function completeTimer() {
		//clearInterval(countdown); //stop countdown
		chrome.notifications.create({
			type: 'basic',
			iconUrl: chrome.runtime.getURL("assets/icons/leetmate128.png"),
			title: 'Time is up!',
			message: 'Have you done your daily Leetcode?',
			requireInteraction: true, // The notification will stay until the user interacts with it
			priority: 2
		});

		//restart timer
		if (timerType == "time" && notifEnabled == true) {
			//if the timer is time based, it should restart the timer after ending (24 hours)
			startNotifTimer()
		}
	}

	function stopTimer() {
		console.log("Trying to stop timer!");
		clearInterval(countdown);
		time = 0;
		remainingTime = 0;
		notifEnabled = false;
	}

	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.action == "startTimer") {
			//customTime = message.payload;
			//console.log(`Number passed to timer: ${message.payload}`);
			notifEnabled = true;
			console.log(`notifEnabled: ${notifEnabled}`);

			if (notifEnabled == true) {
				startNotifTimer();

				console.log("Creating timer alarm!");
				chrome.alarms.create("leetmate-reminder", {
					delayInMinutes: 0
				});
			}
		}
		else if (message.action == "stopTimer") {
			chrome.alarms.create("stop-timer", {
				delayInMinutes: 0
			});
		}

		//console.log("Leetmate: startNotificationTimer received.");

		/*chrome.notifications.create({
		  type: "basic",
		  iconUrl: chrome.runtime.getURL("assets/icons/leetmate128.png"),
		  title: "Button works",
		  message: "The click reached background.js",
		  priority: 2
		});*/

		sendResponse({ ok: true });
		// no return true here
		return;
	});

	chrome.alarms.onAlarm.addListener((alarm) => {
		if (alarm.name == "leetmate-reminder") {
			//await startNotifTimer();
			/*event.waitUntil(
				(async () => {
					await startNotifTimer();
				}) ()
			);*/
		}
		else if (alarm.name == "stop-timer") {
			console.log("Stop timer alarm heard.");
			stopTimer();
		}

		//console.log("Leetmate: reminder alarm fired.");

		/*chrome.notifications.create({
		  type: "basic",
		  iconUrl: "assets/icons/leetmate128.png",
		  title: "It's time!",
		  message: "Make sure to check your leetmate!",
		  requireInteraction: true,
		  priority: 2
		  });*/

		return;
	});


	// Dummy listener to prevent "Receiving end does not exist" errors
	chrome.runtime.onConnect.addListener(() => { });


})();

