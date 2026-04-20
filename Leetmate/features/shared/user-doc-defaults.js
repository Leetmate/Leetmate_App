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
    if (!uid) return Promise.reject(new Error('Missing uid'));
  
    var userRef = db.collection('users').doc(uid);
    var friendsMetaRef = db.collection('users').doc(uid).collection('friends').doc('_meta');
  
    return db.runTransaction(function (transaction) {
      return Promise.all([
        transaction.get(userRef),
        transaction.get(friendsMetaRef)
      ]).then(function (results) {
        var userSnap = results[0];
        var friendsMetaSnap = results[1];
  
        if (userSnap.exists) {
          var userData = userSnap.data() || {};
  
          if (!Object.prototype.hasOwnProperty.call(userData, 'savedHappiness')) {
            transaction.set(userRef, {
              savedHappiness: null,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
  
          if (!friendsMetaSnap.exists) {
            transaction.set(friendsMetaRef, {
              initializedAt: firebase.firestore.FieldValue.serverTimestamp(),
              version: 1
            });
          }
  
          return;
        }
  
        if (!username) {
          throw new Error('Missing username');
        }
  
        var canonicalUsername = String(username).trim();
        var usernameRef = db.collection('usernames').doc(canonicalUsername);
  
        return transaction.get(usernameRef).then(function (usernameSnap) {
          if (usernameSnap.exists) {
            var usernameData = usernameSnap.data() || {};
            if (usernameData.uid && usernameData.uid !== uid) {
              throw new Error('That username is already taken.');
            }
          }
  
          transaction.set(userRef, createUserDoc(uid, email, canonicalUsername));
  
          transaction.set(usernameRef, {
            uid: uid,
            username: canonicalUsername,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
  
          if (!friendsMetaSnap.exists) {
            transaction.set(friendsMetaRef, {
              initializedAt: firebase.firestore.FieldValue.serverTimestamp(),
              version: 1
            });
          }
        });
      });
    });
  }

  window.LeetmateUserDoc = {
    createUserDoc: createUserDoc,
    ensureUserDoc: ensureUserDoc,
    PET_SCHEMA: PET_SCHEMA
  };
})();