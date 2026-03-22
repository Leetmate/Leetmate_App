/**
 * Template for firebase-config.js. Values are filled from .env by: npm run build:config
 * Do not load this file in the extension – the build outputs firebase-config.js.
 */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('Leetmate: Firebase compat scripts must be loaded before firebase-config.js');
    return;
  }

  var firebaseConfig = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'VITE_FIREBASE_APP_ID'
  };

  window.firebaseApp = firebase.initializeApp(firebaseConfig);
})();
