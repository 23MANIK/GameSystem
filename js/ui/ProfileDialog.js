/**
 * ProfileDialog — the signed-in player's profile: picture, name, what they do,
 * a short bio, their progress, and Sign out / Delete account.
 * Opened from the ☰ menu in the game or the account chip on the start screen.
 */

import account from '../firebase/account.js';
import profiles, { LIMITS, PRESET_AVATARS, TITLES, avatarHtml, displayFor, shrinkPicture } from '../firebase/profile.js';
import { PRODUCTS } from '../data/products.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

let dialog = null;

/**
 * @param {{ onSignOut?: () => Promise<void>|void, onDeleted?: () => void }} opts
 *   onSignOut runs Sign out (the caller saves the game first and says so);
 *   onDeleted runs after the account was deleted.
 */
export function openProfile(opts = {}) {
  if (!account.user) return;
  if (!dialog) dialog = build();
  dialog.opts = opts;
  dialog.reset();
  dialog.showModal();
}

function build() {
  const d = document.createElement('dialog');
  d.className = 'fb-dialog pf-dialog';
  d.setAttribute('aria-labelledby', 'pf-title');
  d.innerHTML = `
    <div class="fb-head"><h3 id="pf-title">Your profile</h3><button type="button" class="fb-close" aria-label="Close">✕</button></div>
    <form class="pf-form" novalidate>
      <div class="pf-top">
        <span class="pf-photo"></span>
        <div class="pf-pics" role="radiogroup" aria-label="Picture"></div>
      </div>
      <input type="file" class="pf-file" accept="image/*" hidden>
      <label class="pf-label">Name <small>shown in the game</small>
        <input name="name" maxlength="${LIMITS.name}" autocomplete="nickname" required>
      </label>
      <label class="pf-label">What you do <small>optional</small>
        <input name="title" maxlength="${LIMITS.title}" list="pf-titles" placeholder="e.g. Student, Backend engineer">
        <datalist id="pf-titles">${TITLES.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      </label>
      <label class="pf-label">About you <small class="pf-count"></small>
        <textarea name="bio" rows="3" maxlength="${LIMITS.bio}" placeholder="What are you learning? (optional)"></textarea>
      </label>
      <p class="fb-status pf-status" role="status"></p>
      <button type="submit" class="btn btn-primary fb-send pf-save">Save profile</button>
    </form>
    <section class="pf-stats" aria-label="Your progress"></section>
    <section class="pf-account">
      <p class="pf-email"></p>
      <div class="pf-actions">
        <button type="button" class="btn btn-secondary pf-signout">Sign out</button>
        <button type="button" class="pf-delete">Delete account</button>
      </div>
      <div class="pf-confirm" hidden>
        <p><strong>Delete your account?</strong> Your profile and the progress saved to your account are deleted for good. The game saved on this device stays.</p>
        <p class="pf-error" role="alert"></p>
        <div class="pf-actions">
          <button type="button" class="btn btn-danger pf-delete-yes">Delete forever</button>
          <button type="button" class="btn btn-secondary pf-delete-no">Cancel</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(d);

  const form = d.querySelector('form');
  const status = d.querySelector('.pf-status');
  const fileInput = d.querySelector('.pf-file');
  const bio = form.elements.bio;
  let pick = { avatar: 'google', photo: '' };

  const preview = () => {
    const view = displayFor(account.user, { ...pick, name: form.elements.name.value.trim() });
    d.querySelector('.pf-photo').innerHTML = avatarHtml(view, 'pf-avatar');
    d.querySelectorAll('.pf-pic').forEach(b => b.setAttribute('aria-checked', String(b.dataset.avatar === pick.avatar)));
  };

  const renderPics = () => {
    const u = account.user;
    const google = u.photoURL ? `<button type="button" role="radio" class="pf-pic" data-avatar="google" title="Your Google photo"><img src="${esc(u.photoURL)}" alt="Google photo" referrerpolicy="no-referrer"></button>` : '';
    const upload = `<button type="button" role="radio" class="pf-pic pf-upload" data-avatar="upload" title="Upload a picture">${pick.avatar === 'upload' && pick.photo ? `<img src="${esc(pick.photo)}" alt="Your picture">` : '📷'}</button>`;
    d.querySelector('.pf-pics').innerHTML = google + upload +
      PRESET_AVATARS.map(e => `<button type="button" role="radio" class="pf-pic" data-avatar="emoji:${esc(e)}" aria-label="${esc(e)}">${esc(e)}</button>`).join('');
    preview();
  };

  const renderStats = async () => {
    const box = d.querySelector('.pf-stats');
    box.innerHTML = '<p class="pf-muted">Loading your progress…</p>';
    let stats = null;
    try { stats = await profiles.stats(); } catch (err) { console.warn('Stats unavailable:', err); }
    if (!stats) { box.innerHTML = '<p class="pf-muted">Your progress will show here once it is saved to your account.</p>'; return; }
    const rows = Object.entries(stats.progress).filter(([, n]) => n > 0).map(([id, n]) => {
      const p = PRODUCTS.find(x => x.id === id);
      const total = p?.levels?.filter(l => l.playable !== false).length || 0;
      const name = p ? `${p.icon} ${p.name}` : '🎲 Your own design';
      const pct = total ? Math.min(100, Math.round((n / total) * 100)) : 100;
      return `<li><span>${esc(name)}</span><span class="pf-bar"><i style="width:${pct}%"></i></span><b>${n}${total ? ` / ${total}` : ''}</b></li>`;
    });
    const done = Object.values(stats.progress).reduce((a, n) => a + (Number(n) || 0), 0);
    const since = stats.createdAt ? stats.createdAt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
    box.innerHTML = `
      <div class="pf-tiles">
        <div><b data-testid="pf-levels">${done}</b><small>levels done</small></div>
        <div><b>${rows.length}</b><small>${rows.length === 1 ? 'system' : 'systems'} started</small></div>
        ${since ? `<div><b>${esc(since)}</b><small>playing since</small></div>` : ''}
      </div>
      ${rows.length ? `<ul class="pf-games">${rows.join('')}</ul>` : '<p class="pf-muted">Finish a level and it shows up here.</p>'}`;
  };

  d.reset = () => {
    const u = account.user;
    const saved = profiles.uid === u.uid ? profiles.data : null;
    form.elements.name.value = saved?.name || u.name || '';
    form.elements.title.value = saved?.title || '';
    bio.value = saved?.bio || '';
    pick = { avatar: saved?.avatar || 'google', photo: saved?.photo || '' };
    if (pick.avatar === 'google' && !u.photoURL) pick.avatar = 'emoji:' + PRESET_AVATARS[0];
    status.textContent = '';
    d.querySelector('.pf-email').textContent = `Signed in with Google as ${u.email || u.name}`;
    d.querySelector('.pf-confirm').hidden = true;
    d.querySelector('.pf-error').textContent = '';
    d.querySelector('.pf-account > .pf-actions').hidden = false;
    d.querySelector('.pf-count').textContent = `${bio.value.length} / ${LIMITS.bio}`;
    renderPics();
    renderStats();
    // The first time: the saved profile may still be loading
    if (!saved && profiles.uid !== u.uid) profiles.load().then(p => { if (p && d.open) d.reset(); }).catch(() => {});
  };

  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.fb-close')) d.close(); });
  bio.addEventListener('input', () => { d.querySelector('.pf-count').textContent = `${bio.value.length} / ${LIMITS.bio}`; });
  form.elements.name.addEventListener('input', preview);

  d.querySelector('.pf-pics').addEventListener('click', e => {
    const b = e.target.closest('.pf-pic');
    if (!b) return;
    if (b.dataset.avatar === 'upload') { fileInput.click(); return; }
    pick = { avatar: b.dataset.avatar, photo: pick.photo };
    preview();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    status.textContent = 'Preparing your picture…';
    try {
      pick = { avatar: 'upload', photo: await shrinkPicture(file) };
      status.textContent = 'Looks good? Press Save profile.';
      renderPics();
    } catch (err) {
      status.textContent = err.message;
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const save = d.querySelector('.pf-save');
    save.disabled = true;
    status.textContent = 'Saving…';
    let error = '';
    try {
      error = await profiles.save({ ...Object.fromEntries(new FormData(form)), ...pick });
    } catch (err) {
      console.warn('Profile save failed:', err);
      error = 'Could not save right now. Check your connection and try again.';
    }
    save.disabled = false;
    status.textContent = error || '✓ Saved';
    if (!error) setTimeout(() => { if (status.textContent === '✓ Saved') d.close(); }, 700);
  });

  d.querySelector('.pf-signout').addEventListener('click', async () => {
    d.close();
    await d.opts.onSignOut?.();
  });
  d.querySelector('.pf-delete').addEventListener('click', () => {
    d.querySelector('.pf-confirm').hidden = false;
    d.querySelector('.pf-account > .pf-actions').hidden = true;
  });
  d.querySelector('.pf-delete-no').addEventListener('click', () => {
    d.querySelector('.pf-confirm').hidden = true;
    d.querySelector('.pf-account > .pf-actions').hidden = false;
  });
  d.querySelector('.pf-delete-yes').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      if (await account.deleteAccount()) { d.close(); d.opts.onDeleted?.(); }
    } catch (err) {
      console.warn('Delete account failed:', err);
      d.querySelector('.pf-error').textContent = 'Could not delete right now. Check your connection and try again.';
    }
    btn.disabled = false;
    btn.textContent = 'Delete forever';
  });
  return d;
}
