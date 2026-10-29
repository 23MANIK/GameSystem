import { openFeedback } from './Feedback.js';
/**
 * Scale Architect - Top HUD (v4: minimal)
 *
 * The bar holds only what a player checks every few seconds:
 *   ☰ menu · level + goal progress · coins · speed (users / limit live in the health popover)
 * Everything else is one tap away:
 *   - ☰ menu: Home, all levels, money, feedback, Google sign-in
 *   - health chip (#hud-resources): the one thing that needs attention now,
 *     with four tiny bars; tap it for CPU / RAM / Disk / Network, latency and
 *     reputation in full.
 */

import { LEVELS } from '../data/levels.js';
import { PART_ORDER, SERVER_PARTS } from '../data/serverParts.js';
import { ROLES } from '../data/roles.js';
import { getChallenges } from '../game/Challenges.js';
import { infoButton } from './InfoTips.js';
import account from '../firebase/account.js';
import profiles, { avatarHtml } from '../firebase/profile.js';

/** Health worse than this is called out on the chip. */
const BUSY = 0.8;

export default class HUD {
  /**
   * @param {HTMLElement} container - DOM element for HUD (e.g. #hud-container)
   * @param {object} gameState - GameState instance
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
    this.menuPop = null;
    this.healthPop = null;
  }

  /** Game speed: 1× → 2× → 4× → 1×. The game loop runs that many steps per tick. */
  cycleSpeed() {
    const gs = this.gameState;
    const next = { 1: 2, 2: 4, 4: 1 }[gs.speed || 1] || 1;
    gs.speed = next;
    try { localStorage.setItem('sa-speed', String(next)); } catch (e) { /* private mode */ }
    this.updateSpeed();
  }

  updateSpeed() {
    const btn = document.getElementById('hud-speed');
    if (!btn) return;
    const sp = this.gameState.speed || 1;
    btn.textContent = `${sp}×`;
    btn.classList.toggle('fast', sp > 1);
    btn.setAttribute('aria-label', `Game speed ${sp}×. Tap to change.`);
  }

  init() {
    try { this.gameState.speed = Number(localStorage.getItem('sa-speed')) || 1; } catch (e) { this.gameState.speed = 1; }
    if (![1, 2, 4].includes(this.gameState.speed)) this.gameState.speed = 1;
    this.buildPops();
    this.render();
    // The bar is wired once; it re-renders its innards only
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('.info-btn')) return;
      if (e.target.closest('#hud-menu')) this.toggleMenu();
      else if (e.target.closest('#hud-speed')) this.cycleSpeed();
      else if (e.target.closest('#hud-coins-btn')) { this.closePops(); this.gameState.emit('openMoney', {}); }
      else if (e.target.closest('#hud-resources')) this.toggleHealth();
      else if (e.target.closest('#hud-level')) { this.closePops(); this.gameState.emit('openLevel', {}); }
    });
    this.gameState.on('coinsChanged', () => this.updateCoins());
    this.gameState.on('usersChanged', () => this.updateUsers());
    this.gameState.on('metricsUpdated', () => this.update());
    this.gameState.on('levelUp', () => this.render());
    this.gameState.on('stateChanged', () => this.update());
  }

  /** The ☰ menu and the health details live outside the bar (it clips overflow). */
  buildPops() {
    this.menuPop = document.createElement('div');
    this.menuPop.className = 'hud-pop hud-menu-pop';
    this.menuPop.setAttribute('role', 'menu');
    this.menuPop.hidden = true;
    this.menuPop.innerHTML = `
      <button type="button" role="menuitem" class="hud-menu-item" id="hud-home">🏠 <span>Home<small>Your game is saved</small></span></button>
      <button type="button" role="menuitem" class="hud-menu-item" id="hud-menu-levels">🗺️ <span>All levels<small>Story, roadmap, blueprint</small></span></button>
      <button type="button" role="menuitem" class="hud-menu-item" id="hud-menu-money">💰 <span>Money<small>Where coins come from and go</small></span></button>
      <button type="button" role="menuitem" class="hud-menu-item" id="hud-feedback">💬 <span>Send feedback</span></button>
      <button type="button" role="menuitem" class="hud-menu-item" id="hud-menu-account" hidden></button>`;
    document.body.appendChild(this.menuPop);
    this.menuPop.addEventListener('click', (e) => {
      const item = e.target.closest('.hud-menu-item');
      if (!item) return;
      this.closePops();
      if (item.id === 'hud-home') this.gameState.emit('goHome', {});
      if (item.id === 'hud-menu-levels') this.gameState.emit('openLevel', {});
      if (item.id === 'hud-menu-money') this.gameState.emit('openMoney', {});
      if (item.id === 'hud-feedback') openFeedback(`in game, level ${this.gameState.level}`);
      if (item.id === 'hud-menu-account') this.gameState.emit('accountMenu', { signedIn: Boolean(account.user) });
    });
    this.renderAccountItem();
    this.offAccount = account.onChange(() => this.renderAccountItem());
    this.offProfile = profiles.onChange(() => this.renderAccountItem());

    const bars = PART_ORDER.map(partId => {
      const part = SERVER_PARTS[partId];
      return `
        <div class="hud-res" id="hud-res-${partId}" title="${part.name}: ${part.whatItDoes}">
          <span class="hud-res-label">${part.short}</span>
          <span class="hud-res-track"><span class="hud-res-fill" id="hud-res-fill-${partId}"></span></span>
          <span class="hud-res-pct" id="hud-res-pct-${partId}">–</span>
        </div>`;
    }).join('');
    this.healthPop = document.createElement('div');
    this.healthPop.className = 'hud-pop hud-health-pop';
    this.healthPop.setAttribute('role', 'dialog');
    this.healthPop.setAttribute('aria-label', 'System health');
    this.healthPop.hidden = true;
    this.healthPop.innerHTML = `
      <div class="hh-head"><strong id="hud-res-title">🖥️ Your server</strong>${infoButton('resources')}</div>
      <div class="hud-busiest-bars">${bars}</div>
      <div class="hh-row">
        <span>👥 Users / limit ${infoButton('userLimit')}</span><strong class="hud-value" id="hud-users">–</strong>
      </div>
      <div class="hh-row">
        <span>📶 Latency ${infoButton('latency')}</span><strong id="hud-latency">–</strong>
      </div>
      <div class="hh-row">
        <span>⭐ Reputation ${infoButton('reputation')}</span><strong id="hud-rep">–</strong>
      </div>
      <button type="button" class="btn btn-secondary hh-act" id="hud-health-act">Upgrade</button>`;
    document.body.appendChild(this.healthPop);
    this.healthPop.querySelector('#hud-health-act').addEventListener('click', () => {
      const role = this.gameState.serverStatus?.bottleneckRole || this.gameState.serverStatus?.busiestRole || 'app';
      this.closePops();
      this.gameState.emit('openBuilder', { role: this.gameState.server ? role : null });
    });

    document.addEventListener('click', (e) => {
      if (!this.isPopOpen()) return;
      if (e.target.closest('.hud-pop') || e.target.closest('#hud-menu') || e.target.closest('#hud-resources') || e.target.closest('.info-pop')) return;
      this.closePops();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.isPopOpen()) return;
      if (document.querySelector('.info-pop:not([hidden])')) return;
      this.closePops();
    });
    window.addEventListener('resize', () => this.positionPops());
  }

  isPopOpen() {
    return Boolean((this.menuPop && !this.menuPop.hidden) || (this.healthPop && !this.healthPop.hidden));
  }

  closePops() {
    if (this.menuPop) this.menuPop.hidden = true;
    if (this.healthPop) this.healthPop.hidden = true;
    document.getElementById('hud-menu')?.classList.remove('open');
    document.getElementById('hud-resources')?.classList.remove('open');
  }

  /** Menu item: "Sign in with Google", or who is signed in (tap for their profile). */
  renderAccountItem() {
    const item = this.menuPop?.querySelector('#hud-menu-account');
    if (!item) return;
    item.hidden = !account.enabled || !account.ready;
    const esc = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    const me = profiles.view();
    item.innerHTML = me
      ? `${avatarHtml(me, 'hud-menu-avatar')} <span>${esc(me.name)}<small>Your profile · progress · sign out</small></span>`
      : `🔑 <span>Sign in with Google<small>Save your progress, play on any device</small></span>`;
  }

  toggleMenu() {
    const open = this.menuPop.hidden;
    this.closePops();
    if (!open) return;
    this.gameState.emit('hudPopOpened', {});
    this.menuPop.hidden = false;
    document.getElementById('hud-menu')?.classList.add('open');
    this.positionPops();
  }

  toggleHealth() {
    const open = this.healthPop.hidden;
    this.closePops();
    if (!open) return;
    this.gameState.emit('hudPopOpened', {});
    this.healthPop.hidden = false;
    document.getElementById('hud-resources')?.classList.add('open');
    this.updateResources();
    this.positionPops();
  }

  /** Drop a popover down from the button it opened from, kept inside the window. */
  positionPops() {
    const place = (pop, anchorId, width) => {
      const a = document.getElementById(anchorId);
      if (!pop || pop.hidden || !a) return;
      const r = a.getBoundingClientRect();
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
      pop.style.width = `${w}px`;
      pop.style.left = `${left}px`;
      pop.style.top = `${r.bottom + 8}px`;
    };
    place(this.menuPop, 'hud-menu', 240);
    place(this.healthPop, 'hud-resources', 300);
  }

  getLevel() {
    return LEVELS[this.gameState.level - 1] || LEVELS[0];
  }

  render() {
    if (!this.container) return;
    const level = this.getLevel();
    const mini = PART_ORDER.map(p => `<span class="hc-bar" id="hud-mini-${p}"><i></i></span>`).join('');

    this.container.innerHTML = `
      <div class="hud hud-v4">
        <div class="hud-left">
          <button type="button" class="hud-home hud-menu-btn" id="hud-menu" aria-label="Menu" aria-haspopup="menu" title="Menu: Home, levels, money, feedback">☰</button>
          <button type="button" class="hud-levelcard" id="hud-level" title="About this level">
            <span class="hud-lv">Lv.${level.level}</span>
            <span class="hud-levelcard-body">
              <span class="hud-levelcard-name">${level.name}</span>
              <span class="hud-goal" id="hud-goal"></span>
            </span>
          </button>
          <div class="hud-spike-wrap" id="hud-spike-wrap" hidden><span class="hud-spike" id="hud-spike"></span>${infoButton('spike')}</div>
        </div>

        <div class="hud-right">
          <button type="button" class="hud-health" id="hud-resources" aria-haspopup="dialog" title="System health: tap for CPU, memory, disk, network, latency and reputation">
            <span class="hc-dot"></span>
            <span class="hc-bars" aria-hidden="true">${mini}</span>
            <span class="hc-text" id="hud-health-text">No server yet</span>
          </button>
          <button type="button" class="hud-stat coins hud-coins-btn" id="hud-coins-btn" title="Money: where coins come from and go">
            <span class="hud-icon hud-stat-icon">💰</span>
            <div class="hud-stat-info">
              <span class="hud-label label">Coins</span>
              <span class="hud-value value" id="hud-coins">${this.formatNumber(this.gameState.coins)}</span>
            </div>
          </button>
          <button type="button" class="hud-speed" id="hud-speed" title="Game speed: tap for 2× or 4× to finish levels faster"></button>
        </div>
      </div>
    `;

    this.updateSpeed();
    this.update();
  }

  updateCoins() {
    const el = document.getElementById('hud-coins');
    if (!el) return;
    el.textContent = this.formatNumber(this.gameState.coins || 0);
    el.classList.add('flash-amber');
    setTimeout(() => el.classList.remove('flash-amber'), 400);
  }

  updateUsers() {
    const gs = this.gameState;
    const el = document.getElementById('hud-users');
    if (el) {
      const limit = gs.serverStatus ? gs.serverStatus.userLimit : 0;
      el.innerHTML = `${this.formatNumber(gs.users)}<small> / ${gs.server ? this.formatNumber(limit) : '–'}</small>`;
      el.classList.toggle('hud-over', Boolean(gs.serverStatus) && gs.users > limit);
    }

    const goal = document.getElementById('hud-goal');
    if (goal) {
      const list = getChallenges(gs.level);
      const total = list.length;
      const done = list.filter(ch => gs.challengesDone.includes(ch.id)).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      goal.innerHTML = gs.levelCompleted
        ? '<span class="hud-goal-done">✓ Complete</span>'
        : `<span class="hud-goal-track"><span class="hud-goal-fill" style="width:${pct}%"></span></span>
           <span class="hud-goal-text">${done}/${total}</span>`;
    }
  }

  /** Latency colour: green / amber / red. */
  latencyColor(ms) {
    return ms < 60 ? 'var(--accent-cyan)' : ms < 120 ? 'var(--accent-amber)' : 'var(--accent-red)';
  }

  /**
   * The single most important thing about the system right now, for the chip.
   * Order: no server → over the user limit → a part at 80%+ → low reputation → slow → all good.
   */
  healthSummary() {
    const gs = this.gameState;
    const st = gs.serverStatus;
    if (!st || !gs.server) return { level: 'idle', text: 'No server yet' };
    if (gs.users > st.userLimit) return { level: 'bad', text: 'Over the user limit' };
    const role = st.busiestRole || 'app';
    const usage = st.servers?.[role]?.usage || {};
    let worst = null;
    for (const p of PART_ORDER) if (!worst || (usage[p] || 0) > (usage[worst] || 0)) worst = p;
    const peak = usage[worst] || 0;
    const several = Object.keys(st.servers || {}).length > 1;
    if (peak >= BUSY) {
      const who = several ? `${ROLES[role]?.name || 'Server'} ` : '';
      return { level: peak > 1 ? 'bad' : 'warn', text: `${who}${SERVER_PARTS[worst].short} ${Math.round(peak * 100)}%` };
    }
    const rep = Math.round(gs.reputation ?? 100);
    if (rep < 80) return { level: rep < 50 ? 'bad' : 'warn', text: `Reputation ${rep}` };
    const ms = gs.metrics?.latency || 0;
    if (ms >= 120) return { level: 'warn', text: `Slow · ${ms}ms` };
    return { level: 'good', text: 'All good' };
  }

  updateResources() {
    const gs = this.gameState;
    const status = gs.serverStatus;
    // Several machines: the bars show the busiest one
    const role = status?.busiestRole || 'app';
    const several = status && Object.keys(status.servers).length > 1;
    const usageOf = status?.servers?.[role]?.usage;
    const title = document.getElementById('hud-res-title');
    if (title) {
      title.textContent = several ? `Busiest · ${ROLES[role].icon} ${ROLES[role].name}` : '🖥️ Your server';
    }
    for (const partId of PART_ORDER) {
      const usage = usageOf ? usageOf[partId] : 0;
      const p = Math.round(usage * 100);
      const state = usage > 1 ? 'over' : usage >= BUSY ? 'warn' : '';
      const mini = document.getElementById(`hud-mini-${partId}`);
      if (mini) {
        mini.firstElementChild.style.height = `${Math.max(8, Math.min(100, p))}%`;
        mini.className = `hc-bar ${state}`;
      }
      const fill = document.getElementById(`hud-res-fill-${partId}`);
      const pct = document.getElementById(`hud-res-pct-${partId}`);
      const row = document.getElementById(`hud-res-${partId}`);
      if (!fill || !pct || !row) continue;
      fill.style.width = `${Math.min(100, p)}%`;
      pct.textContent = status ? `${p}%` : '–';
      row.classList.toggle('warn', usage >= BUSY && usage <= 1);
      row.classList.toggle('over', usage > 1);
      row.classList.toggle('bottleneck', Boolean(status) && status.bottleneck === partId && status.bottleneckRole === role);
    }

    const lat = document.getElementById('hud-latency');
    if (lat) {
      const ms = gs.metrics?.latency || 0;
      lat.textContent = status ? `${ms}ms` : '–';
      lat.style.color = status ? this.latencyColor(ms) : '';
    }

    const chip = document.getElementById('hud-resources');
    if (chip) {
      const h = this.healthSummary();
      chip.dataset.health = h.level;
      const text = document.getElementById('hud-health-text');
      if (text && text.textContent !== h.text) text.textContent = h.text;
    }
    const act = document.getElementById('hud-health-act');
    if (act) {
      const r = status?.bottleneckRole && ROLES[status.bottleneckRole];
      act.hidden = gs.levelCompleted;
      act.textContent = !gs.server ? '🖥️ Build your server' : r ? `${r.icon} Upgrade ${r.name.toLowerCase()}` : '🖥️ Open server builder';
    }
  }

  updateSpikeAndReputation() {
    const gs = this.gameState;
    const rep = document.getElementById('hud-rep');
    if (rep) {
      const r = Math.round(gs.reputation ?? 100);
      rep.textContent = `${r}/100`;
      rep.style.color = r >= 80 ? 'var(--accent-green)' : r >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
    const spike = document.getElementById('hud-spike');
    const wrap = document.getElementById('hud-spike-wrap');
    if (spike && wrap) {
      wrap.hidden = !gs.spike;
      if (gs.spike) {
        const failing = (gs.metrics?.errorRate || 0) >= 0.05;
        spike.className = `hud-spike${failing ? ' failing' : ''}`;
        const label = { spike: `📈 Spike ×${gs.spike.mult}`, bots: `🤖 Bots ×${gs.spike.mult}`, crash: '💥 Server down' }[gs.spike.kind] || '⚠️ Incident';
        spike.textContent = `${label} · ${Math.max(0, Math.ceil(gs.spike.secondsLeft))}s${failing ? ' · failing!' : ''}`;
      }
    }
  }

  update() {
    this.updateUsers();
    this.updateSpikeAndReputation();
    this.updateResources();
    const el = document.getElementById('hud-coins');
    if (el) el.textContent = this.formatNumber(this.gameState.coins || 0);
  }

  formatNumber(n) {
    const num = Number(n) || 0;
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  destroy() {
    if (this.container) this.container.innerHTML = '';
    this.menuPop?.remove();
    this.offAccount?.();
    this.offProfile?.();
    this.healthPop?.remove();
  }
}
