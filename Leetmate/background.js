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

(function () {
  'use strict';

  // Queue submissions from content script; Home will sync to Firestore when it loads
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
})();
