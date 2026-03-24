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
      username: username || '',
      email: email || '',
      activePetId: null, // selected pet ID from the pets/ subcollection
      xp: 0,
      coins: 0,
      level: 1,
      streak: 0,
      trophy: 0,
      freezeEndDate: null,
      premium: false,
      leetcode: {
        username: null,
        connected: false,
        lastSyncedAt: null
      },
      settings: {
        vacationMode: false,
        volume: 80,
        profileColor: '#4f46e5',
        reminders: {
          enabled: false,
          type: 'daily',
          setTime: '09:00',
          setHealth: 100
        }
      },
      updatedAt: now,
      createdAt: now
    };
  }

  window.LeetmateUserDoc = {
    createUserDoc: createUserDoc,
    PET_SCHEMA: PET_SCHEMA
  };
})();
