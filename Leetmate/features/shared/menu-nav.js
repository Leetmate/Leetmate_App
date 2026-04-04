/**
 * Navigation menu - inject shared drawer markup, open/close from trigger,
 * close on X / overlay / Esc, and restore focus to trigger on close.
 */
(function () {
  'use strict';

  function ensureNavMarkup() {
    if (document.getElementById('nav-overlay')) return;

    document.body.insertAdjacentHTML(
      'beforeend',
      [
        '<div class="nav-overlay" id="nav-overlay" aria-hidden="true">',
        '  <div class="nav-drawer" id="nav-drawer" role="dialog" aria-modal="true" aria-label="Main menu">',
        '    <button type="button" class="nav-close-btn" id="nav-close" aria-label="Close menu">×</button>',
        '    <nav class="nav-menu" id="nav-menu">',
        '      <button type="button" class="nav-menu-btn" id="home-btn">Home</button>',
        '      <button type="button" class="nav-menu-btn" id="playground-btn">Playground</button>',
        '      <button type="button" class="nav-menu-btn" id="store-btn">Store</button>',
        '      <button type="button" class="nav-menu-btn" id="community-btn">Community</button>',
        '      <button type="button" class="nav-menu-btn" id="activity-btn">Activity</button>',
        '      <button type="button" class="nav-menu-btn" id="settings-btn">Settings</button>',
                // TODO: Remove after testing
        '      <button type="button" class="nav-menu-btn" id="evolution-btn">Evolution</button>', 
        '    </nav>',
        '  </div>',
        '</div>'
      ].join('')
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureNavMarkup();

    var overlay = document.getElementById('nav-overlay');
    var trigger = document.getElementById('nav-trigger');
    var drawer = document.getElementById('nav-drawer');
    var closeBtn = document.getElementById('nav-close');

    if (!overlay || !trigger || !drawer || !closeBtn) return;

    var focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    function getFocusables(container) {
      return Array.prototype.slice.call(
        container.querySelectorAll(focusableSelector)
      );
    }

    function openNav() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
      document.addEventListener('keydown', handleKeydown);
    }

    function closeNav() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      trigger.focus();
      document.removeEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
      if (e.key === 'Escape') {
        closeNav();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = getFocusables(drawer);
      if (focusables.length === 0) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeNav();
    });

    trigger.addEventListener('click', openNav);
    closeBtn.addEventListener('click', closeNav);

    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'nav-drawer');
    trigger.setAttribute('aria-label', 'Open menu');

    var routes = {
      'activity-btn': '../activity/index.html',
      'community-btn': '../community-main/index.html',
      'home-btn': '../home/index.html',
      'playground-btn': '../playground-main/index.html',
      'settings-btn': '../settings-main/index.html',
      'store-btn': '../store-accessory/index.html',
      // TODO: Remove after testing
      'evolution-btn': '../evolution/index.html' 
    };

    Object.keys(routes).forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      button.addEventListener('click', function () {
        window.location.href = routes[id];
      });
    });
  });
})();
