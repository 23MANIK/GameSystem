/**
 * ServerBuilder — buy and upgrade your machines.
 * One tab per kind of machine you can have at this level (app server, database,
 * web server, gateway, load balancer, cache, CDN), plus Code fixes.
 * Every choice is previewed: user limit, what runs out first, disk space, cost.
 */

import {
  PART_ORDER, SERVER_PARTS, cheapestServer, getOption, getOptionIndex, serverCost, upgradeCost,
  runningCostPerMinute, optionsForLevel
} from '../data/serverParts.js';
import { fixesForLevel, CODE_FIXES } from '../data/codeFixes.js';
import { ROLES, partView, optionView } from '../data/roles.js';
import { scaleOutRule, vocab } from '../products/registry.js';
import { simulateSystem, limitForOption } from '../game/SystemSimulator.js';
import { getSteps } from '../game/Tutorial.js';
import { infoButton } from './InfoTips.js';
import { linkTerms } from './Glossary.js';

export default class ServerBuilder {
  constructor(backdrop, content, gameState, notifications) {
    this.backdrop = backdrop;
    this.content = content;
    this.gameState = gameState;
    this.notifications = notifications;
    this.selection = null;
    this.tab = 'app';
    this.isOpen = false;
    this.onConfirm = null;
    this._closeTimer = null;

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
    // Coins change while the window is open: refresh prices and buttons
    this.gameState.on('coinsChanged', () => {
      if (!this.isOpen) return;
      if (this.tab === 'code') this.render();
      else this.renderSummary();
    });
  }

  /** The first machine this level unlocks that you don't have yet. */
  newRoleThisLevel() {
    const gs = this.gameState;
    return gs.availableRoles().find(r => ROLES[r].unlockLevel === gs.level && !gs.getServerConfig(r)) || null;
  }

  /** tab: a role id or 'code'. onConfirm({ upgrade, role, extra }) runs after buying a machine. */
  open(onConfirm = null, tab = null) {
    this.onConfirm = onConfirm;
    const gs = this.gameState;
    // The guide can ask for a tab (e.g. "Database → Add shard")
    const t = gs.tutorial;
    const stepTab = !t.done ? getSteps(gs.level)[t.step]?.builderTab : null;
    this.tab = tab || stepTab || (gs.server ? this.newRoleThisLevel() : null) || 'app';
    this.resetSelection();
    this.renderedTab = null;
    this.render();

    clearTimeout(this._closeTimer);
    this.content.classList.add('server-builder-modal');
    this.backdrop.style.display = 'flex';
    requestAnimationFrame(() => this.backdrop.classList.add('open'));
    this.isOpen = true;
    // The floating guide would cover this window, so its tip shows inside instead
    document.body.classList.add('builder-open');
    gs.emit('serverBuilderOpened', { tab: this.tab });
    this.renderTip();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    document.body.classList.remove('builder-open');
    this.gameState.emit('serverBuilderClosed', {});
    this.backdrop.classList.remove('open');
    this._closeTimer = setTimeout(() => {
      this.backdrop.style.display = 'none';
      this.content.classList.remove('server-builder-modal');
    }, 250);
  }

  get role() {
    return this.tab === 'code' ? null : this.tab;
  }

  get installed() {
    return this.role ? this.gameState.getServerConfig(this.role) : null;
  }

  get isUpgrade() {
    return Boolean(this.installed);
  }

  /** How many machines an upgrade applies to (every app server / shard gets the same parts). */
  get count() {
    return this.role === 'app' || this.role === 'db' ? Math.max(1, this.gameState.machineCount(this.role)) : 1;
  }

  resetSelection() {
    this.selection = this.installed ? { ...this.installed } : cheapestServer();
  }

  /** Simulator input with the current selection swapped in (previews a purchase). */
  previewInput(selection = this.selection) {
    return this.gameState.simulationInput({ machines: { [this.role]: selection } });
  }

  // ─── Rendering ───

  renderTabs() {
    const gs = this.gameState;
    const roles = gs.availableRoles();
    if (roles.length < 2) return '';
    const tabs = roles.map(r => ({
      id: r,
      label: `${ROLES[r].icon} ${ROLES[r].short}${gs.getServerConfig(r) ? '' : ' <em>new</em>'}`
    }));
    if (gs.hasDatabaseLevel()) tabs.push({ id: 'code', label: '🧑‍💻 Code fixes' });
    return `<div class="sb-tabs" role="tablist">${tabs.map(t => `
      <button type="button" role="tab" class="sb-tab${this.tab === t.id ? ' active' : ''}" data-tab="${t.id}" aria-selected="${this.tab === t.id}">${t.label}</button>`).join('')}
    </div>`;
  }

  headerText() {
    const gs = this.gameState;
    if (this.tab === 'code') {
      return { icon: '🧑‍💻', title: 'Code fixes', sub: `One-time purchases that make every request cheaper. No running cost. ${infoButton('codeFixes')}` };
    }
    // Level 1: one machine, simple words
    if (!gs.hasDatabaseLevel()) {
      return this.isUpgrade
        ? { icon: '🖥️', title: 'Upgrade your server', sub: `Buy a bigger part to raise your user limit. You pay the difference. ${infoButton('verticalScaling')}` }
        : { icon: '🖥️', title: 'Build your server', sub: 'One machine runs everything: the web page, the app code and the saved data.' };
    }
    const role = ROLES[this.role];
    const many = this.count > 1 ? ` (all ${this.count} of them)` : '';
    return {
      icon: role.icon,
      title: this.isUpgrade ? `Upgrade your ${role.name.toLowerCase()}${many}` : `Build a ${role.name.toLowerCase()}`,
      sub: `${linkTerms(role.job, { skip: [role.info] })} ${infoButton(role.info)}`
    };
  }

  render() {
    // Live refreshes (coins change every tick) must not jump the list back to the top
    const oldBody = this.content.querySelector('.sb-body');
    const keepScroll = oldBody && this.renderedTab === this.tab ? oldBody.scrollTop : 0;
    this.renderedTab = this.tab;
    const head = this.headerText();
    const body = this.tab === 'code' ? this.renderCodeFixes() : this.renderScaleOut() + this.renderParts();

    this.content.innerHTML = `
      <div class="modal-header">
        <span class="modal-header-icon">${head.icon}</span>
        <div class="modal-header-title">
          <h3>${head.title}</h3>
          <span class="sb-subtitle">${head.sub}</span>
        </div>
      </div>
      ${this.renderTabs()}
      <div class="sb-tip" id="sb-tip" hidden></div>
      <div class="modal-body sb-body">${body}</div>
      ${this.tab === 'code' ? '' : '<div class="sb-summary" id="sb-summary"></div>'}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="sb-cancel">${this.tab === 'code' ? 'Close' : 'Cancel'}</button>
        ${this.tab === 'code' ? '' : '<button class="btn btn-primary" id="sb-confirm">Buy</button>'}
      </div>
    `;

    this.content.querySelectorAll('.sb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.tab = btn.dataset.tab;
        this.resetSelection();
        this.render();
      });
    });
    this.content.querySelectorAll('.sb-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.selection[btn.dataset.part] = btn.dataset.option;
        this.content.querySelectorAll(`.sb-option[data-part="${btn.dataset.part}"]`)
          .forEach(b => b.classList.toggle('selected', b === btn));
        this.renderSummary();
      });
    });
    this.content.querySelectorAll('.sb-fix-buy').forEach(btn => {
      btn.addEventListener('click', () => this.buyFix(btn.dataset.fix));
    });
    this.content.querySelector('#sb-add-app')?.addEventListener('click', () => this.addMachine());
    this.content.querySelectorAll('.sb-fix-toggle').forEach(btn => {
      btn.addEventListener('click', () => this.toggleFix(btn.dataset.fix));
    });
    this.content.querySelector('#sb-cancel').addEventListener('click', () => this.close());
    this.content.querySelector('#sb-confirm')?.addEventListener('click', () => this.confirm());

    if (this.tab !== 'code') this.renderSummary();
    this.renderTip();
    const body2 = this.content.querySelector('.sb-body');
    if (body2 && keepScroll) body2.scrollTop = keepScroll;
  }

  /**
   * App tab: how many app servers, and a button to add one (needs a load balancer).
   * Database tab (products that shard): how many shards, and a button to add one.
   */
  renderScaleOut() {
    const gs = this.gameState;
    const role = this.role;
    const rule = role ? scaleOutRule(role, gs.level) : null;
    if (!rule || !gs.isPlaced(role)) return '';
    const n = gs.machineCount(role);
    const max = ROLES[role].maxCount;
    const cost = gs.extraMachineCost(role);
    const noun = rule.noun;
    let action;
    if (rule.needs && !gs.isPlaced(rule.needs)) {
      action = `<span class="sb-appcount-note">Place a ${ROLES[rule.needs].name.toLowerCase()} first: without one, users can only reach one ${noun}.</span>`;
    } else if (n >= max) {
      action = `<span class="sb-appcount-note">Maximum ${max} ${noun}s.</span>`;
    } else {
      action = `<button type="button" class="btn ${gs.coins >= cost ? 'btn-primary' : 'btn-secondary'}" id="sb-add-app" ${gs.coins >= cost ? '' : 'disabled'}>
        + Add ${noun} · 💰 ${cost}</button>`;
    }
    const info = role === 'db' ? 'sharding' : 'horizontalScaling';
    return `
      <section class="sb-appcount">
        <div>
          <strong>${ROLES[role].icon.repeat(Math.max(1, n))}</strong>
          <span>${n} ${noun}${n === 1 ? '' : 's'} running ${infoButton(info)}</span>
        </div>
        ${action}
      </section>`;
  }

  renderParts() {
    const gs = this.gameState;
    const installed = this.installed;
    const holdsData = this.role === 'db' || (this.role === 'app' && !gs.isDbPlaced());
    const input = this.previewInput();
    const nowSpace = gs.serverStatus?.space;
    const usedSpace = holdsData ? (nowSpace?.used || 0) : 0;
    const spaceMult = this.role === 'db' ? Math.max(1, gs.machineCount('db')) : 1;

    return PART_ORDER.map(partId => {
      const part = partView(this.role, SERVER_PARTS[partId]);
      const options = optionsForLevel(partId, gs.level);
      const installedIdx = installed ? getOptionIndex(partId, installed[partId]) : -1;

      const cards = options.map(opt => {
        const idx = getOptionIndex(partId, opt.id);
        const shown = optionView(this.role, partId, opt, idx);
        const selected = this.selection[partId] === opt.id;
        const isInstalled = installedIdx === idx;
        const disabled = installedIdx > idx; // no downgrades
        const users = limitForOption(input, this.role, partId, opt.id);
        let price = `💰 ${opt.cost * this.count}`;
        if (isInstalled) price = 'Installed';
        else if (installedIdx >= 0 && !disabled) price = `💰 ${(opt.cost - part.options[installedIdx].cost) * this.count}`;
        const fits = opt.space * spaceMult;
        const tooSmall = partId === 'storage' && holdsData && opt.space && !isInstalled && usedSpace > 0 && fits <= usedSpace;
        const space = partId === 'storage' && holdsData && opt.space
          ? `<span class="sb-option-space${tooSmall ? ' sb-option-too-small' : ''}">${tooSmall ? `too small: you have ${Math.round(usedSpace).toLocaleString()}` : `holds ${fits.toLocaleString()} ${vocab('records')}`}</span>` : '';
        return `
          <button class="sb-option${selected ? ' selected' : ''}${isInstalled ? ' installed' : ''}${opt.unlockLevel ? ' xl' : ''}"
            data-part="${partId}" data-option="${opt.id}" ${disabled ? 'disabled' : ''}>
            <span class="sb-option-label">${shown.label}</span>
            <span class="sb-option-spec">${shown.spec}</span>
            <span class="sb-option-users">${users === Infinity ? 'not a limit' : `~${users.toLocaleString()} users`}</span>
            ${space}
            <span class="sb-option-cost">${price}</span>
          </button>`;
      }).join('');

      const extraInfo = partId === 'storage' && holdsData && gs.hasDatabaseLevel() ? infoButton('diskSpace') : '';
      return `
        <section class="sb-part" data-part="${partId}">
          <div class="sb-part-head">
            <span class="sb-part-icon">${part.icon}</span>
            <div>
              <h4 class="sb-part-name">${part.name} ${infoButton(part.info || partId)} ${extraInfo}</h4>
              <p class="sb-part-desc">${part.whatItDoes}</p>
              ${partId === 'storage' && holdsData && gs.hasDatabaseLevel() ? `<p class="sb-part-desc sb-part-tradeoff">Speed and size trade off: <strong>HDD</strong> is big but slow, <strong>SSD</strong> is 10× faster but holds a quarter as much, <strong>NVMe</strong> is fastest and mid-size. Check the disk still fits your ${vocab('records')} before you switch.</p>` : ''}
            </div>
          </div>
          <div class="sb-options" style="--cols:${options.length}">${cards}</div>
        </section>`;
    }).join('');
  }

  renderCodeFixes() {
    const gs = this.gameState;
    const now = gs.serverStatus ? simulateSystem(gs.simulationInput()) : null;

    return fixesForLevel(gs.level).map(fix => {
      const owned = Boolean(gs.codeFixes[fix.id]);
      let preview = '';
      if (fix.toggle) return this.renderToggleFix(fix, now);
      if (now && !owned) {
        const after = simulateSystem(gs.simulationInput({ fixes: { ...gs.codeFixes, [fix.id]: true } }));
        preview = `
          <div class="sb-fix-preview">
            <span>User limit <strong>${now.userLimit} → ${after.userLimit}</strong></span>
            <span>Latency <strong>${now.latency} → ${after.latency} ms</strong></span>
            ${['pagination', 'archive'].includes(fix.id) ? `<span>Response <strong>${Math.round(now.responseKB)} → ${Math.round(after.responseKB)} KB</strong></span>` : ''}
            ${['archive', 'expiry'].includes(fix.id) && now.space.capacity ? `<span>Disk <strong>${Math.round(now.space.pct * 100)}% → ${Math.round(after.space.pct * 100)}%</strong></span>` : ''}
          </div>`;
      }
      const canAfford = gs.coins >= fix.cost;
      return `
        <section class="sb-fix${owned ? ' owned' : ''}">
          <div class="sb-fix-head">
            <span class="sb-part-icon">${fix.icon}</span>
            <div>
              <h4 class="sb-part-name">${fix.name} ${infoButton(fix.info)}</h4>
              <p class="sb-part-desc">${linkTerms(fix.short, { skip: [fix.info] })}</p>
              <p class="sb-fix-effect">${linkTerms(fix.effect, { skip: [fix.info] })}</p>
            </div>
          </div>
          ${preview}
          ${owned
            ? '<span class="sb-fix-owned">✅ Installed</span>'
            : `<button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary'} sb-fix-buy" data-fix="${fix.id}" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `Buy · 💰 ${fix.cost}` : `Need 💰 ${fix.cost}`}
              </button>`}
        </section>`;
    }).join('');
  }

  /** A switch-style fix (e.g. 301 vs 302): free to turn on and off, with its trade-off shown. */
  renderToggleFix(fix, now) {
    const gs = this.gameState;
    const on = Boolean(gs.codeFixes[fix.id]);
    let preview = '';
    if (now) {
      const other = simulateSystem(gs.simulationInput({ fixes: { ...gs.codeFixes, [fix.id]: !on } }));
      const [offS, onS] = on ? [other, now] : [now, other];
      const acc = st => st.clickAccuracy == null ? '' : ` · clicks counted ${Math.round(st.clickAccuracy * 100)}%`;
      preview = `
        <div class="sb-fix-preview">
          <span>Off: busiest machine <strong>${Math.round(offS.peak * 100)}%</strong>${acc(offS)}</span>
          <span>On: busiest machine <strong>${Math.round(onS.peak * 100)}%</strong>${acc(onS)}</span>
        </div>`;
    }
    return `
      <section class="sb-fix${on ? ' owned' : ''}">
        <div class="sb-fix-head">
          <span class="sb-part-icon">${fix.icon}</span>
          <div>
            <h4 class="sb-part-name">${fix.name} ${infoButton(fix.info)}</h4>
            <p class="sb-part-desc">${linkTerms(fix.short, { skip: [fix.info] })}</p>
            <p class="sb-fix-effect">${linkTerms(fix.effect, { skip: [fix.info] })}</p>
          </div>
        </div>
        ${preview}
        <button class="btn ${on ? 'btn-primary' : 'btn-secondary'} sb-fix-toggle" data-fix="${fix.id}" aria-pressed="${on}">
          ${on ? '✅ On: click to turn off' : 'Off: click to turn on'}
        </button>
      </section>`;
  }

  /** Show the current tutorial step (if it's about the builder) at the top. */
  renderTip() {
    const el = this.content.querySelector('#sb-tip');
    if (!el) return;
    const gs = this.gameState;
    const t = gs.tutorial;
    const step = !t.done ? getSteps(gs.level)[t.step] : null;
    if (!step || !step.showInBuilder) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<span class="sb-tip-avatar">👷</span><p>${linkTerms(step.text(gs, null))}</p>`;
  }

  getCost() {
    return this.isUpgrade
      ? upgradeCost(this.installed, this.selection) * this.count
      : serverCost(this.selection);
  }

  hasChanges() {
    if (!this.isUpgrade) return true;
    return PART_ORDER.some(id => this.selection[id] !== this.installed[id]);
  }

  renderSummary() {
    const el = this.content.querySelector('#sb-summary');
    if (!el) return;
    const gs = this.gameState;
    const status = simulateSystem(this.previewInput());
    const bottleneck = partView(status.bottleneckRole, SERVER_PARTS[status.bottleneck]);
    const several = Object.keys(status.servers).length > 1;
    const cost = this.getCost();
    const canAfford = gs.coins >= cost;

    let before = '';
    let runBefore = '';
    if (gs.serverStatus && gs.server) before = `<span class="sb-before">${gs.serverStatus.userLimit} →</span> `;
    if (this.isUpgrade) runBefore = `<span class="sb-before">${gs.roleRunningCostPerMinute(this.role)} →</span> `;
    const runAfter = Math.round(runningCostPerMinute(this.selection) * this.count * (ROLES[this.role]?.costMult ?? 1) * (this.role === 'blob' && gs.codeFixes.coldTier ? 0.5 : 1));

    const where = several ? `${ROLES[status.bottleneckRole].icon} ${ROLES[status.bottleneckRole].short}: ` : '';
    const showSpace = status.space.capacity && (this.role === 'db' || (this.role === 'app' && !gs.isDbPlaced()));
    const space = showSpace
      ? `<div class="sb-summary-item">
          <span class="sb-summary-label">Disk space ${infoButton('diskSpace')}</span>
          <span class="sb-summary-value ${status.space.pct >= 1 ? 'sb-cost-short' : ''}">${Math.round(status.space.pct * 100)}% <small>of ${status.space.capacity.toLocaleString()}</small></span>
        </div>` : '';

    el.innerHTML = `
      <div class="sb-summary-item">
        <span class="sb-summary-label">Can handle</span>
        <span class="sb-summary-value">${before}~${status.userLimit.toLocaleString()} users</span>
      </div>
      <div class="sb-summary-item">
        <span class="sb-summary-label">Runs out first ${infoButton('bottleneck')}</span>
        <span class="sb-summary-value sb-bottleneck">${where}${bottleneck.icon} ${bottleneck.short}</span>
      </div>
      <div class="sb-summary-item">
        <span class="sb-summary-label">Price now</span>
        <span class="sb-summary-value ${canAfford ? 'sb-cost' : 'sb-cost-short'}">💰 ${cost.toLocaleString()} <small>/ ${gs.coins.toLocaleString()}</small></span>
      </div>
      <div class="sb-summary-item">
        <span class="sb-summary-label">Running cost ${infoButton('runningCost')}</span>
        <span class="sb-summary-value">${runBefore}${runAfter}<small>/min</small></span>
      </div>
      ${space}
      <p class="sb-hint">${several ? `${ROLES[status.bottleneckRole].icon} <strong>${ROLES[status.bottleneckRole].name}</strong> · ` : ''}${bottleneck.icon} <strong>${bottleneck.short}:</strong> ${bottleneck.whenFull}</p>
    `;

    const btn = this.content.querySelector('#sb-confirm');
    if (btn) {
      const changed = this.hasChanges();
      const diskTooSmall = this.diskTooSmall(status);
      btn.disabled = !canAfford || !changed || diskTooSmall;
      const what = gs.hasDatabaseLevel() ? ROLES[this.role].name.toLowerCase() : 'server';
      btn.textContent = !changed ? 'Pick a bigger part'
        : diskTooSmall ? 'Disk too small for your data'
        : !canAfford ? 'Not enough coins'
        : this.isUpgrade ? `Upgrade · 💰 ${cost.toLocaleString()}` : `Buy ${what} · 💰 ${cost.toLocaleString()}`;
    }
  }

  /** True when the picked disk is smaller than the data already stored on it. */
  diskTooSmall(status) {
    const gs = this.gameState;
    const holdsData = this.role === 'db' || (this.role === 'app' && !gs.isDbPlaced());
    if (!holdsData || (this.isUpgrade && this.selection.storage === this.installed?.storage)) return false;
    const used = gs.serverStatus?.space?.used || 0;
    return used > 0 && status.space.capacity > 0 && status.space.capacity <= used;
  }

  confirm() {
    if (!this.hasChanges()) return;
    if (this.diskTooSmall(simulateSystem(this.previewInput()))) {
      this.notifications?.show('That disk is smaller than the data already on it. Pick a bigger disk.', 'warning', 4000);
      return;
    }
    const role = this.role;
    const cost = this.getCost();
    const wasUpgrade = this.isUpgrade;
    const before = this.installed;
    const changedParts = wasUpgrade ? PART_ORDER.filter(id => this.selection[id] !== before[id]) : [];

    if (!this.gameState.setServer(this.selection, cost, role)) {
      this.notifications?.show('Not enough coins yet. Users bring in coins over time.', 'warning', 3000);
      return;
    }

    this.close();
    if (wasUpgrade) {
      const names = changedParts.map(id => `${partView(role, SERVER_PARTS[id]).short} → ${optionView(role, id, getOption(id, this.selection[id]), getOptionIndex(id, this.selection[id])).label}`);
      const who = this.gameState.hasDatabaseLevel() ? `${ROLES[role].name}: ` : '';
      this.notifications?.show(`⬆️ ${who}upgraded ${names.join(', ')}. New limit: ~${this.gameState.serverStatus.userLimit} users`, 'success', 4000);
    }
    if (typeof this.onConfirm === 'function') this.onConfirm({ upgrade: wasUpgrade, role });
  }

  /** Add one more app server or database shard (same parts as the others). */
  addMachine() {
    const role = this.role;
    const noun = scaleOutRule(role, this.gameState.level)?.noun || 'machine';
    if (!this.gameState.buyExtraMachine(role)) {
      this.notifications?.show(`Not enough coins for another ${noun} yet.`, 'warning', 3000);
      return;
    }
    this.close();
    if (typeof this.onConfirm === 'function') this.onConfirm({ upgrade: false, role, extra: true });
  }

  addAppServer() {
    this.addMachine();
  }

  toggleFix(id) {
    const fix = CODE_FIXES[id];
    if (!fix) return;
    this.gameState.toggleCodeFix(id);
    const on = this.gameState.codeFixes[id];
    this.notifications?.show(`${fix.icon} ${fix.name} ${on ? 'on' : 'off'}.`, 'info', 3000);
    this.render();
  }

  buyFix(id) {
    const fix = CODE_FIXES[id];
    if (!fix) return;
    if (!this.gameState.buyCodeFix(id, fix.cost)) {
      this.notifications?.show(`Not enough coins for ${fix.name} yet.`, 'warning', 3000);
      return;
    }
    this.notifications?.show(`${fix.icon} ${fix.name} installed. ${fix.effect}`, 'success', 5000);
    this.render();
  }
}
