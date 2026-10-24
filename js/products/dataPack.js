/**
 * dataPack.js — turn a data-only product (plain JSON, no code) into a normal
 * product pack (see js/products/registry.js for the pack shape).
 *
 * Generated games (Create DesignGame) are stored as JSON, so they can be
 * loaded at run time without shipping new code. Everything that is code in a
 * hand-written pack (goal checks, tutorial text, fix suggestions) is picked
 * here from a fixed menu instead. The format is described in
 * docs/designgame/data-pack-format.md.
 *
 *   const pack = compileDataPack(json);   // throws DataPackError with every problem found
 *
 * All text is cleaned: only <strong>, <em>, <code>, <b>, <i> and <br> survive,
 * because the UI renders these strings as HTML and generated games are shared.
 */

import {
  placedChallenge, usersChallenge, latencyChallenge, incidentChallenge, profitChallenge, cpuAtUsers
} from '../game/Challenges.js';
import { newMachineSteps, ROLE_NAME, suggestedFix } from '../game/Tutorial.js';
import { ROLES } from '../data/roles.js';
import { CODE_FIXES } from '../data/codeFixes.js';
import { SERVER_PARTS } from '../data/serverParts.js';

export const DATA_PACK_VERSION = 1;

export class DataPackError extends Error {
  constructor(problems) {
    super(`Invalid game data: ${problems.slice(0, 8).join('; ')}${problems.length > 8 ? ` (+${problems.length - 8} more)` : ''}`);
    this.problems = problems;
  }
}

// ─── What a level may contain ───

const LEVEL_NUMBERS = [
  'userTarget', 'userGrowthRate', 'audience', 'startingCoins', 'coinRate', 'computeBudget',
  'readsPerUser', 'writesPerUser', 'pageViewsPerUser', 'pageKB', 'botShare', 'spamPerUser', 'dbReadCost',
  'globalShare', 'distanceMs', 'appCallCost', 'keepRecords', 'cacheHitRate', 'edgeHitRate', 'recordSpace',
  'blobSpaceMult', 'readKB', 'writeKB', 'bigFileShare', 'unverifiedShare', 'listReadsPerUser', 'devicesPerUser',
  'pollPerDevice', 'conflictShare', 'browsePerUser', 'publicShare', 'fanoutPerWrite', 'celebrityShare', 'celebrityMult', 'dedupShare', 'updateShare'
];
const LEVEL_BOOLS = ['serverMode', 'crashes', 'clickTracking', 'shardIdClash', 'comingSoon'];
const LEVEL_TEXTS = ['name', 'subtitle', 'intro', 'story', 'completionMessage'];
const LEVEL_ENUMS = {
  mode: ['single-server', 'app-db'],
  readKind: ['all', 'lookup'],
  botKind: ['read', 'write']
};
const LEVEL_LISTS = ['unlockedComponentIds', 'unlockedFeatures', 'realWorld', 'requiredComponents', 'replacesComponents', 'eventIds', 'unlockedFixes'];
const ENDPOINT_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'PAGE', 'BOT', 'EVT', 'WS'];
const ENDPOINT_RATES = ['readsPerSec', 'writesPerSec', 'botsPerSec', 'clicksPerSec', 'pagesPerSec'];

const INCIDENT_KINDS = ['spike', 'bots', 'crash'];
// Counters in gs.liveStats and shares in gs.serverStatus that goals can watch
export const COUNTER_STATS = ['botsBlocked', 'clicksCounted', 'cleanLinks', 'safeEdits', 'uploadsOk', 'verifiedFiles', 'feedWrites', 'fanoutClearSec'];
export const SHARE_STATS = ['cacheHit', 'clickAccuracy'];
const PARTS = Object.keys(SERVER_PARTS);
const TEXT_MAX = 1200;

// ─── Text cleaning ───

const ALLOWED_TAGS = /&lt;(\/?)(strong|em|code|b|i)&gt;|&lt;br\s*\/?&gt;/g;

/** Escape HTML, then bring back a few harmless formatting tags (no attributes). */
export function cleanText(s, max = TEXT_MAX) {
  const escaped = String(s ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(ALLOWED_TAGS, (m, slash, tag) => (tag ? `<${slash}${tag}>` : '<br>'));
}

function cleanDeep(v) {
  if (typeof v === 'string') return cleanText(v);
  if (Array.isArray(v)) return v.map(cleanDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cleanDeep(x)]));
  return v;
}

// ─── Validation helpers ───

function checker() {
  const problems = [];
  const at = (where, msg) => problems.push(`${where}: ${msg}`);
  const num = (where, v, { min = 0, max = 1e9, int = false } = {}) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return at(where, 'must be a number');
    if (v < min || v > max) at(where, `must be between ${min} and ${max}`);
    if (int && !Number.isInteger(v)) at(where, 'must be a whole number');
  };
  const str = (where, v, { required = true, max = TEXT_MAX } = {}) => {
    if (v == null && !required) return;
    if (typeof v !== 'string' || (required && !v.trim())) return at(where, 'must be text');
    if (v.length > max) at(where, `is longer than ${max} characters`);
  };
  const oneOf = (where, v, list) => {
    if (!list.includes(v)) at(where, `must be one of ${list.join(', ')}`);
  };
  return { problems, at, num, str, oneOf };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// ─── Goals ───

/** Goal types a data pack can use, each built from plain fields. */
const GOAL_TYPES = {
  users: g => usersChallenge(g.target, g.hint),
  latency: g => latencyChallenge(g.ms, g.users, g.hint),
  placed: g => placedChallenge(g.role, g.icon || ROLES[g.role].icon, g.label || `Add a ${ROLES[g.role].name.toLowerCase()}`, g.hint),
  incident: g => incidentChallenge(g.kind, { label: g.label, hint: g.hint }),
  profit: g => profitChallenge(g.target, g.hint),

  /** Records stored (links, posts, files…), counted by the game. */
  records: (g, pack) => ({
    id: 'records',
    icon: g.icon || '🗂️',
    info: g.info || 'storage',
    label: g.label || `Store ${g.target.toLocaleString()} ${pack.vocab?.records || 'records'}`,
    hint: g.hint,
    progress: gs => ({ value: gs.guestbook.count, target: g.target, unit: pack.vocab?.records || 'records' })
  }),

  /** A code fix bought (or a switch turned on). */
  fixOwned: g => ({
    id: `fix-${g.fix}`,
    icon: g.icon || CODE_FIXES[g.fix].icon,
    info: g.info || g.fix,
    label: g.label || `Use ${CODE_FIXES[g.fix].name}`,
    hint: g.hint,
    progress: gs => ({ value: gs.codeFixes[g.fix] ? 1 : 0, target: 1, unit: '', display: gs.codeFixes[g.fix] ? 'Done' : 'Not yet' })
  }),

  /** A running counter in gs.liveStats reaches a number (bots blocked, clicks counted…). */
  counter: g => ({
    id: g.id || `count-${g.stat}`,
    icon: g.icon || '📊',
    info: g.info || 'uptime',
    label: g.label,
    hint: g.hint,
    progress: gs => ({ value: Math.round(gs.liveStats?.[g.stat] || 0), target: g.target, unit: g.unit || '' })
  }),

  /** Run N app servers or N database shards. */
  machines: g => ({
    id: g.id || (g.role === 'db' ? 'shards' : `${g.role}-count`),
    icon: g.icon || (g.role === 'db' ? '🧱' : '🖥️'),
    info: g.info || (g.role === 'db' ? 'sharding' : 'horizontalScaling'),
    label: g.label || (g.role === 'db' ? `Split the data across ${g.target} database shards` : `Run ${g.target} app servers`),
    hint: g.hint,
    progress: gs => ({ value: g.role === 'db' ? gs.dbCount() : gs.appCount(), target: g.target, unit: g.role === 'db' ? 'shards' : 'servers' })
  }),

  /** Failed requests under a share, with enough users online. */
  errorRate: g => ({
    id: g.id || 'clean-errors',
    icon: g.icon || '✅',
    info: g.info || 'uptime',
    label: g.label || `Under ${Math.round(g.max * 1000) / 10}% failed requests with ${g.users.toLocaleString()}+ users`,
    hint: g.hint,
    progress: gs => {
      const err = gs.metrics?.errorRate ?? 1;
      const ok = gs.users >= g.users && err < g.max;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users.toLocaleString()} users` };
    }
  }),

  /** A share in gs.serverStatus (cache hit rate, click accuracy…) at least `min`. */
  statAtLeast: g => ({
    id: g.id || `stat-${g.stat}`,
    icon: g.icon || '🎯',
    info: g.info || 'cache',
    label: g.label,
    hint: g.hint,
    progress: gs => {
      const v = gs.serverStatus?.[g.stat] ?? 0;
      const ok = gs.users >= (g.users || 0) && v >= g.min;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${g.displayLabel || 'Now'} ${Math.round(v * 100)}%${g.users ? ` at ${gs.users.toLocaleString()} users` : ''}` };
    }
  }),

  /** One machine's CPU under a share, scaled to a number of users. */
  cpuUnder: g => ({
    id: g.id || `${g.role}-cpu`,
    icon: g.icon || '🗄️',
    info: g.info || 'cache',
    label: g.label || `${ROLES[g.role].name} CPU under ${Math.round(g.max * 100)}% with ${g.users.toLocaleString()}+ users`,
    hint: g.hint,
    progress: gs => {
      const cpu = cpuAtUsers(gs, g.role, g.users);
      const ok = gs.users >= g.users && cpu < g.max;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${ROLE_NAME[g.role] || g.role} CPU ${Math.round(cpu * 100)}% at ${g.users.toLocaleString()} users` };
    }
  })
};

function checkGoal(c, where, g, roles) {
  if (!isObj(g)) return c.at(where, 'must be an object');
  if (!GOAL_TYPES[g.type]) return c.at(where, `unknown goal type "${g.type}" (use ${Object.keys(GOAL_TYPES).join(', ')})`);
  c.str(`${where}.hint`, g.hint);
  for (const k of ['label', 'icon', 'info', 'id', 'unit', 'displayLabel']) c.str(`${where}.${k}`, g[k], { required: false, max: k === 'label' ? 160 : 60 });
  switch (g.type) {
    case 'users': case 'profit': case 'records':
      c.num(`${where}.target`, g.target, { min: 1, int: true }); break;
    case 'latency':
      c.num(`${where}.ms`, g.ms, { min: 1, max: 5000 }); c.num(`${where}.users`, g.users, { min: 1, int: true }); break;
    case 'placed':
      c.oneOf(`${where}.role`, g.role, roles); break;
    case 'incident':
      c.oneOf(`${where}.kind`, g.kind, INCIDENT_KINDS); break;
    case 'fixOwned':
      c.oneOf(`${where}.fix`, g.fix, Object.keys(CODE_FIXES)); break;
    case 'counter':
      c.oneOf(`${where}.stat`, g.stat, COUNTER_STATS); c.str(`${where}.label`, g.label, { max: 160 }); c.num(`${where}.target`, g.target, { min: 1 }); break;
    case 'machines':
      c.oneOf(`${where}.role`, g.role, ['app', 'db']); c.num(`${where}.target`, g.target, { min: 2, max: 8, int: true }); break;
    case 'errorRate':
      c.num(`${where}.max`, g.max, { min: 0.001, max: 0.5 }); c.num(`${where}.users`, g.users, { min: 1, int: true }); break;
    case 'statAtLeast':
      c.oneOf(`${where}.stat`, g.stat, SHARE_STATS); c.str(`${where}.label`, g.label, { max: 160 }); c.num(`${where}.min`, g.min, { min: 0, max: 1 });
      if (g.users != null) c.num(`${where}.users`, g.users, { min: 1, int: true });
      break;
    case 'cpuUnder':
      c.oneOf(`${where}.role`, g.role, roles); c.num(`${where}.max`, g.max, { min: 0.05, max: 1 }); c.num(`${where}.users`, g.users, { min: 1, int: true }); break;
  }
}

// ─── Tutorial ───

/** Built-in step kinds whose text depends on the live game. */
const STEP_KINDS = {
  /** Level 1: one machine, upgrade the part that runs out first. */
  bottleneckSingle: () => ({
    id: 'bottleneck',
    text: (gs, ctx) => {
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
      const pct = Math.round((gs.serverStatus?.usage?.[part.id] || 0.8) * 100);
      return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>, so it will run out first: your <em>bottleneck</em>. ${part.whenFull} Tap <strong>Server</strong> (or your server on the map, then <strong>Upgrade</strong>) and buy a bigger ${part.short}.`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverUpgraded'
  }),
  /** Several machines: name the busy one and suggest a code fix when one helps. */
  bottleneckMulti: () => ({
    id: 'bottleneck',
    text: (gs, ctx) => {
      const role = ctx?.role || gs.serverStatus?.busiestRole || 'db';
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
      const pct = Math.round((gs.serverStatus?.servers?.[role]?.usage?.[part.id] || 0.8) * 100);
      const fix = suggestedFix(gs, role, part.id);
      const advice = fix
        ? `A bigger ${part.short} helps for a while, but the real problem is the code: try <strong>${fix.icon} ${fix.name}</strong> on the <strong>Code fixes</strong> tab. ${fix.short}`
        : `Open <strong>Server</strong>, pick the ${ROLE_NAME[role] || role} tab and buy a bigger ${part.short}.`;
      return `${part.icon} The <strong>${ROLE_NAME[role] || role}'s ${part.short}</strong> is at <strong>${pct}%</strong>. ${advice}`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: ['serverUpgraded', 'codeFixBought']
  }),
  /** Open the game to the public (level 1). */
  goLive: s => ({
    id: 'go_live',
    text: () => s.text,
    highlight: '#hud-resources',
    button: s.button || 'Open to the public',
    onButton: gs => { gs.appLive = true; }
  })
};

const STEP_EVENTS = [
  'serverBuilderOpened', 'serverBought', 'dbBought', 'machineBought', 'serverPlaced', 'dbPlaced', 'machinePlaced',
  'appServerPlaced', 'dbShardPlaced', 'partWarning', 'serverUpgraded', 'codeFixBought'
];
const STEP_FLAGS = ['showInBuilder', 'minimizeAfterButton', 'finishAfterButton'];
const BUILDER_TABS = () => [...Object.keys(ROLES), 'fixes'];

function checkStep(c, where, s) {
  if (!isObj(s)) return c.at(where, 'must be an object');
  if (s.kind) {
    if (!STEP_KINDS[s.kind]) c.at(`${where}.kind`, `unknown step kind "${s.kind}"`);
    if (s.kind === 'goLive') c.str(`${where}.text`, s.text);
    return;
  }
  c.str(`${where}.id`, s.id, { max: 40 });
  c.str(`${where}.text`, s.text);
  c.str(`${where}.button`, s.button, { required: false, max: 40 });
  if (s.highlight != null) c.oneOf(`${where}.highlight`, s.highlight, ['#nav-server', '#nav-goals', '#hud-resources']);
  if (s.builderTab != null) c.oneOf(`${where}.builderTab`, s.builderTab, BUILDER_TABS());
  if (s.role != null) c.oneOf(`${where}.role`, s.role, Object.keys(ROLES));
  for (const e of [].concat(s.advanceOn ?? [])) c.oneOf(`${where}.advanceOn`, e, STEP_EVENTS);
  if (!s.button && !s.advanceOn) c.at(where, 'needs a button or an advanceOn event');
}

function buildStep(s) {
  if (s.kind) return STEP_KINDS[s.kind](s);
  const step = { id: s.id, text: () => s.text };
  for (const k of ['button', 'highlight', 'builderTab', 'role', 'advanceOn']) if (s[k] != null) step[k] = s[k];
  for (const k of STEP_FLAGS) if (s[k]) step[k] = true;
  if (s.goLive) step.onButton = gs => { gs.appLive = true; };
  return step;
}

/**
 * A level's tutorial is either a list of steps, or the usual "new machine"
 * walkthrough: { newMachine: { role, welcome, buy, explain, extra: [steps] } }.
 */
function buildLevelSteps(t) {
  if (Array.isArray(t)) return t.map(buildStep);
  const m = t.newMachine;
  return newMachineSteps({ role: m.role, welcome: m.welcome, buy: m.buy, explain: m.explain, extra: (m.extra || []).map(buildStep) });
}

// ─── Fix suggestions ───

/** suggestFix rules: [{ fix, roles?, parts?, minLevel? }], first match not yet bought wins. */
function buildSuggestFix(rules = []) {
  return (gs, role, partId) => {
    for (const r of rules) {
      if (r.roles && !r.roles.includes(role)) continue;
      if (r.parts && !r.parts.includes(partId)) continue;
      if (r.minLevel && gs.level < r.minLevel) continue;
      if (!gs.codeFixes[r.fix] && CODE_FIXES[r.fix]) return CODE_FIXES[r.fix];
    }
    return null;
  };
}

// ─── Validate ───

/** Every problem in a data pack (empty when it can be played). */
export function validateDataPack(d) {
  const c = checker();
  if (!isObj(d)) return ['the game must be a JSON object'];
  const roles = Object.keys(ROLES);
  const fixes = Object.keys(CODE_FIXES);

  if (d.format !== DATA_PACK_VERSION) c.at('format', `must be ${DATA_PACK_VERSION}`);
  if (typeof d.id !== 'string' || !/^dg_[a-z0-9_]{3,48}$/.test(d.id)) c.at('id', 'must look like dg_ride_hailing (lowercase, digits, _)');
  if (!isObj(d.meta)) c.at('meta', 'is missing');
  else {
    c.str('meta.name', d.meta.name, { max: 60 });
    c.str('meta.icon', d.meta.icon, { max: 8 });
    c.str('meta.likeWhat', d.meta.likeWhat, { required: false, max: 60 });
    c.str('meta.tagline', d.meta.tagline, { max: 400 });
    if (!Array.isArray(d.meta.concepts)) c.at('meta.concepts', 'must be a list');
  }

  // Levels
  if (!Array.isArray(d.levels) || d.levels.length < 2 || d.levels.length > 12) c.at('levels', 'must be a list of 2–12 levels');
  const levelNums = [];
  (Array.isArray(d.levels) ? d.levels : []).forEach((L, i) => {
    const w = `levels[${i}]`;
    if (!isObj(L)) return c.at(w, 'must be an object');
    if (L.level !== i + 1) c.at(`${w}.level`, `must be ${i + 1}`);
    levelNums.push(L.level);
    for (const k of Object.keys(L)) {
      if (![...LEVEL_NUMBERS, ...LEVEL_BOOLS, ...LEVEL_TEXTS, ...LEVEL_LISTS, ...Object.keys(LEVEL_ENUMS), 'level', 'feature', 'spikeRange'].includes(k)) {
        c.at(`${w}.${k}`, 'is not a known level field');
      }
    }
    for (const k of LEVEL_TEXTS) c.str(`${w}.${k}`, L[k], { required: ['name', 'subtitle', 'story', 'completionMessage'].includes(k) });
    for (const k of LEVEL_NUMBERS) if (L[k] != null) c.num(`${w}.${k}`, L[k], { max: k === 'celebrityMult' ? 1e5 : 1e8 });
    for (const k of ['userTarget', 'userGrowthRate', 'coinRate']) if (L[k] == null) c.at(`${w}.${k}`, 'is required');
    for (const k of LEVEL_BOOLS) if (L[k] != null && typeof L[k] !== 'boolean') c.at(`${w}.${k}`, 'must be true or false');
    for (const [k, list] of Object.entries(LEVEL_ENUMS)) if (L[k] != null) c.oneOf(`${w}.${k}`, L[k], list);
    for (const k of LEVEL_LISTS) if (L[k] != null && !(Array.isArray(L[k]) && L[k].every(x => typeof x === 'string'))) c.at(`${w}.${k}`, 'must be a list of text');
    if (L.spikeRange != null && !(Array.isArray(L.spikeRange) && L.spikeRange.length === 2 && L.spikeRange.every(x => typeof x === 'number'))) c.at(`${w}.spikeRange`, 'must be [low, high]');
    if (L.feature != null) {
      const f = L.feature;
      c.str(`${w}.feature.name`, f.name, { max: 80 });
      c.str(`${w}.feature.summary`, f.summary, { max: 600 });
      (Array.isArray(f.endpoints) ? f.endpoints : []).forEach((e, j) => {
        c.oneOf(`${w}.feature.endpoints[${j}].method`, e.method, ENDPOINT_METHODS);
        c.str(`${w}.feature.endpoints[${j}].path`, e.path, { max: 80 });
        c.str(`${w}.feature.endpoints[${j}].does`, e.does, { max: 160 });
        if (e.rate != null) c.oneOf(`${w}.feature.endpoints[${j}].rate`, e.rate, ENDPOINT_RATES);
      });
    }
  });

  // Machines, fixes
  if (!isObj(d.roles) || !d.roles.app) c.at('roles', 'must list at least the app server');
  for (const [r, cfg] of Object.entries(isObj(d.roles) ? d.roles : {})) {
    c.oneOf(`roles.${r}`, r, roles);
    if (!isObj(cfg)) { c.at(`roles.${r}`, 'must be { unlockLevel, maxCount? }'); continue; }
    c.num(`roles.${r}.unlockLevel`, cfg.unlockLevel, { min: 1, max: 12, int: true });
    if (cfg.maxCount != null) c.num(`roles.${r}.maxCount`, cfg.maxCount, { min: 1, max: 8, int: true });
  }
  for (const [r, rule] of Object.entries(isObj(d.scaleOut) ? d.scaleOut : {})) {
    c.oneOf(`scaleOut.${r}`, r, ['app', 'db']);
    c.num(`scaleOut.${r}.level`, rule?.level, { min: 1, max: 12, int: true });
    if (rule?.needs != null) c.oneOf(`scaleOut.${r}.needs`, rule.needs, roles);
    c.str(`scaleOut.${r}.noun`, rule?.noun, { max: 30 });
  }
  for (const [f, lvl] of Object.entries(isObj(d.fixes) ? d.fixes : {})) {
    c.oneOf(`fixes.${f}`, f, fixes);
    c.num(`fixes.${f}`, lvl, { min: 1, max: 12, int: true });
  }
  if (d.xlLevel != null) {
    if (typeof d.xlLevel === 'number') c.num('xlLevel', d.xlLevel, { min: 1, max: 12, int: true });
    else if (isObj(d.xlLevel)) for (const [k, v] of Object.entries(d.xlLevel)) { c.oneOf(`xlLevel.${k}`, k, ['default', ...PARTS]); c.num(`xlLevel.${k}`, v, { min: 1, max: 12, int: true }); }
    else c.at('xlLevel', 'must be a number or { default, cpu, ram, storage, network }');
  }

  // Goals and tutorial, one entry per level
  for (const n of levelNums) {
    const goals = d.goals?.[n];
    if (!Array.isArray(goals) || !goals.length) c.at(`goals.${n}`, 'needs at least one goal');
    else {
      goals.forEach((g, j) => checkGoal(c, `goals.${n}[${j}]`, g, roles));
      const ids = goals.filter(g => GOAL_TYPES[g?.type]).map(g => g.id || `${g.type}:${g.role || g.kind || g.fix || g.stat || ''}`);
      if (new Set(ids).size !== ids.length) c.at(`goals.${n}`, 'has two goals of the same kind (give one an id)');
    }
    const t = d.tutorial?.[n];
    if (t == null) c.at(`tutorial.${n}`, 'is missing');
    else if (Array.isArray(t)) t.forEach((s, j) => checkStep(c, `tutorial.${n}[${j}]`, s));
    else if (isObj(t?.newMachine)) {
      const m = t.newMachine;
      c.oneOf(`tutorial.${n}.newMachine.role`, m.role, roles);
      for (const k of ['welcome', 'buy', 'explain']) c.str(`tutorial.${n}.newMachine.${k}`, m[k]);
      (m.extra || []).forEach((s, j) => checkStep(c, `tutorial.${n}.newMachine.extra[${j}]`, s));
    } else c.at(`tutorial.${n}`, 'must be a list of steps or { newMachine }');
    if (d.levelRole?.[n] != null) c.oneOf(`levelRole.${n}`, d.levelRole[n], roles);
  }

  (Array.isArray(d.suggestFix) ? d.suggestFix : []).forEach((r, i) => {
    c.oneOf(`suggestFix[${i}].fix`, r?.fix, fixes);
    for (const role of r?.roles || []) c.oneOf(`suggestFix[${i}].roles`, role, roles);
    for (const p of r?.parts || []) c.oneOf(`suggestFix[${i}].parts`, p, PARTS);
  });

  for (const [kind, list] of Object.entries(isObj(d.incidents) ? d.incidents : {})) {
    c.oneOf(`incidents.${kind}`, kind, INCIDENT_KINDS);
    if (!Array.isArray(list) || !list.length) { c.at(`incidents.${kind}`, 'must be a non-empty list'); continue; }
    list.forEach((x, j) => {
      c.str(`incidents.${kind}[${j}].name`, x?.name, { max: 60 });
      c.str(`incidents.${kind}[${j}].story`, x?.story, { max: 300 });
      if (x?.mult != null) c.num(`incidents.${kind}[${j}].mult`, x.mult, { min: 1, max: 10 });
    });
  }
  for (const k of ['record', 'records', 'writeFails', 'readName']) c.str(`vocab.${k}`, d.vocab?.[k], { max: 60 });
  return c.problems;
}

// ─── Compile ───

/** Check a data pack and build a playable product pack from it. */
export function compileDataPack(raw) {
  const problems = validateDataPack(raw);
  if (problems.length) throw new DataPackError(problems);
  const d = cleanDeep(raw);
  // Identifiers must stay exact (cleaning leaves plain identifiers unchanged anyway)
  d.id = raw.id;

  const levels = d.levels.map(L => ({ ...L, serverMode: L.serverMode ?? true }));
  const pack = {
    id: d.id,
    dataPack: true,
    meta: d.meta,
    levels,
    roles: d.roles,
    scaleOut: d.scaleOut || {},
    fixes: d.fixes || {},
    xlLevel: d.xlLevel,
    playtest: raw.playtest,
    roleText: d.roleText || {},
    partText: d.partText || {},
    fixText: d.fixText || {},
    explanations: d.explanations || {},
    incidents: d.incidents,
    vocab: d.vocab,
    levelRole: { ...(d.levelRole || {}) },
    suggestFix: buildSuggestFix(raw.suggestFix),
    tryIt: false,
    challenges: {},
    steps: {}
  };
  for (const L of levels) {
    pack.challenges[L.level] = d.goals[L.level].map(g => {
      const ch = GOAL_TYPES[g.type](g, pack);
      if (g.id) ch.id = g.id;
      if (g.icon) ch.icon = g.icon;
      if (g.info) ch.info = g.info;
      return ch;
    });
    pack.steps[L.level] = buildLevelSteps(d.tutorial[L.level]);
    if (!pack.levelRole[L.level]) {
      const t = d.tutorial[L.level];
      pack.levelRole[L.level] = t.newMachine?.role || (L.level === 1 ? 'app' : 'db');
    }
  }
  return pack;
}

/** The entry for js/data/products.js's picker list. */
export function productEntry(pack) {
  return {
    id: pack.id,
    name: pack.meta.name,
    likeWhat: pack.meta.likeWhat || 'Community game',
    icon: pack.meta.icon,
    tagline: pack.meta.tagline,
    concepts: pack.meta.concepts,
    playable: true,
    generated: true,
    levels: pack.levels.map(l => ({ level: l.level, name: l.name, focus: l.subtitle, playable: !l.comingSoon }))
  };
}
