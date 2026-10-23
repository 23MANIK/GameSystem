/**
 * Scale Architect - Incident & Event Management Engine
 * Periodically spawns real-world system design incidents, tracks active duration,
 * evaluates architectural survival criteria, and dispenses rewards or penalties.
 */

import { EVENTS } from '../data/events.js';
import { COMPONENTS } from '../data/components.js';

export default class EventSystem {
  constructor(gameState) {
    this.gameState = gameState;
    // Initial warmup cooldown of 15 ticks (~30s) so new levels aren't hit immediately
    this.eventCooldown = 15;
    this.minCooldown = 30; // ~60 seconds (at 2s / tick)
    this.maxCooldown = 90; // ~180 seconds (at 2s / tick)
  }

  /**
   * Main game loop tick for event system
   */
  tick(deltaSeconds = 2) {
    // Process cooldown when no incidents are active
    if (this.gameState.activeEvents.length === 0) {
      if (this.eventCooldown > 0) {
        this.eventCooldown -= 1;
      } else {
        this.trySpawnEvent();
      }
      return;
    }

    // Process and count down active incidents
    const toResolve = [];
    for (const evt of this.gameState.activeEvents) {
      evt.remainingTime -= deltaSeconds;
      evt.timeLeft = evt.remainingTime;
      if (evt.remainingTime <= 0) {
        toResolve.push(evt);
      }
    }
    this.gameState.emit('eventTick', { activeEvents: this.gameState.activeEvents });

    for (const evt of toResolve) {
      this.resolveEvent(evt);
    }
  }

  /**
   * Checks if an event can legally trigger right now
   */
  canSpawnEvent() {
    if (this.gameState.level < 2) return false;
    if (this.gameState.activeEvents.length > 0) return false;
    if (this.eventCooldown > 0) return false;

    const eligible = this.getEligibleEvents();
    return eligible.length > 0;
  }

  /**
   * Returns list of events eligible for current level
   */
  getEligibleEvents() {
    // Filter events unlocked at player level
    const candidates = EVENTS.filter(e => e.minLevel <= this.gameState.level);
    if (candidates.length <= 1) return candidates;

    // Avoid repeating the exact last incident if alternatives are available
    const lastEvent = this.gameState.eventHistory[this.gameState.eventHistory.length - 1];
    if (lastEvent) {
      const filtered = candidates.filter(e => e.id !== lastEvent.id);
      if (filtered.length > 0) return filtered;
    }

    return candidates;
  }

  /**
   * Attempts to spawn a random eligible event (30% chance per tick when eligible)
   */
  trySpawnEvent() {
    if (!this.canSpawnEvent()) return null;

    if (Math.random() >= 0.30) {
      return null;
    }

    const eligible = this.getEligibleEvents();
    const randomIndex = Math.floor(Math.random() * eligible.length);
    const eventTemplate = eligible[randomIndex];

    return this.triggerEvent(eventTemplate);
  }

  /**
   * Triggers a specific event instance by template
   */
  triggerEvent(eventTemplate) {
    const eventInstance = {
      instanceId: this.gameState.generateId(),
      id: eventTemplate.id,
      name: eventTemplate.name,
      description: eventTemplate.description,
      story: eventTemplate.story,
      severity: eventTemplate.severity,
      minLevel: eventTemplate.minLevel,
      totalDuration: eventTemplate.duration,
      duration: eventTemplate.duration,
      remainingTime: eventTemplate.duration,
      timeLeft: eventTemplate.duration,
      effects: { ...eventTemplate.effects },
      requirements: { ...eventTemplate.requirements },
      rewards: { ...eventTemplate.rewards },
      penalty: { ...eventTemplate.penalty },
      inspiredBy: eventTemplate.inspiredBy,
      startedAt: Date.now()
    };

    this.gameState.activeEvents.push(eventInstance);
    this.gameState.recalculateMetrics();

    this.gameState.emit('eventStarted', {
      event: eventInstance,
      survivalCheck: this.canSurviveEvent(eventInstance)
    });

    return eventInstance;
  }

  /**
   * Allows manually triggering an event by ID (useful for testing and tutorials)
   */
  triggerEventById(eventId) {
    const template = EVENTS.find(e => e.id === eventId);
    if (!template) return null;
    return this.triggerEvent(template);
  }

  /**
   * Evaluates if the current architecture satisfies survival requirements
   */
  canSurviveEvent(event) {
    const reqs = event.requirements;
    if (!reqs || !reqs.components || reqs.components.length === 0) {
      return { canSurvive: true, missingComponents: [], message: 'No special requirements needed.' };
    }

    const missingComponents = [];

    for (const compId of reqs.components) {
      const compDef = COMPONENTS[compId];
      const compName = compDef ? compDef.name : compId;
      const placed = this.gameState.getComponentsByType(compId);

      if (placed.length === 0) {
        missingComponents.push(`${compName} (Not Placed)`);
      } else {
        const hasRequiredTier = placed.some(inst => inst.tier >= reqs.minTier);
        if (!hasRequiredTier) {
          missingComponents.push(`${compName} (Requires Tier ${reqs.minTier}+)`);
        }
      }
    }

    const canSurvive = missingComponents.length === 0;
    const message = canSurvive
      ? 'System architecture is properly defended and ready to absorb the incident!'
      : `Missing defenses: ${missingComponents.join(', ')}`;

    return {
      canSurvive,
      missingComponents,
      message
    };
  }

  /**
   * Resolves an incident upon timer expiry
   */
  resolveEvent(eventInstance) {
    const survival = this.canSurviveEvent(eventInstance);

    // Remove from active events
    this.gameState.activeEvents = this.gameState.activeEvents.filter(
      e => e.instanceId !== eventInstance.instanceId
    );

    if (survival.canSurvive) {
      // Award rewards
      this.gameState.addCoins(eventInstance.rewards.coins);
      this.gameState.addXP(eventInstance.rewards.xp);
      this.gameState.stats.totalEventsResolved += 1;

      const record = {
        id: eventInstance.id,
        name: eventInstance.name,
        survived: true,
        outcome: 'survived',
        timestamp: Date.now(),
        rewards: eventInstance.rewards
      };
      this.gameState.eventHistory.push(record);

      this.gameState.recalculateMetrics();

      this.gameState.emit('eventResolved', {
        event: eventInstance,
        name: eventInstance.name,
        success: true,
        message: `Survied "${eventInstance.name}"! Your architecture stood resilient against the surge.`,
        rewards: eventInstance.rewards
      });
      this.gameState.emit('eventEnded', {
        event: eventInstance,
        name: eventInstance.name,
        success: true
      });
    } else {
      // Apply penalties
      this.gameState.spendCoins(eventInstance.penalty.coinsLost);
      const userDrop = Math.min(this.gameState.users, eventInstance.penalty.usersLost);
      this.gameState.users = Math.max(10, this.gameState.users - userDrop);
      this.gameState.stats.totalEventsFailed += 1;

      const record = {
        id: eventInstance.id,
        name: eventInstance.name,
        survived: false,
        outcome: 'failed',
        timestamp: Date.now(),
        penalty: eventInstance.penalty,
        missing: survival.missingComponents
      };
      this.gameState.eventHistory.push(record);

      this.gameState.recalculateMetrics();

      this.gameState.emit('eventResolved', {
        event: eventInstance,
        name: eventInstance.name,
        success: false,
        message: `Platform suffered degradation during "${eventInstance.name}". Missing: ${survival.missingComponents.join(', ')}`,
        penalty: eventInstance.penalty
      });
      this.gameState.emit('eventEnded', {
        event: eventInstance,
        name: eventInstance.name,
        success: false
      });
    }

    // Reset cooldown to random interval within [minCooldown, maxCooldown]
    this.resetCooldown();
  }

  /**
   * Resets cooldown timer between incidents
   */
  resetCooldown() {
    this.eventCooldown = Math.floor(
      Math.random() * (this.maxCooldown - this.minCooldown + 1)
    ) + this.minCooldown;
  }

  /**
   * Returns list of currently active incidents
   */
  getActiveEvents() {
    return this.gameState.activeEvents;
  }
}
