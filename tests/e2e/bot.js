// In-page play-test bot, injected by tests/e2e/fixtures.mjs. Same rules as
// tests/helpers/harness.mjs and tools/playtest-headless.mjs, but it plays the
// real game in the page (window.__game), so the diagram, panels and overlays
// all run too. It defines window.__testBot.
window.__testBot = (() => {
  let mods = null;
  async function load() {
    if (mods) return mods;
    mods = {
      SP: await import('/js/data/serverParts.js'),
      CF: await import('/js/data/codeFixes.js'),
      reg: await import('/js/products/registry.js'),
      roles: await import('/js/data/roles.js'),
      ch: await import('/js/game/Challenges.js')
    };
    return mods;
  }

  function bump(gs, SP, role, part) {
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
  }

  function act(g, m) {
    const gs = g.gameState;
    const { SP, CF, reg, roles } = m;
    const L = gs.level;
    const plan = reg.activeProduct().playtest || {};
    const aud = gs.levelDef().audience || gs.users;
    for (const role of gs.availableRoles()) {
      if (!gs.getServerConfig(role)) {
        const c = SP.cheapestServer();
        const cost = SP.serverCost(c);
        if (gs.coins < cost || !gs.setServer(c, cost, role)) continue;
      }
      if (!gs.isPlaced(role)) {
        const t = g.placementTiles(role)[0];
        if (t) g.placeMachine(role, t.x, t.y);
      }
    }
    const fixes = plan.fixes
      ? Object.entries(plan.fixes).filter(([l]) => Number(l) <= L).flatMap(([, f]) => f)
      : CF.fixesForLevel(L).filter(f => !f.toggle).map(f => f.id);
    for (const f of fixes) {
      const fix = CF.CODE_FIXES[f];
      if (fix && !gs.codeFixes[f] && gs.coins >= fix.cost + 300) gs.buyCodeFix(f, fix.cost);
    }
    const appRule = reg.scaleOutRule('app', L);
    const dbRule = reg.scaleOutRule('db', L);
    const st0 = gs.serverStatus;
    const extra = role => {
      if (gs.coins < gs.extraMachineCost(role) + 200 || !gs.buyExtraMachine(role)) return;
      g.autoPlaceExtra(role);
    };
    if (appRule && gs.isPlaced(appRule.needs || 'lb') && gs.appCount() < (roles.ROLES.app.maxCount || 6)) {
      const need = plan.apps?.[L] ? gs.appCount() < plan.apps[L] : st0?.bottleneckRole === 'app' && st0.userLimit < aud * 1.3;
      if (need) extra('app');
    }
    if (dbRule && gs.isPlaced('db') && gs.dbCount() < (roles.ROLES.db.maxCount || 4)) {
      const need = plan.shards?.[L] ? gs.dbCount() < plan.shards[L] : st0?.bottleneckRole === 'db' && (st0.userLimit < aud * 1.3 || st0.space?.pct > 0.75);
      if (need) extra('db');
    }
    for (let k = 0; k < 2; k++) {
      const st = gs.serverStatus;
      if (st && st.peak > 0.72) bump(gs, SP, st.busiestRole, st.busiest);
    }
    for (let k = 0; k < 3; k++) {
      const st = gs.serverStatus;
      if (st && st.userLimit < Math.max(aud, 30) * 1.5) { if (!bump(gs, SP, st.bottleneckRole, st.bottleneck)) break; }
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
  }

  /** Play the current level to the end (or maxTicks game ticks). */
  async function playLevel({ maxTicks = 1800 } = {}) {
    const m = await load();
    const g = window.__game, gs = g.gameState;
    g.stopGameLoop();
    gs.appLive = true;
    if (g.tutorial.active) g.tutorial.finish();
    // Own seeded randomness for the whole level, and no pauses in between, so
    // animations can't use up random numbers: the same level plays the same way every run.
    const realRandom = Math.random;
    let s = 7 + gs.level * 1000;
    Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    let t = 0;
    try {
      for (; t < maxTicks && !gs.levelCompleted; t++) {
        act(g, m);
        g.gameTick();
      }
    } finally {
      Math.random = realRandom;
    }
    await new Promise(r => setTimeout(r, 0));
    const ev = m.ch.evaluateChallenges(gs);
    return {
      level: gs.level, done: gs.levelCompleted, minutes: Math.round(t * 2 / 60 * 10) / 10, users: Math.round(gs.users),
      pending: ev.results.filter(r => !r.done).map(r => `${r.id}: ${r.display || `${Math.round(r.value)}/${r.target}`}`)
    };
  }

  /** Run the game for n ticks without the bot doing anything. */
  async function ticks(n) {
    const g = window.__game;
    for (let i = 0; i < n && !g.gameState.levelCompleted; i++) g.gameTick();
  }

  return { playLevel, ticks, act: async () => act(window.__game, await load()) };
})();
