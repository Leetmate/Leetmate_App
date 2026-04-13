(function () {
    'use strict';

    var STORAGE_KEY =
        window.LeetmateTheme && window.LeetmateTheme.STORAGE_KEY
            ? window.LeetmateTheme.STORAGE_KEY
            : 'leetmate_ui_theme';

    function applyUi(theme) {
        if (window.LeetmateTheme && typeof window.LeetmateTheme.apply === 'function') {
            window.LeetmateTheme.apply(theme);
        } else if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function persistDark(on) {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
        if (on) {
            chrome.storage.local.set({ leetmate_ui_theme: 'dark' });
        } else {
            chrome.storage.local.remove(STORAGE_KEY);
        }
    }

    var defaultBtn = document.getElementById('theme-default-btn');
    if (defaultBtn) {
        defaultBtn.addEventListener('click', function () {
            applyUi('light');
            persistDark(false);
        });
    }

    var darkBtn = document.getElementById('theme-dark-btn');
    if (darkBtn) {
        darkBtn.addEventListener('click', function () {
            applyUi('dark');
            persistDark(true);
        });
    }
})();
