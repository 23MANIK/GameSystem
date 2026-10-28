/**
 * Firebase settings for Google sign-in, cloud saves and analytics.
 *
 * Paste the web app config from the Firebase console here
 * (Project settings → Your apps → Web app → SDK setup → Config).
 * These values are public by design: what protects the data is the
 * Firestore security rules (firebase/firestore.rules) and the list of
 * authorized domains in Firebase Auth. See docs/firebase/SETUP.md.
 *
 * Set to null to turn every Firebase feature off: no sign-in button,
 * no network calls, and the game saves in this browser only.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyACD1LD0cEHYQf7KpPdBKo8ID0QlaCTDG0',
  authDomain: 'scale-architect.firebaseapp.com',
  projectId: 'scale-architect',
  storageBucket: 'scale-architect.firebasestorage.app',
  messagingSenderId: '1025189332700',
  appId: '1:1025189332700:web:dc9323c5a6c4dcaeaad619',
  measurementId: 'G-BP1SWTZLLX'
};

/** The Firebase JS SDK version loaded from Google's CDN (gstatic). */
export const FIREBASE_SDK_VERSION = '12.19.0';
