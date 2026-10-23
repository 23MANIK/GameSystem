/**
 * Scale Architect - Component Registry
 * Catalog management service for architectural components across all categories,
 * levels, and progression tiers.
 */

import { COMPONENTS } from '../data/components.js';

export default class ComponentRegistry {
  constructor() {
    this.components = COMPONENTS || {};
  }

  /**
   * Get component definition by ID.
   * @param {string} componentId
   * @returns {object|undefined}
   */
  getComponent(componentId) {
    return this.components[componentId];
  }

  /**
   * Get all components belonging to a specific system category.
   * @param {string} category
   * @returns {Array<object>}
   */
  getComponentsByCategory(category) {
    if (!category || category === 'all') {
      return this.getAll();
    }
    return Object.values(this.components).filter(c => c.category === category);
  }

  /**
   * Get components that unlock at or below a given level.
   * @param {number} level
   * @returns {Array<object>}
   */
  getComponentsByLevel(level) {
    return Object.values(this.components).filter(c => (c.unlockLevel || 1) <= level);
  }

  /**
   * Alias for getComponentsByLevel.
   * @param {number} level
   * @returns {Array<object>}
   */
  getUnlockedComponents(level) {
    return this.getComponentsByLevel(level);
  }

  /**
   * Get components locked beyond the current level.
   * @param {number} level
   * @returns {Array<object>}
   */
  getLockedComponents(level) {
    return Object.values(this.components).filter(c => (c.unlockLevel || 1) > level);
  }

  /**
   * Get list of standard system categories.
   * @returns {string[]}
   */
  getCategories() {
    return ['compute', 'storage', 'network', 'cache', 'security', 'messaging', 'devops'];
  }

  /**
   * Get metadata and cyberpunk theme color for a category.
   * @param {string} category
   * @returns {{ name: string, icon: string, color: string }}
   */
  getCategoryInfo(category) {
    const info = {
      compute: { name: 'Compute', icon: '🖥️', color: 'var(--accent-cyan)' },
      storage: { name: 'Storage', icon: '🗄️', color: 'var(--accent-amber)' },
      network: { name: 'Network', icon: '🌐', color: 'var(--accent-magenta)' },
      cache: { name: 'Cache', icon: '⚡', color: 'var(--accent-cyan)' },
      security: { name: 'Security', icon: '🛡️', color: 'var(--accent-red)' },
      messaging: { name: 'Messaging', icon: '📨', color: 'var(--accent-blue)' },
      devops: { name: 'DevOps', icon: '⚙️', color: 'var(--accent-purple, #8b5cf6)' }
    };
    return info[category] || { name: category || 'General', icon: '📦', color: '#00f0ff' };
  }

  /**
   * Get specific tier stats for a component.
   * @param {string} componentId
   * @param {number} tier - 1-indexed tier number (1-5)
   * @returns {object|undefined}
   */
  getComponentTier(componentId, tier) {
    const comp = this.getComponent(componentId);
    if (!comp || !comp.tiers) return undefined;
    return comp.tiers.find(t => t.tier === tier) || comp.tiers[tier - 1];
  }

  /**
   * Get maximum tier available for a component.
   * @param {string} componentId
   * @returns {number}
   */
  getMaxTier(componentId) {
    const comp = this.getComponent(componentId);
    return comp?.tiers?.length || 5;
  }

  /**
   * Get next tier definition if upgradeable.
   * @param {string} componentId
   * @param {number} currentTier
   * @returns {object|null}
   */
  getNextTier(componentId, currentTier) {
    const comp = this.getComponent(componentId);
    if (!comp || !comp.tiers) return null;
    return comp.tiers.find(t => t.tier === currentTier + 1) || null;
  }

  /**
   * Get all registered component definitions as an array.
   * @returns {Array<object>}
   */
  getAll() {
    return Object.values(this.components);
  }
}
