/**
 * profile.js — the signed-in player's profile: the name and picture the game
 * shows, a title ("what you do") and a short bio.
 *
 * Stored in Firestore at profiles/{uid}, apart from the save in users/{uid}
 * so an uploaded picture never pushes a big save over Firestore's 1 MB limit.
 * Only the player can read or write it (firebase/firestore.rules).
 *
 * Pictures: the Google photo, one of the preset avatars, or an upload. An
 * upload is cropped and shrunk in the browser to a small JPEG and kept in the
 * profile itself, so no Firebase Storage (and no paid plan) is needed.
 *
 * profiles/{uid} = { name, title, bio, avatar, photo, updatedAt }
 *   avatar: 'google' | 'upload' | 'emoji:<emoji>'
 *   photo:  the uploaded picture as a data: URL (only when avatar is 'upload')
 */

import account from './account.js';

export const LIMITS = { name: 40, title: 60, bio: 280, photo: 100_000 };
export const PHOTO_SIZE = 192;   // uploaded pictures are cropped to a square this big (px)

export const PRESET_AVATARS = ['🧑‍💻', '👩‍💻', '🦊', '🐙', '🦉', '🐧', '🤖', '🚀', '⚡', '🛰️', '🧠', '🏗️'];

export const TITLES = ['Student', 'Software engineer', 'Backend engineer', 'Frontend engineer',
  'Engineering manager', 'Interview prep', 'Just curious'];

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Tidy a profile before saving it, and say what is wrong (if anything).
 * Pure, so it can be unit tested. @returns {{ profile, error }}
 */
export function cleanProfile(p = {}) {
  const profile = {
    name: clean(p.name, LIMITS.name),
    title: clean(p.title, LIMITS.title),
    bio: String(p.bio ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMITS.bio),
    avatar: 'google',
    photo: ''
  };
  let error = '';
  if (!profile.name) error = 'Please enter a name.';
  if (typeof p.avatar === 'string' && p.avatar.startsWith('emoji:') && PRESET_AVATARS.includes(p.avatar.slice(6))) {
    profile.avatar = p.avatar;
  } else if (p.avatar === 'upload') {
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo || '') && p.photo.length <= LIMITS.photo) {
      profile.avatar = 'upload';
      profile.photo = p.photo;
    } else {
      error = error || 'That picture could not be used. Try another one.';
    }
  }
  return { profile, error };
}

/**
 * What the game shows for a player: their profile where set, else their
 * Google name and photo. @returns {{ name, photo, emoji, initial }}
 */
export function displayFor(user, profile) {
  if (!user) return null;
  const name = profile?.name || user.name || user.email || 'Player';
  let photo = '', emoji = '';
  if (profile?.avatar === 'upload' && profile.photo) photo = profile.photo;
  else if (profile?.avatar?.startsWith('emoji:')) emoji = profile.avatar.slice(6);
  else photo = user.photoURL || '';
  return { name, photo, emoji, initial: (name[0] || '?').toUpperCase() };
}

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** The player's picture as HTML (an <img>, an emoji, or their first letter). */
export function avatarHtml(view, cls = 'acct-avatar') {
  if (!view) return '';
  if (view.photo) return `<img class="${cls}" src="${esc(view.photo)}" alt="" referrerpolicy="no-referrer">`;
  if (view.emoji) return `<span class="${cls} acct-emoji" aria-hidden="true">${esc(view.emoji)}</span>`;
  return `<span class="${cls} acct-initial" aria-hidden="true">${esc(view.initial)}</span>`;
}

/**
 * Crop a picture file to a centred square and shrink it to a small JPEG
 * data URL (well under LIMITS.photo). Browser only.
 */
export async function shrinkPicture(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Please choose a picture file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That picture is too big (15 MB at most).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That picture could not be opened. Try a JPG or PNG.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    for (const q of [0.85, 0.7, 0.5]) {
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length <= LIMITS.photo) return data;
    }
    throw new Error('That picture is too detailed to use. Try another one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads and saves the signed-in player's profile; tells listeners when it changes. */
class Profiles {
  constructor() {
    this.uid = null;
    this.data = null;        // the saved profile, or null (not loaded, or none yet)
    this.listeners = new Set();
    account.onChange((u) => {
      if (!u) { this.uid = null; this.data = null; this.emit(); return; }
      if (u.uid !== this.uid) this.load().catch(err => console.warn('Profile unavailable:', err));
    });
  }

  ref() {
    return account.fs.doc(account.db, 'profiles', account.user.uid);
  }

  /** Read the profile from Firestore. */
  async load() {
    const u = account.user;
    if (!u || !account.db) return null;
    this.uid = u.uid;
    const snap = await account.fs.getDoc(this.ref());
    if (account.user?.uid !== u.uid) return null;
    this.data = snap.exists() ? snap.data() : null;
    this.emit();
    return this.data;
  }

  /** Save the profile. @returns {Promise<string>} an error to show, or '' */
  async save(input) {
    if (!account.user || !account.db) return 'Sign in to save your profile.';
    const { profile, error } = cleanProfile(input);
    if (error) return error;
    await account.fs.setDoc(this.ref(), { ...profile, updatedAt: account.fs.serverTimestamp() });
    this.data = profile;
    this.emit();
    account.log('profile_saved', { avatar: profile.avatar.split(':')[0], has_bio: Boolean(profile.bio) });
    return '';
  }

  /** The signed-in player as the game shows them, or null. */
  view() {
    return displayFor(account.user, account.user?.uid === this.uid ? this.data : null);
  }

  /** Player stats from their cloud save: levels done per game, member since. */
  async stats() {
    if (!account.user || !account.db) return null;
    const snap = await account.fs.getDoc(account.userDoc());
    const d = snap.exists() ? snap.data() : {};
    return { progress: d.progress || {}, createdAt: toDate(d.createdAt) };
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) {
      try { fn(this.view()); } catch (err) { console.error(err); }
    }
  }
}

/** A Firestore Timestamp (or millis) as a Date, or null. */
export function toDate(t) {
  if (!t) return null;
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  if (typeof t === 'number') return new Date(t);
  return null;
}

export const profiles = new Profiles();
export default profiles;
