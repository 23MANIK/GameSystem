/**
 * CreateGame — the "Create DesignGame" screen: passcode, the form, live
 * progress while Claude researches and builds the game, and the result.
 *
 * The job runs on the server one step per request; this screen asks for the
 * next step until the job is done (closing the screen pauses it, and it picks
 * up again next time).
 */

import { api, passcode, currentJob, ensureGame, shareLink } from '../designgame/client.js';

const FOCUS = ['Caching', 'Sharding', 'Message queues', 'Rate limiting', 'CDN', 'Real-time', 'Storage', 'Search'];

const STAGES = [
  ['check', 'Check the idea'],
  ['research', 'Research the design on the web'],
  ['plan', 'Plan the levels'],
  ['details', 'Write stories, hints and tutorials'],
  ['test', 'Balance and test-play every level'],
  ['done', 'Ready to play']
];
const STAGE_INDEX = { check: 0, research: 1, plan: 2, details: 3, test: 4, repair: 4, redetail: 4, done: 5, failed: -1 };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));

export default class CreateGame {
  constructor(el) {
    this.el = el;
    this.running = false;
  }

  /** onPlay(productId) starts a new game with the finished product; onBack returns to the picker. */
  open({ onPlay, onBack }) {
    this.onPlay = onPlay;
    this.onBack = onBack;
    this.el.hidden = false;
    const job = currentJob.get();
    if (!passcode.get()) this.renderPasscode();
    else if (job) this.follow(job);
    else this.renderForm();
  }

  close() {
    this.running = false;
    this.el.hidden = true;
  }

  frame(title, sub, body) {
    this.el.innerHTML = `
      <div class="pp-inner cg-inner">
        <header class="pp-header">
          <button class="pp-back" id="cg-back">← Back</button>
          <h2 class="pp-title">${title}</h2>
          ${sub ? `<p class="pp-sub">${sub}</p>` : ''}
        </header>
        ${body}
      </div>`;
    this.el.querySelector('#cg-back').addEventListener('click', () => {
      this.close();
      this.onBack?.();
    });
    this.el.scrollTop = 0;
  }

  // ─── Passcode ───

  renderPasscode(error = '') {
    this.frame('✨ Create a DesignGame', 'Creating games is invite-only for now. Enter the passcode.', `
      <form class="cg-card cg-pass" id="cg-pass-form">
        <label class="cg-label" for="cg-pass">Passcode</label>
        <input class="cg-input" id="cg-pass" type="password" autocomplete="current-password" required>
        <label class="cg-check"><input type="checkbox" id="cg-remember"> Remember on this device</label>
        ${error ? `<p class="cg-error">${esc(error)}</p>` : ''}
        <button class="btn btn-primary cg-go" type="submit">Unlock</button>
      </form>`);
    const form = this.el.querySelector('#cg-pass-form');
    form.querySelector('#cg-pass').focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const code = form.querySelector('#cg-pass').value;
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        await api.auth(code);
        passcode.set(code, form.querySelector('#cg-remember').checked);
        const job = currentJob.get();
        if (job) this.follow(job); else this.renderForm();
      } catch (err) {
        this.renderPasscode(err.message);
      }
    });
  }

  // ─── Form ───

  renderForm(prev = {}, error = '') {
    const focus = new Set(prev.focus || []);
    this.frame('✨ Create a DesignGame', 'Name a system. Claude researches how it is really built, turns it into levels and test-plays every one before you get it.', `
      <form class="cg-card" id="cg-form">
        <label class="cg-label" for="cg-prompt">What should players design?</label>
        <textarea class="cg-input cg-prompt" id="cg-prompt" rows="3" maxlength="600" required
          placeholder="e.g. Ride hailing like Uber, a chat app like WhatsApp, a payment system">${esc(prev.prompt || '')}</textarea>

        <div class="cg-row">
          <div>
            <label class="cg-label" for="cg-levels">Levels</label>
            <select class="cg-input" id="cg-levels">
              ${[5, 6, 7, 8, 9, 10].map(n => `<option ${n === (prev.levels || 8) ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          <div>
            <span class="cg-label">Players</span>
            <div class="cg-seg" role="radiogroup">
              <label><input type="radio" name="cg-aud" value="beginner" ${prev.audience !== 'interview' ? 'checked' : ''}> Beginners</label>
              <label><input type="radio" name="cg-aud" value="interview" ${prev.audience === 'interview' ? 'checked' : ''}> Interview prep</label>
            </div>
          </div>
        </div>

        <span class="cg-label">Focus on (optional)</span>
        <div class="cg-chips">
          ${FOCUS.map(f => `<label class="cg-chip"><input type="checkbox" value="${f}" ${focus.has(f) ? 'checked' : ''}><span>${f}</span></label>`).join('')}
        </div>

        <label class="cg-label" for="cg-sources">Pages to read first (optional, one link per line)</label>
        <textarea class="cg-input" id="cg-sources" rows="2" placeholder="https://www.hellointerview.com/learn/system-design/problem-breakdowns/uber">${esc((prev.sources || []).join('\n'))}</textarea>

        ${error ? `<p class="cg-error">${esc(error)}</p>` : ''}
        <button class="btn btn-primary cg-go" type="submit">✨ Generate game</button>
        <p class="cg-note">Takes about 3–8 minutes. You can leave this screen; it carries on when you come back.</p>
      </form>`);
    const form = this.el.querySelector('#cg-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = {
        prompt: form.querySelector('#cg-prompt').value.trim(),
        levels: Number(form.querySelector('#cg-levels').value),
        audience: form.querySelector('input[name="cg-aud"]:checked').value,
        focus: [...form.querySelectorAll('.cg-chip input:checked')].map(i => i.value),
        sources: form.querySelector('#cg-sources').value.split(/\s+/).filter(u => /^https:\/\//.test(u)).slice(0, 5)
      };
      form.querySelector('button[type="submit"]').disabled = true;
      try {
        const { body } = await api.start(input);
        currentJob.set(body.jobId);
        this.lastInput = input;
        this.follow(body.jobId, body.job);
      } catch (err) {
        if (err.status === 401) { passcode.clear(); this.renderPasscode(err.message); return; }
        this.renderForm(input, err.message);
      }
    });
  }

  // ─── Progress ───

  async follow(jobId, view = null) {
    this.running = true;
    let errors = 0;
    try {
      if (!view) view = (await api.job(jobId)).body;
    } catch (err) {
      currentJob.clear();
      this.renderForm({}, err.status === 404 ? 'That game\'s job has expired. Start a new one.' : err.message);
      return;
    }
    this.renderProgress(view);
    while (this.running && !view.done) {
      try {
        const { status, body } = await api.step(jobId);
        view = body;
        errors = 0;
        if (status === 409) await wait(5000); // another tab is running this step
      } catch (err) {
        if (err.status === 401) { this.running = false; passcode.clear(); this.renderPasscode(err.message); return; }
        errors += 1;
        if (errors >= 3) { this.renderProgress(view, err.message); this.running = false; return; }
        await wait(4000 * errors);
        continue;
      }
      if (this.running) this.renderProgress(view);
    }
    if (!this.running) return;
    this.running = false;
    if (view.stage === 'done') this.renderDone(view);
  }

  renderProgress(view, connectionError = '') {
    const at = STAGE_INDEX[view.stage] ?? 0;
    const failed = view.stage === 'failed';
    const failedAt = failed ? (STAGE_INDEX[view.error?.stage] ?? 0) : -1;
    const steps = STAGES.map(([id, label], i) => {
      const state = failed ? (i < failedAt ? 'done' : i === failedAt ? 'failed' : 'todo') : i < at ? 'done' : i === at ? (id === 'done' ? 'done' : 'now') : 'todo';
      const icon = { done: '✓', now: '<span class="cg-spin"></span>', failed: '✕', todo: '○' }[state];
      const extra = id === 'test' && view.round ? ` <small>(repair ${view.round})</small>` : '';
      return `<li class="cg-step ${state}"><span class="cg-step-icon">${icon}</span>${label}${extra}</li>`;
    }).join('');
    const log = view.log.slice(-8).map(l => `<li>${esc(l.text)}</li>`).join('');
    const sources = view.sources?.length ? `
      <details class="cg-sources"><summary>Sources (${view.sources.length})</summary>
        <ul>${view.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ul>
      </details>` : '';
    this.frame(view.name ? `✨ ${esc(view.name)}` : '✨ Creating your game', failed ? '' : 'Claude is building your game. You can leave this screen; it carries on when you come back.', `
      <div class="cg-card">
        <ol class="cg-steps">${steps}</ol>
        ${log ? `<ul class="cg-log">${log}</ul>` : ''}
        ${sources}
        ${failed ? `<p class="cg-error">${esc(view.error?.message || 'Something went wrong.')}</p>` : ''}
        ${connectionError ? `<p class="cg-error">Lost touch with the server: ${esc(connectionError)}</p>` : ''}
        <p class="cg-note">Cost so far: about $${Number(view.cost || 0).toFixed(2)}</p>
        ${failed || connectionError ? `
          <div class="cg-actions">
            ${connectionError ? '<button class="btn btn-primary" id="cg-retry">Try again</button>' : ''}
            <button class="btn ${connectionError ? 'btn-secondary' : 'btn-primary'}" id="cg-new">Start over</button>
          </div>` : ''}
      </div>`);
    this.el.querySelector('#cg-retry')?.addEventListener('click', () => this.follow(view.id));
    this.el.querySelector('#cg-new')?.addEventListener('click', () => {
      currentJob.clear();
      this.renderForm(this.lastInput || {});
    });
  }

  // ─── Result ───

  async renderDone(view) {
    const entry = await ensureGame(view.gameId, { refresh: true });
    this.frame(`${esc(entry?.icon || '✨')} ${esc(view.name)} is ready`, entry ? esc(entry.tagline) : '', `
      <div class="cg-card">
        <ol class="cg-levels">${view.levels.map(L => `<li><strong>${esc(L.name)}</strong> <span>${esc(L.subtitle)}</span></li>`).join('')}</ol>
        ${view.warnings?.length ? `<details class="cg-sources"><summary>${view.warnings.length} balance note${view.warnings.length === 1 ? '' : 's'}</summary><ul>${view.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
        <p class="cg-note">Every level was test-played by a bot. Cost: about $${Number(view.cost || 0).toFixed(2)}. Only people with the link can play it until you publish it.</p>
        <div class="cg-actions">
          <button class="btn btn-primary" id="cg-play" ${entry ? '' : 'disabled'}>▶ Play it</button>
          <button class="btn btn-secondary" id="cg-publish">🌍 Publish to Community games</button>
          <button class="btn btn-secondary" id="cg-copy">🔗 Copy link</button>
        </div>
        <p class="cg-note" id="cg-status"></p>
        <button class="cg-link" id="cg-another">Make another game</button>
      </div>`);
    const status = this.el.querySelector('#cg-status');
    this.el.querySelector('#cg-play').addEventListener('click', () => {
      currentJob.clear();
      this.close();
      this.onPlay?.(view.gameId);
    });
    const pub = this.el.querySelector('#cg-publish');
    pub.addEventListener('click', async () => {
      pub.disabled = true;
      try {
        await api.publish(view.gameId, true);
        status.textContent = 'Published: it now shows under Community games for everyone.';
      } catch (err) {
        status.textContent = err.message;
        pub.disabled = false;
      }
    });
    this.el.querySelector('#cg-copy').addEventListener('click', async () => {
      const link = shareLink(view.gameId);
      try { await navigator.clipboard.writeText(link); status.textContent = 'Link copied.'; } catch { status.textContent = link; }
    });
    this.el.querySelector('#cg-another').addEventListener('click', () => {
      currentJob.clear();
      this.renderForm();
    });
  }
}
