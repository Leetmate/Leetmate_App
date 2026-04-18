(function () {
    'use strict';

    var STORAGE_KEY = 'leetmate_ui_theme';

    function apply(theme) {
        var root = document.documentElement;

        if (!theme || theme === 'light') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', theme);
        }
    }

    // Load saved theme early
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
            apply(result[STORAGE_KEY]);
        });
    }

    // Expose globally
    window.LeetmateTheme = window.LeetmateTheme || {};
    window.LeetmateTheme.apply = apply;
    window.LeetmateTheme.STORAGE_KEY = STORAGE_KEY;
})();