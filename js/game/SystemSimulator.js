/**
 * SystemSimulator — how much load your traffic puts on each machine.
 *
 * Requests flow through whichever machines you have:
 *   users → CDN → API gateway → load balancer → web / app servers → cache → database
 *   (plus, for some products: an ID generator and a message queue beside the app tier)
 *
 * Every load is "base + perUser × users", so each part's user limit can be read
 * off directly. Data size matters (more records = slower scans), and so do
 * code fixes and the level's traffic (pages, bots, far-away users, click tracking).
 *
 * The level's `params` describe the product's traffic, e.g.
 *   readKind 'all'    → Guestbook: "read every entry" (responses grow with the data)
 *   readKind 'lookup' → URL shortener: find ONE row by key and redirect (tiny response)
 */

import { PART_ORDER, getOption } from '../data/serverParts.js';
import { AGENT_DEFAULTS, agentFlow, agentLoads, agentLatency, agentStatus } from './AgentSim.js';

export const READS_PER_USER = 0.2;            // default GET reads per online user per second
export const DEFAULT_WRITES_PER_USER = 0.004; // default POST writes per online user per second
export const PAGE_SIZE = 50;                  // entries per page once pagination is on

const PAGE_KB = 10;   // Level 1–2: the simple page, sent with every read
const ENTRY_KB = 1;   // one entry inside a response
const REDIRECT_KB = 0.5; // a "302 Found" response with a Location header
const BOT_BLOCK = 0.95; // share of bot traffic a rate-limiting gateway rejects
export const ARCHIVE_KEEP = 2000; // entries kept in the database once archiving is on
const BROWSER_CACHED = 0.4;  // with 301s, share of clicks the browser answers itself
const CLICK_BATCH = 50;      // click events a queue consumer folds into one database write
const COLLISION_SHARE = 0.3; // per-shard counters: share of new codes that clash
const FANOUT_WAIT_MS = 0.5;  // inline fan-out: extra ms a post waits per follower feed written
const FANOUT_WAIT_CAP = 150; // …capped (the request times out / gives up)
const MERGE_READS = 10;      // hybrid fan-out: celebrity timelines pulled per feed read, per unit of celebrityShare

export function rowsReturned(entries, fixes = {}) {
  return fixes.pagination ? Math.min(entries, PAGE_SIZE) : entries;
}

/** Fill in the level's traffic settings with defaults. */
function trafficParams(params = {}) {
  return {
    readsPerUser: READS_PER_USER,
    writesPerUser: DEFAULT_WRITES_PER_USER,
    pageViewsPerUser: 0,
    pageKB: 0,
    botShare: 0,          // bot reads per real read
    botKind: 'read',      // 'read' (scrapers) or 'write' (spammers creating records)
    spamPerUser: 0,       // bot writes per online user per second (botKind 'write')
    botMult: 1,
    globalShare: 0,
    distanceMs: 0,
    dbReadCost: 0.2,      // database CPU per read, before scanning
    readKind: 'all',
    cacheHitRate: null,   // product-specific hit rates (null = Guestbook rules)
    edgeHitRate: null,
    clickTracking: false, // every read is also an event to record (analytics)
    appCallCost: null,    // app CPU per API call (null = 0.4, or 0.3 once the UI is split off)
    // ─── File storage products (readKind 'file') ───
    readKB: 0,            // size of a download
    writeKB: 0,           // size of an upload
    recordSpace: 1,       // disk units one record takes (a file's bytes take many)
    blobSpaceMult: 40,    // blob storage holds this many times more than a server disk
    bigFileShare: 0,      // uploads over the gateway's size limit (fail unless chunked)
    dedupShare: 0.4,      // uploads that are copies of stored files (skipped with dedup)
    updateShare: 0.5,     // uploads that are edits of an existing file (delta sync sends only changes)
    devicesPerUser: 0,    // devices each user keeps in sync
    pollPerDevice: 0.2,   // "anything new?" checks per device per second without push
    listReadsPerUser: 0,  // "shared with me" / folder listings
    conflictShare: 0,     // edits that collide with someone else's edit
    publicShare: 0,       // downloads of public links (cacheable at the edge)
    unverifiedShare: 0,   // uploads marked done by the client but missing a chunk (unless verified)
    browsePerUser: 0,     // folder browsing, renames, search: metadata reads a cache can't absorb
    // ─── Fan-out (news feeds) ───
    shardIdClash: false,  // true: shards that count their own IDs hand out duplicates (needs idgen)
    fanoutPerWrite: 0,    // feed writes per real post (followers' feeds to update)
    celebrityShare: 0,    // share of posts from huge accounts
    celebrityMult: 1000,  // their fan-out is this many times bigger
    // ─── Bookings (ticketing) ───
    clashShare: 0,        // bookings that grab a seat someone else is paying for (unless seats are held)
    searchPerUser: 0,     // keyword searches per online user per second
    searchCacheHit: 0.5,  // repeated searches a cache answers
    rushPerUser: 0,       // on-sale frenzy: extra "book now!" attempts per user (a waiting room queues them)
    // ─── Analytics (ad clicks) ───
    reportPerUser: 0,     // advertiser dashboard queries per online user per second
    reportCost: 3,        // database CPU per dashboard query that scans raw events
    dupShare: 0,          // clicks that arrive twice (counted twice unless deduplicated)
    hotShare: 0,          // share of clicks on one viral ad (one hot queue partition)
    lossShare: 0,         // clicks the stream loses (restarts, late events) unless reconciled
    // ─── AI agents (readKind 'agent', see AgentSim.js) ───
    ...AGENT_DEFAULTS,
    ...params
  };
}

/**
 * Work out per-user request rates after each layer has done its job.
 * Everything here is "per online user, per second".
 */
function trafficFlow(m, entries, fixes, p, shards) {
  if (p.readKind === 'agent') return agentFlow(m, entries, fixes, p);
  const lookup = p.readKind === 'lookup';
  // 301 = "moved permanently": browsers remember it and skip you next time
  const browserCached = lookup && fixes.redirect301 ? BROWSER_CACHED : 0;
  const r = p.readsPerUser * (1 - browserCached);
  const w = p.writesPerUser;
  const R = lookup ? 1 : rowsReturned(entries, fixes);
  const splitUi = p.pageViewsPerUser > 0;
  const respKB = lookup ? REDIRECT_KB : splitUi ? 2 + ENTRY_KB * R : PAGE_KB + ENTRY_KB * R;

  const writeBots = p.botKind === 'write';
  const botsIn = writeBots ? p.spamPerUser * p.botMult : r * p.botShare * p.botMult;
  const botsPassed = m.gateway ? botsIn * (1 - BOT_BLOCK) : botsIn;
  const botReads = writeBots ? 0 : botsPassed;
  const wAll = w + (writeBots ? botsPassed : 0);         // writes reaching the app (spam included)

  const edgeHit = m.cdn ? (p.edgeHitRate ?? (fixes.pagination ? 0.7 : 0.2)) : 0; // reads the CDN answers itself
  const readsOrigin = (r + botReads) * (1 - edgeHit);     // reads reaching your servers
  const pagesOrigin = p.pageViewsPerUser * (m.cdn ? 0.02 : 1);
  const cacheHit = m.cache ? (p.cacheHitRate ?? (fixes.pagination ? 0.95 : 0.6)) : 0;
  const dbReads = readsOrigin * (1 - cacheHit);

  // New short codes: hashing needs an "is this code taken?" lookup on every
  // create (on every shard once the data is split). Codes made from unique IDs
  // (Base62) skip it, but per-shard counters clash without a global ID generator.
  const codeChecks = lookup && !fixes.base62 ? wAll * (m.idgen ? 1 : shards) : 0;
  const collisionShare = (p.shardIdClash || (lookup && fixes.base62)) && shards > 1 && !m.idgen ? COLLISION_SHARE : 0;
  const idRequests = m.idgen ? wAll * (fixes.idRanges ? 0.01 : 1) : 0;

  // Click analytics: every real redirect is an event to count
  const clicks = p.clickTracking ? r : 0;
  const clicksOrigin = clicks * (1 - edgeHit);
  const syncClickWrites = clicks && !m.queue ? clicksOrigin : 0;  // UPDATE clicks = clicks + 1, inline
  const queuedClicks = clicks && m.queue ? clicks : 0;             // edge clicks are logged to the queue too
  const batchWrites = queuedClicks / CLICK_BATCH;
  // Fan-out on write: each real post is copied into every follower's feed
  // (into the cache if there is one, else the database). Without a queue the
  // app does it inside the request; with one, workers do it in the background.
  // Hybrid fan-out skips celebrity posts and merges them in at read time.
  const fanout = p.fanoutPerWrite || 0;
  const celebTerm = fixes.hybridFanout ? 0 : p.celebrityShare * (p.celebrityMult - 1);
  const fanoutPerPost = fanout ? fanout * (1 + celebTerm) : 0;
  const fanoutWrites = w * fanoutPerPost;
  const fanoutInline = m.queue ? 0 : fanoutWrites;
  const fanoutQueued = m.queue ? fanoutWrites : 0;
  const mergeReads = fanout && fixes.hybridFanout ? readsOrigin * p.celebrityShare * MERGE_READS : 0;
  const dbWrites = wAll + syncClickWrites + batchWrites + (m.cache ? 0 : fanoutWrites);

  // ─── Files: bytes, uploads, sync, sharing ───
  const file = p.readKind === 'file';
  const dedupCut = file && fixes.dedup ? p.dedupShare : 0;
  const deltaCut = file && fixes.deltaSync ? p.updateShare * 0.8 : 0;
  // Client-side compression shrinks text-like files; photos and videos barely shrink
  const upKB = file ? p.writeKB * (1 - dedupCut) * (1 - deltaCut) * (fixes.compress ? 0.85 : 1) : 0;
  // Trusting the client's "chunk done" report leaves some files broken
  const broken = file && p.unverifiedShare && !fixes.verifyUploads ? p.unverifiedShare : 0;
  // Without direct (pre-signed) uploads, every byte passes through your servers
  const bytesViaApp = file && !(m.blob && fixes.presigned);
  // Uploads bigger than one request allows fail, unless the client sends chunks
  const tooBig = file && p.bigFileShare && !fixes.chunking ? p.bigFileShare : 0;
  // Devices ask "anything new?" unless a sync server pushes changes to them
  const polls = file ? p.devicesPerUser * (m.sync ? 0.005 : p.pollPerDevice) : 0;
  const pushes = file && m.sync ? wAll * p.devicesPerUser : 0;
  const lists = file ? p.listReadsPerUser : 0;
  const browse = file ? p.browsePerUser : 0;
  const listsDb = lists * (1 - (m.cache ? 0.85 : 0));
  const listCost = fixes.sharesTable ? 0.05 : 0.1 + entries / 3000;   // scan every file's share list
  const lostEdits = file && p.conflictShare && !fixes.versions ? wAll * p.conflictShare : 0;
  const fileEdge = file && m.cdn ? p.publicShare * 0.9 : 0;
  const fileReadsOrigin = file ? r * (1 - fileEdge) : 0;

  if (file) {
    return {
      r, w, wAll, R: 1, respKB: p.readKB, splitUi: false, lookup: false, file: true,
      botsIn, botsPassed, botReads, edgeHit: fileEdge, cacheHit,
      readsOrigin: fileReadsOrigin, pagesOrigin: 0, dbReads: fileReadsOrigin + polls + listsDb * 0,
      codeChecks: 0, collisionShare: 0, idRequests: 0,
      clicks: 0, clicksOrigin: 0, syncClickWrites: 0, queuedClicks: 0,
      fanoutPerPost: 0, fanoutWrites: 0, fanoutInline: 0, fanoutQueued: 0, mergeReads: 0, dbWrites: wAll * (fixes.versions ? 1.3 : 1),
      upKB, bytesViaApp, tooBig, polls, pushes, lists, listsDb, listCost, lostEdits, dedupCut, broken, browse,
      apiOrigin: fileReadsOrigin + wAll + polls + lists,
      apiIn: fileReadsOrigin + wAll + polls + lists
    };
  }

  // ─── Bookings ───
  // Without seat holds, two people can buy the same seat: one of them pays and loses it
  const clashShare = p.clashShare && !fixes.holds ? p.clashShare : 0;
  const holdWrites = p.clashShare && fixes.holds ? w * 0.5 : 0;       // reserve, then confirm
  const searches = p.searchPerUser * (1 - edgeHit);
  const searchesDb = searches * (m.cache ? 1 - p.searchCacheHit : 1);
  const searchCost = fixes.searchIndex ? 0.08 : 0.5 + entries / 2000;  // LIKE '%…%' scans every event
  // On-sale frenzy: without a waiting room every attempt hits the booking path
  const rush = p.rushPerUser || 0;
  const rushQueued = m.queue ? rush : 0;
  const rushDirect = m.queue ? 0 : rush;
  // ─── Analytics ───
  const reports = p.reportPerUser || 0;
  const rollups = Boolean(fixes.rollups && m.queue);
  const reportDbCost = rollups ? 0.05 : p.reportCost;
  const streamWork = rollups ? queuedClicks : 0;                        // windowed counts per minute
  const deduped = Boolean(fixes.dedupIds && m.cache);
  const dupCount = clicks && p.dupShare && !deduped ? p.dupShare : 0;   // share of extra (double) counts
  const dedupLookups = deduped ? clicks : 0;
  const hotMult = m.queue && p.hotShare && !fixes.saltKeys ? 1 + p.hotShare * 60 : 1;
  const reconciled = Boolean(fixes.reconcile && m.blob);
  const lostClicks = clicks && p.lossShare && !reconciled ? p.lossShare : 0;
  const archived = m.blob ? clicks : 0;                                  // raw events copied to the data lake

  return {
    r, w, wAll, R, respKB, splitUi, lookup,
    clashShare, holdWrites, searches, searchesDb, searchCost, rush, rushQueued, rushDirect,
    reports, reportDbCost, rollups, streamWork, dupCount, dedupLookups, hotMult, lostClicks, archived,
    botsIn, botsPassed, botReads, edgeHit, cacheHit,
    readsOrigin, pagesOrigin, dbReads: dbReads + mergeReads * (1 - cacheHit),
    codeChecks, collisionShare, idRequests,
    clicks, clicksOrigin, syncClickWrites, queuedClicks, dbWrites: dbWrites + holdWrites,
    fanoutPerPost, fanoutWrites, fanoutInline, fanoutQueued, mergeReads,
    apiOrigin: readsOrigin + wAll + searches + rushDirect + reports,
    apiIn: (r + (writeBots ? 0 : botsIn)) * (1 - edgeHit) + w + (writeBots ? botsIn : 0) + searches + rush + reports
  };
}

/** Per-part load ({ base, perUser }) for every machine you have. */
function buildLoads(m, appCount, shards, entries, fixes, p, f) {
  if (f.agent) return agentLoads(m, appCount, shards, fixes, p, f);
  const N = Math.max(1, appCount);
  const S = Math.max(1, shards);
  const rowsPerShard = entries / S;
  const scanCpu = fixes.index ? 0.05 : rowsPerShard / 1000;       // full table scan without an index
  const diskPerRead = fixes.index ? 0.1 : 0.25 + rowsPerShard / 4000;
  const diskPerWrite = 1 + (fixes.index ? 0.2 : 0);          // the index must be updated too
  const clickCpu = f.syncClickWrites * 0.1 + (m.queue ? f.clicksOrigin * 0.02 : 0); // app work per click
  const writeKB = f.lookup ? 1 : 1;
  // Searches, "book now!" attempts (seat-lock checks) and dashboard queries the database answers
  const extraDb = f.file ? { cpu: 0, storage: 0, network: 0 } : {
    cpu: (f.searchesDb || 0) * f.searchCost + (f.rushDirect || 0) * 1.5 + (f.reports || 0) * f.reportDbCost,
    storage: (f.searchesDb || 0) * (fixes.searchIndex ? 0.1 : 0.5 + entries / 4000) + (f.rushDirect || 0) * 0.3 + (f.reports || 0) * (f.rollups ? 0.05 : 1),
    network: (f.searchesDb || 0) * 2 + (f.rushDirect || 0) * 0.5 + (f.reports || 0) * 2
  };
  const loads = {};

  if (f.file) {
    // Bytes moved per user per second, and whether your servers carry them
    const bytes = f.readsOrigin * p.readKB + f.wAll * f.upKB;
    const via = f.bytesViaApp ? bytes : 0;
    const call = p.appCallCost ?? 0.3;
    if (!m.db) {
      // One machine: code, metadata AND the files' bytes on its own disk
      loads.app = {
        cpu: { base: 0, perUser: f.apiOrigin * call + bytes / 1500 + f.lists * f.listCost },
        ram: { base: 400, perUser: 12 },
        storage: { base: 0, perUser: f.readsOrigin * (0.2 + p.readKB / 2000) + f.wAll * (1 + f.upKB / 1000) + f.polls * 0.05 },
        network: { base: 0, perUser: bytes + f.polls * 0.5 + f.lists * 2 }
      };
    } else {
      loads.app = {
        cpu: { base: 0, perUser: (f.apiOrigin * call + f.browse * 0.1 + via / 1500) / N },
        ram: { base: 300, perUser: 1.5 / N }, // stateless: signs links, keeps no sessions
        storage: { base: 0, perUser: f.apiOrigin * 0.01 / N },
        network: { base: 0, perUser: (via + (f.readsOrigin + f.wAll) * 0.5 + f.polls * 0.5 + f.lists * 2) / N }
      };
      // Metadata only: file rows, share lists, "what changed since…" checks
      loads.db = {
        cpu: { base: 0, perUser: ((f.readsOrigin + f.polls + f.browse) * (p.dbReadCost + scanCpu) + f.listsDb * f.listCost + f.dbWrites * 0.3) / S },
        ram: { base: 300 + 300 * N, perUser: 0 },
        storage: { base: 0, perUser: ((f.readsOrigin + f.polls + f.browse) * diskPerRead + f.listsDb * 0.3 + f.dbWrites * diskPerWrite) / S },
        network: { base: 0, perUser: (f.readsOrigin + f.polls + f.listsDb * 3 + f.dbWrites) / S }
      };
    }
    if (m.blob) {
      // Object storage: cheap, huge, slow-ish per request, lots of bandwidth
      loads.blob = {
        cpu: { base: 0, perUser: (f.readsOrigin + f.wAll) * 0.03 + (fixes.verifyUploads ? f.wAll * 0.05 : 0) },
        ram: { base: 300, perUser: 0 },
        storage: { base: 0, perUser: f.readsOrigin * p.readKB / 8000 + f.wAll * f.upKB / 4000 },
        network: { base: 0, perUser: bytes }
      };
    }
    if (m.sync) {
      // One open connection per device: RAM grows with devices online, busy or not
      loads.sync = {
        cpu: { base: 0, perUser: f.pushes * 0.02 + p.devicesPerUser * 0.002 },
        ram: { base: 300, perUser: p.devicesPerUser * 0.3 },
        storage: { base: 0, perUser: 0 },
        network: { base: 0, perUser: f.pushes * 0.5 + p.devicesPerUser * 0.05 }
      };
    }
  } else if (!m.db) {
    // One machine does everything
    loads.app = {
      cpu: { base: 0, perUser: f.readsOrigin * (1 + scanCpu) + f.codeChecks * (1 + scanCpu) + f.wAll + f.syncClickWrites * 0.5 + f.pagesOrigin + f.fanoutWrites * 0.1 + extraDb.cpu + (f.rushDirect || 0) * 0.6 },
      ram: { base: 400, perUser: 15 },
      storage: { base: 0, perUser: (f.readsOrigin + f.codeChecks) * diskPerRead + (f.wAll + f.syncClickWrites + f.fanoutWrites * 0.3 + (f.holdWrites || 0)) * diskPerWrite + f.pagesOrigin * 0.05 + extraDb.storage },
      network: { base: 0, perUser: f.readsOrigin * f.respKB + f.wAll * writeKB + f.pagesOrigin * p.pageKB + extraDb.network }
    };
  } else {
    const appPages = m.web ? 0 : f.pagesOrigin; // without a web server, the app serves the UI too
    // Load on EACH app server (the load balancer splits it N ways)
    loads.app = {
      // A JSON API call (Level 3+) is lighter than building a whole page
      cpu: { base: 0, perUser: (f.apiOrigin * (p.appCallCost ?? (f.splitUi ? 0.3 : 0.4)) + appPages + clickCpu + f.fanoutInline * 0.1 + (f.dedupLookups || 0) * 0.02) / N },
      ram: { base: 300, perUser: 5 / N },
      storage: { base: 0, perUser: (f.apiOrigin * 0.02 + appPages * 0.05) / N },
      network: { base: 0, perUser: (f.readsOrigin * f.respKB + f.wAll + appPages * p.pageKB + f.fanoutInline * 0.1) / N }
    };
    // Load on EACH database shard (rows and requests are split S ways)
    const dbLookups = f.dbReads + f.codeChecks;
    loads.db = {
      cpu: { base: 0, perUser: (dbLookups * (p.dbReadCost + scanCpu) + f.dbWrites * (0.3 + (fixes.index ? 0.05 : 0)) + extraDb.cpu) / S },
      ram: { base: 300 + 300 * N, perUser: 0 }, // a connection pool per app server
      storage: { base: 0, perUser: (dbLookups * diskPerRead + f.dbWrites * diskPerWrite + extraDb.storage) / S },
      network: { base: 0, perUser: (f.dbReads * (1 + ENTRY_KB * f.R) + f.codeChecks + f.dbWrites + extraDb.network) / S }
    };
  }

  if (m.blob && !f.file) {
    // Data lake: raw events archived in big files for batch jobs (reconciliation)
    loads.blob = {
      cpu: { base: 0, perUser: f.archived * 0.004 + (fixes.reconcile ? f.archived * 0.004 : 0) },
      ram: { base: 300, perUser: 0 },
      storage: { base: 0, perUser: f.archived * 0.004 },
      network: { base: 0, perUser: f.archived * 0.1 }
    };
  }
  if (m.web) {
    loads.web = {
      cpu: { base: 0, perUser: f.pagesOrigin * 0.2 },
      ram: { base: 200, perUser: f.pagesOrigin * 30 }, // open connections downloading pages
      storage: { base: 0, perUser: f.pagesOrigin * 0.05 },
      network: { base: 0, perUser: f.pagesOrigin * p.pageKB }
    };
  }
  if (m.gateway) {
    loads.gateway = {
      cpu: { base: 0, perUser: f.apiIn * 0.03 },  // it has to look at every request, bots included
      ram: { base: 200, perUser: 0.5 },
      storage: { base: 0, perUser: f.apiIn * 0.01 },
      network: { base: 0, perUser: f.file ? (f.bytesViaApp ? f.readsOrigin * p.readKB + f.wAll * f.upKB : 0) + f.apiIn * 0.5 : f.readsOrigin * f.respKB + f.wAll }
    };
  }
  if (m.lb) {
    loads.lb = {
      cpu: { base: 0, perUser: f.apiOrigin * 0.02 },
      ram: { base: 200, perUser: 0.5 },
      storage: { base: 0, perUser: f.apiOrigin * 0.01 },
      network: { base: 0, perUser: f.file ? (f.bytesViaApp ? f.readsOrigin * p.readKB + f.wAll * f.upKB : 0) + f.apiOrigin * 0.5 : f.readsOrigin * f.respKB + f.wAll }
    };
  }
  if (m.cache) {
    loads.cache = f.file ? {
      // Share lists and folder listings
      cpu: { base: 0, perUser: f.lists * 0.03 + f.w * 0.02 },
      ram: { base: 500, perUser: 0.3 },
      storage: { base: 0, perUser: 0 },
      network: { base: 0, perUser: f.lists * 3 }
    } : {
      // writes invalidate cached pages; fan-out pushes post IDs into feed lists
      // searches are cached by their parameters; dedup checks "seen this impression ID?"
      cpu: { base: 0, perUser: f.readsOrigin * 0.03 + f.w * 0.02 + f.fanoutWrites * 0.01 + f.mergeReads * 0.01 + (f.searches || 0) * 0.03 + (f.dedupLookups || 0) * 0.03 },
      ram: { base: 500, perUser: 0.2 + (f.dedupLookups || 0) * 2 }, // the hot entries, plus a little per user
      storage: { base: 0, perUser: 0 },
      network: { base: 0, perUser: f.readsOrigin * f.cacheHit * f.respKB + f.fanoutWrites * 0.1 + f.mergeReads * 0.5 + (f.searches || 0) * 2 + (f.dedupLookups || 0) * 0.2 }
    };
  }
  if (m.cdn) {
    const edgeReads = f.file ? f.r * f.edgeHit : (f.r + f.botReads) * f.edgeHit;
    const edgePages = p.pageViewsPerUser - f.pagesOrigin;
    loads.cdn = {
      cpu: { base: 0, perUser: (edgeReads + edgePages) * 0.02 },
      ram: { base: 200, perUser: 0.5 },
      storage: { base: 0, perUser: (edgeReads + edgePages) * 0.01 },
      network: { base: 0, perUser: edgeReads * f.respKB + edgePages * p.pageKB }
    };
  }
  if (m.idgen) {
    // Every new short code asks for the next unique number (or a block of 1,000)
    loads.idgen = {
      cpu: { base: 0, perUser: f.idRequests * 0.25 },
      ram: { base: 150, perUser: 0 },
      storage: { base: 0, perUser: f.idRequests * 0.1 }, // the counter is saved so it never goes back
      network: { base: 0, perUser: f.idRequests * 0.2 }
    };
  }
  if (m.queue) {
    // Click events are appended to a log and read by a consumer in batches
    loads.queue = {
      // Fan-out jobs too: workers copy each post into its followers' feeds
      // A viral ad sends most clicks to ONE partition (hotMult); stream aggregation adds work per click;
      // a waiting room keeps every queued fan in line and tells them their place
      cpu: { base: 0, perUser: (f.queuedClicks * 0.012 + (f.streamWork || 0) * 0.006) * (f.hotMult || 1) + f.fanoutQueued * 0.004 + (f.rushQueued || 0) * 0.01 },
      ram: { base: 400, perUser: f.queuedClicks * 1 + f.fanoutQueued * 0.2 + (f.rushQueued || 0) * 0.3 },
      storage: { base: 0, perUser: f.queuedClicks * 0.02 + f.fanoutQueued * 0.005 + (f.rushQueued || 0) * 0.005 }, // sequential appends are cheap
      network: { base: 0, perUser: f.queuedClicks * 0.6 + f.fanoutQueued * 0.1 + (f.rushQueued || 0) * 0.2 }
    };
  }
  return loads;
}

/**
 * Full picture of the system.
 * state: {
 *   machines: { app, db, web, gateway, lb, cache, cdn, idgen, queue }  (configs; missing = none)
 *   appCount, crashed (app servers currently down), dbCount (shards), users, entries, fixes,
 *   params: the level's traffic settings
 * }
 * Older shape { app, db, writesPerUser } is still accepted.
 */
export function simulateSystem(state) {
  const m = state.machines || { app: state.app, db: state.db || null };
  const params = trafficParams(state.params || { writesPerUser: state.writesPerUser ?? DEFAULT_WRITES_PER_USER });
  const users = state.users || 0;
  const fixes = state.fixes || {};
  // With archiving / expiry, only the newest entries stay in the database; older
  // ones move to cheap cold storage, so reads, scans and disk space stop growing
  const totalEntries = state.entries || 0;
  const entries = fixes.archive || fixes.expiry ? Math.min(totalEntries, params.keepRecords || ARCHIVE_KEEP) : totalEntries;
  const appCount = state.appCount || 1;
  const shards = m.db ? Math.max(1, state.dbCount || 1) : 1;
  const up = Math.max(0, appCount - (state.crashed || 0)); // app servers still running

  const f = trafficFlow(m, entries, fixes, params, shards);
  const loads = buildLoads(m, up, shards, entries, fixes, params, f);

  const servers = {};
  let bottleneck = null;
  let busiest = null;
  for (const role of Object.keys(loads)) {
    const usage = {};
    const limits = {};
    for (const partId of PART_ORDER) {
      const cap = getOption(partId, m[role]?.[partId])?.capacity || 0;
      const { base, perUser } = loads[role][partId];
      usage[partId] = cap ? (base + perUser * users) / cap : 0;
      // A fixed load bigger than the part (e.g. one DB connection pool per app server
      // overflowing RAM) means no users fit at all
      limits[partId] = perUser > 0 ? Math.max(0, Math.floor((cap - base) / perUser)) : base > cap ? 0 : Infinity;
      if (!bottleneck || limits[partId] < bottleneck.limit) bottleneck = { role, part: partId, limit: limits[partId] };
      if (!busiest || usage[partId] > busiest.usage) busiest = { role, part: partId, usage: usage[partId] };
    }
    servers[role] = { usage, limits };
  }
  const peak = busiest.usage;
  const appDown = up === 0;

  // Disk space: whichever machine holds the data (every shard adds its disk)
  const dataRole = f.file && m.blob ? 'blob' : m.db ? 'db' : 'app';
  const space = f.file && m.blob
    ? (getOption('storage', m.blob.storage)?.space || 0) * params.blobSpaceMult
    : (getOption('storage', m[dataRole]?.storage)?.space || 0) * (dataRole === 'db' ? shards : 1);
  // Files take many disk units each (their bytes); dedup and versions change that
  const used = f.file
    ? entries * params.recordSpace * (1 - (fixes.dedup ? params.dedupShare : 0)) * (fixes.versions ? 1.3 : 1)
    : entries;
  const diskFull = space > 0 && used >= space;

  // Latency: network hops + time to find the rows + queueing + distance
  const queryMs = fixes.index ? 1 : entries / shards / 50;
  const dbShare = f.readsOrigin > 0 ? f.dbReads / f.readsOrigin : 1;
  const hops = (m.db ? 2 : 0) + (m.gateway ? 2 : 0) + (m.lb ? 1 : 0) + (m.cache ? 1 : 0);
  const distance = params.globalShare * params.distanceMs * (1 - f.edgeHit);
  // Writing a click inline makes every redirect wait for a database write
  const clickWaitMs = f.syncClickWrites > 0 ? 4 : 0;
  // Inline fan-out: a post waits until every follower's feed is written;
  // hybrid fan-out: each feed read merges in celebrity posts
  const fanoutMs = (f.fanoutInline > 0 ? Math.min(FANOUT_WAIT_CAP, f.fanoutPerPost * FANOUT_WAIT_MS) : 0) + (f.mergeReads > 0 ? 3 : 0);
  const fileMs = f.file ? (f.bytesViaApp && m.blob ? 12 : 0) + (fixes.coldTier ? 5 : 0) + (fixes.compress ? 6 : 0) : 0;
  // Searches and dashboard queries: slow scans unless indexed / pre-aggregated
  const apiAll = Math.max(1e-9, f.apiOrigin || 0);
  const searchMs = f.searches ? (fixes.searchIndex ? 2 : Math.min(400, 5 + entries / 40)) * (f.searches / apiAll) * 4 : 0;
  const reportMs = f.reports ? (f.rollups ? 2 : 100 * f.reportDbCost) * Math.min(1, (f.reports / apiAll) * 20) : 0;
  const latency = f.agent ? agentLatency(f, peak) : Math.round(20 + hops + queryMs * dbShare + clickWaitMs + fileMs + fanoutMs + searchMs + reportMs + Math.max(0, peak - 0.7) * 400 + distance);

  // Errors: overloaded parts drop requests (out of RAM is worst); a full disk
  // fails every write; clashing short codes break new links; with every app
  // server down, everything fails
  const writeShare = f.wAll / Math.max(1e-9, f.r + f.wAll);
  let errorRate = 0.002;
  if (peak > 1) errorRate = (peak - 1) * (busiest.part === 'ram' ? 3 : 1.5);
  if (diskFull) errorRate += writeShare;
  errorRate += f.collisionShare * writeShare;
  if (f.clashShare) errorRate += f.clashShare * writeShare;
  if (f.tooBig) errorRate += f.tooBig * writeShare;
  // Broken files fail when someone downloads them
  if (f.broken) errorRate += f.broken * (1 - writeShare) * 0.5;
  // AI agents: prompt-injection attacks that get through make bad answers / actions
  if (f.agent) errorRate += f.harmShare;
  if (appDown) errorRate = 0.95;
  errorRate = Math.min(0.95, errorRate);

  return {
    servers,
    // Level 1 shape: the app server's view
    usage: servers.app.usage,
    limits: servers.app.limits,
    userLimit: appDown ? 0 : bottleneck.limit,
    bottleneck: bottleneck.part,
    bottleneckRole: bottleneck.role,
    busiest: busiest.part,
    busiestRole: busiest.role,
    peak,
    appCount,
    appsUp: up,
    appDown,
    dbCount: shards,
    reqPerSec: Math.round(users * (f.r + f.w + f.botsIn) * 10) / 10,
    readsPerSec: users * f.r,
    writesPerSec: users * f.w,
    pagesPerSec: users * params.pageViewsPerUser,
    botsPerSec: users * f.botsIn,
    botsBlockedPerSec: users * (f.botsIn - f.botsPassed) * (params.botKind === 'write' ? 1 : (1 - f.edgeHit)),
    clicksPerSec: users * f.clicks,
    // New records stored per second (spam that gets through is stored too)
    recordsPerSec: users * f.wAll,
    brokenPerSec: users * f.wAll * f.collisionShare,
    collisionShare: f.collisionShare,
    // Share of real clicks your analytics actually sees
    clickAccuracy: params.clickTracking ? Math.max(0, (1 - (fixes.redirect301 ? BROWSER_CACHED : 0)) * (1 - errorRate) * (1 - (f.lostClicks || 0)) - (f.dupCount || 0)) : null,
    // Bookings: share that clash over one seat, searches, on-sale attempts, dashboard queries
    clashShare: f.clashShare || 0,
    clashPerSec: users * f.w * (f.clashShare || 0),
    searchesPerSec: users * (f.searches || 0),
    rushPerSec: users * (f.rush || 0),
    rushQueuedPerSec: users * (f.rushQueued || 0),
    reportsPerSec: users * (f.reports || 0),
    dupClickShare: f.dupCount || 0,
    lostClickShare: f.lostClicks || 0,
    searchMs, reportMs,
    cacheHit: f.cacheHit,
    edgeHit: f.edgeHit,
    rowsReturned: f.R,
    responseKB: f.respKB,
    queryMs,
    distanceMs: distance,
    latency,
    errorRate,
    space: { used: Math.round(used), capacity: space, pct: space ? used / space : 0, role: dataRole },
    // File storage
    uploadFailShare: f.tooBig || 0,
    brokenFilesPerSec: users * (f.file ? f.wAll * (f.broken || 0) : 0),
    lostEditsPerSec: users * (f.lostEdits || 0),
    editsPerSec: users * (f.file ? f.wAll * (params.updateShare || 0) : 0),
    syncDelaySec: f.file && params.devicesPerUser ? (m.sync ? 1 : Math.round(1 / params.pollPerDevice)) : 0,
    pollsPerSec: users * (f.polls || 0),
    listsPerSec: users * (f.lists || 0),
    browsePerSec: users * (f.browse || 0),
    uploadMBPerSec: users * (f.file ? f.wAll * f.upKB / 1000 : 0),
    bytesViaApp: Boolean(f.bytesViaApp),
    // Fan-out: feed writes per second, and how fast the queue's backlog grows
    // (+) or drains (−) when its CPU can't keep up
    fanoutPerSec: users * (f.fanoutWrites || 0),
    fanoutBacklogRate: fanoutBacklogRate(f, servers, users),
    fanoutMs,
    diskFull,
    ...(f.agent ? agentStatus(f, users, Math.min(0.95, errorRate)) : {}),
    // Requests per second along each part of the path (for the animated diagram)
    flows: {
      reads: users * f.r,                 // real users reading
      writes: users * f.w,                // real users writing
      pages: users * params.pageViewsPerUser,
      botsIn: users * f.botsIn,           // bot requests arriving
      botsPassed: users * f.botsPassed,   // bot requests the gateway let through
      botKind: params.botKind,
      edgeHit: f.edgeHit,                 // share of reads the CDN answers
      cacheHit: f.cacheHit,               // share of reads the cache answers
      readsOrigin: users * f.readsOrigin, // reads reaching your servers
      pagesOrigin: users * f.pagesOrigin, // page views reaching the web/app server
      apiOrigin: users * f.apiOrigin,     // API calls reaching the app servers
      dbReads: users * (f.dbReads + f.codeChecks + (f.searchesDb || 0) + (f.rushDirect || 0) + (f.reports || 0)), // lookups reaching the database
      dbWrites: users * f.dbWrites,       // writes reaching the database
      idRequests: users * f.idRequests,   // calls to the ID generator
      queued: users * (f.queuedClicks + (f.rushQueued || 0)),     // click events into the queue
      batchWrites: users * f.queuedClicks / CLICK_BATCH,
      collisionShare: f.collisionShare,
      file: Boolean(f.file),
      bytesViaApp: Boolean(f.bytesViaApp),
      blobIn: users * (f.file ? f.readsOrigin + f.wAll : (f.archived || 0)),
      polls: users * (f.polls || 0),
      pushes: users * (f.pushes || 0),
      devices: users * (params.devicesPerUser || 0),
      fanout: users * (f.fanoutWrites || 0),   // feed writes (inline or via the queue)
      fanoutQueued: users * (f.fanoutQueued || 0),
      // AI agents
      agent: Boolean(f.agent),
      llmCalls: users * (f.allCalls || 0),
      toolCalls: users * (f.toolCalls || 0),
      kbSearches: users * (f.kbSearches || 0),
      attacks: users * (f.attacks || 0),
      research: users * (f.research || 0),
      asked: users * (f.asked || 0),                 // questions asked (before the semantic cache)
      chatCalls: users * (f.calls || 0),             // model calls for chat answers
      researchCalls: users * (f.researchCalls || 0)  // model calls for big jobs
    }
  };
}

/** Queued fan-out jobs per second the workers fall behind (+) or could catch up (−). */
function fanoutBacklogRate(f, servers, users) {
  const queued = users * (f.fanoutQueued || 0);
  const u = servers.queue?.usage?.cpu || 0;
  if (!queued || !u) return 0;
  return u > 1 ? queued * (1 - 1 / u) : -queued * (1 / u - 1);
}

/** Users one option of one part could handle (for the builder cards). */
export function limitForOption(state, role, partId, optionId) {
  const base = state.machines || { app: state.app, db: state.db || null };
  const machines = { ...base, [role]: { ...(base[role] || base.app), [partId]: optionId } };
  const sim = simulateSystem({ ...state, machines });
  return sim.servers[role]?.limits[partId] ?? 0;
}
