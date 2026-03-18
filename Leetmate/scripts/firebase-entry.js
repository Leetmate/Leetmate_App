// Bundled Firebase for extension pages (MV3-safe, local file only).
// Uses compat API so existing code (firebase.auth(), firebase.firestore()) keeps working.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Expose the compat namespace globally for existing scripts.
// firebase-config.js, signup.js, signin.js expect `window.firebase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window /** @type {any} */).firebase = firebase;

