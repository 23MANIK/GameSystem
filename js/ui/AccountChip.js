/**
 * AccountChip — "Sign in with Google" on the start screen, or the signed-in
 * player (picture, name; tap for their profile, where Sign out is).
 * Hidden when Firebase isn't set up.
 */

import account, { signInErrorMessage } from '../firebase/account.js';
import profiles, { avatarHtml } from '../firebase/profile.js';
import { openProfile } from './ProfileDialog.js';

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default class AccountChip {
  /**
   * @param {HTMLElement} el
   * @param {{ onSignedIn?: (choice: string) => void }} opts
   *   onSignedIn runs after a sign-in synced the save ('pull' = a cloud save replaced this one).
   */
  constructor(el, { onSignedIn } = {}) {
    this.el = el;
    this.onSignedIn = onSignedIn;
    this.busy = false;
    this.message = '';
    if (!account.enabled || !el) return;
    account.onChange(() => this.render());
    profiles.onChange(() => this.render());
    this.render();
  }

  render() {
    const el = this.el;
    if (!account.enabled) { el.hidden = true; return; }
    el.hidden = false;
    const u = account.user;
    if (!account.ready && !this.busy) {
      el.innerHTML = `<span class="acct-note">Checking sign-in…</span>`;
      return;
    }
    if (u) {
      const me = profiles.view();
      el.innerHTML = `
        <button type="button" class="acct-chip" data-testid="account-signed-in" title="Your profile">
          ${avatarHtml(me)}
          <span class="acct-who"><strong>${esc(me.name)}</strong><small>☁️ Progress saved to your account</small></span>
          <span class="acct-out">Profile</span>
        </button>
        ${this.message ? `<p class="acct-note" role="status">${esc(this.message)}</p>` : ''}`;
      el.querySelector('.acct-chip').onclick = () => openProfile({
        onSignOut: () => this.signOut(),
        onDeleted: () => { this.message = 'Your account was deleted. Your game stays on this device.'; this.render(); }
      });
      return;
    }
    el.innerHTML = `
      <button type="button" class="acct-google" ${this.busy ? 'disabled' : ''}>${GOOGLE_G}<span>${this.busy ? 'Signing in…' : 'Sign in with Google'}</span></button>
      <p class="acct-note" role="status">${esc(this.message || 'Save your progress and play on any device.')}</p>`;
    el.querySelector('.acct-google').onclick = () => this.signIn();
  }

  async signIn() {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.render();
    let user = null;
    try {
      user = await account.signIn();
    } catch (err) {
      console.warn('Sign-in failed:', err);
      this.message = signInErrorMessage(err);
    }
    if (user) {
      try {
        const choice = await account.sync();
        this.message = choice === 'push' ? 'Your progress on this device is now saved to your account.' : '';
        this.onSignedIn?.(choice);
      } catch (err) {
        // Signed in, but the save couldn't be synced: keep playing, retry on the next save
        console.warn('Cloud save sync failed:', err);
        this.message = 'Signed in. Your progress will be saved to your account on the next save.';
      }
    }
    this.busy = false;
    this.render();
  }

  async signOut() {
    this.message = '';
    await account.signOut();
    this.message = 'Signed out. Your progress stays on this device too.';
    this.render();
  }
}
