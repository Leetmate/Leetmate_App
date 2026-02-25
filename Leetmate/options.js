/**
 * options.js – Options page logic.
 *
 * Add logic here later, for example:
 *
 * - On load: read saved settings from chrome.storage.local (e.g. reminderTime, theme)
 *   and fill the form inputs.
 * - On Save click: write form values to chrome.storage.local and optionally
 *   chrome.runtime.sendMessage({ type: 'OPTIONS_SAVED', reminderTime: '...' }) so
 *   background.js can reschedule the daily reminder alarm.
 * - Show success or error in #status (e.g. "Options saved" or validation errors).
 * - Later: Firebase auth UI (sign in / sign out), link to account, theme picker.
 */

(function () {
  'use strict';

  // const reminderTime = document.getElementById('reminderTime');
  // const btnSave = document.getElementById('btnSave');
  // const status = document.getElementById('status');
  //
  // btnSave.addEventListener('click', function () {
  //   chrome.storage.local.set({ reminderTime: reminderTime.value }, function () {
  //     status.textContent = 'Options saved.';
  //     chrome.runtime.sendMessage({ type: 'OPTIONS_SAVED', reminderTime: reminderTime.value });
  //   });
  // });
  //
  // chrome.storage.local.get('reminderTime', function (data) {
  //   if (data.reminderTime) reminderTime.value = data.reminderTime;
  // });
})();
