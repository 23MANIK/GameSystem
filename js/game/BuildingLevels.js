/**
 * BuildingLevels.js — how big a machine looks on the map, and what the next
 * size up costs.
 *
 * A machine is built from four parts (CPU, RAM, Storage, Network), each with
 * four options. Its building level (1–4) is the average option it uses, so a
 * server with bigger parts is drawn as a bigger building. "Upgrade to the next
 * level" lifts every part to at least that option and is bought through
 * GameState.setServer, exactly like an upgrade from the Server Builder.
 */

import { PART_ORDER, SERVER_PARTS, getOptionIndex, upgradeCost, runningCostPerMinute, optionsForLevel } from '../data/serverParts.js';
import { ROLES } from '../data/roles.js';

export const MAX_BUILDING_LEVEL = 4;
export const SIZE_NAMES = ['Small', 'Medium', 'Large', 'X-Large'];

/**
 * The buildings in the gallery. `role` is the machine it stands for in the
 * game (null = not in the game yet).
 */
export const BUILDINGS = [
  { type: 'server', role: 'app', name: 'Web Server', category: 'Compute', short: 'Handles user requests and runs your code.' },
  { type: 'lb', role: 'lb', name: 'Load Balancer', category: 'Network', short: 'Spreads traffic across your servers.' },
  { type: 'db', role: 'db', name: 'Database', category: 'Storage', short: 'Stores your data so it survives restarts.' },
  { type: 'cache', role: 'cache', name: 'Cache', category: 'Storage', short: 'Answers popular reads from memory.' },
  { type: 'queue', role: 'queue', name: 'Queue', category: 'Async', short: 'Buffers slow jobs to process later.' },
  { type: 'cdn', role: 'cdn', name: 'CDN', category: 'Network', short: 'Serves content close to your users.' },
  { type: 'firewall', role: 'gateway', name: 'Firewall / Gateway', category: 'Security', short: 'Front door that blocks abusive clients.' },
  { type: 'broker', role: null, name: 'Message Broker', category: 'Async', short: 'Streams events between services.' },
  // AI agent machines: only shown in products that use them (onlyWhenUsed)
  { type: 'brain', role: 'llm', name: 'AI Model', category: 'AI', short: 'The rented "brain" that reads prompts and writes answers.', onlyWhenUsed: true },
  { type: 'library', role: 'kb', name: 'Knowledge Base', category: 'AI', short: 'Your documents, searchable by meaning.', onlyWhenUsed: true },
  { type: 'workshop', role: 'tools', name: 'Tool Server', category: 'AI', short: 'The buttons the agent may press: orders, refunds.', onlyWhenUsed: true },
  { type: 'shield', role: 'guard', name: 'Guardrail', category: 'Security', short: 'Checks every message and answer for tricks.', onlyWhenUsed: true },
  { type: 'tower', role: 'orch', name: 'Orchestrator', category: 'AI', short: 'A lead agent that splits big jobs across helpers.', onlyWhenUsed: true }
];

/** Building level 1–4 for a machine config (null config = nothing built yet). */
export function buildingLevel(config) {
  if (!config) return 1;
  let sum = 0;
  for (const partId of PART_ORDER) sum += Math.max(0, getOptionIndex(partId, config[partId]));
  return Math.min(MAX_BUILDING_LEVEL, 1 + Math.round(sum / PART_ORDER.length));
}

/** How many machines one upgrade pays for (every app server / shard gets the same parts). */
function machinesToUpgrade(gs, role) {
  return role === 'app' || role === 'db' ? Math.max(1, gs.machineCount(role)) : 1;
}

/**
 * The next building level for a role: the parts it would get, the price and
 * the new running cost. { config, level, cost, runPerMin } or
 * { blocked: reason } when there's nothing bigger to buy yet.
 */
export function nextLevelUpgrade(gs, role) {
  const current = gs.getServerConfig(role);
  if (!current) return { blocked: 'Not built yet' };
  const level = buildingLevel(current);
  if (level >= MAX_BUILDING_LEVEL) return { blocked: 'Max size' };

  const target = level + 1;
  // Smallest change that reaches the next level: raise the smallest parts first
  const next = { ...current };
  const buyable = Object.fromEntries(PART_ORDER.map(id => [id, optionsForLevel(id, gs.level)]));
  const byIndex = () => PART_ORDER.slice().sort((a, b) => getOptionIndex(a, next[a]) - getOptionIndex(b, next[b]));
  let guard = 0;
  while (buildingLevel(next) < target && guard++ < 16) {
    const partId = byIndex().find(id => getOptionIndex(id, next[id]) + 1 < buyable[id].length);
    if (!partId) break;
    next[partId] = buyable[partId][getOptionIndex(partId, next[partId]) + 1].id;
  }
  if (buildingLevel(next) < target) {
    const xl = Math.min(...PART_ORDER.map(id => SERVER_PARTS[id].options[SERVER_PARTS[id].options.length - 1].unlockLevel || Infinity));
    return { blocked: Number.isFinite(xl) ? `Bigger parts unlock at level ${xl}` : 'Max size for now' };
  }

  const count = machinesToUpgrade(gs, role);
  const mult = (ROLES[role]?.costMult ?? 1) * (role === 'blob' && gs.codeFixes?.coldTier ? 0.5 : 1);
  return {
    config: next,
    level: target,
    cost: upgradeCost(current, next) * count,
    runPerMin: Math.round(runningCostPerMinute(next) * count * mult),
    changed: PART_ORDER.filter(id => next[id] !== current[id])
  };
}

/**
 * Animation state from the simulator: failed (down or overloaded),
 * heavy (> 80% of a part), processing (users flowing) or idle.
 */
export function buildingState(gs, role) {
  if (!gs.isPlaced(role)) return 'idle';
  const status = gs.serverStatus;
  if (!status) return 'idle';
  if (role === 'app' && status.appDown) return 'failed';
  const usage = status.servers?.[role]?.usage;
  if (!usage) return 'idle';
  const peak = Math.max(...PART_ORDER.map(id => usage[id] || 0));
  if (peak > 1) return 'failed';
  if (peak > 0.8) return 'heavy';
  return gs.users > 0 && peak > 0.02 ? 'processing' : 'idle';
}
