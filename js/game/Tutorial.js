/**
 * Tutorial — the guided walkthrough for each level.
 * Each step says what to do and which game event(s) move it forward.
 * showInBuilder: the step's text also shows inside the Server Builder.
 */

import { SERVER_PARTS } from '../data/serverParts.js';
import { CODE_FIXES } from '../data/codeFixes.js';
import { ROLES } from '../data/roles.js';

const LEVEL_1_STEPS = [
  {
    id: 'welcome',
    text: () => "Hi, I'm Archie! Every big system starts as <strong>one machine</strong>. It serves the page, runs the code and stores the data. Let's build yours.",
    button: "Let's build"
  },
  {
    id: 'open_builder',
    text: () => 'Tap <strong>Server</strong> at the bottom to open the Server Builder.',
    highlight: '#nav-server',
    advanceOn: 'serverBuilderOpened'
  },
  {
    id: 'pick_parts',
    text: () => 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds users in memory, <strong>Storage</strong> saves data, <strong>Network</strong> sends responses. Each card shows how many users that part can handle. Pick parts and press <strong>Buy</strong>. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverBought'
  },
  {
    id: 'place',
    text: () => 'Now click the glowing slot to place your server.',
    advanceOn: 'serverPlaced'
  },
  {
    id: 'go_live',
    text: () => 'Your server runs this level\'s feature: a <strong>Guestbook</strong>. Visitors <em>read every entry</em> (<code>GET /entries</code>) and <em>sign with their name</em> (<code>POST /entries</code>). Every request uses CPU, RAM, disk and network: watch the bars at the top. Users also bring you coins.',
    highlight: '#hud-resources',
    button: 'Open to the public',
    onButton: gs => { gs.appLive = true; }
  },
  {
    id: 'grow',
    text: () => 'To finish this level, complete every challenge in <strong>Goals</strong>. Each has a hint, and any <span class="info-glyph">i</span> button explains things in more detail. Watch out: your server costs coins every minute. I\'ll tell you when a part gets busy.',
    highlight: '#nav-goals',
    button: 'Got it',
    minimizeAfterButton: true,
    advanceOn: 'partWarning'
  },
  {
    id: 'bottleneck',
    text: (gs, ctx) => {
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'ram'];
      const pct = Math.round((gs.serverStatus?.usage?.[part.id] || 0.8) * 100);
      return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>, so it will run out first: your <em>bottleneck</em>. ${part.whenFull} Tap <strong>Server</strong> (or your server on the map, then <strong>Upgrade</strong>) and buy a bigger ${part.short}.`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'serverUpgraded'
  },
  {
    id: 'scaled',
    text: () => 'That\'s <strong>vertical scaling</strong>: making the one machine bigger. Each time a part fills up, upgrade the one that runs out first. Check <strong>Goals</strong> for what\'s left.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

export const ROLE_NAME = { app: 'app server', db: 'database' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
function guestbookSuggestedFix(gs, role, partId) {
  if (role === 'db' && (partId === 'cpu' || partId === 'storage') && !gs.codeFixes.index) return CODE_FIXES.index;
  if (partId === 'network' && !gs.codeFixes.pagination) return CODE_FIXES.pagination;
  return null;
}

/** The active product's rule for "which code fix would help?" (see setTutorial). */
let suggestedFixRule = guestbookSuggestedFix;
export function suggestedFix(gs, role, partId) {
  return suggestedFixRule(gs, role, partId);
}

const LEVEL_2_STEPS = [
  {
    id: 'welcome',
    text: () => 'Level 2! Your Guestbook went viral: people sign <strong>5× more often</strong>. Your one server is doing everything, and the data is fighting your app for CPU, RAM and disk. Time to give the data <strong>its own machine</strong>.',
    button: 'Show me'
  },
  {
    id: 'open_db',
    text: () => 'Tap <strong>Server</strong>. The builder now has tabs: <strong>App server</strong>, <strong>Database</strong> and <strong>Code fixes</strong>.',
    highlight: '#nav-server',
    advanceOn: 'serverBuilderOpened'
  },
  {
    id: 'buy_db',
    text: () => 'On the <strong>Database</strong> tab, build a database server. Watch "Can handle": the app server stops doing disk work, so it handles more users. Disk <strong>space</strong> matters now: the database stores every entry. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbBought'
  },
  {
    id: 'place_db',
    text: () => 'Click the glowing slot to place the database. It connects to your app server automatically.',
    advanceOn: 'dbPlaced'
  },
  {
    id: 'data_grows',
    text: () => 'Your data has its own home! Now watch it grow. As entries pile up: <strong>"read all" gets heavier</strong>, the database <strong>scans more rows</strong> on every read, and the <strong>disk fills up</strong>. Bigger machines only buy time: some problems need <strong>Code fixes</strong>. I\'ll tell you when something gets busy.',
    highlight: '#hud-resources',
    button: 'Got it',
    minimizeAfterButton: true,
    advanceOn: 'partWarning'
  },
  {
    id: 'bottleneck',
    text: (gs, ctx) => {
      const role = ctx?.role || gs.serverStatus?.busiestRole || 'db';
      const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
      const pct = Math.round((gs.serverStatus?.servers?.[role]?.usage?.[part.id] || 0.8) * 100);
      const fix = suggestedFix(gs, role, part.id);
      const advice = fix
        ? `A bigger ${part.short} helps for a while, but the real problem is the code: try <strong>${fix.icon} ${fix.name}</strong> on the <strong>Code fixes</strong> tab. ${fix.short}`
        : `Open <strong>Server</strong>, pick the ${ROLE_NAME[role]} tab and buy a bigger ${part.short}.`;
      return `${part.icon} The <strong>${ROLE_NAME[role]}'s ${part.short}</strong> is at <strong>${pct}%</strong>. ${advice}`;
    },
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: ['serverUpgraded', 'codeFixBought']
  },
  {
    id: 'done',
    text: () => 'Every time something fills up, ask: <strong>bigger machine, or better code?</strong> Code fixes are one-time costs; bigger machines cost more every minute. Keep an eye on <strong>disk space</strong> too. Check <strong>Goals</strong> for what\'s left.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

/**
 * Levels 3–7 follow the same shape: story → open the builder → buy the new
 * machine → place it → (extra steps) → what it does.
 */
export function newMachineSteps({ role, welcome, buy, extra = [], explain }) {
  const r = ROLES[role];
  return [
    { id: 'welcome', text: () => welcome, button: 'Show me' },
    {
      id: 'open',
      text: () => `Tap <strong>Server</strong>. It opens on the new <strong>${r.icon} ${r.short}</strong> tab.`,
      highlight: '#nav-server',
      advanceOn: 'serverBuilderOpened'
    },
    { id: 'buy', role, text: () => buy, highlight: '#nav-server', showInBuilder: true, advanceOn: 'machineBought' },
    { id: 'place', role, text: () => `Click the glowing slot to place the ${r.name.toLowerCase()}. It connects itself.`, advanceOn: 'machinePlaced' },
    ...extra,
    { id: 'explain', text: () => explain, highlight: '#nav-goals', button: 'Got it', finishAfterButton: true }
  ];
}

const LEVEL_3_STEPS = newMachineSteps({
  role: 'web',
  welcome: 'Level 3! Your designers shipped a rich new UI: every page view is <strong>~300 KB</strong> of HTML, JavaScript and images. Your app server is now busy shipping files instead of answering API calls. Give the UI <strong>its own web server</strong>.',
  buy: 'A web server only sends files: it needs little CPU but lots of <strong>network</strong>. Watch "Can handle" and the App server\'s load drop. (Closed it? Tap Server again.)',
  explain: 'Pages now come from the web server and the app server only answers small JSON API calls. Each machine can be sized for its own job. Check <strong>Goals</strong> for what\'s left.'
});

const LEVEL_4_STEPS = newMachineSteps({
  role: 'gateway',
  welcome: 'Level 4! <strong>Bots and scrapers</strong> found your API. For every real read there are 1.5 bot reads: they eat CPU and bandwidth and never pay. Put an <strong>API gateway</strong> at the front door.',
  buy: 'The gateway looks at every request (bots too), so it needs some CPU. Its <strong>rate limiting</strong> rejects clients that call too often with "429 Too Many Requests". (Closed it? Tap Server again.)',
  explain: 'Bots now bounce off the gateway before they reach your app. Watch the blocked counter in <strong>Goals</strong>, and get ready for a bot attack.'
});

const LEVEL_5_STEPS = newMachineSteps({
  role: 'lb',
  welcome: 'Level 5! You need <strong>1,500 users</strong>, and even the biggest app server can\'t handle that alone. Also, machines crash: with one app server, a crash means the site is down. Time to <strong>scale out</strong>: several app servers behind a <strong>load balancer</strong>.',
  buy: 'The load balancer spreads requests across your app servers and skips any that are down. It is light work: a small one is fine. Bigger <strong>XL parts</strong> also unlocked this level (dashed cards). (Closed it? Tap Server again.)',
  extra: [{
    id: 'add_apps',
    builderTab: 'app',
    text: () => 'Now add app servers: <strong>Server → App tab → Add app server</strong>. Each one takes a share of the requests. Aim for 3, so one can crash and two still cope.',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'appServerPlaced'
  }],
  explain: 'That\'s <strong>horizontal scaling</strong>: more machines instead of a bigger one. Need more capacity? Add another app server. Check <strong>Goals</strong>, and watch for crashes.'
});

const LEVEL_6_STEPS = newMachineSteps({
  role: 'cache',
  welcome: 'Level 6! Readers refresh constantly. You can add app servers, but there is <strong>one database</strong> and every read lands on it. Put a <strong>cache</strong> in front: popular data in memory, so most reads never reach the database.',
  buy: 'A cache is mostly <strong>RAM</strong>. Tip: caches love <strong>pagination</strong>: the same first page is read again and again. Without it, the hit rate stays low. (Closed it? Tap Server again.)',
  explain: 'Reads check the cache first; only misses reach the database. Check the <strong>hit rate</strong> and the database\'s CPU in <strong>Goals</strong>.'
});

const LEVEL_7_STEPS = newMachineSteps({
  role: 'cdn',
  welcome: 'Level 7! You\'re global: <strong>60% of users are on other continents</strong>, and every request crosses an ocean (~120 ms). No server upgrade fixes the speed of light. Put copies <strong>close to users</strong> with a <strong>CDN</strong>.',
  buy: 'A CDN serves pages and popular reads from locations near each user. With pagination about 70% of reads are answered at the edge; your servers only see the rest. (Closed it? Tap Server again.)',
  explain: 'Far-away users now get most answers from nearby. Your origin servers see far less traffic: you may even be able to shrink them. Check <strong>Goals</strong>.'
});

export const GUESTBOOK_STEPS = {
  1: LEVEL_1_STEPS,
  2: LEVEL_2_STEPS,
  3: LEVEL_3_STEPS,
  4: LEVEL_4_STEPS,
  5: LEVEL_5_STEPS,
  6: LEVEL_6_STEPS,
  7: LEVEL_7_STEPS
};

/** The new machine each level is about (for resuming after a reload). */
export const GUESTBOOK_LEVEL_ROLE = { 1: 'app', 2: 'db', 3: 'web', 4: 'gateway', 5: 'lb', 6: 'cache', 7: 'cdn' };

// The active product's walkthrough (swapped by js/products/registry.js)
let STEPS_BY_LEVEL = GUESTBOOK_STEPS;
let LEVEL_ROLE = GUESTBOOK_LEVEL_ROLE;
const EVENT_SETS = [GUESTBOOK_STEPS];

export function setTutorial({ steps, levelRole, suggestFix }) {
  STEPS_BY_LEVEL = steps;
  LEVEL_ROLE = levelRole;
  suggestedFixRule = suggestFix || guestbookSuggestedFix;
  if (!EVENT_SETS.includes(steps)) EVENT_SETS.push(steps);
}

/** Every product's step tables, so the tutorial listens for all their events. */
export function registerSteps(steps) {
  if (!EVENT_SETS.includes(steps)) EVENT_SETS.push(steps);
}

export function getSteps(level) {
  return STEPS_BY_LEVEL[level] || [];
}

/** @deprecated use getSteps(level) */
export const STEPS = LEVEL_1_STEPS;

export default class Tutorial {
  constructor(gameState) {
    this.gameState = gameState;
    this.context = null;
    this.minimized = false;
    this.listeners = [];

    const events = new Set();
    for (const table of EVENT_SETS) {
      for (const steps of Object.values(table)) {
        for (const s of steps) [].concat(s.advanceOn || []).forEach(e => events.add(e));
      }
    }
    for (const evt of events) {
      gameState.on(evt, (data) => this.handleEvent(evt, data));
    }
  }

  get steps() {
    return getSteps(this.gameState.level);
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  notify() {
    for (const cb of this.listeners) cb(this);
  }

  get state() {
    return this.gameState.tutorial;
  }

  get active() {
    return !this.state.done && this.steps.length > 0;
  }

  get step() {
    return this.steps[this.state.step] || null;
  }

  /** Skip steps whose goal is already met (e.g. after reloading a save). */
  sync() {
    const gs = this.gameState;
    if (this.state.done) return;
    const idx = id => this.steps.findIndex(s => s.id === id);
    const jump = id => { const i = idx(id); if (i >= 0 && this.state.step < i) this.state.step = i; };

    const role = LEVEL_ROLE[gs.level];
    if (role === 'app') {
      if (gs.server) jump('place');
      if (gs.isServerPlaced()) jump('go_live');
      if (gs.appLive) jump('grow');
    } else if (role) {
      const placeId = idx('place_db') >= 0 ? 'place_db' : 'place';
      if (gs.getServerConfig(role)) jump(placeId);
      if (gs.isPlaced(role)) {
        const after = this.steps[idx(placeId) + 1];
        if (after) jump(after.id);
      }
      if (idx('add_apps') >= 0 && gs.appCount() >= 2) jump(this.steps[idx('add_apps') + 1].id);
      if (idx('add_shards') >= 0 && gs.dbCount() >= 2) jump(this.steps[idx('add_shards') + 1].id);
    }
    this.autoAdvance(false);
    // The first level's "grow" step waits quietly for the first busy part
    this.minimized = role === 'app' && this.step?.id === 'grow';
  }

  /**
   * Is this step's action already done? (The player may have bought or placed
   * something before the guide asked for it, so the event it waits for already
   * happened.) Steps with a button are never skipped.
   */
  isStepDone(step) {
    if (!step || step.button) return false;
    const gs = this.gameState;
    const checks = {
      serverBought: () => Boolean(gs.server),
      serverPlaced: () => gs.isServerPlaced(),
      dbBought: () => Boolean(gs.getServerConfig('db')),
      dbPlaced: () => gs.isPlaced('db'),
      machineBought: () => Boolean(step.role && gs.getServerConfig(step.role)),
      machinePlaced: () => Boolean(step.role && gs.isPlaced(step.role)),
      codeFixBought: () => Boolean(step.fix && gs.codeFixes[step.fix]),
      appServerPlaced: () => gs.appCount() >= 2,
      dbShardPlaced: () => gs.dbCount() >= 2
    };
    const events = [].concat(step.advanceOn || []);
    if (events.some(e => checks[e]?.())) return true;
    // "Open the builder" is pointless once what it leads to is done
    if (events.includes('serverBuilderOpened')) {
      const nextStep = this.steps[this.steps.indexOf(step) + 1];
      return Boolean(nextStep && !nextStep.button && this.isStepDone(nextStep));
    }
    return false;
  }

  /** Move past every step that's already done. Returns true if it moved. */
  autoAdvance(notify = true) {
    if (!this.active) return false;
    let moved = false;
    while (this.active && this.step && this.isStepDone(this.step)) {
      if (this.state.step + 1 >= this.steps.length) { this.finish(); return true; }
      this.state.step += 1;
      moved = true;
    }
    if (moved) {
      this.context = null;
      this.minimized = false;
      this.gameState.save();
      if (notify) this.notify();
    }
    return moved;
  }

  goTo(index, context = null) {
    if (index >= this.steps.length) {
      this.finish();
      return;
    }
    this.state.step = index;
    this.context = context;
    this.minimized = false;
    this.gameState.save();
    this.notify();
  }

  next(context = null) {
    this.goTo(this.state.step + 1, context);
  }

  handleEvent(evt, data) {
    if (!this.active || !this.step) return;
    if (![].concat(this.step.advanceOn || []).includes(evt)) return;
    if (evt === 'entryWritten' && !data?.isPlayer) return;
    this.next(data);
    // The step after it may already be done too
    this.autoAdvance();
  }

  pressButton() {
    const step = this.step;
    if (!step) return;
    if (step.onButton) step.onButton(this.gameState);
    if (step.finishAfterButton) {
      this.finish();
    } else if (step.minimizeAfterButton) {
      this.minimized = true;
      this.notify();
    } else {
      this.next();
    }
  }

  skip() {
    this.gameState.appLive = true;
    this.finish();
  }

  finish() {
    this.state.done = true;
    this.minimized = false;
    this.gameState.save();
    this.notify();
  }
}
