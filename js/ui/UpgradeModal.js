/**
 * Scale Architect - Upgrade & Dismantle Modal
 * Inspects placed infrastructure nodes, presents side-by-side tier metrics comparisons,
 * handles tier upgrades, and provides asset liquidations (sell for 50% scrap value).
 */

import { COMPONENTS } from '../data/components.js';

export default class UpgradeModal {
  /**
   * @param {HTMLElement} container - Modal container (#upgrade-modal)
   * @param {object} gameState - GameState instance
   * @param {object} [notifications] - Notifications instance
   * @param {object} [gridRenderer] - GridRenderer instance for clearing occupancy
   */
  constructor(container, gameState, notifications = null, gridRenderer = null) {
    this.container = container;
    this.modal = container;
    this.backdrop = document.getElementById('upgrade-modal-backdrop') || container?.parentElement;
    this.gameState = gameState;
    this.notifications = notifications;
    this.gridRenderer = gridRenderer;
    this.currentInstance = null;

    this._handleBackdropClick = this.handleBackdropClick.bind(this);
    this._handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Initialize modal listeners.
   */
  init() {
    if (this.backdrop) {
      this.backdrop.addEventListener('click', this._handleBackdropClick);
    }

    window.addEventListener('keydown', this._handleKeyDown);

    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('componentSelected', (data) => {
        if (data && data.id) {
          this.show(data.id);
        }
      });
      this.gameState.on('coinsChanged', () => this.updateAffordability());
    }
  }

  /**
   * Open modal and display selected component details.
   * @param {string|number} instanceId
   */
  show(instanceId) {
    let placed = null;
    if (this.gameState) {
      if (typeof this.gameState.getComponent === 'function') {
        placed = this.gameState.getComponent(instanceId);
      } else if (Array.isArray(this.gameState.placedComponents)) {
        placed = this.gameState.placedComponents.find(c => c.id === instanceId);
      }
    }

    if (!placed) return;

    this.currentInstance = placed;
    this.render();

    if (this.backdrop) {
      this.backdrop.classList.remove('closed');
      this.backdrop.classList.add('open');
    }
  }

  /**
   * Close modal and clear selection.
   */
  close() {
    if (this.backdrop) {
      this.backdrop.classList.add('closed');
      this.backdrop.classList.remove('open');
    }

    if (this.currentInstance && this.gameState && typeof this.gameState.emit === 'function') {
      this.gameState.emit('componentDeselected', { id: this.currentInstance.id });
    }

    this.currentInstance = null;
  }

  /**
   * Render modal contents with side-by-side tier comparison.
   */
  render() {
    if (!this.modal || !this.currentInstance) return;

    const placed = this.currentInstance;
    const comp = COMPONENTS[placed.componentId] || {};
    const curTierNum = Number(placed.tier) || 1;
    const maxTier = comp.tiers?.length || 5;
    const isMaxTier = curTierNum >= maxTier;

    const curTier = comp.tiers?.[curTierNum - 1] || {};
    const nextTier = !isMaxTier ? comp.tiers?.[curTierNum] : null;

    const upgradeCost = nextTier?.cost ?? 0;
    const playerCoins = this.gameState?.coins ?? 0;
    const canAfford = !isMaxTier && playerCoins >= upgradeCost;

    // Calculate total invested cost for 50% scrap value refund
    let totalInvested = 0;
    if (comp.tiers) {
      for (let t = 0; t < curTierNum; t++) {
        totalInvested += comp.tiers[t]?.cost || 0;
      }
    }
    const sellRefund = Math.max(25, Math.floor(totalInvested * 0.5));

    this.modal.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">${comp.icon || '📦'}</span>
          <div>
            <h2 class="modal-title" style="margin: 0; font-size: 16px;">${comp.name || placed.componentId}</h2>
            <span style="font-size: 11px; color: var(--accent-cyan); text-transform: uppercase; font-family: var(--font-mono); letter-spacing: 0.05em;">
              ${comp.category || 'System'} Node • Tier ${curTierNum}
            </span>
          </div>
        </div>
        <button class="modal-close-btn" id="modal-close-btn" aria-label="Close dialog">✕</button>
      </div>

      <div class="modal-body" style="padding: 16px 20px;">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.4;">
          ${comp.description || ''}
        </div>

        <!-- Side-by-Side Tier Comparison -->
        <div class="tier-compare" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <!-- Current Tier Column -->
          <div class="tier-col current" style="background: var(--bg-glass-card); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 12px;">
            <div class="tier-col-title" style="font-family: var(--font-title); font-size: 11px; font-weight: 800; color: var(--accent-cyan); margin-bottom: 8px; border-bottom: 1px solid var(--border-glass); padding-bottom: 4px;">
              CURRENT (T${curTierNum})
            </div>
            
            <div class="stat-comparison-row">
              <span class="stat-comparison-label">Throughput:</span>
              <span class="stat-comparison-val">${curTier.throughput || 0} req/s</span>
            </div>
            <div class="stat-comparison-row">
              <span class="stat-comparison-label">Capacity:</span>
              <span class="stat-comparison-val">+${curTier.capacityBonus || 0} users</span>
            </div>
            <div class="stat-comparison-row">
              <span class="stat-comparison-label">Latency:</span>
              <span class="stat-comparison-val">-${curTier.latencyReduction || 0}ms</span>
            </div>
            <div class="stat-comparison-row">
              <span class="stat-comparison-label">Compute Cost:</span>
              <span class="stat-comparison-val">${curTier.computeDrain || curTier.computeUsed || 2}%</span>
            </div>
          </div>

          <!-- Next Tier Column -->
          <div class="tier-col next" style="background: ${isMaxTier ? 'rgba(0,0,0,0.3)' : 'rgba(6, 214, 160, 0.05)'}; border: 1px solid ${isMaxTier ? 'var(--border-glass)' : 'var(--accent-green)'}; border-radius: var(--radius-md); padding: 12px;">
            <div class="tier-col-title" style="font-family: var(--font-title); font-size: 11px; font-weight: 800; color: ${isMaxTier ? 'var(--text-muted)' : 'var(--accent-green)'}; margin-bottom: 8px; border-bottom: 1px solid var(--border-glass); padding-bottom: 4px;">
              ${isMaxTier ? 'MAX TIER REACHED' : `UPGRADE (T${curTierNum + 1})`}
            </div>

            ${!isMaxTier ? `
              <div class="stat-comparison-row">
                <span class="stat-comparison-label">Throughput:</span>
                <span class="stat-comparison-val" style="color: var(--accent-green); font-weight: 700;">
                  ${nextTier.throughput || 0} req/s
                </span>
              </div>
              <div class="stat-comparison-row">
                <span class="stat-comparison-label">Capacity:</span>
                <span class="stat-comparison-val" style="color: var(--accent-green); font-weight: 700;">
                  +${nextTier.capacityBonus || 0} users
                </span>
              </div>
              <div class="stat-comparison-row">
                <span class="stat-comparison-label">Latency:</span>
                <span class="stat-comparison-val" style="color: var(--accent-green); font-weight: 700;">
                  -${nextTier.latencyReduction || 0}ms
                </span>
              </div>
              <div class="stat-comparison-row">
                <span class="stat-comparison-label">Compute Cost:</span>
                <span class="stat-comparison-val">
                  ${nextTier.computeDrain || nextTier.computeUsed || 4}%
                </span>
              </div>
            ` : `
              <div style="font-size: 11px; color: var(--text-muted); text-align: center; padding-top: 18px;">
                ⭐ Architecture is fully optimized at peak specification.
              </div>
            `}
          </div>
        </div>

        <!-- Position Details -->
        <div style="font-size: 10px; font-family: var(--font-mono); color: var(--text-muted); display: flex; justify-content: space-between; padding: 4px 0;">
          <span>Grid Coordinates: (${placed.gridX}, ${placed.gridY})</span>
          <span>Instance ID: #${placed.id}</span>
        </div>
      </div>

      <div class="modal-footer" style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); border-top: 1px solid var(--border-glass);">
        <!-- Sell Button -->
        <button 
          class="btn btn-danger sell-btn" 
          id="sell-btn"
          style="padding: 6px 14px; font-size: 11px;"
        >
          🗑️ Dismantle (+💰${sellRefund.toLocaleString()})
        </button>

        <!-- Upgrade Button -->
        ${!isMaxTier ? `
          <button 
            class="btn btn-primary upgrade-btn" 
            id="upgrade-btn"
            ${canAfford ? '' : 'disabled'}
            style="padding: 6px 18px; font-size: 12px;"
          >
            ⭐ Upgrade to T${curTierNum + 1} (💰 ${upgradeCost.toLocaleString()})
          </button>
        ` : `
          <button class="btn btn-secondary" disabled style="padding: 6px 18px; font-size: 12px;">
            Max Tier
          </button>
        `}
      </div>
    `;

    // Attach click listeners
    const closeBtn = this.modal.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const upgradeBtn = this.modal.querySelector('#upgrade-btn');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.handleUpgrade());
    }

    const sellBtn = this.modal.querySelector('#sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => this.handleSell(sellRefund));
    }
  }

  /**
   * Execute tier upgrade on current component.
   */
  handleUpgrade() {
    if (!this.currentInstance) return;

    const placed = this.currentInstance;
    const comp = COMPONENTS[placed.componentId];
    if (!comp) return;

    const curTierNum = Number(placed.tier) || 1;
    const nextTier = comp.tiers?.[curTierNum];
    if (!nextTier) return;

    const cost = nextTier.cost || 0;
    const playerCoins = this.gameState?.coins ?? 0;

    if (playerCoins < cost) {
      if (this.notifications) {
        this.notifications.show(`Insufficient coins! Required: ${cost}`, 'error');
      }
      return;
    }

    // 1. Deduct coins
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

    // 2. Increment placed tier
    placed.tier = curTierNum + 1;

    if (typeof this.gameState.upgradeComponent === 'function') {
      this.gameState.upgradeComponent(placed.id, placed.tier);
    } else if (typeof this.gameState.emit === 'function') {
      this.gameState.emit('componentUpgraded', placed);
    }

    if (this.notifications) {
      this.notifications.show(
        `Upgraded ${comp.name} to Tier ${placed.tier}!`,
        'success'
      );
    }

    this.render();
  }

  /**
   * Dismantle component and recover coins.
   * @param {number} refundAmount
   */
  handleSell(refundAmount) {
    if (!this.currentInstance) return;

    const placed = this.currentInstance;
    const comp = COMPONENTS[placed.componentId];
    const compName = comp?.name || 'Component';
    const instanceId = placed.id;
    const gx = placed.gridX;
    const gy = placed.gridY;

    // 1. Refund coins
    if (typeof this.gameState.addCoins === 'function') {
      this.gameState.addCoins(refundAmount);
    } else {
      this.gameState.coins = (this.gameState.coins || 0) + refundAmount;
      if (typeof this.gameState.emit === 'function') {
        this.gameState.emit('coinsChanged', this.gameState.coins);
      }
    }

    // 2. Remove component from gameState
    if (typeof this.gameState.removeComponent === 'function') {
      this.gameState.removeComponent(instanceId);
    } else {
      if (Array.isArray(this.gameState.placedComponents)) {
        this.gameState.placedComponents = this.gameState.placedComponents.filter(c => c.id !== instanceId);
      }
      if (typeof this.gameState.emit === 'function') {
        this.gameState.emit('componentRemoved', { id: instanceId, gridX: gx, gridY: gy });
      }
    }

    // 3. Unmark grid occupancy
    if (this.gridRenderer) {
      this.gridRenderer.setOccupied(gx, gy, false);
    }

    if (this.notifications) {
      this.notifications.show(
        `Dismantled ${compName}. Recovered 💰 ${refundAmount.toLocaleString()} coins.`,
        'info'
      );
    }

    this.close();
  }

  /**
   * Update upgrade button enable/disable state when coins change.
   */
  updateAffordability() {
    if (!this.currentInstance) return;
    const upgradeBtn = this.modal?.querySelector('#upgrade-btn');
    if (!upgradeBtn) return;

    const placed = this.currentInstance;
    const comp = COMPONENTS[placed.componentId];
    const curTierNum = Number(placed.tier) || 1;
    const nextTier = comp?.tiers?.[curTierNum];

    if (nextTier) {
      const canAfford = (this.gameState?.coins ?? 0) >= (nextTier.cost || 0);
      upgradeBtn.disabled = !canAfford;
    }
  }

  /**
   * Handle backdrop click to close modal.
   */
  handleBackdropClick(e) {
    if (e.target === this.backdrop) {
      this.close();
    }
  }

  /**
   * Handle ESC key to dismiss modal.
   */
  handleKeyDown(e) {
    if (e.key === 'Escape' && this.backdrop && !this.backdrop.classList.contains('closed')) {
      this.close();
    }
  }

  /**
   * Clean up event listeners and DOM elements.
   */
  destroy() {
    if (this.backdrop) {
      this.backdrop.removeEventListener('click', this._handleBackdropClick);
    }
    window.removeEventListener('keydown', this._handleKeyDown);
    if (this.modal) {
      this.modal.innerHTML = '';
    }
  }
}
