/**
 * Scale Architect - Research Panel
 * R&D Technology Tree displaying architectural research projects grouped by milestone level.
 * Features progress bars, prerequisite validation, real-time timer countdowns, and capability buffs.
 */

import { RESEARCH_TREE } from '../data/research.js';

export default class ResearchPanel {
  /**
   * @param {HTMLElement} container - DOM container element (#panel-body or side panel)
   * @param {object} gameState - GameState instance
   * @param {object} [notifications] - Notifications instance
   */
  constructor(container, gameState, notifications = null) {
    this.container = container;
    this.gameState = gameState;
    this.notifications = notifications;
    this.sidePanel = document.getElementById('side-panel');
    this.panelTitle = document.getElementById('panel-title');
    this.progressInterval = null;
  }

  /**
   * Initialize event subscriptions and start ticker loop.
   */
  init() {
    this.render();

    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('researchStarted', () => this.update());
      this.gameState.on('researchProgress', () => this.updateProgress());
      this.gameState.on('researchCompleted', () => this.update());
      this.gameState.on('levelUp', () => this.update());
      this.gameState.on('coinsChanged', () => this.update());
    }

    // Timer loop for in-progress research updates
    this.progressInterval = setInterval(() => {
      this.tickActiveResearch();
    }, 500);
  }

  /**
   * Open the side panel drawer and configure title for Research.
   */
  open() {
    if (this.sidePanel) {
      this.sidePanel.classList.remove('closed');
      this.sidePanel.classList.add('open');
    }
    if (this.panelTitle) {
      this.panelTitle.textContent = 'R&D Technology Tree';
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
   * Render research projects grouped by level.
   */
  render() {
    if (!this.container) return;

    const researchList = RESEARCH_TREE || [];
    const playerLevel = this.gameState?.level || 1;
    const playerCoins = this.gameState?.coins ?? 0;
    const completedList = this.getCompletedResearch();
    const activeResearch = this.getActiveResearch();

    // Group items by level (Levels 2, 3, 4, 5)
    const levels = [2, 3, 4, 5];

    this.container.innerHTML = `
      <div class="research-tree">
        ${levels.map(lvl => {
          const itemsAtLevel = researchList.filter(item => (item.unlockLevel || 1) === lvl);
          if (itemsAtLevel.length === 0) return '';

          return `
            <div class="panel-section" style="margin-bottom: var(--space-4);">
              <div class="panel-section-title">
                <span>Tier ${lvl} Research Projects ${playerLevel < lvl ? `(🔒 Level ${lvl})` : ''}</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                ${itemsAtLevel.map(item => {
                  const isCompleted = completedList.includes(item.id);
                  const isResearching = activeResearch && (activeResearch.id === item.id || activeResearch.researchId === item.id);
                  
                  // Prerequisite validation
                  const prereqs = item.prerequisites || [];
                  const unfulfilledPrereqs = prereqs.filter(pId => !completedList.includes(pId));
                  const isLocked = (item.unlockLevel || 1) > playerLevel || unfulfilledPrereqs.length > 0;
                  const canAfford = !isLocked && !isCompleted && !isResearching && playerCoins >= item.cost;
                  const isAvailable = !isLocked && !isCompleted && !isResearching;

                  let statusClass = 'locked';
                  if (isCompleted) statusClass = 'unlocked';
                  else if (isResearching) statusClass = 'researching available';
                  else if (isAvailable) statusClass = 'available';

                  return `
                    <div 
                      class="research-item ${statusClass}" 
                      id="research-card-${item.id}"
                      data-research-id="${item.id}"
                    >
                      <div class="research-icon">
                        ${isCompleted ? '✅' : (item.icon || '🔬')}
                      </div>

                      <div class="research-info">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                          <span class="research-name">${item.name}</span>
                          ${isCompleted ? `
                            <span style="font-family: var(--font-title); font-size: 10px; font-weight: 800; color: var(--accent-green);">
                              COMPLETED
                            </span>
                          ` : isResearching ? `
                            <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--accent-magenta);" id="research-timer-${item.id}">
                              ${this.formatTimeRemaining(activeResearch)}
                            </span>
                          ` : isLocked ? `
                            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">
                              ${(item.unlockLevel || 1) > playerLevel ? `Lv.${item.unlockLevel}` : 'Prereq Req.'}
                            </span>
                          ` : `
                            <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--accent-amber);">
                              💰 ${item.cost.toLocaleString()}
                            </span>
                          `}
                        </div>

                        <div class="research-desc">${item.description}</div>

                        <!-- Effect Buff Pill -->
                        ${item.effects?.description ? `
                          <div style="font-size: 10px; font-family: var(--font-mono); color: var(--accent-cyan); margin-top: 4px;">
                            ⚡ Buff: ${item.effects.description}
                          </div>
                        ` : ''}

                        <!-- Prerequisite Warning for Locked Items -->
                        ${isLocked && unfulfilledPrereqs.length > 0 ? `
                          <div style="font-size: 10px; color: var(--accent-amber); margin-top: 4px;">
                            ⚠️ Requires: ${unfulfilledPrereqs.map(p => this.getResearchNameById(p)).join(', ')}
                          </div>
                        ` : ''}

                        <!-- Progress Bar for In-Progress Research -->
                        ${isResearching ? `
                          <div class="research-progress">
                            <div 
                              class="research-progress-fill" 
                              id="progress-fill-${item.id}"
                              style="width: ${this.calculateProgressPercent(activeResearch)}%;"
                            ></div>
                          </div>
                        ` : ''}

                        <!-- Research Trigger Action -->
                        ${isAvailable ? `
                          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-2);">
                            <span style="font-size: 10px; font-family: var(--font-mono); color: var(--text-muted);">
                              ⏱️ ${item.researchTime || 15}s R&D Time
                            </span>
                            <button 
                              class="btn btn-primary btn-sm start-research-btn" 
                              data-research-id="${item.id}"
                              ${canAfford ? '' : 'disabled'}
                              style="padding: 3px 12px; font-size: 10px;"
                            >
                              ${canAfford ? 'Research' : 'Insufficient Coins'}
                            </button>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach Start Research button handlers
    const buttons = this.container.querySelectorAll('.start-research-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rId = btn.dataset.researchId;
        this.startResearch(rId);
      });
    });
  }

  /**
   * Start researching a specific project.
   * @param {string} researchId
   */
  startResearch(researchId) {
    const item = (RESEARCH_TREE || []).find(r => r.id === researchId);
    if (!item) return;

    const playerCoins = this.gameState?.coins ?? 0;
    if (playerCoins < item.cost) {
      if (this.notifications) {
        this.notifications.show(`Insufficient coins! Required: ${item.cost}`, 'error');
      }
      return;
    }

    // Check if research already in progress
    if (this.getActiveResearch()) {
      if (this.notifications) {
        this.notifications.show('Research lab busy! Wait for the current project to finish.', 'warning');
      }
      return;
    }

    // 1. Deduct coins
    if (typeof this.gameState.spendCoins === 'function') {
      this.gameState.spendCoins(item.cost);
    } else if (typeof this.gameState.deductCoins === 'function') {
      this.gameState.deductCoins(item.cost);
    } else {
      this.gameState.coins = Math.max(0, (this.gameState.coins || 0) - item.cost);
      if (typeof this.gameState.emit === 'function') {
        this.gameState.emit('coinsChanged', this.gameState.coins);
      }
    }

    // 2. Set active research in gameState
    const durationMs = (item.researchTime || 20) * 1000;
    const activeData = {
      id: item.id,
      researchId: item.id,
      name: item.name,
      startTime: Date.now(),
      endTime: Date.now() + durationMs,
      durationMs,
      progress: 0
    };

    if (typeof this.gameState.startResearch === 'function') {
      this.gameState.startResearch(item.id);
    } else {
      this.gameState.activeResearch = activeData;
      if (typeof this.gameState.emit === 'function') {
        this.gameState.emit('researchStarted', activeData);
      }
    }

    if (this.notifications) {
      this.notifications.show(`R&D started: "${item.name}"!`, 'info');
    }

    this.render();
  }

  /**
   * Heartbeat to calculate time remaining and complete research.
   */
  tickActiveResearch() {
    const active = this.getActiveResearch();
    if (!active) return;

    const now = Date.now();
    const endTime = active.endTime || (active.startTime + (active.durationMs || 20000));
    const remainingMs = Math.max(0, endTime - now);

    this.updateProgress();

    if (remainingMs <= 0) {
      this.completeResearch(active.id || active.researchId);
    }
  }

  /**
   * Finalize completed research, apply buffs, and notify player.
   * @param {string} researchId
   */
  completeResearch(researchId) {
    const item = (RESEARCH_TREE || []).find(r => r.id === researchId);

    // Add to completed
    if (this.gameState) {
      if (typeof this.gameState.completeResearch === 'function') {
        this.gameState.completeResearch(researchId);
      } else {
        if (!this.gameState.completedResearch) {
          this.gameState.completedResearch = [];
        }
        if (!this.gameState.completedResearch.includes(researchId)) {
          this.gameState.completedResearch.push(researchId);
        }
        this.gameState.activeResearch = null;

        if (typeof this.gameState.emit === 'function') {
          this.gameState.emit('researchCompleted', { id: researchId, item });
        }
      }
    }

    if (this.notifications) {
      this.notifications.show(
        `🎉 Research Completed: "${item?.name || researchId}"! Permanent boost unlocked.`,
        'success',
        6000
      );
    }

    this.render();
  }

  /**
   * Update active progress bar DOM without full re-render.
   */
  updateProgress() {
    const active = this.getActiveResearch();
    if (!active) return;

    const id = active.id || active.researchId;
    const fillEl = document.getElementById(`progress-fill-${id}`);
    const timerEl = document.getElementById(`research-timer-${id}`);

    if (fillEl) {
      fillEl.style.width = `${this.calculateProgressPercent(active)}%`;
    }
    if (timerEl) {
      timerEl.textContent = this.formatTimeRemaining(active);
    }
  }

  /**
   * Calculate percentage (0-100) of completed research time.
   */
  calculateProgressPercent(active) {
    if (!active) return 0;
    const now = Date.now();
    const start = active.startTime || now;
    const duration = active.durationMs || ((active.researchTime || 20) * 1000);
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  }

  /**
   * Format human readable seconds remaining.
   */
  formatTimeRemaining(active) {
    if (!active) return '';
    const now = Date.now();
    const endTime = active.endTime || (active.startTime + (active.durationMs || 20000));
    const sec = Math.max(0, Math.ceil((endTime - now) / 1000));
    return `${sec}s remaining`;
  }

  /**
   * Lookup research name by ID.
   */
  getResearchNameById(rId) {
    const item = (RESEARCH_TREE || []).find(r => r.id === rId);
    return item?.name || rId;
  }

  /**
   * Get active research from gameState.
   */
  getActiveResearch() {
    return this.gameState?.activeResearch || null;
  }

  /**
   * Get list of completed research IDs.
   */
  getCompletedResearch() {
    if (!this.gameState) return [];
    if (Array.isArray(this.gameState.completedResearch)) {
      return this.gameState.completedResearch;
    }
    if (this.gameState.research instanceof Set) {
      return Array.from(this.gameState.research);
    }
    if (this.gameState.research && Array.isArray(this.gameState.research.completed)) {
      return this.gameState.research.completed;
    }
    return [];
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
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
