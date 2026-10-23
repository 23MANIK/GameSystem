/**
 * NotificationsPanel — history of every alert, newest first.
 * Pop-up toasts disappear after a few seconds; everything stays here.
 */

const FILTERS = {
  all: { label: 'All', match: () => true },
  problems: { label: 'Problems', match: n => n.type === 'warning' || n.type === 'error' },
  progress: { label: 'Progress', match: n => n.type === 'success' },
  info: { label: 'Info', match: n => n.type === 'info' }
};

const TYPE_ICON = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default class NotificationsPanel {
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
    this.filter = 'all';
  }

  render() {
    const gs = this.gameState;
    const log = gs.notificationLog;
    this.lastKey = `${log.length}:${log[log.length - 1]?.id || ''}`;
    const unreadBefore = new Set(log.filter(n => !n.read).map(n => n.id));

    const counts = {};
    for (const key of Object.keys(FILTERS)) counts[key] = log.filter(FILTERS[key].match).length;

    const items = log.filter(FILTERS[this.filter].match).slice().reverse();

    const tabs = Object.entries(FILTERS).map(([key, f]) => `
      <button type="button" class="nt-tab${this.filter === key ? ' active' : ''}" data-filter="${key}">
        ${f.label} <span class="nt-count">${counts[key]}</span>
      </button>`).join('');

    const list = items.length === 0
      ? `<p class="nt-empty">${log.length === 0 ? 'No notifications yet. Alerts about your server, spikes and challenges will collect here.' : 'Nothing in this filter.'}</p>`
      : `<ul class="nt-list">${items.map(n => `
          <li class="nt-item nt-${n.type}${unreadBefore.has(n.id) ? ' unread' : ''}">
            ${/^\p{Extended_Pictographic}/u.test(n.message) ? '' : `<span class="nt-icon">${TYPE_ICON[n.type] || 'ℹ️'}</span>`}
            <div class="nt-body">
              <p class="nt-msg">${escapeHtml(n.message)}</p>
              <span class="nt-time">${timeAgo(n.at)}</span>
            </div>
          </li>`).join('')}</ul>`;

    this.container.innerHTML = `
      <div class="nt">
        <div class="nt-tabs">${tabs}</div>
        <div class="nt-actions">
          <span class="goals-muted">${log.length} total</span>
          <button type="button" class="nt-clear" id="nt-clear" ${log.length ? '' : 'disabled'}>Clear all</button>
        </div>
        ${list}
      </div>`;

    this.container.querySelectorAll('.nt-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.filter;
        this.render();
      });
    });
    this.container.querySelector('#nt-clear').addEventListener('click', () => {
      gs.clearNotifications();
      gs.save();
      this.render();
    });

    // Opening the panel reads everything (new ones stay highlighted this time)
    if (unreadBefore.size) {
      gs.markNotificationsRead();
      gs.save();
    }
  }

  /** Called every tick while open: only redraw when something new arrived. */
  update() {
    const log = this.gameState.notificationLog;
    const key = `${log.length}:${log[log.length - 1]?.id || ''}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.render();
  }
}
