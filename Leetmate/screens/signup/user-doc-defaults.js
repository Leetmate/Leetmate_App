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
    return {
      uid: uid || null,
      email: email || '',
      username: username || '',
      xp: 0, // level is derived from XP: level = floor(xp/100) + 1
      level: 1,
      coins: 0,
      leetcode: {
        username: null,
        connected: false
      },

      // Pets / inventory / social (references only; assets are local)
      pets: [], // array of PET_SCHEMA objects (see PET_SCHEMA)
      selectedPetIndex: null, // which pet is currently active/profile (index into pets[])
      friends: [], // array of user UIDs (references)
      itemsOwned: [], // array of item ids (references)

      createdAt: (function () {
        if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp) {
          return firebase.firestore.FieldValue.serverTimestamp();
        }
        return new Date();
      })()
    };
  }

  window.LeetmateUserDoc = {
    createUserDoc: createUserDoc,
    PET_SCHEMA: PET_SCHEMA
  };
})();
