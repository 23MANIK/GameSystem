// Fake Firebase Auth: the "Google account" is window.__FAKE_GOOGLE_USER__,
// remembered in localStorage like the real SDK keeps you signed in.
const KEY = 'fake-auth-user';
const listeners = new Set();
let current = null;
try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { current = null; }
const notify = () => listeners.forEach(fn => fn(current));

export function getAuth() { return { get currentUser() { return current; } }; }
export function connectAuthEmulator() {}
export class GoogleAuthProvider { setCustomParameters() {} }
export function onAuthStateChanged(auth, fn) {
  listeners.add(fn);
  setTimeout(() => fn(current), 50);
  return () => listeners.delete(fn);
}
export async function signInWithPopup() {
  const u = window.__FAKE_GOOGLE_USER__;
  if (!u) { const e = new Error('closed'); e.code = 'auth/popup-closed-by-user'; throw e; }
  if (u.__error) { const e = new Error(u.__error); e.code = u.__error; throw e; }
  current = u;
  localStorage.setItem(KEY, JSON.stringify(u));
  notify();
  return { user: u };
}
export async function signOut() {
  current = null;
  localStorage.removeItem(KEY);
  notify();
}
// Deleting an account: window.__FAKE_RECENT_LOGIN__ = false makes the first try
// ask for a fresh sign-in, like Firebase does after a while.
export async function deleteUser(user) {
  if (window.__FAKE_RECENT_LOGIN__ === false) {
    const e = new Error('requires-recent-login'); e.code = 'auth/requires-recent-login'; throw e;
  }
  window.__fakeDeletedUsers = [...(window.__fakeDeletedUsers || []), user.uid];
  await signOut();
}
export async function reauthenticateWithPopup() {
  if (!window.__FAKE_GOOGLE_USER__) { const e = new Error('closed'); e.code = 'auth/popup-closed-by-user'; throw e; }
  window.__FAKE_RECENT_LOGIN__ = true;
  return { user: current };
}
