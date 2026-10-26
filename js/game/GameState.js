/**
 * Scale Architect - Central Game State Manager
 * Holds the single source of truth for all components, connections,
 * resources, metrics, research, and active events.
 */

import { COMPONENTS } from '../data/components.js';
import { RESEARCH_TREE } from '../data/research.js';
import { LEVELS } from '../data/levels.js';
import { setActiveProduct } from '../products/registry.js';
import Guestbook from './Guestbook.js';
import { simulateSystem, DEFAULT_WRITES_PER_USER } from './SystemSimulator.js';
import { AGENT_DEFAULTS } from './AgentSim.js';
import { runningCostPerMinute, serverCost } from '../data/serverParts.js';
import { ROLES, rolesForLevel, roleForComponent } from '../data/roles.js';

const SAVE_KEY = 'scale_architect_save_v4'; // v4: machines map, levels 2–7
const LEVEL_START_KEY = 'scale_architect_level_start_v4'; // the save as each level began

export default class GameState {
  constructor() {
    this.resetToDefaults();
  }

  /** Which product is being played. Setting it switches levels, goals and texts. */
  get productId() { return this._productId; }
  set productId(id) {
    this._productId = id;
    setActiveProduct(id);
  }

  /**
   * Resets all state values to new game defaults
   */
  resetToDefaults() {
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.coins = LEVELS[0].startingCoins;
    this.users = 0;
    this.maxUsers = 0;
    this.computeUsed = 0;
    this.computeBudget = 100;

    // ─── Level 1: single server ───
    // Chosen part per resource, e.g. { cpu: 'cpu_1', ram: 'ram_1', ... }, or null before building
    this.machines = {};
    this.server = null;
    // Level 2+: the separate database server (same shape as server), or null
    this.dbServer = null;
    // One-time code improvements bought, e.g. { pagination: true, index: true }
    this.codeFixes = {};
    this.guestbook = new Guestbook();
    this.playerName = '';
    // True once the Guestbook is open to the public and users start arriving
    this.appLive = false;
    // Latest simulator output (usage per part, user limit, bottleneck, ...)
    this.serverStatus = null;
    this.tutorial = { step: 0, done: false };
    // Parts we already warned about being over 80% (reset when they cool down)
    this.warnedParts = [];
    this.levelCompleted = false;
    // The level whose intro card was already shown (the clock starts after it)
    this.introSeenLevel = 0;

    // Which product the player is building (see data/products.js)
    this.productId = 'guestbook';
    // Challenge ids met in the current level (they stay met)
    this.challengesDone = [];
    // Things the player did themselves
    this.achievements = { signed: false, read: false, spikeHandled: false, botsHandled: false, crashHandled: false };
    // Money in and out since the level started
    this.economy = { revenue: 0, cost: 0, costCarry: 0, penalties: 0, lost: 0 };
    // For end-of-level stats: how many users were online on average
    this.liveStats = { ticks: 0, userSum: 0, peakUsers: 0, seconds: 0, healthyTicks: 0, botsBlocked: 0, clicksCounted: 0, brokenLinks: 0, cleanLinks: 0, lostEdits: 0, safeEdits: 0, uploadsOk: 0, uploadsTried: 0, brokenFiles: 0, verifiedFiles: 0, feedWrites: 0, fanoutBacklog: 0, fanoutClearSec: 0, clashedBookings: 0, safeBookings: 0, fairQueued: 0, accurateClicks: 0 };
    // 0–100. Outages lower it; low reputation slows growth and shrinks funding
    this.reputation = 100;
    // Current traffic spike (see TrafficSpikes.js) and seconds until the next one
    this.spike = null;
    this.nextSpikeIn = null;
    // Investment rounds received after completed levels
    this.fundingHistory = [];
    // Every notification shown, newest last: { id, message, type, at, read }
    this.notificationLog = [];

    // Placed components: [{ id, componentId, tier, gridX, gridY }]
    this.placedComponents = [];

    // Connections: [{ id, fromId, toId }]
    this.connections = [];

    // Unlocked features list
    this.unlockedFeatures = ['Registration', 'Profile', 'Text Posts'];

    // Completed research IDs
    this.completedResearch = [];

    // Currently active research project: { id, name, startTime, endTime, durationMs, progress }
    this.activeResearch = null;

    // Currently active incidents: [{ ...eventData, remainingTime, totalDuration, instanceId }]
    this.activeEvents = [];

    // Incident resolution history: [{ id, name, survived, timestamp, rewards, penalty }]
    this.eventHistory = [];

    // Calculated platform metrics
    this.metrics = {
      latency: 100,      // ms (lower is better)
      throughput: 100,    // req/s
      errorRate: 0.01,    // 0-1
      uptime: 99.9,       // percentage
    };

    // Lifetime performance stats
    this.stats = {
      totalEventsResolved: 0,
      totalEventsFailed: 0,
      totalCoinsEarned: 0,
      totalUsersServed: 0,
      playTime: 0,
    };

    // Upgrade concurrency and in-flight upgrades: [{ instanceId, targetTier, remainingTime, totalTime }]
    this.devOpsEngineers = 1;
    this.activeUpgrades = [];

    this.isPaused = false;
    this.tickCount = 0;
    this.listeners = {};
  }

  // ==========================================
  // EVENT SYSTEM (OBSERVER PATTERN)
  // ==========================================

  /**
   * Subscribe a listener callback to a named game event
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe a listener callback
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Emit an event to all subscribed listeners
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    const callbacks = [...this.listeners[event]];
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for "${event}":`, err);
      }
    }
  }

  /**
   * Generates a unique component/entity identifier
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  // ==========================================
  // PERSISTENCE (LOCAL STORAGE)
  // ==========================================

  /**
   * Serializes state to JSON and writes to localStorage
   */
  save() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const serialized = JSON.stringify(this.toJSON());
      localStorage.setItem(SAVE_KEY, serialized);
      this.emit('saved', { timestamp: Date.now() });
      return true;
    } catch (err) {
      console.error('Failed to save game state:', err);
      return false;
    }
  }

  /**
   * Reads from localStorage and restores state
   */
  load() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const dataStr = localStorage.getItem(SAVE_KEY);
      if (!dataStr) return false;
      const data = JSON.parse(dataStr);
      this.fromJSON(data);
      this.recalculateMetrics();
      this.emit('stateLoaded', { state: this });
      return true;
    } catch (err) {
      console.error('Failed to load game state:', err);
      return false;
    }
  }

  /** Remember the game as it was when this level began (for "Retry level" after a crash). */
  snapshotLevelStart() {
    try {
      localStorage.setItem(LEVEL_START_KEY, JSON.stringify(this.toJSON()));
    } catch (err) { /* private mode: no retry point */ }
  }

  /** Is there a saved start for the level being played right now? */
  hasLevelStart() {
    try {
      const data = JSON.parse(localStorage.getItem(LEVEL_START_KEY) || 'null');
      return Boolean(data && data.productId === this.productId && data.level === this.level);
    } catch (err) {
      return false;
    }
  }

  /** Put the level-start save back as the current save. Returns false if there is none. */
  restoreLevelStart() {
    if (!this.hasLevelStart()) return false;
    try {
      localStorage.setItem(SAVE_KEY, localStorage.getItem(LEVEL_START_KEY));
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Clears saved state from localStorage and resets memory state
   */
  reset() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVE_KEY);
      }
    } catch (err) {
      console.error('Failed to remove save data:', err);
    }
    this.resetToDefaults();
    this.recalculateMetrics();
    this.emit('stateReset', {});
  }

  // ==========================================
  // COMPONENT MANAGEMENT
  // ==========================================

  /**
   * Adds and places a new component onto the architecture canvas
   */
  addComponent(componentId, gridX, gridY) {
    const compDef = COMPONENTS[componentId];
    if (!compDef) {
      console.warn(`Unknown component ID: ${componentId}`);
      return null;
    }

    // Check maximum allowed instance count
    const currentCount = this.getComponentCount(componentId);
    // Machines from roles.js have their own limit (e.g. up to 6 app servers)
    const maxCount = roleForComponent(componentId)?.maxCount ?? compDef.maxCount;
    if (currentCount >= maxCount) {
      console.warn(`Cannot place more than ${maxCount} instances of ${compDef.name}`);
      return null;
    }

    const instance = {
      id: this.generateId(),
      componentId,
      tier: 1,
      gridX: Math.round(gridX),
      gridY: Math.round(gridY),
      placedAt: Date.now()
    };

    this.placedComponents.push(instance);
    this.recalculateMetrics();
    this.emit('componentAdded', { instance });
    return instance.id;
  }

  /**
   * Removes a placed component and any attached network connections
   */
  removeComponent(instanceId) {
    const index = this.placedComponents.findIndex(c => c.id === instanceId);
    if (index === -1) return false;

    const removedInstance = this.placedComponents[index];

    // Remove from placed components list
    this.placedComponents.splice(index, 1);

    // Remove all associated connections
    const removedConns = this.connections.filter(c => c.fromId === instanceId || c.toId === instanceId);
    this.connections = this.connections.filter(c => c.fromId !== instanceId && c.toId !== instanceId);

    // Cancel any active upgrades for this component
    this.activeUpgrades = this.activeUpgrades.filter(u => u.instanceId !== instanceId);

    for (const conn of removedConns) {
      this.emit('connectionRemoved', { fromId: conn.fromId, toId: conn.toId, connectionId: conn.id });
    }

    this.recalculateMetrics();
    this.emit('componentRemoved', { instanceId, component: removedInstance });
    return true;
  }

  /**
   * Queues an upgrade for a placed component or applies explicit target tier
   */
  upgradeComponent(instanceId, explicitTargetTier = null) {
    const comp = this.getComponent(instanceId);
    if (!comp) {
      return { success: false, reason: 'Component not found' };
    }

    if (explicitTargetTier !== null && typeof explicitTargetTier === 'number') {
      comp.tier = Math.min(5, Math.max(1, explicitTargetTier));
      this.recalculateMetrics();
      this.emit('componentUpgraded', comp);
      return { success: true, targetTier: comp.tier };
    }

    if (comp.tier >= 5) {
      return { success: false, reason: 'Component already at maximum Hyperscale tier (5)' };
    }

    if (this.activeUpgrades.some(u => u.instanceId === instanceId)) {
      return { success: false, reason: 'Upgrade already in progress for this component' };
    }

    if (this.activeUpgrades.length >= this.devOpsEngineers) {
      return { success: false, reason: 'All DevOps engineers are currently busy' };
    }

    const targetTier = comp.tier + 1;
    // Upgrade time scales with tier: Tier 2 = 6s, Tier 3 = 12s, Tier 4 = 20s, Tier 5 = 30s
    const totalTime = targetTier * 6;

    const compDef = COMPONENTS[comp.componentId];
    const componentName = compDef ? compDef.name : comp.componentId;

    const upgradeTask = {
      instanceId,
      componentName,
      targetTier,
      remainingTime: totalTime,
      totalTime,
      completeAt: Date.now() + (totalTime * 1000)
    };

    this.activeUpgrades.push(upgradeTask);
    this.emit('upgradeStarted', { instanceId, targetTier, totalTime, componentName });
    return { success: true, targetTier, totalTime, componentName };
  }

  /**
   * Completes an active upgrade immediately
   */
  completeUpgrade(instanceId) {
    const comp = this.getComponent(instanceId);
    if (!comp) return false;

    const upgradeIndex = this.activeUpgrades.findIndex(u => u.instanceId === instanceId);
    let targetTier = comp.tier + 1;
    if (upgradeIndex !== -1) {
      targetTier = this.activeUpgrades[upgradeIndex].targetTier;
      this.activeUpgrades.splice(upgradeIndex, 1);
    }

    comp.tier = Math.min(5, targetTier);
    this.recalculateMetrics();
    this.emit('componentUpgraded', comp);
    return true;
  }

  /**
   * Ticks active component upgrades
   */
  tickUpgrades(deltaSeconds = 1) {
    if (this.activeUpgrades.length === 0) return;

    const completed = [];
    for (const up of this.activeUpgrades) {
      up.remainingTime -= deltaSeconds;
      if (up.remainingTime <= 0) {
        completed.push(up.instanceId);
      }
    }

    for (const id of completed) {
      this.completeUpgrade(id);
    }
  }

  /**
   * Returns a placed component instance by its unique instance ID
   */
  getComponent(instanceId) {
    return this.placedComponents.find(c => c.id === instanceId) || null;
  }

  /**
   * Returns all placed components of a specific component type
   */
  getComponentsByType(componentId) {
    return this.placedComponents.filter(c => c.componentId === componentId);
  }

  /**
   * Returns true if at least one instance of componentId is placed
   */
  hasComponent(componentId) {
    return this.placedComponents.some(c => c.componentId === componentId);
  }

  /**
   * Returns how many instances of a component type are placed
   */
  getComponentCount(componentId) {
    return this.placedComponents.filter(c => c.componentId === componentId).length;
  }

  // ==========================================
  // CONNECTION MANAGEMENT
  // ==========================================

  /**
   * Connects two placed components if architecturally valid
   */
  addConnection(fromInstanceId, toInstanceId) {
    if (fromInstanceId === toInstanceId) {
      return { success: false, reason: 'Cannot connect a component to itself' };
    }

    const fromComp = this.getComponent(fromInstanceId);
    const toComp = this.getComponent(toInstanceId);

    if (!fromComp || !toComp) {
      return { success: false, reason: 'One or both components do not exist' };
    }

    // Check if connection already exists
    const exists = this.connections.some(c => c.fromId === fromInstanceId && c.toId === toInstanceId);
    if (exists) {
      return { success: false, reason: 'Connection already exists between these components' };
    }

    const fromDef = COMPONENTS[fromComp.componentId];
    const toDef = COMPONENTS[toComp.componentId];

    // Check outputs & inputs compatibility
    const allowsOutput = fromDef && fromDef.connections && fromDef.connections.outputs.includes(toComp.componentId);
    const allowsInput = toDef && toDef.connections && toDef.connections.inputs.includes(fromComp.componentId);

    if (!allowsOutput && !allowsInput) {
      return {
        success: false,
        reason: `${fromDef.name} cannot be piped into ${toDef.name} according to system design principles`
      };
    }

    const connection = {
      id: this.generateId(),
      fromId: fromInstanceId,
      toId: toInstanceId
    };

    this.connections.push(connection);
    this.recalculateMetrics();
    this.emit('connectionAdded', { connection });
    return { success: true, connection };
  }

  /**
   * Removes a connection between two placed components
   */
  removeConnection(fromInstanceId, toInstanceId) {
    const index = this.connections.findIndex(c => c.fromId === fromInstanceId && c.toId === toInstanceId);
    if (index === -1) return false;

    const removed = this.connections.splice(index, 1)[0];
    this.recalculateMetrics();
    this.emit('connectionRemoved', { fromId: fromInstanceId, toId: toInstanceId, connectionId: removed.id });
    return true;
  }

  /**
   * Returns all incoming and outgoing connections for an instance
   */
  getConnections(instanceId) {
    const incoming = this.connections.filter(c => c.toId === instanceId);
    const outgoing = this.connections.filter(c => c.fromId === instanceId);
    return { incoming, outgoing, all: [...incoming, ...outgoing] };
  }

  /**
   * Automatically establishes valid network connections between placed components
   */
  autoConnect() {
    let newConnectionsCount = 0;
    for (const from of this.placedComponents) {
      const fromDef = COMPONENTS[from.componentId];
      if (!fromDef || !fromDef.connections || !fromDef.connections.outputs) continue;

      for (const to of this.placedComponents) {
        if (from.id === to.id) continue;
        const toDef = COMPONENTS[to.componentId];
        if (!toDef) continue;

        if (fromDef.connections.outputs.includes(to.componentId)) {
          const exists = this.connections.some(c => c.fromId === from.id && c.toId === to.id);
          if (!exists) {
            const res = this.addConnection(from.id, to.id);
            if (res.success) {
              newConnectionsCount++;
            }
          }
        }
      }
    }
    return newConnectionsCount;
  }

  // ==========================================
  // RESOURCE & PROGRESSION MANAGEMENT
  // ==========================================

  /**
   * Adds coins to the balance and records lifetime stats
   */
  addCoins(amount) {
    const val = Math.round(amount);
    if (val <= 0) return;
    this.coins += val;
    this.stats.totalCoinsEarned += val;
    this.emit('coinsChanged', { coins: this.coins, delta: val });
  }

  /**
   * Spends coins if sufficient balance is available
   */
  spendCoins(amount) {
    const val = Math.round(amount);
    if (val <= 0) return true;
    if (this.coins < val) return false;
    this.coins -= val;
    this.emit('coinsChanged', { coins: this.coins, delta: -val });
    return true;
  }

  /**
   * Checks if user has enough coins
   */
  canAfford(amount) {
    return this.coins >= Math.round(amount);
  }

  /**
   * Grants XP and handles level up thresholds
   */
  addXP(amount) {
    const val = Math.round(amount);
    if (val <= 0) return;
    this.xp += val;

    let leveledUp = false;
    while (this.xp >= this.xpToNextLevel && this.level < 5) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Math.round(this.xpToNextLevel * 1.8);
      leveledUp = true;
    }

    this.emit('xpGained', { xp: this.xp, level: this.level, xpToNextLevel: this.xpToNextLevel });

    if (leveledUp) {
      const levelData = LEVELS[this.level - 1] || null;
      if (levelData) {
        this.computeBudget = levelData.computeBudget;
        this.unlockedFeatures = [...new Set([...this.unlockedFeatures, ...levelData.unlockedFeatures])];
        const newComponents = (levelData.unlockedComponentIds || []).map(id => {
          const def = COMPONENTS[id];
          return def ? { id, name: def.name, icon: def.icon } : { id, name: id, icon: '📦' };
        });
        this.recalculateMetrics();
        this.emit('levelUp', {
          level: this.level,
          name: levelData.name,
          levelData,
          newComponents,
          newFeatures: levelData.unlockedFeatures
        });
      }
    }
  }

  // ==========================================
  // RESEARCH MANAGEMENT
  // ==========================================

  /**
   * Starts a research project from the RESEARCH_TREE
   */
  startResearch(researchId) {
    const item = RESEARCH_TREE.find(r => r.id === researchId);
    if (!item) return { success: false, reason: 'Research item not found' };

    if (this.completedResearch.includes(researchId)) {
      return { success: false, reason: 'Already researched' };
    }

    if (this.activeResearch) {
      return { success: false, reason: 'Research lab is busy with another project' };
    }

    if (this.level < item.unlockLevel) {
      return { success: false, reason: `Requires Level ${item.unlockLevel}` };
    }

    // Check prerequisites
    const unfulfilled = (item.prerequisites || []).filter(pId => !this.completedResearch.includes(pId));
    if (unfulfilled.length > 0) {
      return { success: false, reason: 'Missing prerequisite research' };
    }

    if (!this.spendCoins(item.cost)) {
      return { success: false, reason: 'Insufficient coins' };
    }

    const durationMs = (item.researchTime || 20) * 1000;
    this.activeResearch = {
      id: item.id,
      researchId: item.id,
      name: item.name,
      startTime: Date.now(),
      endTime: Date.now() + durationMs,
      durationMs,
      progress: 0
    };

    this.emit('researchStarted', this.activeResearch);
    return { success: true, activeResearch: this.activeResearch };
  }

  /**
   * Completes a research project and applies its buffs
   */
  completeResearch(researchId) {
    const item = RESEARCH_TREE.find(r => r.id === researchId);
    if (!this.completedResearch.includes(researchId)) {
      this.completedResearch.push(researchId);
    }
    this.activeResearch = null;
    this.recalculateMetrics();
    this.emit('researchCompleted', { id: researchId, item, completedResearch: this.completedResearch });
    return true;
  }

  // ==========================================
  // METRICS & SYSTEM DESIGN CALCULATIONS
  // ==========================================

  /**
   * Recalculates platform throughput, latency, max capacity, compute usage,
   * and error rate based on placed components, research, and active incidents.
   */
  recalculateMetrics() {
    const levelDef = LEVELS[this.level - 1];
    if (levelDef && levelDef.serverMode) {
      this.recalculateServerMetrics();
      return;
    }

    let rawThroughput = 0;
    let latencyReduction = 0;
    let rawCapacity = 0;
    let computeSum = 0;

    // Evaluate research bonuses
    const hasHorizontalScaling = this.completedResearch.includes('horizontal_scaling');
    const hasDbIndexing = this.completedResearch.includes('db_indexing');
    const hasCdnOpt = this.completedResearch.includes('cdn_optimization');
    const hasConnPooling = this.completedResearch.includes('connection_pooling');
    const hasTtlJitter = this.completedResearch.includes('ttl_jitter');
    const hasReadWriteSplit = this.completedResearch.includes('read_write_split');
    const hasRateLimiting = this.completedResearch.includes('rate_limiting_algos');
    const hasDbSharding = this.completedResearch.includes('db_sharding_strategy');
    const hasBlueGreen = this.completedResearch.includes('blue_green_deploy');
    const hasCaching101 = this.completedResearch.includes('caching_101');
    const hasAutoScaling = this.completedResearch.includes('auto_scaling');

    // Aggregate values across all placed components
    for (const instance of this.placedComponents) {
      const def = COMPONENTS[instance.componentId];
      if (!def) continue;

      const tierIndex = Math.max(0, Math.min(def.tiers.length - 1, instance.tier - 1));
      const tierDef = def.tiers[tierIndex];
      if (!tierDef) continue;

      let throughputMultiplier = 1.0;
      let capacityMultiplier = 1.0;
      let computeCostMultiplier = 1.0;

      // Apply research multipliers per component
      if (instance.componentId === 'app_server' && hasHorizontalScaling) {
        throughputMultiplier *= 1.25;
      }
      if (instance.componentId === 'database') {
        if (hasDbIndexing) throughputMultiplier *= 1.40;
        if (hasConnPooling) computeCostMultiplier *= 0.75;
      }
      if (instance.componentId === 'cdn' && hasCdnOpt) {
        throughputMultiplier *= 1.35;
        latencyReduction += 10;
      }
      if (instance.componentId === 'redis_cache' && hasTtlJitter) {
        capacityMultiplier *= 1.30;
      }
      if (instance.componentId === 'read_replica' && hasReadWriteSplit) {
        throughputMultiplier *= 1.50;
      }
      if (instance.componentId === 'rate_limiter' && hasRateLimiting) {
        throughputMultiplier *= 1.40;
      }
      if (instance.componentId === 'db_shard' && hasDbSharding) {
        capacityMultiplier *= 1.50;
      }

      rawThroughput += tierDef.throughput * throughputMultiplier;
      latencyReduction += tierDef.latencyReduction;
      rawCapacity += tierDef.capacityBonus * capacityMultiplier;
      computeSum += tierDef.computeCost * computeCostMultiplier;
    }

    // Global research effects
    if (hasCaching101) {
      latencyReduction += 15;
    }

    // Base values
    this.computeUsed = Math.round(computeSum);

    // Get level data compute budget
    const currentLevelDef = LEVELS[this.level - 1];
    if (currentLevelDef) {
      this.computeBudget = currentLevelDef.computeBudget;
    }

    // Capacity starts with base starter users if starter components placed
    const baseCapacity = this.placedComponents.length > 0 ? 50 : 10;
    this.maxUsers = Math.max(50, Math.round(baseCapacity + rawCapacity));

    // Base latency calculation: base 200ms - latencyReduction (min 10ms)
    let calculatedLatency = Math.max(10, 200 - latencyReduction);

    // Base throughput
    let calculatedThroughput = Math.max(10, Math.round(rawThroughput));

    // Error rate based on compute utilization
    const computeRatio = this.computeBudget > 0 ? this.computeUsed / this.computeBudget : 1;
    // Auto-scaling research expands tolerance ceiling by 20%
    const toleranceCeiling = hasAutoScaling ? 1.0 : 0.8;

    let baseErrorRate = 0.005; // 0.5% baseline
    if (computeRatio > toleranceCeiling) {
      const excess = computeRatio - toleranceCeiling;
      baseErrorRate += excess * 0.45;
    }
    if (computeRatio > 1.0) {
      const extremeOverload = computeRatio - 1.0;
      baseErrorRate += extremeOverload * 0.8;
    }

    // Active incidents modifier
    let incidentLatencyMultiplier = 1.0;
    let incidentErrorIncrease = 0.0;
    let incidentThroughputDrain = 0.0;

    const hasCircuitBreaker = this.completedResearch.includes('circuit_breaker');
    const hasRequestCoalescing = this.completedResearch.includes('request_coalescing');

    for (const evt of this.activeEvents) {
      if (!evt.effects) continue;
      let errorInc = evt.effects.errorRateIncrease || 0;

      // Defenses mitigate incident spikes
      if (hasCircuitBreaker) {
        errorInc *= 0.65; // 35% error reduction
      }
      if (evt.id === 'cache_stampede' && hasRequestCoalescing) {
        errorInc *= 0.50; // 50% error reduction
      }

      incidentErrorIncrease += errorInc;
      incidentLatencyMultiplier *= (evt.effects.latencyMultiplier || 1.0);
      incidentThroughputDrain += (evt.effects.throughputDrain || 0.0);
    }

    // Apply incident multipliers
    calculatedLatency = Math.round(calculatedLatency * incidentLatencyMultiplier);
    calculatedThroughput = Math.max(5, Math.round(calculatedThroughput * Math.max(0.1, 1.0 - incidentThroughputDrain)));
    let calculatedErrorRate = Math.min(1.0, Math.max(0.001, baseErrorRate + incidentErrorIncrease));

    // Calculate Uptime
    let baseUptime = 99.99;
    if (hasBlueGreen) {
      baseUptime += 0.08;
    }
    const calculatedUptime = Math.max(0.0, Math.min(100.0, Number((baseUptime - (calculatedErrorRate * 12)).toFixed(2))));

    this.metrics = {
      latency: calculatedLatency,
      throughput: calculatedThroughput,
      errorRate: Number(calculatedErrorRate.toFixed(4)),
      uptime: calculatedUptime,
      capacity: this.maxUsers
    };

    this.emit('metricsUpdated', { metrics: this.metrics });
  }

  /**
   * Current user capacity of the architecture
   */
  get userCapacity() {
    return this.maxUsers;
  }

  // ==========================================
  // SERIALIZATION & SAVE FORMAT
  // ==========================================

  /**
   * Converts state to a clean JSON-serializable object
   */
  toJSON() {
    return {
      version: 1,
      level: this.level,
      xp: this.xp,
      xpToNextLevel: this.xpToNextLevel,
      coins: this.coins,
      users: this.users,
      maxUsers: this.maxUsers,
      computeUsed: this.computeUsed,
      computeBudget: this.computeBudget,
      placedComponents: this.placedComponents,
      connections: this.connections,
      unlockedFeatures: this.unlockedFeatures,
      completedResearch: this.completedResearch,
      activeResearch: this.activeResearch,
      activeEvents: this.activeEvents,
      eventHistory: this.eventHistory,
      metrics: this.metrics,
      stats: this.stats,
      devOpsEngineers: this.devOpsEngineers,
      activeUpgrades: this.activeUpgrades,
      isPaused: this.isPaused,
      tickCount: this.tickCount,
      machines: this.machines,
      codeFixes: this.codeFixes,
      guestbook: this.guestbook.toJSON(),
      playerName: this.playerName,
      appLive: this.appLive,
      tutorial: this.tutorial,
      warnedParts: this.warnedParts,
      levelCompleted: this.levelCompleted,
      introSeenLevel: this.introSeenLevel,
      productId: this.productId,
      challengesDone: this.challengesDone,
      achievements: this.achievements,
      economy: this.economy,
      liveStats: this.liveStats,
      fundingHistory: this.fundingHistory,
      notificationLog: this.notificationLog,
      reputation: this.reputation,
      spike: this.spike,
      nextSpikeIn: this.nextSpikeIn
    };
  }

  // ==========================================
  // MACHINES (app server, database, web, gateway, load balancer, cache, CDN)
  // ==========================================

  // `server` and `dbServer` are shortcuts for machines.app / machines.db
  get server() { return this.machines?.app || null; }
  set server(v) { this.machines = this.machines || {}; this.machines.app = v; }
  get dbServer() { return this.machines?.db || null; }
  set dbServer(v) { this.machines = this.machines || {}; this.machines.db = v; }

  /** True once a machine of this role has been bought AND placed on the map. */
  isPlaced(role) {
    return Boolean(this.machines?.[role]) && this.hasComponent(ROLES[role].componentId);
  }

  /** True once the (app) server has been bought AND placed on the map. */
  isServerPlaced() {
    return this.isPlaced('app');
  }

  /** True once the database server has been bought AND placed on the map. */
  isDbPlaced() {
    return this.isPlaced('db');
  }

  /** How many app servers are on the map (Level 5 adds more behind a load balancer). */
  appCount() {
    return this.machines?.app ? this.getComponentCount(ROLES.app.componentId) : 0;
  }

  /** How many database shards are running (1 unless the product shards its data). */
  dbCount() {
    return this.machines?.db ? this.getComponentCount(ROLES.db.componentId) : 0;
  }

  /** How many machines of a role are running (app servers and shards can be several). */
  machineCount(role) {
    if (role === 'app') return this.appCount();
    if (role === 'db') return this.dbCount();
    return this.isPlaced(role) ? 1 : 0;
  }

  levelDef() {
    return LEVELS[this.level - 1] || LEVELS[0];
  }

  /** How often each user signs the Guestbook this level. */
  writesPerUser() {
    return this.levelDef().writesPerUser ?? DEFAULT_WRITES_PER_USER;
  }

  /** Machine roles available at this level. */
  availableRoles() {
    return rolesForLevel(this.level);
  }

  /** Can this level use more than one machine / code fixes? */
  hasDatabaseLevel() {
    // Any second kind of machine (usually the database at Level 2)
    return this.level >= ROLES.db.unlockLevel || rolesForLevel(this.level).length > 1;
  }

  /** The level's traffic: reads, writes, page views, bots, far-away users. */
  trafficParams() {
    const L = this.levelDef();
    const params = { writesPerUser: this.writesPerUser() };
    for (const key of ['readsPerUser', 'pageViewsPerUser', 'pageKB', 'botShare', 'globalShare', 'distanceMs', 'dbReadCost',
      'readKind', 'botKind', 'spamPerUser', 'cacheHitRate', 'edgeHitRate', 'clickTracking', 'keepRecords', 'appCallCost',
      'readKB', 'writeKB', 'recordSpace', 'blobSpaceMult', 'bigFileShare', 'dedupShare', 'updateShare', 'devicesPerUser',
      'pollPerDevice', 'listReadsPerUser', 'conflictShare', 'publicShare', 'unverifiedShare', 'browsePerUser',
      'shardIdClash', 'fanoutPerWrite', 'celebrityShare', 'celebrityMult',
      'clashShare', 'searchPerUser', 'searchCacheHit', 'rushPerUser', 'reportPerUser', 'reportCost', 'dupShare', 'hotShare', 'lossShare',
      ...Object.keys(AGENT_DEFAULTS)]) {
      if (L[key] !== undefined) params[key] = L[key];
    }
    if (this.spike?.kind === 'bots') params.botMult = this.spike.mult;
    return params;
  }

  /**
   * Inputs for the simulator. `overrides.machines` lets the Server Builder
   * preview a config before buying it.
   */
  simulationInput(overrides = {}) {
    const machines = {};
    for (const role of Object.keys(ROLES)) {
      if (this.isPlaced(role)) machines[role] = this.machines[role];
    }
    if (!machines.app && this.machines?.app) machines.app = this.machines.app;
    const crash = this.spike?.kind === 'crash' ? this.spike.crashed : 0;
    return {
      machines: { ...machines, ...(overrides.machines || {}) },
      appCount: overrides.appCount ?? Math.max(1, this.appCount()),
      dbCount: overrides.dbCount ?? Math.max(1, this.dbCount()),
      crashed: overrides.crashed ?? crash,
      // A traffic spike = every user sends more requests
      users: this.users * (this.spike?.kind === 'spike' ? this.spike.mult : 1),
      entries: this.guestbook.count,
      fixes: overrides.fixes || this.codeFixes,
      params: this.trafficParams()
    };
  }

  /** Metrics for the Guestbook running on your machines. */
  recalculateServerMetrics() {
    if (!this.server) {
      this.serverStatus = null;
      this.maxUsers = 0;
      this.metrics = { latency: 0, throughput: 0, errorRate: 0, uptime: 100, capacity: 0 };
      this.emit('metricsUpdated', { metrics: this.metrics });
      return;
    }

    const status = simulateSystem(this.simulationInput());
    this.serverStatus = status;
    this.maxUsers = status.userLimit;
    this.computeUsed = Math.round(status.usage.cpu * 100);

    this.metrics = {
      latency: status.latency,
      throughput: status.reqPerSec,
      errorRate: Number(status.errorRate.toFixed(4)),
      uptime: Math.max(0, Number((99.99 - status.errorRate * 12).toFixed(2))),
      capacity: status.userLimit
    };

    this.emit('metricsUpdated', { metrics: this.metrics, serverStatus: status });
  }

  /** Running cost of one role per minute (every app server counts). */
  roleRunningCostPerMinute(role, config = this.machines?.[role]) {
    if (!config) return 0;
    const count = role === 'app' || role === 'db' ? Math.max(1, this.machineCount(role)) : 1;
    // Some machines are cheaper to run (blob storage), cheaper still with a cold tier
    let mult = ROLES[role]?.costMult ?? 1;
    if (role === 'blob' && this.codeFixes?.coldTier) mult *= 0.5;
    // A rented AI model also bills every token it reads and writes
    const usage = role === 'llm' && config === this.machines?.llm ? this.usageCostPerMinute() : 0;
    return Math.round(runningCostPerMinute(config) * count * mult) + usage;
  }

  /** Coins per minute for every machine that's switched on (placed). */
  totalRunningCostPerMinute() {
    let total = 0;
    for (const role of Object.keys(ROLES)) {
      if (this.isPlaced(role)) total += this.roleRunningCostPerMinute(role);
    }
    return total;
  }

  /** Bills that grow with traffic, not machines: an AI model's token bill. */
  usageCostPerMinute() {
    return this.appLive ? Math.round(this.serverStatus?.tokenBillPerMin || 0) : 0;
  }

  getServerConfig(role = 'app') {
    return this.machines?.[role] || null;
  }

  /**
   * Buy (first time) or upgrade a machine. `cost` is the full price (for app
   * servers, an upgrade is paid once per server).
   * Events: serverBought (app) / dbBought (db) / machineBought (others) on
   * first purchase, serverUpgraded otherwise.
   */
  setServer(server, cost, role = 'app') {
    const isFirstBuild = !this.getServerConfig(role);
    if (!this.spendCoins(cost)) return false;
    this.machines = { ...this.machines, [role]: { ...server } };
    this.recalculateMetrics();
    const event = !isFirstBuild ? 'serverUpgraded'
      : role === 'app' ? 'serverBought' : role === 'db' ? 'dbBought' : 'machineBought';
    this.emit(event, { server: { ...server }, cost, role });
    this.save();
    return true;
  }

  /** Price of one more app server / database shard (same parts as the others). */
  extraMachineCost(role = 'app') {
    const cfg = this.getServerConfig(role);
    return cfg ? serverCost(cfg) : 0;
  }

  extraAppServerCost() {
    return this.extraMachineCost('app');
  }

  /** Buy another app server or shard; the caller then places it on the map. */
  buyExtraMachine(role = 'app') {
    const cost = this.extraMachineCost(role);
    if (!this.getServerConfig(role) || !this.spendCoins(cost)) return false;
    this.emit(role === 'app' ? 'appServerBought' : 'dbShardBought', { cost, role });
    this.save();
    return true;
  }

  buyExtraAppServer() {
    return this.buyExtraMachine('app');
  }

  /** Turn a switch-style code fix (like 301 redirects) on or off. Free. */
  toggleCodeFix(id) {
    this.codeFixes[id] = !this.codeFixes[id];
    this.recalculateMetrics();
    this.emit('codeFixToggled', { id, on: this.codeFixes[id] });
    this.save();
  }

  /** Buy a one-time code fix (see data/codeFixes.js). */
  buyCodeFix(id, cost) {
    if (this.codeFixes[id]) return false;
    if (!this.spendCoins(cost)) return false;
    this.codeFixes[id] = true;
    this.recalculateMetrics();
    this.emit('codeFixBought', { id, cost });
    this.save();
    return true;
  }

  /**
   * Start a level. Machines, data, users and coins carry over;
   * everything measured per level (challenges, money, stats, tutorial) starts fresh.
   */
  startLevel(level) {
    this.level = level;
    this.levelCompleted = false;
    this.challengesDone = [];
    this.achievements = { ...this.achievements, spikeHandled: false, botsHandled: false, crashHandled: false, audienceReached: false };
    this.economy = { revenue: 0, cost: 0, costCarry: 0, penalties: 0, lost: 0 };
    this.liveStats = { ticks: 0, userSum: 0, peakUsers: 0, seconds: 0, healthyTicks: 0, botsBlocked: 0, clicksCounted: 0, brokenLinks: 0, cleanLinks: 0, lostEdits: 0, safeEdits: 0, uploadsOk: 0, uploadsTried: 0, brokenFiles: 0, verifiedFiles: 0, feedWrites: 0, fanoutBacklog: 0, fanoutClearSec: 0, clashedBookings: 0, safeBookings: 0, fairQueued: 0, accurateClicks: 0 };
    this.spike = null;
    this.nextSpikeIn = null;
    this.warnedParts = [];
    this.tutorial = { step: 0, done: false };
    this.unlockedFeatures = [...new Set([...this.unlockedFeatures, ...(this.levelDef().unlockedFeatures || [])])];
    this.recalculateMetrics();
    // The new level's traffic (bots, bigger pages...) can shrink what the system
    // handles. Don't open the level already overloaded: start just under the new limit.
    const limit = this.serverStatus?.userLimit;
    this.levelStartTrim = null;
    if (limit && this.users > limit) {
      const kept = Math.max(10, Math.floor(limit * 0.9));
      this.levelStartTrim = { from: this.users, to: kept };
      this.users = kept;
      this.recalculateMetrics();
    }
    this.save();
    this.emit('levelStarted', { level });
  }

  /**
   * Populates state from a parsed JSON save object
   */
  fromJSON(data) {
    if (!data || typeof data !== 'object') return;
    this.productId = typeof data.productId === 'string' ? data.productId : 'guestbook';

    this.level = typeof data.level === 'number' ? data.level : 1;
    this.xp = typeof data.xp === 'number' ? data.xp : 0;
    this.xpToNextLevel = typeof data.xpToNextLevel === 'number' ? data.xpToNextLevel : 100;
    this.coins = typeof data.coins === 'number' ? data.coins : 500;
    this.users = typeof data.users === 'number' ? data.users : 0;
    this.maxUsers = typeof data.maxUsers === 'number' ? data.maxUsers : 200;
    this.computeUsed = typeof data.computeUsed === 'number' ? data.computeUsed : 0;
    this.computeBudget = typeof data.computeBudget === 'number' ? data.computeBudget : 100;

    this.placedComponents = Array.isArray(data.placedComponents) ? data.placedComponents : [];
    this.connections = Array.isArray(data.connections) ? data.connections : [];
    this.unlockedFeatures = Array.isArray(data.unlockedFeatures) ? data.unlockedFeatures : ['Registration', 'Profile', 'Text Posts'];
    this.completedResearch = Array.isArray(data.completedResearch) ? data.completedResearch : [];
    this.activeResearch = (data.activeResearch && typeof data.activeResearch === 'object') ? data.activeResearch : null;
    this.activeEvents = Array.isArray(data.activeEvents) ? data.activeEvents : [];
    this.eventHistory = Array.isArray(data.eventHistory) ? data.eventHistory : [];

    if (data.metrics) {
      this.metrics = {
        latency: data.metrics.latency ?? 100,
        throughput: data.metrics.throughput ?? 100,
        errorRate: data.metrics.errorRate ?? 0.01,
        uptime: data.metrics.uptime ?? 99.9
      };
    }

    if (data.stats) {
      this.stats = {
        totalEventsResolved: data.stats.totalEventsResolved || 0,
        totalEventsFailed: data.stats.totalEventsFailed || 0,
        totalCoinsEarned: data.stats.totalCoinsEarned || 0,
        totalUsersServed: data.stats.totalUsersServed || 0,
        playTime: data.stats.playTime || 0
      };
    }

    this.devOpsEngineers = typeof data.devOpsEngineers === 'number' ? data.devOpsEngineers : 1;
    this.activeUpgrades = Array.isArray(data.activeUpgrades) ? data.activeUpgrades : [];
    this.isPaused = Boolean(data.isPaused);
    this.tickCount = typeof data.tickCount === 'number' ? data.tickCount : 0;

    this.machines = data.machines && typeof data.machines === 'object' ? data.machines : {};
    this.codeFixes = data.codeFixes && typeof data.codeFixes === 'object' ? data.codeFixes : {};
    this.guestbook = new Guestbook(data.guestbook);
    this.playerName = typeof data.playerName === 'string' ? data.playerName : '';
    this.appLive = Boolean(data.appLive);
    this.tutorial = data.tutorial && typeof data.tutorial === 'object'
      ? { step: data.tutorial.step || 0, done: Boolean(data.tutorial.done) }
      : { step: 0, done: false };
    this.warnedParts = Array.isArray(data.warnedParts) ? data.warnedParts : [];
    this.levelCompleted = Boolean(data.levelCompleted);
    // Older saves: their current level is already under way
    this.introSeenLevel = typeof data.introSeenLevel === 'number' ? data.introSeenLevel : this.level;
    this.challengesDone = Array.isArray(data.challengesDone) ? data.challengesDone : [];
    this.achievements = { signed: false, read: false, ...(data.achievements || {}) };
    this.economy = { revenue: 0, cost: 0, costCarry: 0, penalties: 0, lost: 0, ...(data.economy || {}) };
    this.liveStats = { ticks: 0, userSum: 0, peakUsers: 0, seconds: 0, healthyTicks: 0, botsBlocked: 0, clicksCounted: 0, brokenLinks: 0, cleanLinks: 0, lostEdits: 0, safeEdits: 0, uploadsOk: 0, uploadsTried: 0, brokenFiles: 0, verifiedFiles: 0, feedWrites: 0, fanoutBacklog: 0, fanoutClearSec: 0, clashedBookings: 0, safeBookings: 0, fairQueued: 0, accurateClicks: 0, ...(data.liveStats || {}) };
    this.reputation = typeof data.reputation === 'number' ? data.reputation : 100;
    this.spike = data.spike && typeof data.spike === 'object' ? data.spike : null;
    this.nextSpikeIn = typeof data.nextSpikeIn === 'number' ? data.nextSpikeIn : null;
    this.fundingHistory = Array.isArray(data.fundingHistory) ? data.fundingHistory : [];
    this.notificationLog = Array.isArray(data.notificationLog) ? data.notificationLog : [];
  }

  /** Investors pay in. Not revenue: it doesn't count toward profit. */
  receiveFunding(funding) {
    if (!funding || funding.amount <= 0) return;
    this.fundingHistory.push({ ...funding, at: Date.now() });
    this.addCoins(funding.amount);
    this.emit('fundingReceived', funding);
  }

  totalFunding() {
    return this.fundingHistory.reduce((sum, f) => sum + f.amount, 0);
  }

  // ==========================================
  // NOTIFICATION HISTORY
  // ==========================================

  logNotification(message, type = 'info') {
    this.notificationLog.push({
      id: this.generateId(),
      message: String(message),
      type,
      at: Date.now(),
      read: false
    });
    // Keep the save small
    if (this.notificationLog.length > 150) this.notificationLog.splice(0, this.notificationLog.length - 150);
    this.emit('notificationLogged', {});
  }

  unreadNotifications() {
    return this.notificationLog.filter(n => !n.read).length;
  }

  markNotificationsRead() {
    for (const n of this.notificationLog) n.read = true;
    this.emit('notificationLogged', {});
  }

  clearNotifications() {
    this.notificationLog = [];
    this.emit('notificationLogged', {});
  }

  // ==========================================
  // ECONOMY & STATS
  // ==========================================

  /** Coins earned from users (also counted as revenue). */
  earnRevenue(amount) {
    if (amount <= 0) return;
    this.economy.revenue += amount;
    this.economy.revenueCarry = (this.economy.revenueCarry || 0) + amount;
    const whole = Math.floor(this.economy.revenueCarry);
    if (whole <= 0) return;
    this.economy.revenueCarry -= whole;
    this.addCoins(whole);
  }

  /**
   * Pay the server's running cost. Fractions carry over between ticks.
   * If you can't pay, coins just hit 0 (no debt in Level 1).
   */
  payRunningCost(amount) {
    if (amount <= 0) return;
    this.economy.cost += amount;
    this.deductCoins(amount);
  }

  /**
   * Outage penalty: refunds and angry customers while requests are failing.
   * Counts against profit just like running cost.
   */
  payPenalty(amount) {
    if (amount <= 0) return;
    this.economy.penalties += amount;
    this.deductCoins(amount);
  }

  /** Revenue you would have earned if the failed requests had worked. */
  recordLostRevenue(amount) {
    if (amount > 0) this.economy.lost += amount;
  }

  /** Take coins out; fractions carry over between ticks. Coins never go below 0. */
  deductCoins(amount) {
    this.economy.costCarry += amount;
    const whole = Math.floor(this.economy.costCarry);
    if (whole <= 0) return;
    this.economy.costCarry -= whole;
    const paid = Math.min(this.coins, whole);
    if (paid > 0) {
      this.coins -= paid;
      this.emit('coinsChanged', { coins: this.coins, delta: -paid });
    }
  }

  /**
   * Record one tick of users online (only while the app is live).
   * Also moves reputation: outages hurt it fast, healthy time heals it slowly.
   */
  recordLiveTick(seconds) {
    this.liveStats.ticks += 1;
    this.liveStats.seconds += seconds;
    this.liveStats.userSum += this.users;
    this.liveStats.peakUsers = Math.max(this.liveStats.peakUsers, this.users);

    const errorRate = this.metrics?.errorRate || 0;
    const healthy = errorRate < 0.05;
    if (healthy) {
      this.liveStats.healthyTicks += 1;
      this.reputation = Math.min(100, this.reputation + 0.5);
    } else {
      this.reputation = Math.max(0, this.reputation - Math.min(8, errorRate * 25));
    }
  }

  /** Summary shown in the Goals panel and on the level-complete screen. */
  getEconomySummary() {
    const minutes = Math.max(1 / 30, this.liveStats.seconds / 60);
    const avgUsers = this.liveStats.ticks ? this.liveStats.userSum / this.liveStats.ticks : 0;
    return {
      revenue: Math.round(this.economy.revenue),
      cost: Math.round(this.economy.cost),
      penalties: Math.round(this.economy.penalties),
      lost: Math.round(this.economy.lost),
      profit: Math.round(this.economy.revenue - this.economy.cost - this.economy.penalties),
      // How fast you make money: the faster you fix problems, the higher this is
      profitPerMin: Math.round((this.economy.revenue - this.economy.cost - this.economy.penalties) / minutes),
      // Share of live time the server answered (almost) every request
      uptime: this.liveStats.ticks ? Math.round((this.liveStats.healthyTicks / this.liveStats.ticks) * 1000) / 10 : 100,
      reputation: Math.round(this.reputation),
      revenuePerMin: Math.round(this.economy.revenue / minutes),
      costPerMin: Math.round(this.economy.cost / minutes),
      avgUsers: Math.round(avgUsers),
      peakUsers: this.liveStats.peakUsers,
      // Each online user stands for ~10 people who visit at some point in a day
      estDailyUsers: Math.round(avgUsers * 10),
      minutesLive: Math.round(this.liveStats.seconds / 60)
    };
  }
}
