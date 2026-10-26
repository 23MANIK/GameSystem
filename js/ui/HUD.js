import { openFeedback } from './Feedback.js';
/**
 * Scale Architect - Top HUD
 * Coins, users vs. user limit, level goal, and how busy each server part is.
 */

import { LEVELS } from '../data/levels.js';
import { PART_ORDER, SERVER_PARTS } from '../data/serverParts.js';
import { ROLES, partView } from '../data/roles.js';
import { getChallenges } from '../game/Challenges.js';
import { infoButton } from './InfoTips.js';

export default class HUD {
  /**
   * @param {HTMLElement} container - DOM element for HUD (e.g. #hud-container)
   * @param {object} gameState - GameState instance
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
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
    this.render();
    // Home and level card are wired once; the HUD re-renders its innards only
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#hud-home')) this.gameState.emit('goHome', {});
      if (e.target.closest('#hud-feedback')) openFeedback(`in game, level ${this.gameState.level}`);
      else if (e.target.closest('#hud-speed')) this.cycleSpeed();
      else if (e.target.closest('#hud-coins-btn')) this.gameState.emit('openMoney', {});
      else if (e.target.closest('#hud-level') && !e.target.closest('.info-btn')) this.gameState.emit('openLevel', {});
    });
    this.gameState.on('coinsChanged', () => this.updateCoins());
    this.gameState.on('usersChanged', () => this.updateUsers());
    this.gameState.on('metricsUpdated', () => this.update());
    this.gameState.on('levelUp', () => this.render());
    this.gameState.on('stateChanged', () => this.update());
  }

  getLevel() {
    return LEVELS[this.gameState.level - 1] || LEVELS[0];
  }

  render() {
    if (!this.container) return;
    const level = this.getLevel();

    const bars = PART_ORDER.map(partId => {
      const part = SERVER_PARTS[partId];
      return `
        <div class="hud-res" id="hud-res-${partId}" title="${part.name}: ${part.whatItDoes}">
          <span class="hud-res-label">${part.short}</span>
          <span class="hud-res-track"><span class="hud-res-fill" id="hud-res-fill-${partId}"></span></span>
          <span class="hud-res-pct" id="hud-res-pct-${partId}">–</span>
        </div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="hud">
        <div class="hud-left">
          <button type="button" class="hud-home" id="hud-home" title="Home: pick another product (your game is saved)" aria-label="Home">🏠</button>
          <button type="button" class="hud-home" id="hud-feedback" title="Send feedback" aria-label="Send feedback">💬</button>
          <button type="button" class="hud-stat coins hud-coins-btn" id="hud-coins-btn" title="Money: where coins come from and go">
            <span class="hud-icon hud-stat-icon">💰</span>
            <div class="hud-stat-info">
              <span class="hud-label label">Coins</span>
              <span class="hud-value value" id="hud-coins">${this.formatNumber(this.gameState.coins)}</span>
            </div>
          </button>
          <div class="hud-stat users">
            <span class="hud-icon hud-stat-icon">👥</span>
            <div class="hud-stat-info">
              <span class="hud-label label">Users / limit ${infoButton('userLimit')}</span>
              <span class="hud-value value" id="hud-users"></span>
            </div>
          </div>
          <div class="hud-stat reputation" title="Reputation: outages lower it. Low reputation slows growth and shrinks funding.">
            <span class="hud-icon hud-stat-icon">⭐</span>
            <div class="hud-stat-info">
              <span class="hud-label label">Reputation ${infoButton('reputation')}</span>
              <span class="hud-value value" id="hud-rep"></span>
            </div>
          </div>
        </div>

        <div class="hud-center">
          <button type="button" class="hud-speed" id="hud-speed" title="Game speed: tap for 2× or 4× to finish levels faster"></button>
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
          <div class="hud-busiest" id="hud-resources">
            <div class="hud-busiest-head">
              <span class="hud-label" id="hud-res-title">Server</span>
              ${infoButton('resources')}
            </div>
            <div class="hud-busiest-bars">${bars}</div>
            <button type="button" class="term hud-rep-mini" data-info="latency" aria-label="Latency">📶<span id="hud-lat-mini"></span></button>
            <button type="button" class="term hud-rep-mini" data-info="reputation" aria-label="Reputation">⭐<span id="hud-rep-mini"></span></button>
          </div>
          <div class="hud-stat latency">
            <span class="hud-icon hud-stat-icon">📶</span>
            <div class="hud-stat-info">
              <span class="hud-label label">Latency ${infoButton('latency')}</span>
              <span class="hud-value value" id="hud-latency">–</span>
            </div>
          </div>
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
      el.innerHTML = `${this.formatNumber(gs.users)}<small> / ${gs.server ? limit : '–'}</small>`;
      el.classList.toggle('hud-over', Boolean(gs.serverStatus) && gs.users > limit);
    }

    const goal = document.getElementById('hud-goal');
    if (goal) {
      const list = getChallenges(gs.level);
      const total = list.length;
      const done = list.filter(ch => gs.challengesDone.includes(ch.id)).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      goal.innerHTML = gs.levelCompleted
        ? '<span class="hud-goal-done">✓ Complete · paused</span>'
        : `<span class="hud-goal-track"><span class="hud-goal-fill" style="width:${pct}%"></span></span>
           <span class="hud-goal-text">${done}/${total} goals</span>`;
    }
  }

  updateResources() {
    const gs = this.gameState;
    const status = gs.serverStatus;
    // Several machines: the bars show the busiest one, chips show them all
    const role = status?.busiestRole || 'app';
    const several = status && Object.keys(status.servers).length > 1;
    const usageOf = status?.servers?.[role]?.usage;
    const title = document.getElementById('hud-res-title');
    if (title) {
      title.textContent = several ? `Busiest · ${ROLES[role].icon} ${ROLES[role].name}` : '🖥️ Your server';
    }
    for (const partId of PART_ORDER) {
      const fill = document.getElementById(`hud-res-fill-${partId}`);
      const pct = document.getElementById(`hud-res-pct-${partId}`);
      const row = document.getElementById(`hud-res-${partId}`);
      if (!fill || !pct || !row) continue;

      // A rented AI model's parts are its plan limits (Tokens, At once…)
      const part = partView(role, SERVER_PARTS[partId]);
      const label = row.querySelector('.hud-res-label');
      if (label && label.textContent !== part.short) label.textContent = part.short;
      row.title = `${part.name}: ${part.whatItDoes}`;
      const usage = usageOf ? usageOf[partId] : 0;
      const p = Math.round(usage * 100);
      fill.style.width = `${Math.min(100, p)}%`;
      pct.textContent = status ? `${p}%` : '–';
      row.classList.toggle('warn', usage >= 0.8 && usage <= 1);
      row.classList.toggle('over', usage > 1);
      row.classList.toggle('bottleneck', Boolean(status) && status.bottleneck === partId && status.bottleneckRole === role);
    }

    const lat = document.getElementById('hud-latency');
    if (lat) {
      const ms = gs.metrics?.latency || 0;
      // AI answers take seconds, so they are shown (and judged) in seconds
      const agent = Boolean(status?.flows?.agent);
      lat.textContent = !status ? '–' : agent ? `${(ms / 1000).toFixed(1)} s` : `${ms}ms`;
      const [good, ok] = agent ? [3000, 6000] : [60, 120];
      lat.style.color = !status ? '' : ms < good ? 'var(--accent-cyan)' : ms < ok ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
    // Phones: the same number in the bars strip
    const latMini = document.getElementById('hud-lat-mini');
    if (latMini) {
      const ms = gs.metrics?.latency || 0;
      latMini.textContent = !status ? '–' : status.flows?.agent ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
      latMini.style.color = lat?.style.color || '';
    }
  }

  updateSpikeAndReputation() {
    const gs = this.gameState;
    const rep = document.getElementById('hud-rep');
    if (rep) {
      const r = Math.round(gs.reputation ?? 100);
      rep.textContent = r;
      rep.style.color = r >= 80 ? 'var(--accent-green)' : r >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
      // Phones: the same number at the end of the bars strip
      const mini = document.getElementById('hud-rep-mini');
      if (mini) { mini.textContent = r; mini.style.color = rep.style.color; }
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
    this.updateResources();
    this.updateSpikeAndReputation();
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
  }
}
