/**
 * Firestore user document shape (schema) for Leetmate.
 * Used on sign-up to create `users/{uid}` with the full set of fields your app will later update.
 *
 * Note: Pets/items/friends are stored as references/IDs; assets live in the extension bundle.
 */
(function () {
  'use strict';

  /**
   * Pet object shape (stored inside `pets[]`).
   * New users start with `pets: []`. When you later add a pet, create objects matching this shape.
   */
  var PET_SCHEMA = {
    petRef: null, // string asset id, e.g. "CubicCat"
    equippedItemRef: null, // string item id (optional)
    profileBgColors: { primary: null, secondary: null }, // chosen colors for profile background
    stats: {
      age: 0,
      level: 1,
      happiness: 100,
      xp: 0,
      streak: 0,
      coins: 0
    }
  };

  /**
   * Builds the Firestore user document for a new sign-up (users/{uid}).
   * This is only the initial schema—your app will update these fields later.
   */
  function createUserDoc(uid, email, username) {
    var now = (function () {
      if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp) {
        return firebase.firestore.FieldValue.serverTimestamp();
      }
      return new Date();
    })();

    return {
      uid: uid || null,
      email: email || '',
      username: username || '',
			activePetId: null,
      leetcode: {
        username: null,
        connected: false,
				lastSyncedAt: null,
      },
      xp: 0, // level is derived from XP: level = floor(xp/100) + 1
      level: 1,
      coins: 0,
      savedHappiness: null,
			trophy: 0,
			premium: false,
			lastFedTime: null,
      streak: 0,
      streakFreezeEnd: null,
			equippedItemId: null,
			settings: {
				easyMode: false,
				volume: 100,
				profileColor: null,
				reminders: {
					enabled: false,
					type: 'time',
					setTime: '00:00',
					setHealth: 100
				}
			},

			updatedAt: now,
			createdAt: now,
    };
  }

  function ensureUserDoc(db, uid, email, username) {
    if (!db) return Promise.reject(new Error('Firestore not loaded'));

    var userRef = db.collection('users').doc(uid);
    return userRef.get().then(function (snap) {
      if (snap.exists) {
        var data = snap.data() || {};
        if (!Object.prototype.hasOwnProperty.call(data, 'savedHappiness')) {
          return userRef.set(
            {
              savedHappiness: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
        return Promise.resolve();
      }
      return userRef.set(createUserDoc(uid, email, username));
    });
  }

  function ensureUsernameDoc(db, uid, username) {
    if (!db) return Promise.reject(new Error("Firestore not loaded"));
    if (!uid) return Promise.reject(new Error("Missing uid"));
    if (!username) return Promise.reject(new Error("Missing username"));
  
    var usernameRef = db.collection("usernames").doc(username);
  
    return db.runTransaction(function (transaction) {
      return transaction.get(usernameRef).then(function (snap) {
        if (snap.exists) {
          var data = snap.data() || {};
          if (data.uid && data.uid !== uid) {
            throw new Error("That username is already taken.");
          }
        }
  
        transaction.set(usernameRef, {
          uid: uid,
          username: username,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
    });
  }

  window.LeetmateUserDoc = {
    createUserDoc: createUserDoc,
    ensureUserDoc: ensureUserDoc,
    ensureUsernameDoc: ensureUsernameDoc,
    PET_SCHEMA: PET_SCHEMA
  };
})();
