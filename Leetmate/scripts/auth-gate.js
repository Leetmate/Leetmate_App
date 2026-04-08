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
            } else {
                // User is signed in. Now check if they have an active pet.
                // But only if they aren't already on an auth or starter page.
                var path = window.location.pathname;
                var isAuthPage = path.indexOf('/auth-') !== -1 || path.indexOf('/start/') !== -1;
                
                if (!isAuthPage) {
                    var db = firebase.firestore();
                    db.collection('users').doc(user.uid).get().then(function(snap) {
                        var data = snap.exists ? snap.data() : {};
                        if (!data.activePetId) {
                            // Only Home should bounce directly into starter selection.
                            // Other protected screens should route back to Home first so
                            // the user does not get dropped into onboarding unexpectedly.
                            if (window.location.pathname.indexOf('/home/') !== -1) {
                                window.location.replace('../auth-starters/index.html');
                            } else {
                                window.location.replace('../home/index.html');
                            }
                        } else {
                            // Pet found. 
                            // HOME screening: pet-loader.js will handle the reveal after sprite is ready.
                            // Other pages: reveal immediately.
                            if (window.location.pathname.indexOf('/home/') === -1) {
                                document.body.classList.remove('hidden-on-load');
                            }
                        }
                    }).catch(function(err) {
                        console.error('Auth gate firestore error:', err);
                        // Fallback reveal in case of error (better to show home than nothing)
                        document.body.classList.remove('hidden-on-load');
                    });
                } else {
                    // Auth page, reveal content immediately
                    document.body.classList.remove('hidden-on-load');
                }
            }
        });

        // Optionally: check immediately before the observer fires
        // Note: currentUser might be null initially while Firebase initializes,
        // so onAuthStateChanged is the most reliable way.
    });
})();
