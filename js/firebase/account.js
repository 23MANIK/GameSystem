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

/** Settings: a test can inject { config, emulator } before the page loads. */
function settings() {
  const injected = typeof window !== 'undefined' ? window.__SA_FIREBASE__ : null;
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

export const account = new Account();
export default account;
