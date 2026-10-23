/**
 * Scale Architect - Build Panel
 * Shop drawer displaying architectural infrastructure components by category.
 * Handles purchasing, coin deduction, grid placement mode, and deployment auto-connection.
 */

import { COMPONENTS } from '../data/components.js';

export default class BuildPanel {
  /**
   * @param {HTMLElement} container - Target container element (#panel-body or side panel)
   * @param {object} gameState - GameState instance
   * @param {object} gridRenderer - Active GridRenderer instance
   * @param {object} [notifications] - Toast Notifications instance
   */
  constructor(container, gameState, gridRenderer, notifications = null) {
    this.container = container;
    this.gameState = gameState;
    this.gridRenderer = gridRenderer;
    this.notifications = notifications;
    this.currentCategory = 'all';
    this.pendingPurchase = null;
    this.sidePanel = document.getElementById('side-panel');
    this.panelTitle = document.getElementById('panel-title');
    this.closeBtn = document.getElementById('panel-close-btn');

    this._handleKeyDown = this.handleKeyDown.bind(this);
    this._handleCellPlacement = this.handleCellPlacement.bind(this);
  }

  /**
   * Initialize event handlers and render panel content.
   */
  init() {
    this.render();

    // Listen for GameState reactive changes
    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('coinsChanged', () => this.updateAffordability());
      this.gameState.on('levelUp', () => this.render());
      this.gameState.on('componentAdded', () => this.updateAffordability());
      this.gameState.on('componentRemoved', () => this.updateAffordability());
    }

    // Attach Escape key listener for cancelling placement mode
    window.addEventListener('keydown', this._handleKeyDown);

    // Close button handler
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
  }

  /**
   * Open the side panel drawer and configure title.
   */
  open() {
    if (this.sidePanel) {
      this.sidePanel.classList.remove('closed');
      this.sidePanel.classList.add('open');
    }
    if (this.panelTitle) {
      this.panelTitle.textContent = 'Build Components';
    }
    this.render();
  }

  /**
   * Close the side panel drawer.
   */
  close() {
    if (this.sidePanel) {
      this.sidePanel.classList.add('closed');
      this.sidePanel.classList.remove('open');
    }
  }

  /**
   * Render category tabs and component cards.
   */
  render() {
    if (!this.container) return;

    const categories = [
      { id: 'all', name: 'All', icon: '📦' },
      { id: 'compute', name: 'Compute', icon: '🖥️' },
      { id: 'storage', name: 'Storage', icon: '🗄️' },
      { id: 'network', name: 'Network', icon: '🌐' },
      { id: 'cache', name: 'Cache', icon: '⚡' },
      { id: 'security', name: 'Security', icon: '🛡️' },
      { id: 'messaging', name: 'Messaging', icon: '📨' },
      { id: 'devops', name: 'DevOps', icon: '⚙️' }
    ];

    const playerLevel = this.gameState?.level || 1;
    const playerCoins = this.gameState?.coins ?? 0;

    // Filter components according to selected category
    const allComponents = Object.values(COMPONENTS || {});
    const filteredComponents = allComponents.filter(c => {
      if (this.currentCategory === 'all') return true;
      return c.category === this.currentCategory;
    });

    this.container.innerHTML = `
      <!-- Category Tabs -->
      <div class="category-tabs" id="category-tabs">
        ${categories.map(cat => `
          <button 
            class="category-tab ${this.currentCategory === cat.id ? 'active' : ''}" 
            data-category="${cat.id}"
            type="button"
          >
            <span>${cat.icon}</span>
            <span>${cat.name}</span>
          </button>
        `).join('')}
      </div>

      <!-- Component Catalog List -->
      <div class="component-list" id="component-list">
        ${filteredComponents.map(comp => {
          const isLocked = (comp.unlockLevel || 1) > playerLevel;
          const tier1Cost = comp.tiers?.[0]?.cost ?? 0;
          const canAfford = !isLocked && playerCoins >= tier1Cost;
          const tier1Stats = comp.tiers?.[0] || {};

          return `
            <div 
              class="shop-card ${canAfford ? 'affordable' : 'unaffordable'} ${isLocked ? 'locked' : ''}" 
              id="shop-card-${comp.id}"
              data-component-id="${comp.id}"
              data-cost="${tier1Cost}"
              data-locked="${isLocked}"
            >
              <div class="shop-card-left">
                <div class="shop-card-icon">${comp.icon || '📦'}</div>
                <div class="shop-card-info">
                  <span class="shop-card-name">${comp.name}</span>
                  <span class="shop-card-desc">${comp.description || ''}</span>
                  ${!isLocked ? `
                    <div style="font-size: 10px; color: var(--accent-cyan); font-family: var(--font-mono); margin-top: 3px;">
                      Throughput: +${tier1Stats.throughput || 0} req/s | +${tier1Stats.capacityBonus || 0} users
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="shop-card-right">
                ${isLocked ? `
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-align: right;">
                    🔒 Lv.${comp.unlockLevel}
                  </div>
                ` : `
                  <div class="cost">
                    <span class="cost-icon">💰</span>
                    <span>${tier1Cost === 0 ? 'FREE' : tier1Cost.toLocaleString()}</span>
                  </div>
                  <button 
                    class="btn btn-primary buy-btn" 
                    data-buy-id="${comp.id}"
                    ${canAfford ? '' : 'disabled'}
                    style="padding: 4px 12px; font-size: 11px;"
                  >
                    Deploy
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach Category Tab Listeners
    const tabBtns = this.container.querySelectorAll('.category-tab');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.dataset.category;
        this.render();
      });
    });

    // Attach Buy Button Listeners
    const buyBtns = this.container.querySelectorAll('.buy-btn');
    buyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const compId = btn.dataset.buyId;
        this.startPlacement(compId);
      });
    });
  }

  /**
   * Initiate deployment placement mode for selected component.
   * @param {string} componentId
   */
  startPlacement(componentId) {
    const comp = COMPONENTS[componentId];
    if (!comp) return;

    const cost = comp.tiers?.[0]?.cost ?? 0;
    const playerCoins = this.gameState?.coins ?? 0;

    if (playerCoins < cost) {
      if (this.notifications) {
        this.notifications.show(`Insufficient coins! Required: ${cost}`, 'error');
      }
      return;
    }

    this.pendingPurchase = {
      componentId,
      component: comp,
      cost,
      tier: 1
    };

    // Close panel drawer to allow unrestricted view of isometric grid
    this.close();

    // Enable placement mode on GridRenderer
    if (this.gridRenderer) {
      this.gridRenderer.setPlacementMode(true);
      this.gridRenderer.onCellClick(this._handleCellPlacement);
    }

    if (this.notifications) {
      this.notifications.show(
        `Select an empty grid cell to deploy ${comp.name}. (Press ESC to cancel)`,
        'info',
        5000
      );
    }
  }

  /**
   * Handle grid cell click during placement mode.
   * @param {object} cellData - { gridX, gridY, cell, isOccupied }
   */
  handleCellPlacement(cellData) {
    if (!this.pendingPurchase) return;

    const { gridX, gridY, isOccupied } = cellData;
    const { componentId, component, cost, tier } = this.pendingPurchase;

    if (isOccupied) {
      if (this.notifications) {
        this.notifications.show('This cell is already occupied! Choose an empty tile.', 'warning');
      }
      return;
    }

    // 1. Deduct coins via gameState
    if (cost > 0) {
      if (typeof this.gameState.spendCoins === 'function') {
        this.gameState.spendCoins(cost);
      } else if (typeof this.gameState.deductCoins === 'function') {
        this.gameState.deductCoins(cost);
      } else {
        this.gameState.coins = Math.max(0, (this.gameState.coins || 0) - cost);
        if (typeof this.gameState.emit === 'function') {
          this.gameState.emit('coinsChanged', this.gameState.coins);
        }
      }
    }

    // 2. Add component to gameState
    let placedRecord = null;
    if (typeof this.gameState.addComponent === 'function') {
      placedRecord = this.gameState.addComponent(componentId, gridX, gridY, tier);
    } else {
      placedRecord = {
        id: `comp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        componentId,
        tier: 1,
        gridX,
        gridY
      };
      if (!this.gameState.placedComponents) {
        this.gameState.placedComponents = [];
      }
      this.gameState.placedComponents.push(placedRecord);
      if (typeof this.gameState.emit === 'function') {
        this.gameState.emit('componentAdded', placedRecord);
      }
    }

    // 3. Mark cell as occupied
    if (this.gridRenderer) {
      this.gridRenderer.setOccupied(gridX, gridY, true);
      this.gridRenderer.setPlacementMode(false);
      this.gridRenderer.clearHighlights();
    }

    // 4. Trigger auto-connect logic
    if (typeof this.gameState.autoConnect === 'function') {
      this.gameState.autoConnect();
    }

    // 5. Notify player of success
    if (this.notifications) {
      this.notifications.show(
        `Deployed ${component.name} at (${gridX}, ${gridY})!`,
        'success'
      );
    }

    // Clear pending state
    this.pendingPurchase = null;
    this.updateAffordability();
  }

  /**
   * Cancel active placement mode (e.g. user pressed Escape).
   */
  cancelPlacement() {
    if (!this.pendingPurchase) return;

    if (this.gridRenderer) {
      this.gridRenderer.setPlacementMode(false);
      this.gridRenderer.clearHighlights();
    }

    if (this.notifications) {
      this.notifications.show('Deployment cancelled.', 'info');
    }

    this.pendingPurchase = null;
  }

  /**
   * Handle keyboard events (ESC cancels placement).
   */
  handleKeyDown(e) {
    if (e.key === 'Escape' && this.pendingPurchase) {
      this.cancelPlacement();
    }
  }

  /**
   * Reactive update for component affordability glows and button states.
   */
  updateAffordability() {
    const playerCoins = this.gameState?.coins ?? 0;
    const cards = this.container ? this.container.querySelectorAll('.shop-card') : [];

    cards.forEach(card => {
      const isLocked = card.dataset.locked === 'true';
      const cost = Number(card.dataset.cost) || 0;
      const canAfford = !isLocked && playerCoins >= cost;

      if (canAfford) {
        card.classList.add('affordable');
        card.classList.remove('unaffordable');
      } else {
        card.classList.remove('affordable');
        card.classList.add('unaffordable');
      }

      const buyBtn = card.querySelector('.buy-btn');
      if (buyBtn) {
        buyBtn.disabled = !canAfford;
      }
    });
  }

  /**
   * General reactive update.
   */
  update() {
    this.updateAffordability();
  }

  /**
   * Clean up event listeners and DOM elements.
   */
  destroy() {
    window.removeEventListener('keydown', this._handleKeyDown);
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.pendingPurchase = null;
  }
}
