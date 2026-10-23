/**
 * Scale Architect - Event Panel
 * Incident response center displaying active production disasters, countdown timers,
 * required architectural component checklists, and historical survivals/failures.
 */

import { COMPONENTS } from '../data/components.js';

export default class EventPanel {
  /**
   * @param {HTMLElement} container - DOM container element (#panel-body or side panel)
   * @param {object} gameState - GameState instance
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
    this.sidePanel = document.getElementById('side-panel');
    this.panelTitle = document.getElementById('panel-title');
    this.eventBadge = document.getElementById('event-badge');
    this.timerInterval = null;
  }

  /**
   * Initialize event subscriptions and start timer loop.
   */
  init() {
    this.render();

    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('eventStarted', () => {
        this.update();
        this.updateBadge();
      });
      this.gameState.on('eventEnded', () => {
        this.update();
        this.updateBadge();
      });
      this.gameState.on('eventTick', () => this.updateTimers());
      this.gameState.on('componentAdded', () => this.update());
      this.gameState.on('componentRemoved', () => this.update());
      this.gameState.on('componentUpgraded', () => this.update());
    }

    // Live countdown timer ticker (ticks every 1s)
    this.timerInterval = setInterval(() => {
      this.updateTimers();
      this.updateBadge();
    }, 1000);

    this.updateBadge();
  }

  /**
   * Open the side panel drawer and configure title for Events.
   */
  open() {
    if (this.sidePanel) {
      this.sidePanel.classList.remove('closed');
      this.sidePanel.classList.add('open');
    }
    if (this.panelTitle) {
      this.panelTitle.textContent = 'Incident Center';
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
   * Render the complete active events and event history layout.
   */
  render() {
    if (!this.container) return;

    const activeEvents = this.getActiveEvents();
    const eventHistory = this.getEventHistory();

    this.container.innerHTML = `
      <!-- Active Incidents Section -->
      <div class="panel-section">
        <div class="panel-section-title">
          <span>⚠️ Active Incidents (${activeEvents.length})</span>
        </div>

        <div class="event-list" id="active-event-list">
          ${activeEvents.length === 0 ? `
            <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); background: var(--bg-glass-card); border-radius: var(--radius-md); border: 1px dashed var(--border-glass);">
              <span style="font-size: 28px; display: block; margin-bottom: 8px;">🛡️</span>
              <span style="font-family: var(--font-title); font-size: 13px; font-weight: 700; color: var(--accent-green);">All Systems Nominal</span>
              <p style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">No active traffic surges, DDoS attacks, or database locks detected.</p>
            </div>
          ` : activeEvents.map(evt => this.renderActiveEventCard(evt)).join('')}
        </div>
      </div>

      <!-- Incident History Section -->
      <div class="panel-section" style="margin-top: var(--space-4);">
        <div class="panel-section-title">
          <span>📜 Incident History (${eventHistory.length})</span>
        </div>

        <div class="event-list" id="history-event-list">
          ${eventHistory.length === 0 ? `
            <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 11px;">
              No past incidents recorded yet.
            </div>
          ` : eventHistory.slice(-8).reverse().map(hist => this.renderHistoryEventCard(hist)).join('')}
        </div>
      </div>
    `;

    this.updateBadge();
  }

  /**
   * Render card for an active event with countdown and requirements checklist.
   * @param {object} evt - Active event object
   * @returns {string} HTML string
   */
  renderActiveEventCard(evt) {
    const severity = evt.severity || 'medium';
    const timeLeft = Math.max(0, Math.ceil(evt.timeLeft != null ? evt.timeLeft : (evt.duration || 30)));
    const requirements = evt.requirements || { components: [], minTier: 1 };
    const reqComponents = requirements.components || [];
    const minTier = requirements.minTier || 1;

    // Check if each required component is fulfilled by placed components
    const reqChecklist = reqComponents.map(compId => {
      const compDef = COMPONENTS[compId] || { name: compId, icon: '📦' };
      const isFulfilled = this.isRequirementFulfilled(compId, minTier);

      return `
        <span class="event-req-pill ${isFulfilled ? 'fulfilled' : 'missing'}">
          <span>${isFulfilled ? '✓' : '✗'}</span>
          <span>${compDef.icon}</span>
          <span>${compDef.name} ${minTier > 1 ? `(T${minTier}+)` : ''}</span>
        </span>
      `;
    }).join('');

    return `
      <div class="event-card active" id="event-card-${evt.id}">
        <div class="event-card-header">
          <div class="event-card-title-group">
            <span class="event-severity-dot ${severity}"></span>
            <span class="event-title">${evt.name}</span>
          </div>
          <span class="event-timer" id="timer-${evt.id}">${timeLeft}s</span>
        </div>

        <div class="event-desc">${evt.description || evt.story || ''}</div>

        <div style="font-size: 10px; font-family: var(--font-title); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">
          Survival Requirements:
        </div>
        <div class="event-requirements">
          ${reqChecklist || '<span style="font-size: 11px; color: var(--accent-cyan);">No special hardware required</span>'}
        </div>

        ${evt.inspiredBy ? `
          <div style="font-size: 10px; color: var(--text-muted); font-style: italic; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4px;">
            💡 Inspired by: ${evt.inspiredBy}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render card for a past resolved event.
   * @param {object} hist - Past event history item
   * @returns {string} HTML string
   */
  renderHistoryEventCard(hist) {
    const isSurvived = hist.outcome === 'survived' || hist.survived;
    const severity = hist.severity || 'medium';

    return `
      <div class="event-card ${isSurvived ? 'resolved' : ''}" style="border-left: 3px solid ${isSurvived ? 'var(--accent-green)' : 'var(--accent-red)'}">
        <div class="event-card-header">
          <div class="event-card-title-group">
            <span class="event-severity-dot ${severity}"></span>
            <span class="event-title">${hist.name}</span>
          </div>
          <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: ${isSurvived ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${isSurvived ? 'SURVIVED' : 'FAILED'}
          </span>
        </div>

        <div class="event-desc" style="font-size: 11px;">
          ${hist.description || hist.story || ''}
        </div>

        <div style="font-size: 10px; font-family: var(--font-mono); color: var(--text-secondary); display: flex; gap: 12px; margin-top: 2px;">
          ${isSurvived ? `
            <span style="color: var(--accent-amber);">+${hist.rewards?.coins || 0} Coins</span>
            <span style="color: var(--accent-cyan);">+${hist.rewards?.xp || 0} XP</span>
          ` : `
            <span style="color: var(--accent-red);">-${hist.penalty?.coinsLost || 0} Coins</span>
            <span style="color: var(--accent-red);">-${hist.penalty?.usersLost || 0} Users</span>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Check if a required component type and tier exists on player grid.
   * @param {string} componentId
   * @param {number} minTier
   * @returns {boolean}
   */
  isRequirementFulfilled(componentId, minTier = 1) {
    const placedList = this.getPlacedComponents();
    return placedList.some(p => p.componentId === componentId && (Number(p.tier) || 1) >= minTier);
  }

  /**
   * Retrieve active events from gameState.
   * @returns {Array<object>}
   */
  getActiveEvents() {
    if (!this.gameState) return [];
    if (Array.isArray(this.gameState.activeEvents)) {
      return this.gameState.activeEvents;
    }
    if (this.gameState.events && Array.isArray(this.gameState.events.active)) {
      return this.gameState.events.active;
    }
    return [];
  }

  /**
   * Retrieve historical event logs from gameState.
   * @returns {Array<object>}
   */
  getEventHistory() {
    if (!this.gameState) return [];
    if (Array.isArray(this.gameState.eventHistory)) {
      return this.gameState.eventHistory;
    }
    if (Array.isArray(this.gameState.pastEvents)) {
      return this.gameState.pastEvents;
    }
    if (this.gameState.events && Array.isArray(this.gameState.events.history)) {
      return this.gameState.events.history;
    }
    return [];
  }

  /**
   * Retrieve placed components list from gameState.
   * @returns {Array<object>}
   */
  getPlacedComponents() {
    if (!this.gameState) return [];
    if (Array.isArray(this.gameState.placedComponents)) {
      return this.gameState.placedComponents;
    }
    if (this.gameState.placedComponents instanceof Map) {
      return Array.from(this.gameState.placedComponents.values());
    }
    return [];
  }

  /**
   * Update active countdown timers without full DOM re-render.
   */
  updateTimers() {
    const activeEvents = this.getActiveEvents();
    for (const evt of activeEvents) {
      const timerEl = document.getElementById(`timer-${evt.id}`);
      if (timerEl) {
        const timeLeft = Math.max(0, Math.ceil(evt.timeLeft != null ? evt.timeLeft : 0));
        timerEl.textContent = `${timeLeft}s`;
      }
    }
  }

  /**
   * Update bottom navigation event badge notification count.
   */
  updateBadge() {
    if (!this.eventBadge) return;
    const count = this.getActiveEvents().length;

    if (count > 0) {
      this.eventBadge.textContent = String(count);
      this.eventBadge.style.display = 'flex';
    } else {
      this.eventBadge.style.display = 'none';
    }
  }

  /**
   * Reactive update.
   */
  update() {
    this.render();
  }

  /**
   * Clean up timer loop and listeners.
   */
  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
