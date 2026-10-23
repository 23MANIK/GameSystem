/**
 * Scale Architect - Level Progression System
 * Evaluates level completion requirements, unlocks new architectural components,
 * and calculates dynamic user growth rates.
 */

import { LEVELS } from '../data/levels.js';
import { COMPONENTS } from '../data/components.js';
import { getChallenges } from './Challenges.js';
import { calculateFunding } from '../data/funding.js';

export default class LevelSystem {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /**
   * Returns definition data for the player's current level
   */
  getCurrentLevel() {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, this.gameState.level - 1));
    return LEVELS[idx];
  }

  /**
   * Returns all component IDs unlocked up to and including the current level
   */
  getUnlockedComponentIds() {
    const unlocked = new Set();
    const maxIdx = Math.min(LEVELS.length - 1, this.gameState.level - 1);
    for (let i = 0; i <= maxIdx; i++) {
      for (const id of LEVELS[i].unlockedComponentIds) {
        unlocked.add(id);
      }
    }
    return Array.from(unlocked);
  }

  /**
   * Returns all platform features unlocked up to and including the current level
   */
  getUnlockedFeatures() {
    const features = new Set();
    const maxIdx = Math.min(LEVELS.length - 1, this.gameState.level - 1);
    for (let i = 0; i <= maxIdx; i++) {
      for (const feat of LEVELS[i].unlockedFeatures) {
        features.add(feat);
      }
    }
    return Array.from(features);
  }

  /**
   * Checks whether a specific component is unlocked at the current level
   */
  isComponentUnlocked(componentId) {
    return this.getUnlockedComponentIds().includes(componentId);
  }

  /**
   * Evaluates if user target and required architectural components are satisfied
   */
  canLevelUp() {
    const currentLevel = this.getCurrentLevel();

    // Single-server level: every challenge of the level is done
    if (currentLevel.serverMode) {
      const challenges = getChallenges(currentLevel.level);
      return this.gameState.isServerPlaced()
        && challenges.length > 0
        && challenges.every(ch => this.gameState.challengesDone.includes(ch.id));
    }

    // If already at max level, cannot advance further
    if (this.gameState.level >= LEVELS.length) {
      return false;
    }

    // Check user target
    const hasEnoughUsers = this.gameState.users >= currentLevel.userTarget;
    if (!hasEnoughUsers) {
      return false;
    }

    // Check required components placement
    const hasRequiredComponents = currentLevel.requiredComponents.every(compId => {
      return this.gameState.hasComponent(compId);
    });

    return hasRequiredComponents;
  }

  /**
   * Returns missing requirements for leveling up (for UI guidance)
   */
  getLevelUpChecklist() {
    const current = this.getCurrentLevel();
    const userTargetMet = this.gameState.users >= current.userTarget;
    const missingComponents = current.requiredComponents.filter(compId => !this.gameState.hasComponent(compId));

    return {
      canAdvance: userTargetMet && missingComponents.length === 0,
      userTarget: current.userTarget,
      currentUsers: this.gameState.users,
      userTargetMet,
      requiredComponents: current.requiredComponents,
      missingComponents
    };
  }

  /**
   * Advances player to next level if requirements are satisfied
   */
  checkLevelUp() {
    if (!this.canLevelUp()) {
      return false;
    }

    const completedLevel = this.getCurrentLevel();
    const nextLevelNum = this.gameState.level + 1;
    const nextLevelData = LEVELS[nextLevelNum - 1];

    // Server levels: celebrate, pay funding and pause. The player starts the
    // next level themselves (if it's built yet).
    if (completedLevel.serverMode || !nextLevelData || nextLevelData.comingSoon) {
      if (this.gameState.levelCompleted) return false;
      this.gameState.levelCompleted = true;

      // Investors fund the next stage based on users and profit
      const stats = this.gameState.getEconomySummary();
      const funding = calculateFunding(completedLevel.level, stats);
      this.gameState.receiveFunding(funding);

      this.gameState.save();
      this.gameState.emit('levelComplete', {
        level: completedLevel.level,
        name: completedLevel.name,
        completionMessage: completedLevel.completionMessage,
        userTarget: completedLevel.userTarget,
        next: nextLevelData || null,
        nextPlayable: Boolean(nextLevelData && !nextLevelData.comingSoon),
        stats,
        funding
      });
      return true;
    }

    // Grant level completion coin bonus
    const bonusCoins = Math.round(completedLevel.startingCoins * 1.5);
    this.gameState.addCoins(bonusCoins);

    // Advance level
    this.gameState.level = nextLevelNum;
    this.gameState.computeBudget = nextLevelData.computeBudget;
    this.gameState.unlockedFeatures = this.getUnlockedFeatures();

    this.gameState.recalculateMetrics();

    // Prepare unlocked components summary for UI overlay
    const newComponents = (nextLevelData.unlockedComponentIds || []).map(id => {
      const def = COMPONENTS[id];
      return def ? { id, name: def.name, icon: def.icon } : { id, name: id, icon: '📦' };
    });

    // Emit levelUp notification
    this.gameState.emit('levelUp', {
      level: this.gameState.level,
      name: nextLevelData.name,
      levelData: nextLevelData,
      bonusCoins,
      newComponents,
      newFeatures: nextLevelData.unlockedFeatures,
      completionMessage: completedLevel.completionMessage
    });

    return true;
  }

  /**
   * Calculates realistic user growth rate per tick (every 2s) based on capacity,
   * error rate, and active incidents.
   */
  getUserGrowthRate() {
    const currentLevel = this.getCurrentLevel();

    // Single server: new users keep showing up (they don't know your limit).
    // Once a part goes over 100%, errors drive users away again.
    if (currentLevel.serverMode) {
      const gs = this.gameState;
      if (!gs.appLive || !gs.isServerPlaced() || !gs.serverStatus) return 0;
      const peak = gs.serverStatus.peak;
      if (peak > 1) {
        // Overloaded: users leave (at most 8% per tick)
        const share = Math.min(0.08, (peak - 1) * 0.5);
        return -Math.max(1, Math.ceil(gs.users * share));
      }
      // A bad reputation slows word of mouth (down to 25% of normal growth)
      // Everyone who wants the product is already here
      if (currentLevel.audience && gs.users >= currentLevel.audience) return 0;
      const growth = currentLevel.userGrowthRate * (0.25 + 0.75 * (gs.reputation / 100));
      const whole = Math.floor(growth);
      return whole + (Math.random() < growth - whole ? 1 : 0);
    }
    let baseRate = currentLevel.userGrowthRate;

    // 1. Capacity Throttling
    // If current users are at or above max capacity, growth halts
    if (this.gameState.users >= this.gameState.maxUsers) {
      return 0;
    }

    // As system fills up past 80% capacity, growth slows down
    const remainingCapacity = this.gameState.maxUsers - this.gameState.users;
    const capacityBuffer = this.gameState.maxUsers * 0.2;
    if (remainingCapacity < capacityBuffer) {
      const slowdown = Math.max(0.1, remainingCapacity / capacityBuffer);
      baseRate *= slowdown;
    }

    // 2. Error Rate Penalties
    // High error rate destroys user trust and causes churn
    const errorRate = this.gameState.metrics.errorRate;
    if (errorRate > 0.05) {
      // 5% error rate starts suppressing growth
      const penalty = Math.min(1.0, (errorRate - 0.05) * 3);
      baseRate *= Math.max(0, 1.0 - penalty);
    }

    if (errorRate > 0.35) {
      // Catastrophic error rate causes net negative churn
      const churnRate = Math.round(this.gameState.users * 0.02 * (errorRate - 0.35));
      return -Math.max(1, churnRate);
    }

    // 3. Active Incident Drain
    let incidentUserDrain = 0;
    for (const evt of this.gameState.activeEvents) {
      if (evt.effects && evt.effects.userLossRate) {
        incidentUserDrain += evt.effects.userLossRate * 2; // 2 seconds per tick
      }
    }

    const netRate = Math.round(baseRate) - incidentUserDrain;
    return netRate;
  }

  /**
   * Returns list of event IDs eligible to trigger at the current level
   */
  getAvailableEvents() {
    const levelDef = this.getCurrentLevel();
    return levelDef ? [...(levelDef.eventIds || [])] : [];
  }
}
