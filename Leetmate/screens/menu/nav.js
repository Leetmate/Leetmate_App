/**
 * Navigation menu – open/close from hamburger, close on X / overlay / Esc.
 * Focus trap and return focus to trigger on close.
 */
(function () {
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
    return Array.prototype.slice.call(container.querySelectorAll(focusableSelector));
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
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
  closeBtn.setAttribute('aria-label', 'Close menu');

  // Navigation Logic
  var navMenu = document.getElementById('nav-menu');
  if (navMenu) {
    var navButtons = navMenu.querySelectorAll('.nav-menu-btn');
    for (var i = 0; i < navButtons.length; i++) {
      navButtons[i].addEventListener('click', function(e) {
        // Only run routing for default buttons without custom inline onclick handlers
        // Wait, some have onclicks inline, but this will just act globally
        var screenName = e.target.textContent.trim().toLowerCase();
        window.location.href = '../' + screenName + '/index.html';
      });
    }
  }
})();
