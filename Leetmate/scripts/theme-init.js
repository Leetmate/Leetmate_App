/**
 * Applies saved UI theme before / as soon as extension storage resolves.
 * Include in <head> on every HTML entry so screens stay consistent.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'leetmate_ui_theme';

    function apply(theme) {
        var root = document.documentElement;
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else {
            root.removeAttribute('data-theme');
        }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], function (result) {
            apply(result[STORAGE_KEY]);
        });
    }

    window.LeetmateTheme = window.LeetmateTheme || {};
    window.LeetmateTheme.apply = apply;
    window.LeetmateTheme.STORAGE_KEY = STORAGE_KEY;
})();
