/**
 * TrafficSpikes — incidents that hit every so often:
 *   spike: traffic suddenly jumps (every level)
 *   bots:  a scraper attack multiplies bot traffic (levels with bots)
 *   crash: one app server goes down for a while (levels with crashes)
 * Handle it (under 5% failed requests) and you earn or keep your money;
 * fail and requests error, money is lost, users leave and reputation drops.
 */

export const GUESTBOOK_INCIDENTS = {
  spike: [
    { name: 'Shared on a forum', story: 'Someone posted your Guestbook on a popular forum.', mult: 1.5 },
    { name: 'Influencer mention', story: 'An influencer told their followers to sign your Guestbook.', mult: 1.8 },
    { name: 'Front page!', story: 'Your Guestbook hit the front page of a news site.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Scraper attack', story: 'A scraper network is hammering your API to copy every entry.', mult: 3 },
    { name: 'Bot swarm', story: 'Thousands of bots are calling GET /api/entries in a loop.', mult: 4 }
  ],
  crash: [
    { name: 'App server crashed', story: 'One of your app servers ran out of memory and crashed. It is restarting.', crashed: 1 },
    { name: 'Hardware failure', story: 'A disk died in one of your app servers. It is being replaced.', crashed: 1 }
  ]
};

// The active product's incident stories (swapped by js/products/registry.js)
let INCIDENTS = GUESTBOOK_INCIDENTS;
export function setIncidents(incidents) {
  INCIDENTS = incidents;
}

const DURATION = { spike: 20, bots: 20, crash: 30 };
const HANDLED_KEY = { spike: 'spikeHandled', bots: 'botsHandled', crash: 'crashHandled' };
const FIRST_AFTER = 120; // seconds of live time before the first incident
const MIN_GAP = 75;
const MAX_GAP = 140;
const HANDLED_ERROR_LIMIT = 0.05; // under 5% failed requests counts as handled

export default class TrafficSpikes {
  constructor(gameState) {
    this.gameState = gameState;
  }

  /** Which kinds of incident can happen at this level. */
  kinds() {
    const L = this.gameState.levelDef();
    const kinds = ['spike'];
    if (L.botShare) kinds.push('bots');
    if (L.crashes) kinds.push('crash');
    return kinds;
  }

  /** Prefer kinds the player hasn't handled yet this level, so each one shows up. */
  pickKind() {
    const gs = this.gameState;
    const pool = [];
    for (const kind of this.kinds()) {
      const weight = gs.achievements[HANDLED_KEY[kind]] ? 1 : 3;
      for (let i = 0; i < weight; i++) pool.push(kind);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Advance incidents by `seconds`. Returns { started, ended } so the UI can react. */
  tick(seconds) {
    const gs = this.gameState;
    const result = { started: null, ended: null };
    if (!gs.appLive || !gs.isServerPlaced() || gs.users <= 0) return result;

    if (gs.spike) {
      const s = gs.spike;
      s.secondsLeft -= seconds;
      s.ticks += 1;
      s.errorSum += gs.metrics?.errorRate || 0;
      if (s.secondsLeft <= 0) {
        const avgError = s.errorSum / Math.max(1, s.ticks);
        const handled = avgError < HANDLED_ERROR_LIMIT;
        result.ended = { ...s, avgError, handled };
        if (handled) gs.achievements[HANDLED_KEY[s.kind]] = true;
        gs.spike = null;
        gs.nextSpikeIn = MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
        gs.recalculateMetrics();
      }
      return result;
    }

    if (gs.nextSpikeIn == null) gs.nextSpikeIn = FIRST_AFTER;
    gs.nextSpikeIn -= seconds;
    if (gs.nextSpikeIn <= 0) {
      const kind = this.pickKind();
      const pool = INCIDENTS[kind].filter(t => !t.minUsers || gs.users >= t.minUsers);
      const type = { ...pool[Math.floor(Math.random() * pool.length)] };
      // Some levels use gentler spikes (Level 1: +20–40%)
      const range = gs.levelDef().spikeRange;
      if (kind === 'spike' && range) {
        type.mult = Math.round((range[0] + Math.random() * (range[1] - range[0])) * 10) / 10;
      }
      gs.spike = {
        kind,
        ...type,
        secondsLeft: DURATION[kind],
        duration: DURATION[kind],
        ticks: 0,
        errorSum: 0,
        revenue: 0,
        lost: 0,
        usersLost: 0
      };
      gs.nextSpikeIn = null;
      gs.recalculateMetrics();
      result.started = gs.spike;
    }
    return result;
  }
}
