/**
 * Scale Architect - Component Renderer
 * Positions, renders, and manages interactive system design nodes on the isometric grid.
 */

import { gridToScreen } from '../rendering/IsometricUtils.js';
import { COMPONENTS } from '../data/components.js';
import { PART_ORDER, SERVER_PARTS, getOption } from '../data/serverParts.js';
import { ROLES, roleForComponent } from '../data/roles.js';

export default class ComponentRenderer {
  /**
   * @param {HTMLElement} container - Container element (#component-layer)
   * @param {object} gameState - Central GameState instance
   * @param {object} gridRenderer - Active GridRenderer instance
   */
  constructor(container, gameState, gridRenderer) {
    this.container = container;
    this.gameState = gameState;
    this.gridRenderer = gridRenderer;
    this.elements = new Map(); // instanceId -> HTMLElement
    this.selectedInstance = null;
    this._handleResize = this.updatePositions.bind(this);
  }

  /**
   * Initialize event subscriptions and render initial components.
   */
  init() {
    if (!this.container) return;

    // Listen for GameState events
    if (this.gameState && typeof this.gameState.on === 'function') {
      // addComponent emits { instance }
      this.gameState.on('componentAdded', (data) => this.renderComponent(data?.instance || data));
      // Level 1: the single server shows its parts and load
      this.gameState.on('serverUpgraded', () => this.refreshServer());
      this.gameState.on('levelStarted', () => this.refreshServer());
      this.gameState.on('metricsUpdated', () => this.updateServerLoad());
      this.gameState.on('componentRemoved', (data) => this.removeComponentElement(data.id || data.instanceId));
      this.gameState.on('componentUpgraded', (data) => this.updateComponentElement(data));
      this.gameState.on('componentSelected', (data) => {
        if (data && data.id !== this.selectedInstance) {
          this.selectComponent(data.id, false);
        }
      });
      this.gameState.on('componentDeselected', () => this.deselectAll());
    }

    // Window resize keeping components aligned with isometric grid offsets
    window.addEventListener('resize', this._handleResize);

    // Render any components from initial or loaded game state
    this.renderAll();
  }

  /**
   * Render or re-render all placed components from gameState.
   */
  renderAll() {
    this.container.innerHTML = '';
    this.elements.clear();

    if (!this.gameState) return;

    let placedList = [];
    if (Array.isArray(this.gameState.placedComponents)) {
      placedList = this.gameState.placedComponents;
    } else if (this.gameState.placedComponents instanceof Map) {
      placedList = Array.from(this.gameState.placedComponents.values());
    } else if (this.gameState.components) {
      placedList = Array.isArray(this.gameState.components)
        ? this.gameState.components
        : Object.values(this.gameState.components);
    }

    for (const placed of placedList) {
      this.renderComponent(placed);
    }
  }

  /**
   * Render a single placed component onto the grid.
   * @param {object} placed - Placed component descriptor { id, componentId, tier, gridX, gridY }
   */
  renderComponent(placed) {
    if (!placed || !this.container) return;

    const compId = placed.componentId || placed.id;
    const comp = COMPONENTS[compId] || (this.gameState?.registry?.getComponent(compId));
    if (!comp) return;

    const tierNum = Number(placed.tier) || 1;
    const tierData = (comp.tiers && (comp.tiers[tierNum - 1] || comp.tiers[0])) || {};

    const pos = gridToScreen(
      placed.gridX,
      placed.gridY,
      this.gridRenderer.tileWidth,
      this.gridRenderer.tileHeight
    );

    // 104px width standard from components.css; center horizontally, place on tile
    const posX = (pos.x + this.gridRenderer.offsetX) - 52;
    const posY = (pos.y + this.gridRenderer.offsetY) - 56;

    const el = document.createElement('div');
    el.className = `component component-${comp.category} category-${comp.category}`;
    el.id = `comp-${placed.id}`;
    el.dataset.instanceId = String(placed.id);
    el.dataset.componentId = compId;
    el.dataset.category = comp.category;

    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    if (roleForComponent(compId) && this.gameState.getServerConfig(roleForComponent(compId).id)) {
      el.innerHTML = this.serverMarkup(roleForComponent(compId).id);
    } else el.innerHTML = `
      <div class="component-tier tier-${tierNum} t${tierNum}">T${tierNum}</div>
      <div class="component-icon">${comp.icon || '📦'}</div>
      <div class="component-name">${comp.name || compId}</div>
      <div class="component-stats">
        <div class="component-stat-row">
          <span>Throughput:</span>
          <span class="component-stat-val">${tierData.throughput || 0} req/s</span>
        </div>
        <div class="component-stat-row">
          <span>Capacity:</span>
          <span class="component-stat-val">+${tierData.capacityBonus || 0} users</span>
        </div>
        ${tierData.latencyReduction ? `
        <div class="component-stat-row">
          <span>Latency:</span>
          <span class="component-stat-val">-${tierData.latencyReduction}ms</span>
        </div>` : ''}
      </div>
      <div class="component-load-bar">
        <div class="component-load-fill" style="width: 15%"></div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectComponent(placed.id, true);
    });

    this.container.appendChild(el);
    this.elements.set(placed.id, el);

    // Bounce entrance animation
    el.style.animation = 'bounce-in 0.4s ease-out';
    if (roleForComponent(compId)) this.updateServerLoad();
  }

  /** Card content for a machine: its name, four parts and a load bar. */
  serverMarkup(roleId = 'app') {
    const gs = this.gameState;
    const role = ROLES[roleId];
    const s = gs.getServerConfig(roleId);
    if (!s) return '';
    const rows = PART_ORDER.map(id => {
      const opt = getOption(id, s[id]);
      return `
        <div class="component-stat-row">
          <span>${SERVER_PARTS[id].icon} ${SERVER_PARTS[id].short}</span>
          <span class="component-stat-val">${opt ? opt.label : '?'}</span>
        </div>`;
    }).join('');
    // Level 1 has only one machine: just "My Server"
    const name = gs.hasDatabaseLevel() ? role.name : 'My Server';
    return `
      <div class="component-icon">${role.icon}</div>
      <div class="component-name">${name}</div>
      <div class="component-stats">${rows}</div>
      <div class="component-load-bar">
        <div class="component-load-fill" style="width: 0%"></div>
      </div>
    `;
  }

  /** Every placed machine card with its role: [{ placed, role, el }]. */
  machineElements() {
    const out = [];
    for (const placed of this.gameState.placedComponents) {
      const role = roleForComponent(placed.componentId);
      const el = this.elements.get(placed.id);
      if (role && el) out.push({ placed, role: role.id, el });
    }
    return out;
  }

  /** Re-draw machine cards after an upgrade. */
  refreshServer() {
    for (const { role, el } of this.machineElements()) {
      el.innerHTML = this.serverMarkup(role);
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'bounce-in 0.4s ease-out';
    }
    this.updateServerLoad();
  }

  /** Each card's load bar follows that machine's busiest part; crashed app servers go dark. */
  updateServerLoad() {
    const gs = this.gameState;
    const status = gs.serverStatus;
    if (!status) return;
    const crashed = gs.spike?.kind === 'crash' ? gs.spike.crashed : 0;
    let appIndex = 0;
    const apps = this.machineElements().filter(m => m.role === 'app').length;

    for (const { role, el } of this.machineElements()) {
      const usage = status.servers[role]?.usage;
      const peak = usage ? Math.max(...Object.values(usage)) : 0;
      const fill = el.querySelector('.component-load-fill');
      if (fill) {
        fill.style.width = `${Math.min(100, Math.round(peak * 100))}%`;
        fill.style.background = peak > 1 ? 'var(--accent-red)' : peak >= 0.8 ? 'var(--accent-amber)' : '';
      }
      el.classList.toggle('server-overloaded', peak > 1);
      // The last N app servers are the crashed ones
      let down = false;
      if (role === 'app') {
        down = appIndex >= apps - crashed;
        appIndex += 1;
      }
      el.classList.toggle('server-down', down);
    }
  }

  /**
   * Remove a component element with an animated fade out.
   * @param {string|number} instanceId
   */
  removeComponentElement(instanceId) {
    const el = this.elements.get(instanceId);
    if (el) {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '0';
      el.style.transform = 'scale(0.7) translateY(20px)';
      setTimeout(() => {
        el.remove();
      }, 300);
      this.elements.delete(instanceId);
    }
    if (this.selectedInstance === instanceId) {
      this.selectedInstance = null;
    }
  }

  /**
   * Update an existing placed component element (e.g. after tier upgrade).
   * @param {object} data - { id, tier, ... }
   */
  updateComponentElement(data) {
    if (!data) return;
    const instanceId = data.id || data.instanceId;
    this.removeComponentElement(instanceId);

    // Retrieve full placed descriptor from state
    let placed = null;
    if (this.gameState) {
      if (typeof this.gameState.getComponent === 'function') {
        placed = this.gameState.getComponent(instanceId);
      } else if (Array.isArray(this.gameState.placedComponents)) {
        placed = this.gameState.placedComponents.find(c => c.id === instanceId);
      }
    }

    if (placed) {
      this.renderComponent(placed);
      // Re-apply selection state if it was selected
      if (this.selectedInstance === instanceId) {
        const el = this.elements.get(instanceId);
        if (el) el.classList.add('selected');
      }
    }
  }

  /**
   * Select a placed component instance and highlight it.
   * @param {string|number} instanceId
   * @param {boolean} emitState - True to emit componentSelected event
   */
  selectComponent(instanceId, emitState = true) {
    // Deselect previous
    if (this.selectedInstance && this.selectedInstance !== instanceId) {
      const prevEl = this.elements.get(this.selectedInstance);
      if (prevEl) prevEl.classList.remove('selected');
    }

    this.selectedInstance = instanceId;
    const el = this.elements.get(instanceId);
    if (el) {
      el.classList.add('selected');
    }

    if (emitState && this.gameState && typeof this.gameState.emit === 'function') {
      this.gameState.emit('componentSelected', { id: instanceId, instanceId });
    }
  }

  /**
   * Deselect currently selected component.
   */
  deselectAll() {
    if (this.selectedInstance) {
      const el = this.elements.get(this.selectedInstance);
      if (el) el.classList.remove('selected');
      this.selectedInstance = null;
    }
  }

  /**
   * Highlight components that are under threat or incident overload.
   * @param {Array<string>} componentIds - Array of component definition IDs (e.g. ['database', 'redis_cache'])
   */
  setWarningMode(componentIds = []) {
    for (const [id, el] of this.elements) {
      let placedCompId = el.dataset.componentId;
      if (!placedCompId && this.gameState && typeof this.gameState.getComponent === 'function') {
        const placed = this.gameState.getComponent(id);
        placedCompId = placed?.componentId;
      }

      if (placedCompId && componentIds.includes(placedCompId)) {
        el.classList.add('warning');
      } else {
        el.classList.remove('warning');
      }
    }
  }

  /**
   * Clear warning overload states from all components.
   */
  clearWarnings() {
    for (const el of this.elements.values()) {
      el.classList.remove('warning');
    }
  }

  /**
   * Recalculate screen positions of all placed components (e.g. after window resize).
   */
  updatePositions() {
    if (!this.gridRenderer) return;

    for (const [id, el] of this.elements) {
      let placed = null;
      if (this.gameState && typeof this.gameState.getComponent === 'function') {
        placed = this.gameState.getComponent(id);
      } else if (Array.isArray(this.gameState?.placedComponents)) {
        placed = this.gameState.placedComponents.find(c => c.id === id);
      }

      if (placed) {
        const pos = gridToScreen(
          placed.gridX,
          placed.gridY,
          this.gridRenderer.tileWidth,
          this.gridRenderer.tileHeight
        );
        el.style.left = `${(pos.x + this.gridRenderer.offsetX) - 52}px`;
        el.style.top = `${(pos.y + this.gridRenderer.offsetY) - 56}px`;
      }
    }
  }

  /**
   * Clean up all DOM elements and listeners.
   */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
    this.elements.clear();
    this.container.innerHTML = '';
    this.selectedInstance = null;
  }
}
