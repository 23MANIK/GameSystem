/**
 * GuestbookPanel — the one app feature in Level 1.
 *   Sign      → POST /entries  (write one entry with your name)
 *   Read all  → GET  /entries  (read every entry)
 * Every request goes to your one server, so it can be slow or fail when the server is overloaded.
 */

const SHOW_LIMIT = 50;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default class GuestbookPanel {
  constructor(container, gameState, notifications, onRequest = null) {
    this.container = container;
    this.gameState = gameState;
    this.notifications = notifications;
    this.onRequest = onRequest; // (method) => void, used to animate a request on the map
    this.log = [];
    this.lastRead = null; // { entries, count, at }
  }

  render() {
    const gs = this.gameState;

    if (!gs.isServerPlaced()) {
      this.container.innerHTML = `
        <div class="gb-empty">
          <div class="gb-empty-icon">🔌</div>
          <p><strong>No server yet.</strong></p>
          <p>Your Guestbook needs a machine to run on. Build a server first, then come back to sign it.</p>
        </div>`;
      return;
    }

    this.container.innerHTML = `
      <div class="gb">
        <p class="gb-intro">
          A tiny app on your server. <strong>Anyone can read every entry</strong> and
          <strong>sign it with their name</strong>. Each button sends a real-looking request to your server.
        </p>

        <form class="gb-form" id="gb-form" autocomplete="off">
          <label class="gb-label" for="gb-name">Your name</label>
          <input class="gb-input" id="gb-name" maxlength="24" placeholder="e.g. Nikhil" value="${escapeHtml(gs.playerName)}">
          <label class="gb-label" for="gb-message">Message</label>
          <input class="gb-input" id="gb-message" maxlength="80" placeholder="was here!">
          <div class="gb-actions">
            <button type="submit" class="btn btn-primary" id="gb-sign">✍️ Sign <code>POST /entries</code></button>
            <button type="button" class="btn btn-secondary" id="gb-read">📖 Read all <code>GET /entries</code></button>
          </div>
        </form>

        <div class="gb-stats" id="gb-stats"></div>

        <h4 class="gb-heading">Request log</h4>
        <ul class="gb-log" id="gb-log"></ul>

        <h4 class="gb-heading">Entries</h4>
        <div id="gb-entries"></div>
      </div>`;

    this.container.querySelector('#gb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sign();
    });
    this.container.querySelector('#gb-read').addEventListener('click', () => this.readAll());

    this.renderStats();
    this.renderLog();
    this.renderEntries();
  }

  update() {
    if (!this.gameState.isServerPlaced()) return;
    if (!this.container.querySelector('#gb-stats')) {
      this.render();
      return;
    }
    this.renderStats();
  }

  /** Simulate one request against the server: may fail if it is overloaded. */
  sendRequest(method) {
    const metrics = this.gameState.metrics || {};
    // Only an overloaded server drops requests
    const overloaded = (this.gameState.serverStatus?.peak || 0) > 1;
    const failed = overloaded && Math.random() < (metrics.errorRate || 0);
    const latency = Math.max(5, Math.round((metrics.latency || 20) * (0.8 + Math.random() * 0.4)));
    if (this.onRequest) this.onRequest(method, failed);
    return { failed, latency };
  }

  sign() {
    const nameEl = this.container.querySelector('#gb-name');
    const msgEl = this.container.querySelector('#gb-message');
    const name = nameEl.value.trim();
    if (!name) {
      nameEl.focus();
      nameEl.classList.add('gb-input-error');
      setTimeout(() => nameEl.classList.remove('gb-input-error'), 800);
      return;
    }

    const { failed, latency } = this.sendRequest('POST');
    if (failed) {
      this.addLog('POST', 503, latency, 'Server overloaded, try again');
      this.notifications?.show('❌ 503: your server is overloaded and dropped the request', 'error', 3000);
      return;
    }

    this.gameState.playerName = name;
    const entry = this.gameState.guestbook.write(name, msgEl.value, true);
    msgEl.value = '';
    this.addLog('POST', 201, latency, `Saved "${entry.name}"`);
    this.gameState.recalculateMetrics();
    this.gameState.emit('entryWritten', { entry, isPlayer: true });
    this.gameState.save();
    this.renderStats();
  }

  readAll() {
    const gs = this.gameState;
    const { failed, latency } = this.sendRequest('GET');
    const sizeKB = gs.serverStatus ? Math.round(gs.serverStatus.responseKB) : 10;
    if (failed) {
      this.addLog('GET', 503, latency, 'Server overloaded, try again');
      return;
    }
    const entries = gs.guestbook.read();
    this.lastRead = { entries, count: gs.guestbook.count, at: Date.now() };
    this.addLog('GET', 200, latency, `${gs.guestbook.count} entries · ${sizeKB} KB`);
    this.renderEntries();
    gs.emit('entriesRead', { count: gs.guestbook.count });
  }

  addLog(method, status, latency, note) {
    this.log.unshift({ method, status, latency, note, at: Date.now() });
    this.log = this.log.slice(0, 6);
    this.renderLog();
  }

  renderStats() {
    const el = this.container.querySelector('#gb-stats');
    if (!el) return;
    const gs = this.gameState;
    const size = gs.serverStatus ? Math.round(gs.serverStatus.responseKB) : 10;
    el.innerHTML = `
      <span><strong>${gs.guestbook.count}</strong> entries saved</span>
      <span>"Read all" response: <strong>${size} KB</strong></span>
      <span><strong>${gs.metrics?.throughput ?? 0}</strong> req/s from ${gs.users} users</span>`;
  }

  renderLog() {
    const el = this.container.querySelector('#gb-log');
    if (!el) return;
    if (this.log.length === 0) {
      el.innerHTML = '<li class="gb-log-empty">No requests yet. Try Sign or Read all.</li>';
      return;
    }
    el.innerHTML = this.log.map(r => `
      <li class="gb-log-row ${r.status >= 500 ? 'gb-log-fail' : 'gb-log-ok'}">
        <code class="gb-method gb-${r.method.toLowerCase()}">${r.method}</code>
        <code>/entries</code>
        <span class="gb-status">${r.status}</span>
        <span class="gb-latency">${r.latency}ms</span>
        <span class="gb-note">${escapeHtml(r.note)}</span>
      </li>`).join('');
  }

  renderEntries() {
    const el = this.container.querySelector('#gb-entries');
    if (!el) return;
    if (!this.lastRead) {
      el.innerHTML = '<p class="gb-muted">Press <strong>Read all</strong> to load the entries from your server.</p>';
      return;
    }
    const { entries, count } = this.lastRead;
    if (entries.length === 0) {
      el.innerHTML = '<p class="gb-muted">The Guestbook is empty. Be the first to sign it!</p>';
      return;
    }
    const shown = entries.slice(0, SHOW_LIMIT);
    el.innerHTML = `
      <ul class="gb-entries">
        ${shown.map(e => `
          <li class="gb-entry${e.isPlayer ? ' gb-entry-you' : ''}">
            <span class="gb-entry-name">${escapeHtml(e.name)}${e.isPlayer ? ' <em>(you)</em>' : ''}</span>
            <span class="gb-entry-msg">${escapeHtml(e.message)}</span>
            <span class="gb-entry-time">${timeAgo(e.time)}</span>
          </li>`).join('')}
      </ul>
      ${count > shown.length ? `<p class="gb-muted">Showing the newest ${shown.length} of ${count}. The server still sent all of them, which is why this response keeps growing.</p>` : ''}`;
  }
}
