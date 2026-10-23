/**
 * Scale Architect - Resource Manager
 * Manages economy generation (coins), user growth, compute capacity tracking,
 * and component purchasing/upgrade transactions.
 */

import { COMPONENTS } from '../data/components.js';
import { LEVELS } from '../data/levels.js';
import { runningCostPerMinute } from '../data/serverParts.js';

export default class ResourceManager {
  constructor(gameState, levelSystem = null) {
    this.gameState = gameState;
    this.levelSystem = levelSystem;
  }

  /**
   * Sets the LevelSystem reference if created after ResourceManager
   */
  setLevelSystem(levelSystem) {
    this.levelSystem = levelSystem;
  }

  /**
   * Periodic economic & user update tick (default 2s interval)
   * Supports tick(deltaSeconds) and tick(levelSystem, deltaSeconds)
   */
  tick(deltaSecondsOrLevelSystem = 2, optionalDelta = 2) {
    if (this.gameState.isPaused) return;

    let deltaSeconds = 2;
    if (typeof deltaSecondsOrLevelSystem === 'object' && deltaSecondsOrLevelSystem !== null) {
      this.levelSystem = deltaSecondsOrLevelSystem;
      deltaSeconds = typeof optionalDelta === 'number' ? optionalDelta : 2;
    } else if (typeof deltaSecondsOrLevelSystem === 'number') {
      deltaSeconds = deltaSecondsOrLevelSystem;
    }

    const levelDef = LEVELS[this.gameState.level - 1] || LEVELS[0];

    // 1. Generate coins from active user base
    const income = this.getIncomeRate();
    if (levelDef.serverMode) {
      const gs = this.gameState;
      // Only successful requests make money. During a spike there is more traffic,
      // so more to earn if the server keeps up and more to lose if it doesn't.
      const mult = gs.spike?.kind === 'spike' ? gs.spike.mult : 1;
      const errorRate = gs.metrics?.errorRate || 0;
      const potential = (gs.users / 100) * levelDef.coinRate * mult;
      const earned = potential * (1 - errorRate);
      const lost = potential - earned;
      gs.earnRevenue(earned);
      gs.recordLostRevenue(lost);

      // Real outage (5%+ failing): refunds and support costs on top
      const penalty = errorRate >= 0.05 ? potential * errorRate * 0.5 : 0;
      gs.payPenalty(penalty);

      if (gs.spike) {
        gs.spike.revenue += earned;
        gs.spike.lost += lost + penalty;
      }
      if (this.gameState.isServerPlaced()) {
        this.gameState.payRunningCost(this.gameState.totalRunningCostPerMinute() * deltaSeconds / 60);
      }
      if (this.gameState.appLive && this.gameState.isServerPlaced()) {
        this.gameState.recordLiveTick(deltaSeconds);
        // Bot requests the gateway rejected (Level 4+)
        const st = this.gameState.serverStatus;
        const live = this.gameState.liveStats;
        live.botsBlocked += (st?.botsBlockedPerSec || 0) * deltaSeconds;
        // URL shortener: clicks your analytics saw, links broken by clashing codes,
        // and links made safely while the data is split over 2+ shards
        if (st?.clickAccuracy != null) live.clicksCounted = (live.clicksCounted || 0) + st.clicksPerSec * st.clickAccuracy * deltaSeconds;
        live.brokenLinks = (live.brokenLinks || 0) + (st?.brokenPerSec || 0) * deltaSeconds;
        // Cloud drive: edits lost to conflicts vs kept safely, uploads that worked
        live.lostEdits = (live.lostEdits || 0) + (st?.lostEditsPerSec || 0) * deltaSeconds;
        if (st?.editsPerSec && !st.lostEditsPerSec) live.safeEdits = (live.safeEdits || 0) + st.editsPerSec * (1 - st.errorRate) * deltaSeconds;
        if (st?.uploadMBPerSec != null && st.writesPerSec) {
          live.uploadsTried = (live.uploadsTried || 0) + st.writesPerSec * deltaSeconds;
          live.uploadsOk = (live.uploadsOk || 0) + st.writesPerSec * (1 - st.errorRate) * deltaSeconds;
        }
        live.brokenFiles = (live.brokenFiles || 0) + (st?.brokenFilesPerSec || 0) * deltaSeconds;
        if (st?.uploadMBPerSec != null && st.writesPerSec && !st.brokenFilesPerSec && !st.uploadFailShare) {
          live.verifiedFiles = (live.verifiedFiles || 0) + st.recordsPerSec * (1 - st.errorRate) * deltaSeconds;
        }
        if (st && st.dbCount >= 2 && !st.collisionShare && !st.diskFull) {
          live.cleanLinks = (live.cleanLinks || 0) + st.recordsPerSec * (1 - st.errorRate) * deltaSeconds;
        }
      }
    } else if (income > 0) {
      this.gameState.addCoins(income);
    }

    // 2. User growth / churn processing
    let growth = 0;
    if (this.levelSystem && typeof this.levelSystem.getUserGrowthRate === 'function') {
      growth = this.levelSystem.getUserGrowthRate();
    } else {
      const levelData = LEVELS[this.gameState.level - 1] || LEVELS[0];
      growth = levelData.userGrowthRate;
      if (this.gameState.users >= this.gameState.maxUsers) {
        growth = 0;
      }
    }

    if (growth !== 0) {
      const oldUsers = this.gameState.users;
      const singleServer = Boolean((LEVELS[this.gameState.level - 1] || {}).serverMode);
      // On a single server users can pile up past the limit; overload churn brings them back down
      const targetUsers = singleServer
        ? Math.max(0, this.gameState.users + growth)
        : Math.max(10, Math.min(this.gameState.maxUsers, this.gameState.users + growth));
      const delta = targetUsers - oldUsers;

      if (delta !== 0) {
        this.gameState.users = targetUsers;
        if (delta < 0 && this.gameState.spike) this.gameState.spike.usersLost += -delta;
        if (delta > 0) {
          this.gameState.stats.totalUsersServed += delta;
        }
        this.gameState.emit('usersChanged', { users: this.gameState.users, delta });
      }
    }

    // 3. Tick in-flight component upgrades
    this.gameState.tickUpgrades(deltaSeconds);

    // 4. Update lifetime play counters
    this.gameState.stats.playTime += deltaSeconds;
    this.gameState.tickCount += 1;
  }

  /**
   * Calculates coin income per tick based on current active users and level rate
   */
  getIncomeRate() {
    const currentLevel = LEVELS[this.gameState.level - 1] || LEVELS[0];
    const userHundreds = this.gameState.users / 100;

    if (currentLevel.serverMode) {
      // Only users whose requests succeed bring in money
      const errorRate = this.gameState.metrics?.errorRate || 0;
      // Fractional: earnRevenue carries the remainder to the next tick
      return userHundreds * currentLevel.coinRate * (1 - errorRate);
    }

    // Guaranteed minimum 1 coin per tick
    const income = Math.max(1, Math.round(userHundreds * currentLevel.coinRate));
    return income;
  }

  /**
   * Returns current compute usage summary against level budget
   */
  getComputeUsage() {
    const used = this.gameState.computeUsed;
    const budget = this.gameState.computeBudget;
    const percentage = budget > 0 ? Math.round((used / budget) * 100) : 0;

    return {
      used,
      budget,
      percentage,
      isOverBudget: used > budget,
      isNearCapacity: percentage >= 80
    };
  }

  /**
   * Returns the cost of a component at a specified tier
   */
  getComponentCost(componentId, tier = 1) {
    const compDef = COMPONENTS[componentId];
    if (!compDef) return 0;
    const tierIdx = Math.max(0, Math.min(compDef.tiers.length - 1, tier - 1));
    return compDef.tiers[tierIdx].cost;
  }

  /**
   * Returns the coin cost to upgrade an existing placed component instance
   */
  getUpgradeCost(instanceId) {
    const instance = this.gameState.getComponent(instanceId);
    if (!instance) return null;
    if (instance.tier >= 5) return null; // Already max tier

    const compDef = COMPONENTS[instance.componentId];
    if (!compDef) return null;

    const nextTierIdx = instance.tier; // 1-indexed tier becomes 0-indexed next tier
    if (nextTierIdx >= compDef.tiers.length) return null;

    return compDef.tiers[nextTierIdx].cost;
  }

  /**
   * Checks if player has enough coins to purchase a new component instance
   */
  canAffordComponent(componentId) {
    const cost = this.getComponentCost(componentId, 1);
    return this.gameState.canAfford(cost);
  }

  /**
   * Checks if player has enough coins to upgrade an existing component
   */
  canAffordUpgrade(instanceId) {
    const cost = this.getUpgradeCost(instanceId);
    if (cost === null) return false;
    return this.gameState.canAfford(cost);
  }

  /**
   * Purchases and deducts coins for a new component instance
   */
  purchaseComponent(componentId) {
    const cost = this.getComponentCost(componentId, 1);
    return this.gameState.spendCoins(cost);
  }

  /**
   * Purchases an upgrade and initiates the DevOps upgrade timer
   */
  purchaseUpgrade(instanceId) {
    const cost = this.getUpgradeCost(instanceId);
    if (cost === null || !this.gameState.canAfford(cost)) {
      return false;
    }

    // Attempt to queue the upgrade
    const result = this.gameState.upgradeComponent(instanceId);
    if (!result.success) {
      return false;
    }

    // Deduct coins only after successfully queueing
    this.gameState.spendCoins(cost);
    return true;
  }

  /**
   * Returns total platform capacity across all components
   */
  getUserCapacity() {
    return this.gameState.maxUsers;
  }

  /**
   * Returns current aggregate platform throughput
   */
  getSystemThroughput() {
    return this.gameState.metrics.throughput;
  }

  /**
   * Returns current platform p99 latency in ms
   */
  getSystemLatency() {
    return this.gameState.metrics.latency;
  }
}
