/**
 * auth-gate.js
 * 
 * Ensures that the user is authenticated before allowing them to access
 * protected screens (like Home). If no user is logged in, it redirects
 * them to the welcome screen (screens/start/index.html).
 * 
 * =========================================================================
 * HOW TO PROTECT NEW SCREENS:
 * =========================================================================
 * To make any new screen viewable ONLY when signed in, simply include this 
 * script at the very bottom of your new HTML file (just before </body>), 
 * AFTER including the Firebase scripts. 
 * 
 * Example:
 *   <script src="../../scripts/firebase-bundle.js"></script>
 *   <script src="../../scripts/firebase-config.js"></script>
 *   <script src="../../scripts/auth-gate.js"></script>
 * =========================================================================
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.warn('Firebase Auth is not available for auth gate.');
            // Fail safe: If firebase isn't loaded, maybe they shouldn't be here,
            // but let's just observe. We can redirect to popup to be safe.
            window.location.replace('../start/index.html');
            return;
        }

        var auth = firebase.auth();

        // Listen for auth state changes
        auth.onAuthStateChanged(function (user) {
            if (!user) {
                // Not signed in; redirect to Welcome (screens/start/index.html)
                window.location.replace('../start/index.html');
            }
        });

        // Optionally: check immediately before the observer fires
        // Note: currentUser might be null initially while Firebase initializes,
        // so onAuthStateChanged is the most reliable way.
    });
})();
