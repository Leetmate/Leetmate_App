(function () {
    'use strict';

    var STORAGE_KEY =
        window.LeetmateTheme && window.LeetmateTheme.STORAGE_KEY
            ? window.LeetmateTheme.STORAGE_KEY
            : 'leetmate_ui_theme';

    function applyUi(theme) {
        if (window.LeetmateTheme && typeof window.LeetmateTheme.apply === 'function') {
            window.LeetmateTheme.apply(theme);
        } else if (!theme || theme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    function persistTheme(theme) {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

        if (theme && theme !== 'light') {
            chrome.storage.local.set({ [STORAGE_KEY]: theme });
        } else {
            chrome.storage.local.remove(STORAGE_KEY);
        }
    }

    function setTheme(theme) {
        applyUi(theme);
        persistTheme(theme);
    }

    var defaultBtn = document.getElementById('theme-default-btn');
    if (defaultBtn) {
        defaultBtn.addEventListener('click', function () {
            setTheme('light');
        });
    }

    var darkBtn = document.getElementById('theme-dark-btn');
    if (darkBtn) {
        darkBtn.addEventListener('click', function () {
            setTheme('dark');
        });
    }

    var colorBtn = document.getElementById('theme-color-btn');
    var modal = document.getElementById('color-theme-modal');
    var closeBtn = document.getElementById('color-theme-close-btn');
    var backdrop = document.querySelector('[data-close-color-modal]');
    var swatches = document.querySelectorAll('[data-color-theme]');

    function openModal() {
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add('color-theme-modal-open');
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('color-theme-modal-open');
    }

    if (colorBtn && modal) {
        colorBtn.addEventListener('click', openModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeModal);
    }

    if (swatches.length) {
        swatches.forEach(function (swatch) {
            swatch.addEventListener('click', function () {
                var theme = swatch.getAttribute('data-color-theme');
                if (!theme) return;

                setTheme(theme);
                closeModal();
            });
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && modal && !modal.hidden) {
            closeModal();
        }
    });
})();

// --- Navigation ----
// Back button logic (in header)
const backBtn = document.getElementById("back-btn");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "../settings-main/index.html";
    }
  });
}