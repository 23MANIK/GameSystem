/**
 * BuildingGallery — browse every infrastructure building as an isometric 3D
 * model, see its level, capacity and cost, and upgrade it to the next size.
 *
 * Levels, coins and capacity come from GameState and the simulator; an
 * upgrade is a normal GameState.setServer purchase (same as the Server Builder).
 */

import { isoSVG } from '../components/IsoBuildings.js';
import { BUILDINGS, SIZE_NAMES, MAX_BUILDING_LEVEL, buildingLevel, nextLevelUpgrade, buildingState } from '../game/BuildingLevels.js';
import { PART_ORDER, SERVER_PARTS, getOption } from '../data/serverParts.js';
import { ROLES } from '../data/roles.js';
import { simulateSystem } from '../game/SystemSimulator.js';

const STATES = [
  ['live', 'Live'], ['idle', 'Idle'], ['processing', 'Processing'], ['heavy', 'Heavy load'], ['scaling', 'Scaling'], ['failed', 'Failed']
];
const STATE_LABEL = { idle: 'Idle', processing: 'Processing', heavy: 'Heavy load', scaling: 'Upgrading', failed: 'Failed' };
// How long the scaffolding stays up after an upgrade is bought
const SCALING_MS = 1800;

function fmt(n) {
  return Math.round(n).toLocaleString();
}

export default class BuildingGallery {
  /**
   * openBuilder(role): opens the Server Builder on that machine (build or pick parts).
   * onUpgraded(role): runs after an upgrade is bought.
   * isOpen(): true while this panel is the one showing (the panel body is shared).
   */
  constructor(container, gameState, notifications, openBuilder, onUpgraded, isOpen = () => true) {
    this.container = container;
    this.gameState = gameState;
    this.notifications = notifications;
    this.openBuilder = openBuilder;
    this.onUpgraded = onUpgraded;
    this.isOpen = isOpen;
    this.selected = null;
    this.preview = 'live';
    this.scaling = null;
    this.signature = '';
  }

  /** Where a building stands in this game: built, can build, locked, or not in the game. */
  info(b) {
    const gs = this.gameState;
    const role = b.role && ROLES[b.role] ? b.role : null;
    const config = role ? gs.getServerConfig(role) : null;
    const placed = role ? gs.isPlaced(role) : false;
    const unlockAt = role ? ROLES[role].unlockLevel : Infinity;
    const available = role ? gs.availableRoles().includes(role) : false;
    const level = buildingLevel(config);
    const next = config ? nextLevelUpgrade(gs, role) : null;
    let state = role && placed ? buildingState(gs, role) : 'idle';
    if (this.scaling === b.type) state = 'scaling';
    const usersFit = placed ? this.usersFit(role) : null;
    return {
      ...b, role, config, placed, available, level, next, state, usersFit,
      runPerMin: placed ? gs.roleRunningCostPerMinute(role) : 0,
      count: role && placed ? Math.max(1, gs.machineCount(role)) : 0,
      canUpgrade: Boolean(next && !next.blocked && gs.coins >= next.cost),
      status: !role ? 'soon' : placed ? 'placed' : config ? 'waiting' : available ? 'buildable' : Number.isFinite(unlockAt) ? 'locked' : 'absent',
      unlockAt
    };
  }

  /** Users this machine alone can carry (its tightest part). */
  usersFit(role, machines = null) {
    const gs = this.gameState;
    const status = machines ? simulateSystem(gs.simulationInput({ machines })) : gs.serverStatus;
    const limits = status?.servers?.[role]?.limits;
    if (!limits) return null;
    const min = Math.min(...PART_ORDER.map(id => limits[id]));
    return Number.isFinite(min) ? min : null;
  }

  /** The gallery's buildings; AI machines only appear in products that use them. */
  items() {
    return BUILDINGS.map(b => ({ b, i: this.info(b) }))
      .filter(({ b, i }) => !(b.onlyWhenUsed && i.status === 'absent'))
      .map(({ i }) => i);
  }

  render() {
    const items = this.items();
    this.signature = this.makeSignature(items);
    const sel = this.selected && items.find(i => i.type === this.selected);
    this.container.innerHTML = sel ? this.renderDetail(sel) : this.renderGrid(items);
    this.bind();
  }

  /** Re-render only when something visible changed (called every game tick). */
  update() {
    const sig = this.makeSignature(this.items());
    if (sig !== this.signature) this.render();
  }

  makeSignature(items) {
    const gs = this.gameState;
    return [gs.coins >= 0 ? Math.floor(gs.coins) : 0, this.selected, this.preview, this.scaling,
      ...items.map(i => `${i.type}:${i.status}:${i.level}:${i.state}:${i.usersFit}:${i.count}:${i.canUpgrade}`)].join('|');
  }

  renderGrid(items) {
    const gs = this.gameState;
    const cards = items.map(i => {
      const meta = i.status === 'placed'
        ? `<span class="bg-cap">${i.usersFit != null ? `~${fmt(i.usersFit)} users` : '—'}</span><span>${fmt(i.runPerMin)}/min</span>`
        : `<span class="bg-muted">${this.statusText(i)}</span>`;
      return `
        <button type="button" class="bg-card ${i.status !== 'placed' ? 'is-dim' : ''}" data-type="${i.type}" aria-label="${i.name}, ${this.statusText(i)}">
          <span class="bg-card-art">
            ${isoSVG(i.type, i.level, i.status === 'placed' ? i.state : 'idle', { className: 'bg-svg' })}
            <span class="bg-pill">${i.status === 'placed' || i.status === 'waiting' ? `Lv ${i.level}` : i.status === 'soon' ? 'Soon' : i.status === 'buildable' ? 'New' : 'Locked'}</span>
            ${i.canUpgrade ? '<span class="bg-up" title="Upgrade available">▲</span>' : ''}
          </span>
          <span class="bg-card-name">${i.name}</span>
          <span class="bg-card-meta">${meta}</span>
        </button>`;
    }).join('');
    return `
      <div class="bg-wrap">
        <div class="bg-head">
          <p class="bg-intro">Bigger buildings carry more traffic. Tap one to inspect or upgrade it.</p>
          <span class="bg-coins">💰 ${fmt(gs.coins)}</span>
        </div>
        <div class="bg-grid">${cards}</div>
      </div>`;
  }

  statusText(i) {
    if (i.status === 'placed') return `Lv ${i.level} · ${SIZE_NAMES[i.level - 1]}`;
    if (i.status === 'waiting') return 'Bought: place it on the map';
    if (i.status === 'buildable') return 'Ready to build';
    if (i.status === 'locked') return `Unlocks at level ${i.unlockAt}`;
    if (i.status === 'absent') return 'Not used in this product';
    return 'Coming soon';
  }

  renderDetail(i) {
    const gs = this.gameState;
    const shown = this.preview === 'live' ? i.state : this.preview;
    const next = i.next && !i.next.blocked ? i.next : null;
    const nextFit = next ? this.usersFit(i.role, { [i.role]: next.config }) : null;

    const states = STATES.map(([id, label]) => `
      <button type="button" class="bg-chip ${this.preview === id ? 'on' : ''}" data-state="${id}" aria-pressed="${this.preview === id}">${id === 'live' ? `Live: ${STATE_LABEL[i.state]}` : label}</button>`).join('');

    const path = [1, 2, 3, 4].map(n => `
      <li class="bg-step ${n < i.level ? 'done' : ''} ${n === i.level && i.config ? 'cur' : ''}">
        <strong>Lv ${n}</strong><span>${SIZE_NAMES[n - 1]}</span>
      </li>`).join('');

    const parts = i.config ? PART_ORDER.map(id => {
      const now = getOption(id, i.config[id]);
      const up = next && next.changed.includes(id) ? getOption(id, next.config[id]) : null;
      return `<li><span>${SERVER_PARTS[id].short}</span><strong>${now.label}${up ? ` <em>→ ${up.label}</em>` : ''}</strong></li>`;
    }).join('') : '';

    const stats = i.placed ? `
      <div class="bg-stats">
        <div><span>Carries</span><strong class="bg-cap">${i.usersFit != null ? `~${fmt(i.usersFit)}` : '—'}</strong><small>users${nextFit != null ? ` <em>→ ~${fmt(nextFit)}</em>` : ''}</small></div>
        <div><span>Running cost</span><strong>${fmt(i.runPerMin)}</strong><small>/min${next ? ` <em>→ ${fmt(next.runPerMin)}</em>` : ''}</small></div>
      </div>` : '';

    let upLabel;
    let upDisabled = true;
    if (i.status === 'placed') {
      if (this.scaling) upLabel = 'Upgrading…';
      else if (!next) upLabel = i.level >= MAX_BUILDING_LEVEL ? 'Max size' : i.next.blocked;
      else if (gs.coins < next.cost) upLabel = `Need 💰 ${fmt(next.cost - gs.coins)} more`;
      else { upLabel = `Upgrade to Lv ${next.level} · 💰 ${fmt(next.cost)}`; upDisabled = false; }
    }

    const buildBtn = i.status === 'buildable' || i.status === 'waiting'
      ? `<button type="button" class="btn btn-primary bg-act" data-act="${i.status === 'waiting' ? 'place' : 'build'}">${i.status === 'waiting' ? 'Place it' : `Build ${i.name.toLowerCase()}`}</button>` : '';
    const lockNote = ['locked', 'absent', 'soon'].includes(i.status) ? `<p class="bg-note">${this.statusText(i)}.</p>` : '';
    const several = i.count > 1 ? `<p class="bg-note">Applies to all ${i.count} ${ROLES[i.role].name.toLowerCase()}s.</p>` : '';

    return `
      <div class="bg-wrap">
        <button type="button" class="bg-back" data-act="back">‹ All buildings</button>
        <div class="bg-title">
          <div>
            <span class="bg-cat">${i.category}</span>
            <h3>${i.name}</h3>
            ${i.role ? `<span class="bg-muted">In this game: ${ROLES[i.role].name}</span>` : ''}
          </div>
          ${i.config ? `<span class="bg-lv">Lv ${i.level} · ${SIZE_NAMES[i.level - 1]}</span>` : ''}
        </div>
        <div class="bg-hero">
          ${isoSVG(i.type, i.level, shown, { className: 'bg-svg', label: `${i.name}, level ${i.level}, ${STATE_LABEL[shown]}` })}
          ${this.scaling === i.type ? `<span class="bg-scaling" role="status">Upgrading to Lv ${i.level}…</span>` : ''}
        </div>
        ${i.placed ? `<div class="bg-chips" role="group" aria-label="Preview state">${states}</div>` : ''}
        <p class="bg-desc">${i.role ? ROLES[i.role].job : i.short}</p>
        ${stats}
        <ol class="bg-path" aria-label="Level path">${path}</ol>
        ${parts ? `<ul class="bg-parts">${parts}</ul>` : ''}
        ${several}${lockNote}
        <div class="bg-actions">
          ${i.status === 'placed' ? `<button type="button" class="btn bg-upgrade bg-act" data-act="upgrade" ${upDisabled ? 'disabled' : ''}>${upLabel}</button>
          <button type="button" class="btn btn-secondary bg-act" data-act="configure">Configure parts</button>` : buildBtn}
        </div>
      </div>`;
  }

  bind() {
    this.container.querySelectorAll('.bg-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selected = card.dataset.type;
        this.preview = 'live';
        this.render();
        this.container.scrollTop = 0;
      });
    });
    this.container.querySelectorAll('.bg-chip').forEach(chip => {
      chip.addEventListener('click', () => { this.preview = chip.dataset.state; this.render(); });
    });
    this.container.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => this.act(btn.dataset.act));
    });
  }

  act(action) {
    const b = BUILDINGS.find(x => x.type === this.selected);
    if (action === 'back') { this.selected = null; this.render(); return; }
    if (!b || !b.role) return;
    if (action === 'configure' || action === 'build') { this.openBuilder?.(b.role); return; }
    if (action === 'place') { this.openBuilder?.(b.role, { place: true }); return; }
    if (action === 'upgrade') this.upgrade(b);
  }

  upgrade(b) {
    const gs = this.gameState;
    if (this.scaling) return;
    if (gs.levelCompleted) {
      this.notifications?.show('✅ This level is complete and paused. Start the next level from Goals.', 'info', 4000);
      return;
    }
    const next = nextLevelUpgrade(gs, b.role);
    if (next.blocked) return;
    if (!gs.setServer(next.config, next.cost, b.role)) {
      this.notifications?.show('Not enough coins yet. Users bring in coins over time.', 'warning', 3000);
      return;
    }
    const names = next.changed.map(id => `${SERVER_PARTS[id].short} → ${getOption(id, next.config[id]).label}`).join(', ');
    this.notifications?.show(`⬆️ ${b.name} is now Lv ${next.level} (${names}).`, 'success', 4000);
    this.scaling = b.type;
    this.preview = 'live';
    this.render();
    clearTimeout(this.scaleTimer);
    this.scaleTimer = setTimeout(() => { this.scaling = null; if (this.isOpen()) this.render(); }, SCALING_MS);
    this.onUpgraded?.(b.role);
  }
}
