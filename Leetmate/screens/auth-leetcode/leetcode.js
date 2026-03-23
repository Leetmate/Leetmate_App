/**
 * Connect with LeetCode flow inside the popup.
 * States: initial -> success / failure.
 */
(function () {
  'use strict';

  var STATE_INITIAL = 'initial';
  var STATE_SUCCESS = 'success';
  var STATE_FAILURE = 'failure';

  var pollingIntervalId = null;
  var pollingTimeoutId = null;
  var pollingMs = 1500;
  var pollingTimeoutMs = 120000; // 2 minutes timeout

  var stateEls = {
    initial: document.getElementById('lc-state-initial'),
    success: document.getElementById('lc-state-success'),
    failure: document.getElementById('lc-state-failure')
  };

  var STORAGE_WAITING_KEY = 'leetcodeWaiting';
  var STORAGE_STARTED_AT_KEY = 'leetcodeStartedAt';
  var isWaiting = false;

  function setLoadingVisible(visible, text) {
    var overlay = document.getElementById('loading-overlay');
    var label = document.getElementById('loading-text');
    if (!overlay) return;
    if (label && text) label.textContent = text;
    overlay.classList.toggle('hidden', !visible);
  }

  function showLoading(text) {
    setLoadingVisible(true, text);
  }

  function hideLoading() {
    setLoadingVisible(false);
  }

  // Determine how the user arrived at this screen (signup vs signin)
  var fromParam = null;
  var isFromSignup = false;
  try {
    if (typeof URLSearchParams !== 'undefined') {
      var params = new URLSearchParams(window.location.search);
      fromParam = params.get('from');
      isFromSignup = fromParam === 'signup';
    }
  } catch (e) {
    isFromSignup = false;
  }

  function setState(next) {
    hideLoading();
    Object.keys(stateEls).forEach(function (key) {
      var el = stateEls[key];
      if (!el) return;
      if (key === next) {
        el.classList.add('lc-state--active');
      } else {
        el.classList.remove('lc-state--active');
      }
    });
  }

  function openLeetCodeLogin() {
    try {
      if (chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: 'https://leetcode.com/accounts/login/' });
      } else {
        window.open('https://leetcode.com/accounts/login/', '_blank');
      }
    } catch (e) {
      // fall back silently
      window.open('https://leetcode.com/accounts/login/', '_blank');
    }
  }

  function stopPolling() {
    isWaiting = false;
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      pollingTimeoutId = null;
    }
  }

  function setWaitingFlag(isWaiting) {
    if (!chrome || !chrome.storage || !chrome.storage.local) return;
    var payload = {};
    payload[STORAGE_WAITING_KEY] = !!isWaiting;
    payload[STORAGE_STARTED_AT_KEY] = isWaiting ? Date.now() : 0;
    chrome.storage.local.set(payload);
  }

  function pollForSession(remainingMs) {
    stopPolling();
    showLoading('Waiting for LeetCode sign-in...');

    var timeoutMs =
      typeof remainingMs === 'number' && remainingMs > 0
        ? remainingMs
        : pollingTimeoutMs;
    var start = Date.now();
    isWaiting = true;
    setWaitingFlag(true);

    function handleFailure(reason) {
      stopPolling();
      setWaitingFlag(false);
      hideLoading();
      var errEl = document.getElementById('lc-error-text');
      if (errEl) {
        errEl.textContent =
          reason || 'Unable to detect LeetCode login. Please try again.';
      }
      setState(STATE_FAILURE);
    }

    function onSessionDetected() {
      showLoading('Syncing your LeetCode account...');
      fetchLeetCodeProfile()
        .then(saveLeetCodeProfileToFirebase)
        .then(function () {
          stopPolling();
          setWaitingFlag(false);
          hideLoading();
          setState(STATE_SUCCESS);
        })
        .catch(function (err) {
          console.error('LeetCode sync failed', err);
          handleFailure('Failed to sync with LeetCode. Please try again.');
        });
    }

		// changed the cookie checking for LEETCODE_SESSION instead of any cookie
		pollingIntervalId = setInterval(function () {
			if (!chrome || !chrome.cookies || !chrome.cookies.getAll) {
				handleFailure('Extension does not have cookie access to leetcode.com.');
				return;
			}

			chrome.cookies.getAll(
				{ domain: 'leetcode.com', name: 'LEETCODE_SESSION' },
				function (cookies) {
					if (chrome.runtime && chrome.runtime.lastError) {
						handleFailure(chrome.runtime.lastError.message || 'Cookie lookup failed.');
						return;
					}

					if (cookies && cookies.length > 0) {
						stopPolling();
						setWaitingFlag(false);
						onSessionDetected();
						return;
					}

					if (Date.now() - start > timeoutMs) {
						handleFailure(
							'Timed out waiting for LeetCode login. Please make sure you are signed in on leetcode.com.'
						);
					}
				}
			);
		}, pollingMs);

    pollingTimeoutId = setTimeout(function () {
      handleFailure(
        'Timed out waiting for LeetCode login. Please make sure you are signed in on leetcode.com.'
      );
    }, timeoutMs + 5000);
  }

  function fetchLeetCodeProfile() {
    // Use a public LeetCode endpoint that is accessible with cookies.
    // This endpoint typically includes a "user_name" field.
    return fetch('https://leetcode.com/api/problems/all/', {
      credentials: 'include'
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('LeetCode API responded with ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        var username = data && (data.user_name || data.username || null);
				if (!username) {
					throw new Error("Leetcode did not return a signed-in username.");
				}
        // Only keep lightweight info; raw API payload is intentionally discarded
        // to avoid hitting Firestore's 1 MB document limit.
        return { username: username };
      });
  }

  function saveLeetCodeProfileToFirebase(profile) {
    if (typeof firebase === 'undefined') {
      return Promise.reject(new Error('Firebase is not available.'));
    }
    var auth = firebase.auth && firebase.auth();
    var db = firebase.firestore && firebase.firestore();
    if (!auth || !db) {
      return Promise.reject(
        new Error('Firebase Auth or Firestore not initialized.')
      );
    }
    var current = auth.currentUser;
    if (!current) {
      return Promise.reject(
        new Error('No signed-in user. Please sign in to Leetmate first.')
      );
    }

    var userRef = db.collection('users').doc(current.uid);
    var FieldValue = firebase.firestore.FieldValue;
    var payload = {
      // Simple, queryable fields for later use with LeetCode APIs
      leetcode: {
        username: profile.username || null,
        connected: true,
				linkedAt:
					FieldValue && FieldValue.serverTimestamp
						? FieldValue.serverTimestamp()
						: new Date(),
        lastSyncedAt:
          FieldValue && FieldValue.serverTimestamp
            ? FieldValue.serverTimestamp()
            : new Date()
      }
    };
    return userRef.set(payload, { merge: true })
      .then(function () {
        return setLeetCodeUsername(profile.username);
      });
  }



  document.addEventListener('DOMContentLoaded', function () {
    hideLoading();
    // On load, wait for Firebase Auth to resolve the current user.
    if (
      typeof firebase !== 'undefined' &&
      firebase.auth &&
      firebase.firestore
    ) {
      var auth = firebase.auth();
      var db = firebase.firestore();

      auth.onAuthStateChanged(function (user) {
        if (isWaiting) {
          // Already in an active waiting flow; don't override UI state here.
          return;
        }
        if (!user) {
          // No Leetmate session – send back to Welcome.
          window.location.href = '../start/index.html';
          return;
        }

        // Check whether we were already waiting from a previous popup instance.
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(
            [STORAGE_WAITING_KEY, STORAGE_STARTED_AT_KEY],
            function (res) {
              var waiting = !!res[STORAGE_WAITING_KEY];
              var startedAt = res[STORAGE_STARTED_AT_KEY] || 0;
              if (waiting && startedAt) {
                var elapsed = Date.now() - startedAt;
                var remaining = pollingTimeoutMs - elapsed;
                pollForSession(remaining > 0 ? remaining : pollingTimeoutMs);
                return;
              }

              // Not waiting: decide initial vs success based on Firestore.
              db.collection('users')
                .doc(user.uid)
                .get()
                .then(function (snap) {
                  var data = snap.exists ? snap.data() || {} : {};
                  if (data.leetcode && data.leetcode.connected) {
                    setState(STATE_SUCCESS);
                  } else {
                    setState(STATE_INITIAL);
                  }
                })
                .catch(function () {
                  setState(STATE_INITIAL);
                });
            }
          );
        } else {
          // Storage not available; just fall back to Firestore check.
          db.collection('users')
            .doc(user.uid)
            .get()
            .then(function (snap) {
              var data = snap.exists ? snap.data() || {} : {};
              if (data.leetcode && data.leetcode.connected) {
                setState(STATE_SUCCESS);
              } else {
                setState(STATE_INITIAL);
              }
            })
            .catch(function () {
              setState(STATE_INITIAL);
            });
        }
      });
    } else {
      // If Firebase isn't available for some reason, just show initial state.
      setState(STATE_INITIAL);
    }
    var connectBtn = document.getElementById('lc-connect-btn');
    var retryBtn = document.getElementById('lc-retry-btn');
    var choosePetBtn = document.getElementById('lc-choose-pet-btn');

    if (connectBtn) {
      connectBtn.addEventListener('click', function () {
        openLeetCodeLogin();
        pollForSession();
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        stopPolling();
        setState(STATE_INITIAL);
      });
    }

    if (choosePetBtn) {
      if (isFromSignup) {
        // New users coming from sign-up: keep "Choose your starter Pet" CTA.
        choosePetBtn.textContent = 'Choose your starter Pet';
        choosePetBtn.addEventListener('click', function () {
          // Placeholder navigation to starter pet selection screen.
          // Wire this up once the starter pet screen exists.
          window.location.href = '../auth-signup/index.html';
        });
      } else {
        // Existing users signing in: send them to the pet home screen.
        choosePetBtn.textContent = 'Go to Home';
        choosePetBtn.addEventListener('click', function () {
          window.location.href = '../home/index.html';
        });
      }
    }
  });
})();

