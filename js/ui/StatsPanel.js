/**
 * Scale Architect - Stats Panel
 * Comprehensive system telemetry dashboard presenting vital platform metrics,
 * component distribution breakdown, and architecture feature milestone progress.
 */

import { COMPONENTS } from '../data/components.js';

export default class StatsPanel {
  /**
   * @param {HTMLElement} container - DOM container element (#panel-body or side panel)
   * @param {object} gameState - GameState instance
   */
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
    this.sidePanel = document.getElementById('side-panel');
    this.panelTitle = document.getElementById('panel-title');
  }

  /**
   * Initialize event subscriptions and render initial dashboard.
   */
  init() {
    this.render();

    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('metricsUpdated', () => this.update());
      this.gameState.on('usersChanged', () => this.update());
      this.gameState.on('componentAdded', () => this.update());
      this.gameState.on('componentRemoved', () => this.update());
      this.gameState.on('componentUpgraded', () => this.update());
      this.gameState.on('levelUp', () => this.update());
      this.gameState.on('researchCompleted', () => this.update());
    }
  }

  /**
   * Open the side panel drawer and configure title for Stats.
   */
  open() {
    if (this.sidePanel) {
      this.sidePanel.classList.remove('closed');
      this.sidePanel.classList.add('open');
    }
    if (this.panelTitle) {
      this.panelTitle.textContent = 'System Vitals';
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
   * Render the complete telemetry dashboard.
   */
  render() {
    if (!this.container) return;

    const metrics = this.gameState?.metrics || {};
    const latency = metrics.latency ?? 45;
    const throughput = metrics.throughput ?? 100;
    const errorRate = metrics.errorRate ?? 0.0;
    const uptime = metrics.uptime != null ? Number(metrics.uptime) : 99.95;
    const users = this.gameState?.users ?? 0;
    const capacity = metrics.capacity ?? (this.gameState?.userCapacity || Math.max(500, users * 2));
    const computeUsed = this.gameState?.computeUsed ?? 0;

    // Health indicators
    const latencyHealth = latency < 50 ? 'healthy' : (latency < 100 ? 'warning' : 'critical');
    const errorHealth = errorRate < 0.02 ? 'healthy' : (errorRate < 0.06 ? 'warning' : 'critical');
    const uptimeHealth = uptime >= 99.9 ? 'healthy' : (uptime >= 99.0 ? 'warning' : 'critical');
    const computeHealth = computeUsed < 70 ? 'healthy' : (computeUsed < 90 ? 'warning' : 'critical');
    const capacityRatio = capacity > 0 ? (users / capacity) : 0;
    const userHealth = capacityRatio < 0.8 ? 'healthy' : (capacityRatio < 0.95 ? 'warning' : 'critical');

    // Category counts breakdown
    const categoryCounts = this.getCategoryBreakdown();

    // Features progression
    const features = this.getArchitectureFeatures();

    this.container.innerHTML = `
      <!-- 1. Six Core Metric Cards in a 2-Column Grid -->
      <div class="panel-section">
        <div class="panel-section-title">
          <span>📊 Live Performance Telemetry</span>
        </div>

        <div class="metrics-grid">
          <!-- Card 1: Latency -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Latency (p99)</span>
              <span class="health-indicator ${latencyHealth}"></span>
            </div>
            <div class="metric-value ${latencyHealth}">${latency}ms</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              ${latency < 50 ? '🟢 Lightning Fast' : (latency < 100 ? '🟡 Acceptable' : '🔴 High Degradation')}
            </div>
          </div>

          <!-- Card 2: Throughput -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Throughput</span>
              <span class="health-indicator healthy"></span>
            </div>
            <div class="metric-value healthy">${this.formatNumber(throughput)}</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              Requests / sec
            </div>
          </div>

          <!-- Card 3: Error Rate -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Error Rate</span>
              <span class="health-indicator ${errorHealth}"></span>
            </div>
            <div class="metric-value ${errorHealth}">${(errorRate * 100).toFixed(2)}%</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              5xx Gateway Errors
            </div>
          </div>

          <!-- Card 4: Uptime -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">System Uptime</span>
              <span class="health-indicator ${uptimeHealth}"></span>
            </div>
            <div class="metric-value ${uptimeHealth}">${uptime.toFixed(2)}%</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              SLA Target: 99.90%
            </div>
          </div>

          <!-- Card 5: Users / Capacity -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Users / Capacity</span>
              <span class="health-indicator ${userHealth}"></span>
            </div>
            <div class="metric-value ${userHealth}" style="font-size: 15px;">
              ${this.formatNumber(users)} / ${this.formatNumber(capacity)}
            </div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              ${Math.round(capacityRatio * 100)}% Saturation
            </div>
          </div>

          <!-- Card 6: Compute Utilization -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Compute Usage</span>
              <span class="health-indicator ${computeHealth}"></span>
            </div>
            <div class="metric-value ${computeHealth}">${computeUsed}%</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">
              CPU & Memory Pool
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Infrastructure Node Breakdown by Category -->
      <div class="panel-section" style="margin-top: var(--space-4);">
        <div class="panel-section-title">
          <span>🏗️ Deployed Components by Category</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${categoryCounts.map(cat => `
            <div style="background: var(--bg-glass-card); border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 8px 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                <span style="font-family: var(--font-title); font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                  <span>${cat.icon}</span>
                  <span>${cat.name}</span>
                </span>
                <span style="font-family: var(--font-mono); font-weight: 800; color: ${cat.color};">
                  ${cat.count} nodes
                </span>
              </div>
              <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.5); border-radius: var(--radius-full); margin-top: 6px; overflow: hidden;">
                <div style="width: ${Math.min(100, (cat.count / 6) * 100)}%; height: 100%; background: ${cat.color};"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 3. Unlocked Architecture Milestones -->
      <div class="panel-section" style="margin-top: var(--space-4);">
        <div class="panel-section-title">
          <span>🚀 Architecture Capabilities</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${features.map(feat => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: var(--radius-sm); background: ${feat.unlocked ? 'rgba(6, 214, 160, 0.08)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${feat.unlocked ? 'rgba(6, 214, 160, 0.3)' : 'var(--border-glass)'};">
              <span style="font-size: 11px; color: ${feat.unlocked ? 'var(--text-primary)' : 'var(--text-muted)'}; display: flex; align-items: center; gap: 6px;">
                <span>${feat.unlocked ? '✅' : '🔒'}</span>
                <span style="font-weight: ${feat.unlocked ? '600' : '400'};">${feat.name}</span>
              </span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: ${feat.unlocked ? 'var(--accent-cyan)' : 'var(--text-muted)'};">
                ${feat.requirement}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Calculate node count distribution grouped by the 7 system categories.
   * @returns {Array<object>}
   */
  getCategoryBreakdown() {
    const categories = [
      { id: 'compute', name: 'Compute', icon: '🖥️', color: 'var(--accent-cyan)' },
      { id: 'storage', name: 'Storage', icon: '🗄️', color: 'var(--accent-amber)' },
      { id: 'network', name: 'Network', icon: '🌐', color: 'var(--accent-magenta)' },
      { id: 'cache', name: 'Cache', icon: '⚡', color: '#06d6a0' },
      { id: 'security', name: 'Security', icon: '🛡️', color: 'var(--accent-red)' },
      { id: 'messaging', name: 'Messaging', icon: '📨', color: 'var(--accent-blue)' },
      { id: 'devops', name: 'DevOps', icon: '⚙️', color: '#8b5cf6' }
    ];

    const placedList = this.getPlacedComponents();
    const counts = {};
    for (const cat of categories) {
      counts[cat.id] = 0;
    }

    for (const placed of placedList) {
      const comp = COMPONENTS[placed.componentId];
      if (comp && counts[comp.category] !== undefined) {
        counts[comp.category]++;
      }
    }

    return categories.map(cat => ({
      ...cat,
      count: counts[cat.id] || 0
    }));
  }

  /**
   * Milestone feature checklist showing unlocked scaling abilities.
   * @returns {Array<object>}
   */
  getArchitectureFeatures() {
    const level = this.gameState?.level || 1;
    const completedResearch = this.getCompletedResearch();

    return [
      {
        name: 'Monolithic Single-Box Baseline',
        requirement: 'Level 1',
        unlocked: level >= 1
      },
      {
        name: 'Anycast DNS & Geo-Routing',
        requirement: 'Level 2',
        unlocked: level >= 2
      },
      {
        name: 'Horizontal Application Scaling',
        requirement: 'Research',
        unlocked: completedResearch.includes('horizontal_scaling') || level >= 2
      },
      {
        name: 'CDN Static Edge Caching',
        requirement: 'Level 3',
        unlocked: level >= 3
      },
      {
        name: 'Layer-7 Load Balancing',
        requirement: 'Level 3',
        unlocked: level >= 3
      },
      {
        name: 'Cache-Aside Invalidation Engine',
        requirement: 'Research',
        unlocked: completedResearch.includes('caching_101') || level >= 3
      },
      {
        name: 'Read Replica Query Offloading',
        requirement: 'Level 4',
        unlocked: level >= 4
      },
      {
        name: 'Distributed Message Broker Bus',
        requirement: 'Level 4',
        unlocked: level >= 4
      },
      {
        name: 'Sliding-Window Rate Limiting',
        requirement: 'Level 5',
        unlocked: level >= 5
      },
      {
        name: 'Database Sharding Ring',
        requirement: 'Level 5',
        unlocked: level >= 5
      }
    ];
  }

  /**
   * Retrieve list of placed components from gameState.
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
   * Retrieve completed research IDs from gameState.
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
   * Format numbers to clean human-readable notation (e.g. 1.2M, 5.4K).
   */
  formatNumber(n) {
    const num = Number(n) || 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  /**
   * Reactive dashboard update.
   */
  update() {
    this.render();
  }

  /**
   * Clean up DOM and listeners.
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
