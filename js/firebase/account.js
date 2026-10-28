/**
 * account.js — the player's account: Google sign-in (Firebase Auth), cloud
 * saves (Firestore) and gameplay analytics (Google Analytics for Firebase).
 *
 * Everything here is optional. With no Firebase config (js/firebase/config.js)
 * nothing loads and the game keeps saving in this browser only. Any Firebase
 * failure (offline, blocked by an ad blocker, …) is logged and ignored: the
 * game never waits on it for more than a few seconds.
 *
 * The SDK comes from Google's CDN as ES modules, so the game still has no
 * build step. Tests swap those URLs for a fake (tests/e2e/fixtures/fake-firebase).
 *
 * Firestore layout (rules: firebase/firestore.rules):
 *   users/{uid} = { save, savedAt, productId, level, levelCompleted,
 *                   progress: { [productId]: levels completed },
 *                   name, email, photoURL, createdAt, lastSeen }
 */

import { FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from './config.js';
import { SAVE_KEY } from '../game/GameState.js';
import { chooseSave, saveSummary, mergeProgress } from './cloudSave.js';

const SAVED_AT = 'sa-save-at';         // when this browser last saved the game (ms)
const LAST_SYNC = 'sa-cloud-sync';     // { uid, savedAt } of the last upload/download
const SIGNED_IN = 'sa-signed-in';      // hint: wait for sign-in on startup
const PUSH_DELAY_MS = 20_000;          // batch saves: at most one upload per 20 s

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  json: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
};

/** Settings: a test can inject { config, emulator }, or { off: true }, before the page loads. */
function settings() {
  const injected = typeof window !== 'undefined' ? window.__SA_FIREBASE__ : null;
  if (injected?.off) return null;
  if (injected?.config) return injected;
  return FIREBASE_CONFIG ? { config: FIREBASE_CONFIG } : null;
}

const sdkUrl = name => `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-${name}.js`;

class Account {
  constructor() {
    this.settings = settings();
    this.enabled = Boolean(this.settings);
    this.user = null;          // { uid, name, email, photoURL } or null
    this.ready = false;        // Firebase answered "signed in or not"
    this.listeners = new Set();
    this.pending = [];         // analytics events logged before the SDK loaded
    this.cloudProgress = {};
    this.pushTimer = null;
    this.loading = null;
  }

  /** Start loading Firebase in the background. Safe to call more than once. */
  start() {
    if (!this.enabled) return Promise.resolve(false);
    if (!this.loading) this.loading = this.load().catch(err => {
      console.warn('Firebase unavailable, playing offline:', err);
      this.enabled = false;
      this.ready = true;
      this.emit();
      return false;
    });
    return this.loading;
  }

  async load() {
    const [app, auth, store] = await Promise.all([
      import(sdkUrl('app')), import(sdkUrl('auth')), import(sdkUrl('firestore'))
    ]);
    const { config, emulator } = this.settings;
    this.app = app.initializeApp(config);
    this.authSdk = auth;
    this.fs = store;
    this.auth = auth.getAuth(this.app);
    this.db = store.getFirestore(this.app);
    if (emulator) {
      auth.connectAuthEmulator(this.auth, emulator.auth, { disableWarnings: true });
      store.connectFirestoreEmulator(this.db, emulator.firestoreHost, emulator.firestorePort);
    }
    this.loadAnalytics(config, emulator);

    await new Promise(resolve => {
      auth.onAuthStateChanged(this.auth, (u) => {
        const was = this.user?.uid;
        this.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photoURL: u.photoURL || '' } : null;
        if (this.user) ls.set(SIGNED_IN, '1'); else ls.del(SIGNED_IN);
        this.ready = true;
        if (was !== this.user?.uid) this.analytics?.setUserId?.(this.analyticsObj, this.user?.uid || null);
        this.emit();
        resolve();
      });
    });
    return true;
  }

  /** Analytics is best effort: ad blockers often stop it, and it is off in the emulator. */
  async loadAnalytics(config, emulator) {
    if (!config.measurementId || emulator) return;
    try {
      const a = await import(sdkUrl('analytics'));
      if (!(await a.isSupported())) return;
      this.analytics = a;
      this.analyticsObj = a.getAnalytics(this.app);
      if (this.user) a.setUserId(this.analyticsObj, this.user.uid);
      for (const [name, params] of this.pending.splice(0)) a.logEvent(this.analyticsObj, name, params);
    } catch (err) {
      console.warn('Analytics unavailable:', err);
    }
  }

  /** Was a player signed in on this browser last time? (Then startup waits for them.) */
  get probablySignedIn() {
    return this.enabled && ls.get(SIGNED_IN) === '1';
  }

  /** Resolve once Firebase knows who is signed in, or after `ms`, whichever comes first. */
  whenReady(ms = 3000) {
    if (!this.enabled) return Promise.resolve();
    return Promise.race([this.start(), new Promise(r => setTimeout(r, ms))]);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) {
      try { fn(this.user); } catch (err) { console.error(err); }
    }
  }

  /** Google sign-in in a popup. Resolves with the user, or null if they closed it. */
  async signIn() {
    await this.start();
    if (!this.auth) throw new Error('Sign-in is not available right now.');
    const provider = new this.authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await this.authSdk.signInWithPopup(this.auth, provider);
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return null;
      throw err;
    }
    this.log('login', { method: 'Google' });
    return this.user;
  }

  /** Sign out. The save stays in this browser; it is no longer uploaded. */
  async signOut() {
    await this.flush();
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    if (this.auth) await this.authSdk.signOut(this.auth);
  }

  /**
   * Delete the signed-in player's account: their profile and cloud save in
   * Firestore, then the Firebase Auth user. Google may ask them to pick their
   * account again first (deleting needs a recent sign-in). The game saved in
   * this browser stays. Returns false if they closed that Google window.
   */
  async deleteAccount() {
    if (!this.user || !this.auth) return false;
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    const authUser = this.auth.currentUser;
    const del = () => this.authSdk.deleteUser(authUser);
    // If Google wants a fresh sign-in, the data is already gone; a closed
    // window then leaves just the empty login, and the next save recreates the cloud save
    try {
      await this.fs.deleteDoc(this.fs.doc(this.db, 'profiles', this.user.uid));
      await this.fs.deleteDoc(this.userDoc());
      this.exists = false;
      await del();
    } catch (err) {
      if (err?.code !== 'auth/requires-recent-login') throw err;
      const provider = new this.authSdk.GoogleAuthProvider();
      try {
        await this.authSdk.reauthenticateWithPopup(authUser, provider);
      } catch (e) {
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return false;
        throw e;
      }
      await del();
    }
    ls.del(LAST_SYNC);
    this.log('account_deleted');
    return true;
  }

  /** The signed-in player's Firestore document. */
  userDoc() {
    return this.fs.doc(this.db, 'users', this.user.uid);
  }

  /**
   * Bring this browser and the cloud in line: download the cloud save if it is
   * newer, otherwise upload this one. Returns 'pull', 'push', 'same' or 'none'.
   */
  async sync() {
    if (!this.user || !this.db) return 'none';
    const snap = await this.fs.getDoc(this.userDoc());
    const data = snap.exists() ? snap.data() : null;
    this.cloudProgress = data?.progress || {};
    this.exists = Boolean(data);
    const local = { json: ls.get(SAVE_KEY), savedAt: Number(ls.get(SAVED_AT)) || 0 };
    const cloud = data?.save ? { json: data.save, savedAt: data.savedAt || 0 } : null;
    const choice = chooseSave({ local, cloud, uid: this.user.uid, lastSync: ls.json(LAST_SYNC) });
    if (choice === 'pull') {
      ls.set(SAVE_KEY, cloud.json);
      ls.set(SAVED_AT, String(cloud.savedAt));
      ls.set(LAST_SYNC, JSON.stringify({ uid: this.user.uid, savedAt: cloud.savedAt }));
    } else if (choice === 'push') {
      await this.push();
    } else {
      // Nothing to move: still record the visit (and the profile, the first time)
      await this.writeDoc({});
      if (choice === 'same') ls.set(LAST_SYNC, JSON.stringify({ uid: this.user.uid, savedAt: cloud.savedAt }));
    }
    return choice;
  }

  async writeDoc(fields) {
    const u = this.user;
    const doc = {
      ...fields,
      name: u.name, email: u.email, photoURL: u.photoURL,
      lastSeen: this.fs.serverTimestamp()
    };
    if (!this.exists) doc.createdAt = this.fs.serverTimestamp();
    await this.fs.setDoc(this.userDoc(), doc, { merge: true });
    this.exists = true;
  }

  /** Upload this browser's save now. */
  async push() {
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    if (!this.user || !this.db) return;
    const json = ls.get(SAVE_KEY);
    if (!json) return;
    const savedAt = Number(ls.get(SAVED_AT)) || Date.now();
    const summary = saveSummary(json);
    this.cloudProgress = mergeProgress(this.cloudProgress, summary);
    const uid = this.user.uid;
    await this.writeDoc({ save: json, savedAt, ...summary, progress: this.cloudProgress });
    ls.set(LAST_SYNC, JSON.stringify({ uid, savedAt }));
  }

  /** The game just saved in this browser: note when, and upload it soon. */
  noteLocalSave({ urgent = false } = {}) {
    ls.set(SAVED_AT, String(Date.now()));
    if (!this.user) return;
    if (urgent) { this.flush(true); return; }
    if (!this.pushTimer) this.pushTimer = setTimeout(() => this.flush(), PUSH_DELAY_MS);
  }

  /** Upload now if an upload is waiting (or always, with force). Never throws. */
  async flush(force = false) {
    if (!this.user || (!this.pushTimer && !force)) return;
    try { await this.push(); } catch (err) { console.warn('Cloud save failed (will retry on the next save):', err); }
  }

  /** A gameplay event for analysis. Works signed in or not. */
  log(name, params = {}) {
    if (!this.enabled) return;
    if (this.analytics && this.analyticsObj) this.analytics.logEvent(this.analyticsObj, name, params);
    else if (this.pending.length < 50) this.pending.push([name, params]);
  }
}

/** A sign-in error, in words a player can act on (the Firebase code stays in the console). */
export function signInErrorMessage(err) {
  const code = err?.code || '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
  if (code === 'auth/network-request-failed') return 'Sign-in needs an internet connection. Check it and try again.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not switched on for this game yet. (Firebase: Authentication → Sign-in method → Google.)';
  if (code === 'auth/unauthorized-domain') return 'Sign-in is not allowed on this web address yet. (Firebase: Authentication → Settings → Authorized domains.)';
  return `Sign-in didn't work${code ? ` (${code.replace('auth/', '')})` : ''}. Try again in a moment.`;
}

export const account = new Account();
export default account;
