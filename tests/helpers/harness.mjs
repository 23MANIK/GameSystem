/**
 * harness.mjs — run the real game systems in Node, without a browser.
 *
 * The same engine the page uses (GameState, LevelSystem, ResourceManager,
 * TrafficSpikes, EventSystem, Challenges, Tutorial), driven by the same bot as
 * tools/playtest-headless.mjs. Unit tests use it to set up a game in any
 * state and check what happens next.
 *
 *   const game = await newGame('guestbook');
 *   game.buy('app'); game.place('app');
 *   game.runLevel();               // bot plays until the level is done
 *   game.nextLevel();
 */

const root = new URL('../../js/', import.meta.url).href;

/** A Map-backed localStorage, so save / load / retry work in Node. */
export function installMemoryStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; }
  };
  return globalThis.localStorage;
}

/** Repeatable randomness (spikes, incidents). Same generator as the play-test tool. */
export function seedRandom(seed = 7) {
  let s = seed;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const mod = {};
export async function loadModules() {
  if (mod.GameState) return mod;
  mod.registry = await import(root + 'products/registry.js');
  mod.GameState = (await import(root + 'game/GameState.js')).default;
  mod.LevelSystem = (await import(root + 'game/LevelSystem.js')).default;
  mod.EventSystem = (await import(root + 'game/EventSystem.js')).default;
  mod.ResourceManager = (await import(root + 'game/ResourceManager.js')).default;
  mod.TrafficSpikes = (await import(root + 'game/TrafficSpikes.js')).default;
  mod.Tutorial = (await import(root + 'game/Tutorial.js')).default;
  mod.tutorialMod = await import(root + 'game/Tutorial.js');
  mod.challenges = await import(root + 'game/Challenges.js');
  mod.levels = await import(root + 'data/levels.js'); // live binding: the active pack sets LEVELS
  mod.roles = await import(root + 'data/roles.js');
  mod.parts = await import(root + 'data/serverParts.js');
  mod.fixes = await import(root + 'data/codeFixes.js');
  mod.products = await import(root + 'data/products.js');
  mod.explanations = await import(root + 'data/explanations.js');
  mod.simulator = await import(root + 'game/SystemSimulator.js');
  return mod;
}

const TICK = 2; // seconds per game tick, as in the game

/**
 * A fresh game of one product at Level 1, with the starting coins.
 * Options: seed (randomness), tutorial (attach the guide, default true).
 */
export async function newGame(productId, { seed = 7, tutorial = true } = {}) {
  const m = await loadModules();
  if (!globalThis.localStorage) installMemoryStorage();
  seedRandom(seed);
  if (!m.registry.hasPack(productId)) throw new Error(`no pack "${productId}"`);

  const gs = new m.GameState();
  gs.reset();
  gs.productId = productId;
  gs.coins = m.levels.LEVELS[0].startingCoins;
  const levels = new m.LevelSystem(gs);
  const resources = new m.ResourceManager(gs, levels);
  const events = new m.EventSystem(gs);
  const spikes = new m.TrafficSpikes(gs);
  const guide = tutorial ? new m.Tutorial(gs) : null;
  const pack = m.registry.activeProduct();
  const plan = pack.playtest || {};
  const { ROLES, ROLE_TILES } = m.roles;
  const SP = m.parts;
  const CF = m.fixes;

  const game = {
    gs, levels, resources, events, spikes, tutorial: guide, pack, m,
    get LEVELS() { return m.levels.LEVELS; },

    freeTile(role) {
      const used = new Set(gs.placedComponents.map(c => `${c.gridX},${c.gridY}`));
      return (ROLE_TILES[role] || []).find(t => !used.has(`${t.x},${t.y}`));
    },

    /** Buy a machine with the cheapest parts (or `config`). Returns true if bought. */
    buy(role, config = SP.cheapestServer()) {
      const cost = SP.serverCost(config);
      return gs.coins >= cost && gs.setServer(config, cost, role);
    },

    /** Put a bought machine on the map, the way clicking its slot does. */
    place(role) {
      const t = game.freeTile(role);
      if (!t) return false;
      const id = gs.addComponent(ROLES[role].componentId, t.x, t.y);
      if (!id) return false;
      gs.recalculateMetrics();
      gs.emit(role === 'app' ? 'serverPlaced' : role === 'db' ? 'dbPlaced' : 'machinePlaced', { role, gridX: t.x, gridY: t.y });
      return true;
    },

    /** Move one part of a machine up one option. */
    bump(role, part) {
      const now = gs.getServerConfig(role);
      if (!now) return false;
      const cfg = { ...now };
      const opts = SP.optionsForLevel(part, gs.level);
      const i = opts.findIndex(o => o.id === cfg[part]);
      if (i < 0 || i >= opts.length - 1) return false;
      cfg[part] = opts[i + 1].id;
      const cost = SP.upgradeCost(now, cfg) * Math.max(1, gs.machineCount(role));
      if (gs.coins < cost) return false;
      return gs.setServer(cfg, cost, role);
    },

    addExtra(role) {
      if (!gs.coins || gs.coins < gs.extraMachineCost(role) + 200) return false;
      if (!gs.buyExtraMachine(role)) return false;
      game.place(role);
      return true;
    },

    wantFixes(L) {
      if (plan.fixes) return Object.entries(plan.fixes).filter(([l]) => Number(l) <= L).flatMap(([, f]) => f);
      return CF.fixesForLevel(L).filter(f => !f.toggle).map(f => f.id);
    },

    /** One bot decision: the same rules as tools/playtest-headless.mjs. */
    act() {
      const L = gs.level;
      const aud = gs.levelDef().audience || gs.users;
      for (const role of gs.availableRoles()) {
        if (gs.getServerConfig(role)) { if (!gs.isPlaced(role)) game.place(role); continue; }
        if (game.buy(role)) game.place(role);
      }
      for (const f of game.wantFixes(L)) {
        const fix = CF.CODE_FIXES[f];
        if (fix && !gs.codeFixes[f] && gs.coins >= fix.cost + 300) gs.buyCodeFix(f, fix.cost);
      }
      const appRule = m.registry.scaleOutRule('app', L);
      const dbRule = m.registry.scaleOutRule('db', L);
      const st0 = gs.serverStatus;
      const wantApps = plan.apps?.[L];
      const wantShards = plan.shards?.[L];
      if (appRule && gs.isPlaced(appRule.needs || 'lb') && gs.appCount() < (ROLES.app.maxCount || 6)) {
        const need = wantApps ? gs.appCount() < wantApps : st0?.bottleneckRole === 'app' && st0.userLimit < aud * 1.3;
        if (need) game.addExtra('app');
      }
      if (dbRule && gs.isPlaced('db') && gs.dbCount() < (ROLES.db.maxCount || 4)) {
        const need = wantShards ? gs.dbCount() < wantShards : st0?.bottleneckRole === 'db' && (st0.userLimit < aud * 1.3 || st0.space?.pct > 0.75);
        if (need) game.addExtra('db');
      }
      for (let k = 0; k < 2; k++) {
        const st = gs.serverStatus;
        if (st && st.peak > 0.72) game.bump(st.busiestRole, st.busiest);
      }
      for (let k = 0; k < 3; k++) {
        const st = gs.serverStatus;
        if (st && st.userLimit < Math.max(aud, 30) * 1.5) { if (!game.bump(st.bottleneckRole, st.bottleneck)) break; }
      }
      const st = gs.serverStatus;
      if (st && st.space?.capacity && st.space.pct > 0.7) {
        const role = st.space.role;
        const now = gs.getServerConfig(role);
        if (now) {
          const cfg = { ...now };
          const opts = SP.optionsForLevel('storage', L).filter(o => o.id !== 'disk_hdd');
          const best = opts.reduce((a, o) => (o.space > a.space ? o : a));
          if (SP.getOption('storage', cfg.storage).space < best.space) {
            cfg.storage = best.id;
            const cost = SP.upgradeCost(now, cfg) * Math.max(1, gs.machineCount(role));
            if (gs.coins >= cost) gs.setServer(cfg, cost, role);
          }
        }
      }
    },

    /** One game tick (2 s), in the same order as the game loop in main.js. */
    tick() {
      if (gs.levelCompleted) return;
      spikes.tick(TICK);
      resources.tick(levels, TICK);
      const audience = gs.levelDef().audience;
      if (audience && gs.users >= audience) gs.achievements.audienceReached = true;
      if (gs.appLive && gs.isServerPlaced()) {
        const perSec = gs.serverStatus?.recordsPerSec ?? gs.users * gs.writesPerUser();
        gs.guestbook.simulateVisitors(perSec * (gs.serverStatus?.diskFull ? 0 : 1) * TICK);
      }
      if (levels.getAvailableEvents().length > 0) events.tick();
      gs.recalculateMetrics();
      m.challenges.evaluateChallenges(gs);
      levels.checkLevelUp();
      guide?.autoAdvance();
    },

    /** Let the bot play until the level is done (or maxMinutes of game time). */
    runLevel(maxMinutes = 60) {
      gs.appLive = true;
      if (guide?.active) guide.finish();
      const max = maxMinutes * 60 / TICK;
      let t = 0;
      for (; t < max && !gs.levelCompleted; t++) { game.act(); game.tick(); }
      return { done: gs.levelCompleted, minutes: t * TICK / 60 };
    },

    /** Start the next level the way "Start Level N" does. False if there is none. */
    nextLevel() {
      const next = m.levels.LEVELS[gs.level];
      if (!next || next.comingSoon || !gs.levelCompleted) return false;
      gs.startLevel(next.level);
      return true;
    },

    playableLevels() {
      return m.levels.LEVELS.filter(l => !l.comingSoon);
    }
  };
  return game;
}

/** Every product id that has a pack in this build (PRs can add more). */
export async function packIds() {
  const m = await loadModules();
  return Object.keys(m.registry.PACKS);
}
