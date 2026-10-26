/** Feedback dialog: a short form that posts to /api/feedback (mailed to the owner). */

let dialog = null;

export function openFeedback(context = '') {
  if (!dialog) dialog = build();
  dialog.dataset.context = context;
  dialog.querySelector('.fb-status').textContent = '';
  dialog.querySelector('form').hidden = false;
  dialog.querySelector('.fb-done').hidden = true;
  dialog.syncSend();
  dialog.showModal();
  dialog.querySelector('textarea').focus();
}

function build() {
  const d = document.createElement('dialog');
  d.className = 'fb-dialog';
  d.innerHTML = `
    <form method="dialog" novalidate>
      <div class="fb-head"><h3>💬 Send feedback</h3><button type="button" class="fb-close" aria-label="Close">✕</button></div>
      <p class="fb-sub">Ideas, bugs, a level that felt off: it goes straight to the maker.</p>
      <textarea name="message" rows="5" maxlength="1000" placeholder="What should we know?" required></textarea>
      <div class="fb-count">0 / 1000</div>
      <div class="fb-row">
        <input name="name" maxlength="80" placeholder="Name (optional)" autocomplete="name">
        <input name="contact" maxlength="80" placeholder="Email, if you'd like a reply" autocomplete="email">
      </div>
      <input name="website" class="fb-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="fb-status" role="status"></p>
      <button type="submit" class="btn btn-primary fb-send" disabled>Send</button>
    </form>
    <div class="fb-done" hidden><div class="fb-done-icon">🙌</div><p>Thanks! Your feedback was sent.</p><button type="button" class="btn btn-secondary fb-close">Close</button></div>`;
  document.body.appendChild(d);
  const form = d.querySelector('form'), ta = d.querySelector('textarea'), status = d.querySelector('.fb-status'), send = d.querySelector('.fb-send');
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('.fb-close')) d.close(); });
  // Send stays off until there's something to send
  const sync = () => {
    d.querySelector('.fb-count').textContent = `${ta.value.length} / 1000`;
    if (status.textContent !== 'Sending…') send.disabled = ta.value.trim().length < 5;
  };
  ta.addEventListener('input', sync);
  d.syncSend = sync;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data.message.trim().length < 5) { status.textContent = 'Please write a little more.'; return; }
    send.disabled = true; status.textContent = 'Sending…';
    try {
      const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, context: d.dataset.context }) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) { form.reset(); ta.dispatchEvent(new Event('input')); form.hidden = true; d.querySelector('.fb-done').hidden = false; }
      else status.textContent = out.error || (res.status === 404 ? 'Feedback works on the live site only.' : 'Couldn\'t send right now. Please try again later.');
    } catch { status.textContent = 'You seem to be offline. Please try again.'; }
    if (status.textContent === 'Sending…') status.textContent = '';
    sync();
  });
  return d;
}
