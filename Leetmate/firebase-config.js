/**
 * Firebase config – generated from .env (see firebase-config.template.js for variable names). Do not edit.
 */
(function () {
  'use strict';

  if (typeof firebase === 'undefined') {
    console.error('Leetmate: Firebase compat scripts must be loaded before firebase-config.js');
    return;
  }

  var firebaseConfig = {
    apiKey: 'AIzaSyBMlc828WEQ_JEV_sNkn4Bo5r3Tl3opSak',
    authDomain: 'leetmate-b4182.firebaseapp.com',
    projectId: 'leetmate-b4182',
    storageBucket: 'leetmate-b4182.firebasestorage.app',
    messagingSenderId: '1083358894790',
    appId: '1:1083358894790:web:d4250321f3a0ff618195c7'
  };

  window.firebaseApp = firebase.initializeApp(firebaseConfig);
})();
