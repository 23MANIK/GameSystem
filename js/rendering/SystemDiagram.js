/**
 * SystemDiagram — the system drawn like an architecture diagram.
 *
 *   Clients → Edge → Front door → App tier → Data tier
 *   (users)   (CDN)  (gateway, LB) (app servers, web server above) (cache, database)
 *
 * Layers (back to front): tier boxes, SVG arrows, a canvas of moving requests,
 * then machine cards. Requests are dots that travel along the arrows:
 *   - speed follows latency (slow system = slow dots)
 *   - an overloaded machine makes dots queue up at its entrance; ones that
 *     wait too long time out, turn red and fall off the path
 *   - failed requests turn red and drop
 *   - bots are purple and bounce off the gateway ("429")
 *   - cache / CDN hits turn back early, so fewer dots reach the database
 *   - some products add an ID generator (above the app tier) and a message
 *     queue (below it); database shards show as one stacked card
 */

import { ROLES, CLOUD_EQUIVALENTS } from '../data/roles.js';
import { getOption, PART_ORDER, SERVER_PARTS, runningCostPerMinute } from '../data/serverParts.js';
import { infoButton } from '../ui/InfoTips.js';

const COLORS = {
  read: '#06d6a0',
  write: '#fbbf24',
  page: '#60a5fa',
  bot: '#c084fc',
  fail: '#ef4444',
  hit: '#34d399',
  event: '#f472b6',
  resp: '#e2e8f0'
};

// Each kind of request has its own shape, so they read without colour too
const SHAPES = { read: 'circle', hit: 'circle', write: 'square', page: 'doc', bot: 'triangle', event: 'diamond', fail: 'cross', resp: 'ring' };

/** Draw one request at (x, y) in its shape. r ≈ radius. */
function drawShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  switch (shape) {
    case 'square':
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'doc':
      ctx.roundRect ? ctx.roundRect(x - r * 1.2, y - r * 0.8, r * 2.4, r * 1.6, 1.5) : ctx.rect(x - r * 1.2, y - r * 0.8, r * 2.4, r * 1.6);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.05, y + r * 0.8);
      ctx.lineTo(x - r * 1.05, y + r * 0.8);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.0, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.0, y);
      ctx.closePath();
      break;
    case 'ring':
      ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
      return;
    case 'cross':
      ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
      return;
    default:
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** A small SVG of a shape, for the legend. */
function shapeIcon(shape, color) {
  const body = {
    circle: '<circle cx="6" cy="6" r="4"/>',
    square: '<rect x="2.2" y="2.2" width="7.6" height="7.6"/>',
    doc: '<rect x="1" y="3" width="10" height="6.5" rx="1"/>',
    triangle: '<path d="M6 1.5 L10.5 10 L1.5 10 Z"/>',
    diamond: '<path d="M6 1 L10.5 6 L6 11 L1.5 6 Z"/>',
    cross: '<path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="' + color + '" stroke-width="2" fill="none"/>',
    ring: '<circle cx="6" cy="6" r="3.6" stroke="' + color + '" stroke-width="1.6" fill="none"/>'
  }[shape];
  return `<svg viewBox="0 0 12 12" width="11" height="11" fill="${color}" aria-hidden="true">${body}</svg>`;
}

const BACK_GAP = 17;       // px between a request lane and its response lane
const QUEUE_GAP = 0.035;   // spacing between queued dots (fraction of the arrow)
const QUEUE_MAX = 10;      // dots that fit in a queue before the rest time out
const BASE_TRIP = 1.5;     // seconds for a dot to cross an arrow on a healthy system

function fmtRate(r) {
  if (r >= 1000) return `${(r / 1000).toFixed(1)}k/s`;
  if (r >= 10) return `${Math.round(r)}/s`;
  if (r >= 1) return `${r.toFixed(1)}/s`;
  if (r > 0) return `${(r * 60).toFixed(0)}/min`;
  return '0/s';
}

function peakOf(status, role) {
  const usage = status?.servers?.[role]?.usage;
  return usage ? Math.max(...Object.values(usage)) : 0;
}

/**
 * The part of a machine closest to (or past) its limit, for the bar on its card:
 * CPU, RAM, disk speed, network, or disk space on the machine that holds the data.
 */
function worstOf(status, role) {
  const usage = status?.servers?.[role]?.usage || {};
  let worst = { value: 0, label: '', part: null };
  for (const partId of PART_ORDER) {
    const v = usage[partId] || 0;
    if (v > worst.value) worst = { value: v, label: SERVER_PARTS[partId].short, part: partId };
  }
  const space = status?.space;
  if (space && space.role === role && space.capacity > 0) {
    const v = status.diskFull ? Math.max(1, space.pct) : space.pct;
    if (v >= worst.value) worst = { value: v, label: 'Space', part: 'space' };
  }
  return worst;
}

/** Point on a horizontal-ish cubic curve between a and b (t in 0..1). */
function curvePoint(e, t) {
  const { x1, y1, x2, y2, cx1, cy1, cx2, cy2 } = e;
  const u = 1 - t;
  return {
    x: u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2,
    y: u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2
  };
}

export default class SystemDiagram {
  /**
   * @param {HTMLElement} container  the game world element
   * @param {object} gameState
   * @param {{ onNodeClick?: Function, onSlotClick?: Function }} handlers
   */
  constructor(container, gameState, handlers = {}) {
    this.container = container;
    this.gameState = gameState;
    this.handlers = handlers;
    this.slotRole = null;         // a machine waiting to be placed
    this.structureKey = '';
    this.nodes = {};              // id -> { el, x, y, w, h, role }
    this.edges = [];              // { id, from, to, ... curve, rate, dots, ... }
    this.falling = [];            // dropped / bounced dots, free-flying
    this.popups = [];             // little "429" / "timeout" labels
    this.running = false;
    this.lastFrame = 0;
  }

  init() {
    this.root = document.createElement('div');
    this.root.className = 'sd';
    this.root.innerHTML = `
      <div class="sd-tiers"></div>
      <svg class="sd-edges" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="sd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path>
          </marker>
          <marker id="sd-arrow-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(226, 232, 240, 0.7)"></path>
          </marker>
        </defs>
        <g class="sd-edge-paths"></g>
      </svg>
      <canvas class="sd-canvas"></canvas>
      <div class="sd-labels"></div>
      <div class="sd-nodes"></div>
      <div class="sd-empty" hidden></div>
      <div class="sd-legend"></div>`;
    this.container.appendChild(this.root);
    this.tiersEl = this.root.querySelector('.sd-tiers');
    this.svg = this.root.querySelector('.sd-edges');
    this.pathsEl = this.root.querySelector('.sd-edge-paths');
    this.canvas = this.root.querySelector('.sd-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.labelsEl = this.root.querySelector('.sd-labels');
    this.nodesEl = this.root.querySelector('.sd-nodes');
    this.emptyEl = this.root.querySelector('.sd-empty');
    this.legendEl = this.root.querySelector('.sd-legend');

    this.resizeObserver = new ResizeObserver(() => this.update(true));
    this.resizeObserver.observe(this.root);

    this.update(true);
    this.start();
  }

  /** Show a glowing "place here" slot for a machine (null to hide). */
  setSlot(role) {
    this.slotRole = role;
    this.update(true);
  }

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURE: which boxes and arrows exist, and where
  // ═══════════════════════════════════════════════════════════════

  /** What's on the diagram right now (machines placed + the slot being placed). */
  present() {
    const gs = this.gameState;
    const has = role => gs.isPlaced(role) || this.slotRole === role;
    return {
      app: has('app'),
      appCount: gs.isPlaced('app') ? Math.max(1, gs.appCount()) : 0,
      db: has('db'), web: has('web'), gateway: has('gateway'),
      lb: has('lb'), cache: has('cache'), cdn: has('cdn'),
      idgen: has('idgen'), queue: has('queue'), blob: has('blob'), sync: has('sync'),
      direct: Boolean(gs.codeFixes?.presigned),
      dbCount: gs.isPlaced('db') ? Math.max(1, gs.dbCount()) : 0
    };
  }

  /** Rebuild nodes, tier boxes and arrows when the set of machines changes. */
  update(force = false) {
    if (!this.root) return;
    const gs = this.gameState;
    const p = this.present();
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const key = JSON.stringify({ p, slot: this.slotRole, w, h, level: gs.level, multi: gs.hasDatabaseLevel(), reserve: this.bottomReserve(w, h) });
    if (force || key !== this.structureKey) {
      this.structureKey = key;
      this.layout(p, w, h);
    }
    this.refreshLive();
  }

  /**
   * Phones (top-to-bottom layout): room at the bottom taken by the guide bubble,
   * so the last row isn't hidden under it.
   */
  bottomReserve(W, H) {
    if (!(W < 600 && H > W * 1.15)) return 0;
    const guide = document.getElementById('guide-bubble');
    if (!guide || guide.hidden || getComputedStyle(guide).display === 'none') return 0;
    const top = guide.getBoundingClientRect().top;
    const bottom = this.root.getBoundingClientRect().bottom;
    return Math.max(0, Math.round((bottom - top + 8) / 20) * 20);
  }

  layout(p, W, H) {
    const gs = this.gameState;
    this.nodes = {};
    this.nodesEl.innerHTML = '';
    this.tiersEl.innerHTML = '';
    this.resizeCanvas(W, H);

    // Phones held upright: the same layout, worked out along the screen's height
    // ("flow" runs top → bottom) and turned onto the screen at the end.
    // Laptops and wide screens never take this path.
    const vertical = W < 600 && H > W * 1.15;
    this.vertical = vertical;
    // On phones, leave the strip under the guide bubble free
    const flowLen = vertical ? Math.max(H * 0.55, H - this.bottomReserve(W, H)) : W;
    const crossLen = vertical ? W : H;

    // Columns, left to right, only for what exists
    const cols = ['users'];
    if (p.cdn) cols.push('cdn');
    if (p.gateway) cols.push('gateway');
    if (p.lb) cols.push('lb');
    if (p.app || this.slotRole === 'app') cols.push('app');
    if (p.db || p.cache || p.blob) cols.push('data');

    // Up to 3 servers per column; only 2 when a short screen also has rows above and below
    const sideAbove = p.web || p.idgen || p.sync;
    const rowsCap = vertical
      ? (sideAbove && p.queue ? 1 : 2)
      : (sideAbove && p.queue && H < 560 ? 2 : 3);
    const appCols = Math.ceil(Math.max(1, p.appCount) / rowsCap) > 1 ? Math.ceil(p.appCount / rowsCap) : 1;
    // Card size: as big as fits for the number of columns (smaller with many machines)
    const colCount = cols.length + (appCols - 1);
    const marginGuess = Math.max(24, flowLen * 0.05);
    const colSpacing = (flowLen - marginGuess * 2) / Math.max(1, colCount);
    let scale, NW, NH;
    if (vertical) {
      // Phone: cards as wide as the busiest row allows (1, 2 or 3 across), as tall as the rows allow
      const appRows = cols.includes('app') ? Math.min(Math.max(1, p.appCount), rowsCap) : 0;
      const lanes = 1 + (sideAbove ? 1 : 0) + (p.queue ? 1 : 0);
      const dataRow = ['cache', 'db', 'blob'].filter(r => p[r]).length;
      const across = Math.max(1, dataRow, lanes + Math.max(0, appRows - 1));
      const cardW = across === 1 ? Math.min(150, W * 0.42)
        : across === 2 ? Math.min(108, W * 0.29)
        : Math.min(104, W * 0.27);
      const cardH = Math.max(46, Math.min(72, colSpacing * 0.72));
      scale = Math.max(0.62, Math.min(0.9, cardW / 128));
      NW = cardH;  // extent along the flow (screen height)
      NH = cardW;  // extent across the flow (screen width)
    } else {
      scale = Math.max(0.6, Math.min(1.15, W / (colCount * 175)));
      NW = Math.min(128 * scale, colSpacing * 0.74);
      NH = 74 * scale;
    }
    this.root.style.setProperty('--sd-scale', scale.toFixed(3));
    this.compact = vertical || colSpacing < 150; // tight: shorter names, fewer labels
    const weights = cols.map(c => (c === 'app' ? appCols : 1));
    const totalW = weights.reduce((a, b) => a + b, 0);
    const marginX = Math.max(24, flowLen * 0.05);
    const usable = flowLen - marginX * 2;
    const colX = {};
    let acc = 0;
    cols.forEach((c, i) => {
      const span = usable * (weights[i] / totalW);
      colX[c] = marginX + acc + span / 2;
      acc += span;
    });

    // Lanes: the page path / ID service above, the API path in the middle, the queue below
    const above = sideAbove;
    const below = p.queue;
    let laneY = above && below ? crossLen * 0.52 : above ? crossLen * 0.6 : below ? crossLen * 0.42 : crossLen * 0.5;
    let webY = crossLen * 0.2;
    let belowY = crossLen * 0.85;
    if (vertical) {
      laneY = crossLen * (above && below ? 0.5 : above ? 0.6 : below ? 0.4 : 0.5);
      webY = crossLen * 0.19;
      belowY = crossLen * 0.81;
    }
    const maxRows = rowsCap;

    const place = (id, role, x, y, opts = {}) => {
      this.nodes[id] = { id, role, x, y, w: NW, h: NH, ...opts };
    };

    place('users', 'users', colX.users, laneY);
    if (p.cdn) place('cdn', 'cdn', colX.cdn, laneY);
    if (p.gateway) place('gateway', 'gateway', colX.gateway, laneY);
    if (p.lb) place('lb', 'lb', colX.lb, laneY);

    // App tier: every app server in one box (a grid when there are many)
    const appIds = [];
    if (cols.includes('app')) {
      const n = Math.max(1, p.appCount);
      const rows = Math.min(n, maxRows);
      const gapY = vertical ? 8 : 12 * scale;
      const gapX = vertical ? 8 : 14 * scale;
      const blockH = rows * NH + (rows - 1) * gapY;
      for (let i = 0; i < n; i++) {
        const c = Math.floor(i / maxRows);
        const r = i % maxRows;
        const x = colX.app + (c - (appCols - 1) / 2) * (NW + gapX);
        const y = laneY - blockH / 2 + NH / 2 + r * (NH + gapY);
        const id = `app${i}`;
        place(id, 'app', x, y, { index: i });
        appIds.push(id);
      }
    }
    if (p.web) place('web', 'web', colX.app, webY);
    // ID generator: above the app tier (above the data tier if the web server is there)
    if (p.idgen) place('idgen', 'idgen', p.web && colX.data ? colX.data : colX.app, webY);
    // Message queue: below the app tier
    if (p.queue) place('queue', 'queue', colX.app, belowY);
    // Sync server above the app tier; blob storage at the bottom of the data column
    if (p.sync) place('sync', 'sync', colX.app, webY);
    if (vertical && colX.data) {
      // Phone: cache, database and blob storage side by side in the data row
      const items = ['cache', 'db', 'blob'].filter(r => p[r]);
      const spots = { 1: [0.5], 2: [0.3, 0.7], 3: [0.19, 0.5, 0.81] }[items.length] || [];
      items.forEach((r, i) => place(r, r, colX.data, crossLen * spots[i]));
    } else if (p.blob) place('blob', 'blob', colX.data, belowY);
    if (vertical && colX.data) {
      // placed above
    } else if (p.cache && p.db) {
      place('cache', 'cache', colX.data, laneY - NH * 1.25);
      place('db', 'db', colX.data, laneY + NH * 0.45);
    } else if (p.cache) {
      place('cache', 'cache', colX.data, laneY);
    } else if (p.db) {
      place('db', 'db', colX.data, laneY);
    }
    this.appIds = appIds;

    if (this.detailsId && !this.detailsId.startsWith('edge:') && !this.nodes[this.detailsId]) this.closeDetails();
    if (vertical) {
      // Arrows are worked out in the flow layout, then everything turns onto the screen
      this.buildEdges(p, appIds);
      for (const n of Object.values(this.nodes)) {
        [n.x, n.y, n.w, n.h] = [n.y, n.x, n.h, n.w];
      }
      this.drawTiers(p, appIds, NW, NH, scale);
      this.buildNodes(scale);
    } else {
      this.drawTiers(p, appIds, NW, NH, Math.min(scale, (NW / 128)));
      this.buildNodes(scale);
      this.buildEdges(p, appIds);
    }

    // Before the first server: a friendly hint in the middle
    const nothing = !gs.server && !this.slotRole;
    this.emptyEl.hidden = !nothing;
    if (nothing) {
      this.emptyEl.innerHTML = '<div class="sd-empty-icon">🏗️</div><strong>No servers yet</strong><span>Tap <b>Server</b> below to build your first machine.</span>';
    }
    // Phone: the hint goes just under the Users card instead of on top of it
    const u = this.nodes.users;
    this.emptyEl.style.top = nothing && vertical && u ? `${u.y + u.h / 2 + 24}px` : '';
  }

  resizeCanvas(W, H) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(W * dpr));
    this.canvas.height = Math.max(1, Math.round(H * dpr));
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W;
    this.H = H;
  }

  /** Dashed group boxes behind the machines, like an architecture diagram. */
  drawTiers(p, appIds, NW, NH, scale) {
    const pad = 14 * scale;
    const box = (ids, label, cls) => {
      const ns = ids.map(id => this.nodes[id]).filter(Boolean);
      if (!ns.length) return;
      const left = Math.min(...ns.map(n => n.x - n.w / 2)) - pad;
      const right = Math.max(...ns.map(n => n.x + n.w / 2)) + pad;
      const top = Math.min(...ns.map(n => n.y - n.h / 2)) - pad - 16 * scale;
      const bottom = Math.max(...ns.map(n => n.y + n.h / 2)) + pad;
      const el = document.createElement('div');
      el.className = `sd-tier ${cls}`;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${right - left}px`;
      el.style.height = `${bottom - top}px`;
      el.innerHTML = `<span class="sd-tier-label">${label}</span>`;
      this.tiersEl.appendChild(el);
    };
    const gs = this.gameState;
    box(['users'], 'Clients', 'tier-clients');
    if (p.cdn) box(['cdn'], 'Edge', 'tier-edge');
    if (p.gateway || p.lb) box(['gateway', 'lb'], 'Front door', 'tier-front');
    if (p.web) box(['web'], 'Web tier', 'tier-web');
    if (p.idgen) box(['idgen'], 'ID service', 'tier-ids');
    if (p.queue) box(['queue'], 'Async · analytics', 'tier-async');
    if (appIds.length) {
      const n = gs.appCount();
      const label = !gs.hasDatabaseLevel() ? 'Your server' : n > 1 ? `App tier · ${n} servers` : 'App tier';
      box(appIds, label, 'tier-app');
    }
    if (p.db || p.cache) box(['cache', 'db'], p.dbCount > 1 ? `Data tier · ${p.dbCount} shards` : (p.blob ? 'Metadata' : 'Data tier'), 'tier-data');
    if (p.blob) box(['blob'], 'File storage', 'tier-blob');
    if (p.sync) box(['sync'], 'Live sync', 'tier-ids');
    this.buildLegend(p);
  }

  /** Dot colours that matter for what's on screen. */
  buildLegend(p) {
    const gs = this.gameState;
    const L = gs.levelDef();
    const items = [['read', L.readKind === 'lookup' ? 'redirect' : 'read'], ['write', L.readKind === 'lookup' ? 'new link' : 'write']];
    if (p.web || L.pageViewsPerUser) items.push(['page', 'page']);
    if (L.botShare || L.spamPerUser) items.push(['bot', L.botKind === 'write' ? 'spam' : 'bot']);
    if (p.queue || L.clickTracking || p.sync) items.push(['event', p.sync ? 'event / push' : 'click event']);
    if (L.readKind === 'file' && p.app) items.push(['resp', 'response back']);
    items.push(['fail', 'failed']);
    this.legendEl.innerHTML = items.map(([k, label]) => `<span>${shapeIcon(SHAPES[k], COLORS[k])}${label}</span>`).join('');
  }

  buildNodes(scale) {
    const gs = this.gameState;
    for (const node of Object.values(this.nodes)) {
      // Phone layout: arrow anchors aren't drawn (they showed as stray "Place server" slots)
      if (node.virtual && this.vertical) continue;
      const el = document.createElement('div');
      const isSlot = node.role !== 'users' && this.slotRole === node.role && !gs.isPlaced(node.role);
      el.className = `sd-node role-${node.role}${isSlot ? ' sd-slot' : ''}`;
      el.style.left = `${node.x - node.w / 2}px`;
      el.style.top = `${node.y - node.h / 2}px`;
      el.style.width = `${node.w}px`;
      el.style.height = `${node.h}px`;

      if (node.role === 'users') {
        el.innerHTML = `
          <div class="sd-node-head"><span class="sd-icon">👥</span><span class="sd-name">Users</span></div>
          <div class="sd-sub" data-live="users"></div>
          <button type="button" class="sd-info" aria-label="Traffic details">i</button>`;
      } else if (isSlot) {
        const role = ROLES[node.role];
        el.innerHTML = `<span class="sd-icon">${role.icon}</span><span class="sd-slot-text">Place ${gs.hasDatabaseLevel() ? role.name.toLowerCase() : 'server'}</span>`;
        el.addEventListener('click', () => this.handlers.onSlotClick?.(node.role));
      } else {
        const role = ROLES[node.role];
        const full = this.compact ? role.short : role.name;
        const shards = node.role === 'db' ? gs.dbCount() : 0;
        const name = !gs.hasDatabaseLevel() ? 'My Server'
          : node.role === 'app' && gs.appCount() > 1 ? `App #${node.index + 1}`
          : shards > 1 ? `${this.compact ? 'DB' : 'Database'} ×${shards}` : full;
        if (shards > 1) el.classList.add('sd-stack');
        el.innerHTML = `
          <div class="sd-node-head"><span class="sd-icon">${role.icon}</span><span class="sd-name">${name}</span></div>
          <div class="sd-sub">${this.partsSummary(node.role)}</div>
          <div class="sd-load"><span class="sd-load-fill"></span><span class="sd-load-pct"></span></div>
          <span class="sd-badge" hidden></span>
          <button type="button" class="sd-info" aria-label="${role.name} details">i</button>`;
        // Tap a machine → its usage details (all parts). Upgrading starts from the
        // Upgrade button there, so a tap never jumps straight into buying.
        el.title = `${role.name}: tap for usage details`;
        el.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDetails(node.id); });
      }
      el.querySelector('.sd-info')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDetails(node.id);
      });
      node.el = el;
      this.nodesEl.appendChild(el);
    }
  }

  partsSummary(role) {
    const cfg = this.gameState.getServerConfig(role);
    if (!cfg) return '';
    const cpu = getOption('cpu', cfg.cpu)?.label || '';
    const ram = getOption('ram', cfg.ram)?.label || '';
    return `${cpu} · ${ram}`;
  }

  /** Arrows along the request path. Each has a flow type for its dots. */
  buildEdges(p, appIds) {
    this.edges = [];
    const N = this.nodes;
    const add = (from, to, flow, label) => {
      if (!N[from] || !N[to]) return;
      this.edges.push({ id: `${from}>${to}`, from, to, flow, label, dots: [], spawnAcc: Math.random(), gateAcc: 0 });
    };

    // Front of the path: users → CDN → gateway → LB
    const front = ['users', 'cdn', 'gateway', 'lb'].filter(id => N[id]);
    for (let i = 0; i < front.length - 1; i++) {
      const to = front[i + 1];
      add(front[i], to, `to-${to}`, { cdn: 'all traffic', gateway: 'API calls', lb: 'allowed' }[to]);
    }
    const last = front[front.length - 1];

    // Into the app tier: one arrow per app server (spread by the LB). With
    // several columns, one arrow into the tier box (so arrows never cross cards)
    const multiCol = appIds.length && new Set(appIds.map(id => Math.round(N[id].x))).size > 1;
    if (multiCol) {
      const ns = appIds.map(id => N[id]);
      const left = Math.min(...ns.map(n => n.x - n.w / 2)) - 14;
      const midY = ns.reduce((sum, n) => sum + n.y, 0) / ns.length;
      N.appIn = { id: 'appIn', role: 'app', x: left, y: midY, w: 0, h: 0, virtual: true };
      add(last, 'appIn', 'to-app-tier', `split ${appIds.length} ways`);
    } else {
      for (const id of appIds) add(last, id, 'to-app', appIds.length > 1 ? null : (last === 'users' ? 'requests' : 'API'));
    }

    // Pages to the web server (from users, or from the CDN on a miss)
    if (N.web) add(N.cdn ? 'cdn' : 'users', 'web', 'to-web', 'pages');

    // Out of the app tier to the data tier
    const tierOut = appIds.length ? 'appTier' : null;
    if (tierOut) {
      // A virtual node at the right edge of the app tier, so 6 servers share one arrow
      const ns = appIds.map(id => N[id]);
      const right = Math.max(...ns.map(n => n.x + n.w / 2));
      const midY = ns.reduce((s, n) => s + n.y, 0) / ns.length;
      N.appTier = { id: 'appTier', role: 'app', x: right, y: midY, w: 0, h: 0, virtual: true };
      if (N.cache) add('appTier', 'cache', 'to-cache', 'reads');
      if (N.db) add('appTier', 'db', N.cache ? 'to-db-writes' : 'to-db', N.cache ? 'writes' : 'reads + writes');
      if (N.cache && N.db) add('cache', 'db', 'cache-miss', 'misses');

      // Beside the main path: IDs above, click events below
      const top = Math.min(...ns.map(n => n.y - n.h / 2));
      const bottom = Math.max(...ns.map(n => n.y + n.h / 2));
      const cx = ns.reduce((s, n) => s + n.x, 0) / ns.length;
      N.appTop = { id: 'appTop', role: 'app', x: cx, y: top, w: 0, h: 0, virtual: true };
      N.appBottom = { id: 'appBottom', role: 'app', x: cx, y: bottom, w: 0, h: 0, virtual: true };
      if (N.idgen) add(Math.abs(N.idgen.x - cx) < 10 ? 'appTop' : 'appTier', 'idgen', 'to-idgen', 'next ID');
      if (N.queue) add('appBottom', 'queue', 'to-queue', 'click events');
      if (N.queue && N.db) add('queue', 'db', 'queue-batch', 'batched counts');
    }
    // Edge redirects log their clicks to the queue too
    if (N.cdn && N.queue) add('cdn', 'queue', 'edge-events', null);

    // Files: bytes go through the app to blob storage, or straight from users
    // with pre-signed URLs; devices keep a live connection to the sync server
    if (N.blob) {
      if (p.direct) add('users', 'blob', 'direct-blob', 'direct upload / download');
      else if (N.appTier) add('appTier', 'blob', 'to-blob', 'file bytes');
    }
    if (N.sync) {
      add('users', 'sync', 'to-sync', 'live connections');
      if (N.appTop) add('appTop', 'sync', 'sync-push', 'changes');
    }

    // Files: show what comes BACK on the path from users to the app tier
    const gs = this.gameState;
    if (gs.levelDef().readKind === 'file') {
      const back = gs.codeFixes?.presigned && N.blob ? 'signed URL' : 'file bytes';
      for (const e of this.edges) {
        if (['to-cdn', 'to-gateway', 'to-lb', 'to-app', 'to-app-tier'].includes(e.flow)) {
          e.back = back;
          if (e.label) e.label = back === 'signed URL' ? 'API calls ⇄ signed URLs' : `${e.label} ⇄ files`;
        }
      }
    }

    // Geometry and SVG paths
    this.pathsEl.innerHTML = '';
    this.labelsEl.innerHTML = '';
    for (const e of this.edges) {
      const a = N[e.from];
      const b = N[e.to];
      const vertical = Math.abs(b.x - a.x) < 10; // cache → db, app tier ↔ IDs / queue
      if (vertical && b.y >= a.y) {
        e.x1 = a.x; e.y1 = a.y + a.h / 2;
        e.x2 = b.x; e.y2 = b.y - b.h / 2 - 4;
        e.cx1 = e.x1; e.cy1 = e.y1 + 20; e.cx2 = e.x2; e.cy2 = e.y2 - 20;
      } else if (vertical) {
        e.x1 = a.x; e.y1 = a.y - a.h / 2;
        e.x2 = b.x; e.y2 = b.y + b.h / 2 + 4;
        e.cx1 = e.x1; e.cy1 = e.y1 - 20; e.cx2 = e.x2; e.cy2 = e.y2 + 20;
      } else if (e.flow === 'to-sync') {
        // Up and across: leave the top, curve into the left side
        e.x1 = a.x; e.y1 = a.y - a.h / 2;
        e.x2 = b.x - b.w / 2 - 4; e.y2 = b.y;
        e.cx1 = e.x1; e.cy1 = e.y2; e.cx2 = e.x1; e.cy2 = e.y2;
      } else if (b.x < a.x || e.flow === 'edge-events' || e.flow === 'direct-blob') {
        // Down and across (e.g. CDN → queue at the bottom): leave from the bottom, enter from the left
        e.x1 = a.x; e.y1 = a.y + a.h / 2;
        e.x2 = b.x - b.w / 2 - 4; e.y2 = b.y;
        e.cx1 = e.x1; e.cy1 = e.y2; e.cx2 = e.x1; e.cy2 = e.y2;
      } else if (Math.abs(b.y - a.y) > a.h && e.flow === 'queue-batch') {
        // Up/down and across: leave from the side nearest, curve into the target's bottom or left
        e.x1 = a.x + a.w / 2; e.y1 = a.y;
        e.x2 = b.x; e.y2 = b.y + (b.y < a.y ? b.h / 2 + 4 : -b.h / 2 - 4);
        e.cx1 = e.x2; e.cy1 = e.y1; e.cx2 = e.x2; e.cy2 = e.y1;
      } else {
        e.x1 = a.x + a.w / 2; e.y1 = a.y;
        e.x2 = b.x - b.w / 2 - 4; e.y2 = b.y;
        const dx = (e.x2 - e.x1) * 0.5;
        e.cx1 = e.x1 + dx; e.cy1 = e.y1; e.cx2 = e.x2 - dx; e.cy2 = e.y2;
      }
      if (this.vertical) {
        // Turn the flow layout onto the screen: x ↔ y
        [e.x1, e.y1, e.x2, e.y2] = [e.y1, e.x1, e.y2, e.x2];
        [e.cx1, e.cy1, e.cx2, e.cy2] = [e.cy1, e.cx1, e.cy2, e.cx2];
      }
      // Unit normal of the arrow's chord: responses travel on a lane beside it
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1;
      e.nx = -(e.y2 - e.y1) / len;
      e.ny = (e.x2 - e.x1) / len;
      if (e.back) {
        const o = (x, y) => `${x + e.nx * BACK_GAP} ${y + e.ny * BACK_GAP}`;
        const back = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        back.setAttribute('d', `M ${o(e.x1, e.y1)} C ${o(e.cx1, e.cy1)}, ${o(e.cx2, e.cy2)}, ${o(e.x2, e.y2)}`);
        back.setAttribute('class', 'sd-edge-back');
        back.setAttribute('marker-start', 'url(#sd-arrow-back)');
        this.pathsEl.appendChild(back);
        e.backPath = back;
      }
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${e.x1} ${e.y1} C ${e.cx1} ${e.cy1}, ${e.cx2} ${e.cy2}, ${e.x2} ${e.y2}`);
      path.setAttribute('class', 'sd-edge');
      path.setAttribute('marker-end', 'url(#sd-arrow)');
      this.pathsEl.appendChild(path);
      e.path = path;
      // A wide invisible line on top, so the arrow is easy to click
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', path.getAttribute('d'));
      hit.setAttribute('class', 'sd-edge-hit');
      hit.addEventListener('click', (ev) => { ev.stopPropagation(); this.toggleDetails(`edge:${e.id}`); });
      hit.addEventListener('mouseenter', () => path.classList.add('is-hover'));
      hit.addEventListener('mouseleave', () => path.classList.remove('is-hover'));
      this.pathsEl.appendChild(hit);

      const longEnough = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) > 120;
      if (e.label !== null && e.label !== undefined && longEnough) {
        const mid = curvePoint(e, 0.5);
        const lab = document.createElement('span');
        lab.className = 'sd-edge-label';
        lab.style.left = `${mid.x}px`;
        lab.style.top = `${mid.y}px`;
        lab.title = 'What travels here?';
        lab.addEventListener('click', (ev) => { ev.stopPropagation(); this.toggleDetails(`edge:${e.id}`); });
        this.labelsEl.appendChild(lab);
        e.labelEl = lab;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LIVE VALUES: loads, badges, rates
  // ═══════════════════════════════════════════════════════════════

  refreshLive() {
    if (this.detailsId) this.renderDetails();
    const gs = this.gameState;
    const status = gs.serverStatus;
    // Keeps animating on a finished level too (showing its final traffic)
    const live = gs.appLive && status;
    const crashed = gs.spike?.kind === 'crash' ? gs.spike.crashed : 0;
    const n = this.appIds?.length || 0;

    for (const node of Object.values(this.nodes)) {
      if (!node.el || node.virtual) continue;
      if (node.role === 'users') {
        const sub = node.el.querySelector('[data-live="users"]');
        if (sub) {
          const far = gs.levelDef().globalShare ? ` · ${Math.round(gs.levelDef().globalShare * 100)}% far away` : '';
          sub.textContent = `${gs.users.toLocaleString()} online${far}`;
        }
        continue;
      }
      if (node.el.classList.contains('sd-slot')) continue;
      const worst = worstOf(status, node.role);
      const peak = worst.value;
      const down = node.role === 'app' && node.index >= n - crashed;
      const fill = node.el.querySelector('.sd-load-fill');
      const pct = node.el.querySelector('.sd-load-pct');
      if (fill) {
        fill.style.width = down ? '0%' : `${Math.min(100, Math.round(peak * 100))}%`;
        fill.dataset.level = peak > 1 ? 'over' : peak >= 0.8 ? 'warn' : 'ok';
      }
      if (pct) pct.textContent = down ? '—' : status ? `${worst.label} ${Math.round(peak * 100)}%`.trim() : '';
      if (pct) pct.title = down || !status ? '' : `Busiest part: ${worst.label} at ${Math.round(peak * 100)}% of its limit`;
      node.el.classList.toggle('is-over', peak > 1 && !down);
      node.el.classList.toggle('is-warn', peak >= 0.8 && peak <= 1 && !down);
      node.el.classList.toggle('is-down', down);
      node.el.classList.toggle('is-bottleneck', Boolean(status) && status.bottleneckRole === node.role && !down && !(node.role === 'app' && node.index > 0));

      const badge = node.el.querySelector('.sd-badge');
      if (badge) {
        let text = '';
        if (down) text = 'DOWN';
        else if (status?.diskFull && status.space.role === node.role) text = 'DISK FULL';
        else if (node.role === 'app' && node.index > 0) text = ''; // tier-wide badges once
        else if (peak > 1) text = 'QUEUE';
        else if (status && status.bottleneckRole === node.role && peak >= 0.6) text = 'BOTTLENECK';
        // Name the part that is running out: "BOTTLENECK · RAM", "QUEUE · NET"
        let part = '';
        if (text === 'QUEUE') part = worst.label;
        if (text === 'BOTTLENECK') part = worst.label; // same part the bar shows
        badge.hidden = !text || !live;
        badge.textContent = part ? `${text} · ${part.toUpperCase()}` : text;
        badge.dataset.kind = text.toLowerCase().replace(' ', '-');
      }
      const sub = node.el.querySelector('.sd-sub');
      if (sub) sub.textContent = this.partsSummary(node.role);
    }

    // Arrow rates, colours and labels
    for (const e of this.edges) {
      // Nothing flows into an empty slot until the machine is placed
      const toSlot = this.isSlot(e.to) || this.isSlot(e.from);
      e.rate = live && !toSlot ? this.edgeRate(e, status) : 0;
      const destPeak = e.to === 'users' ? 0 : peakOf(status, this.nodes[e.to]?.role);
      const state = !live || toSlot ? 'idle' : destPeak > 1 ? 'over' : destPeak >= 0.8 ? 'warn' : 'ok';
      e.path.setAttribute('data-state', state);
      e.path.style.strokeWidth = `${1.5 + Math.min(4, Math.log10(1 + e.rate) * 1.4)}`;
      if (e.labelEl) {
        e.labelEl.textContent = live && !toSlot ? `${e.label} · ${fmtRate(e.rate)}` : e.label;
        e.labelEl.dataset.state = state;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DETAILS: the (i) on a card opens its full resources, live
  // ═══════════════════════════════════════════════════════════════

  toggleDetails(id) {
    // One click can reach both an arrow and its label: ignore an instant repeat
    const now = performance.now();
    if (this.detailsId === id && now - (this.detailsOpenedAt || 0) < 350) return;
    if (this.detailsId === id) { this.closeDetails(); return; }
    this.detailsOpenedAt = now;
    this.detailsId = id;
    if (!this.detailsEl) {
      this.detailsEl = document.createElement('div');
      this.detailsEl.className = 'sd-details';
      this.detailsEl.setAttribute('role', 'dialog');
      this.root.appendChild(this.detailsEl);
      this.detailsEl.addEventListener('click', (e) => {
        if (e.target.closest('.sd-details-close')) this.closeDetails();
        const up = e.target.closest('.sd-details-upgrade');
        if (up) { this.closeDetails(); this.handlers.onNodeClick?.(up.dataset.role); }
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeDetails(); });
      document.addEventListener('click', (e) => {
        if (this.detailsId && !this.detailsEl.contains(e.target) && !e.target.closest('.sd-info') && !e.target.closest('.sd-edge-hit') && !e.target.closest('.sd-edge-label') && !e.target.closest('.info-pop')) this.closeDetails();
      });
    }
    this.renderDetails();
    this.detailsEl.hidden = false;
  }

  closeDetails() {
    this.detailsId = null;
    if (this.detailsEl) this.detailsEl.hidden = true;
  }

  renderDetails() {
    const el = this.detailsEl;
    if (!el) return;
    if (this.detailsId?.startsWith('edge:')) {
      const edge = this.edges.find(x => `edge:${x.id}` === this.detailsId);
      if (!edge) { this.closeDetails(); return; }
      if (document.querySelector('.info-pop:not([hidden])') && el.matches(':hover')) return;
      el.innerHTML = this.edgeDetails(edge);
      const w = Math.min(320, this.W - 24);
      el.style.width = `${w}px`;
      el.style.maxHeight = `${Math.max(160, this.H - 16)}px`;
      const mid = curvePoint(edge, 0.5);
      const h = el.offsetHeight || 260;
      el.style.left = `${Math.max(8, Math.min(this.W - w - 8, mid.x - w / 2))}px`;
      el.style.top = `${mid.y + 18 + h < this.H ? mid.y + 18 : Math.max(8, mid.y - h - 18)}px`;
      return;
    }
    const node = this.nodes[this.detailsId];
    if (!node) return;
    // Leave the text alone while an explanation popover from inside it is open
    if (document.querySelector('.info-pop:not([hidden])') && el.matches(':hover')) return;
    el.innerHTML = node.role === 'users' ? this.usersDetails() : this.machineDetails(node);

    // Beside the card: right if there's room, otherwise left
    const w = Math.min(300, this.W - 24);
    el.style.width = `${w}px`;
    el.style.maxHeight = `${Math.max(160, this.H - 16)}px`;
    let x = node.x + node.w / 2 + 10;
    if (x + w > this.W - 8) x = node.x - node.w / 2 - 10 - w;
    x = Math.max(8, Math.min(this.W - w - 8, x));
    const h = el.offsetHeight || 260;
    const y = Math.max(8, Math.min(this.H - h - 8, node.y - 40));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  /** What travels along an arrow: the request, the steps, and what comes back. */
  edgeDetails(e) {
    const gs = this.gameState;
    const L = gs.levelDef();
    const kind = L.readKind;
    const signed = Boolean(gs.codeFixes?.presigned && this.nodes.blob);
    const name = id => (id === 'users' ? 'Users' : ['appTier', 'appTop', 'appBottom', 'appIn'].includes(id) ? 'App servers' : ROLES[this.nodes[id]?.role]?.name || id);
    const front = ['to-cdn', 'to-gateway', 'to-lb', 'to-app', 'to-app-tier'].includes(e.flow);
    let what = '';
    let steps = [];
    let back = '';
    if (front) {
      if (kind === 'file' && signed) {
        what = 'Small API calls only: "I want to upload X", "give me file Y", list folders, share. No file bytes travel here.';
        steps = [
          'Upload: the device asks the app server for permission (<code>POST /files</code>).',
          'The app checks access, saves the file\'s metadata as <em>uploading</em>, signs a URL valid for a few minutes, and sends it <strong>back</strong>.',
          'The device uploads the bytes <strong>straight to blob storage</strong> with that URL (the lower arrow).',
          'Storage confirms; the app marks the file <em>uploaded</em>. Downloads work the same way: ask for a signed link, then fetch from storage.'
        ];
        back = 'Short JSON answers: the signed URL and file metadata.';
      } else if (kind === 'file') {
        what = 'Every upload and download, bytes and all, passes through here.';
        steps = ['Upload: the device sends the whole file to the app server, which forwards it to storage.', 'Download: the app reads the file from storage and streams it back.'];
        back = 'Downloads come back this way: the full file bytes. That is why the app server\'s network is so busy.';
      } else if (kind === 'lookup') {
        what = 'Redirect lookups (<code>GET /{code}</code>) and new short links (<code>POST /api/shorten</code>).';
        back = '<code>302 Found</code> with a <code>Location</code> header: the browser then goes to the long URL by itself.';
      } else {
        what = 'Guestbook requests: read the entries and sign the book.';
        back = 'The entries (or the page) for the user.';
      }
      if (e.flow === 'to-cdn') what = `Everything goes to the CDN first. It answers what it has cached at the edge and passes the rest on. ${what}`;
      if (e.flow === 'to-gateway') what = `The gateway checks who is calling, rate-limits and routes. ${what}`;
      if (e.flow === 'to-lb' || e.flow === 'to-app-tier') what = `The load balancer picks a healthy app server for each request. ${what}`;
    } else {
      const texts = {
        'direct-blob': ['File bytes, straight between devices and blob storage, using the signed URL. Storage checks the signature and expiry itself: no app server involved.', [], 'Uploads: a confirmation (ETag) per chunk. Downloads: the file bytes.'],
        'to-blob': ['The app server forwards uploaded bytes to blob storage and reads files back for downloads.', [], 'The file bytes, which the app then sends on to the user.'],
        'to-db': ['Metadata queries: find a file, list a folder, save a new row.', [], 'The matching rows.'],
        'to-db-writes': ['Writes go straight to the database (caches only help reads).', [], 'An OK once the row is saved.'],
        'to-cache': ['Reads check the cache first (cache-aside).', [], 'The cached value on a hit; on a miss the app asks the database and fills the cache.'],
        'cache-miss': ['Only what the cache didn\'t have reaches the database.', [], 'The rows, which are then cached.'],
        'to-web': ['Page loads: HTML, JavaScript, images.', [], 'The page files.'],
        'to-sync': ['Each device keeps one WebSocket open to the sync server. Nothing flows while nothing changes, but every open connection uses RAM.', [], 'Push messages: "file X changed", so the device fetches the new version.'],
        'sync-push': ['When a file changes, the app tells the sync server, which pushes a notice to every device of every user who can see it.', [], '—'],
        'to-idgen': ['Each new short link asks for the next unique ID (or a block of 1,000).', [], 'The ID(s).'],
        'to-queue': ['Click events dropped into the queue; the redirect doesn\'t wait.', [], 'Just "accepted": the work happens later.'],
        'edge-events': ['Edge servers log the clicks they answered to the queue.', [], '—'],
        'queue-batch': ['A worker reads events in batches and writes one row per 50.', [], 'An OK per batch.']
      };
      const t = texts[e.flow] || ['Requests between these two machines.', [], 'Their responses.'];
      [what, steps, back] = t;
    }
    const rate = e.rate ? `<p class="sd-d-line">Right now: <strong>${fmtRate(e.rate)}</strong></p>` : '';
    return `
      <div class="sd-d-head">
        <span class="sd-d-icon">↔️</span>
        <div><strong>${name(e.from)} → ${name(e.to)}</strong></div>
        <button type="button" class="sd-details-close" aria-label="Close">×</button>
      </div>
      <p class="sd-d-job"><strong>→ Request:</strong> ${what}</p>
      ${steps.length ? `<ol class="sd-d-steps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
      <p class="sd-d-job"><strong>↩ Response:</strong> ${back}</p>
      ${rate}`;
  }

  machineDetails(node) {
    const gs = this.gameState;
    const role = ROLES[node.role];
    const cfg = gs.getServerConfig(node.role);
    const status = gs.serverStatus;
    const server = status?.servers?.[node.role];
    const count = Math.max(1, gs.machineCount(node.role));
    const crashed = gs.spike?.kind === 'crash' ? gs.spike.crashed : 0;
    const down = node.role === 'app' && node.index >= (this.appIds?.length || 0) - crashed;
    const isBottleneck = status?.bottleneckRole === node.role;
    const rows = PART_ORDER.map(partId => {
      const part = SERVER_PARTS[partId];
      const opt = getOption(partId, cfg?.[partId]);
      const use = server?.usage?.[partId] ?? 0;
      const limit = server?.limits?.[partId];
      const pct = Math.round(use * 100);
      const lvl = use > 1 ? 'over' : use >= 0.8 ? 'warn' : 'ok';
      const first = isBottleneck && status.bottleneck === partId;
      return `
        <li class="sd-d-part${first ? ' first' : ''}">
          <span class="sd-d-name">${part.icon} ${part.short} ${infoButton(partId)}</span>
          <span class="sd-d-spec">${opt ? `${opt.label} · ${opt.spec}` : '–'}</span>
          <span class="sd-d-bar"><span data-level="${lvl}" style="width:${Math.min(100, pct)}%"></span></span>
          <span class="sd-d-pct" data-level="${lvl}">${down ? '—' : `${pct}%`}</span>
          <span class="sd-d-limit">${limit === Infinity || limit == null ? 'not a limit' : `fits ~${limit.toLocaleString()} users`}${first ? ' · <strong>runs out first</strong>' : ''}</span>
        </li>`;
    }).join('');
    const space = status?.space && status.space.role === node.role && status.space.capacity
      ? `<p class="sd-d-line">💽 Disk space: <strong>${Math.round(status.space.pct * 100)}%</strong> of ${status.space.capacity.toLocaleString()} ${infoButton('diskSpace')}</p>` : '';
    const cloud = CLOUD_EQUIVALENTS[node.role];
    const name = node.role === 'app' && count > 1 ? `App server #${node.index + 1} of ${count}`
      : count > 1 ? `${role.name} ×${count}` : (!gs.hasDatabaseLevel() ? 'Your server' : role.name);
    return `
      <div class="sd-d-head">
        <span class="sd-d-icon">${role.icon}</span>
        <div><strong>${name}</strong>${down ? '<span class="sd-d-down">DOWN</span>' : ''}</div>
        ${infoButton(role.info)}
        <button type="button" class="sd-details-close" aria-label="Close">×</button>
      </div>
      <p class="sd-d-job">${role.job}</p>
      <ul class="sd-d-parts">${rows}</ul>
      ${space}
      <p class="sd-d-line">💸 Running cost: <strong>${cfg ? runningCostPerMinute(cfg) * count : 0}/min</strong>${count > 1 ? ` for all ${count}` : ''}</p>
      ${cloud ? `<p class="sd-d-cloud">Real world: AWS ${cloud.aws} · GCP ${cloud.gcp}</p>` : ''}
      <button type="button" class="btn btn-primary sd-details-upgrade" data-role="${node.role}">Upgrade →</button>`;
  }

  usersDetails() {
    const gs = this.gameState;
    const st = gs.serverStatus;
    const L = gs.levelDef();
    const lookup = L.readKind === 'lookup';
    const rate = v => (v >= 10 ? Math.round(v).toLocaleString() : (v || 0).toFixed(1));
    const row = (label, value, info = '') => `<li><span>${label} ${info}</span><strong>${value}</strong></li>`;
    const rows = st ? [
      row('Online now', gs.users.toLocaleString()),
      row('Your system fits', `~${st.userLimit.toLocaleString()}`, infoButton('userLimit')),
      row(lookup ? 'Redirects' : 'Reads', `${rate(st.readsPerSec)}/s`),
      row(lookup ? 'New links' : 'Writes', `${rate(st.writesPerSec)}/s`),
      st.pagesPerSec ? row('Page views', `${rate(st.pagesPerSec)}/s`) : '',
      st.botsPerSec ? row(L.botKind === 'write' ? 'Spam' : 'Bots', `${rate(st.botsPerSec)}/s`, infoButton('rateLimiting')) : '',
      st.clicksPerSec ? row('Click events', `${rate(st.clicksPerSec)}/s`, infoButton('clickAnalytics')) : '',
      row('Latency', `${st.latency} ms`, infoButton('latency')),
      row('Failing', `${(st.errorRate * 100).toFixed(1)}%`),
      L.globalShare ? row('Far away', `${Math.round(L.globalShare * 100)}% (+${L.distanceMs} ms)`, infoButton('cdn')) : ''
    ].join('') : '<li><span>No traffic yet</span></li>';
    return `
      <div class="sd-d-head">
        <span class="sd-d-icon">👥</span>
        <div><strong>Users and traffic</strong></div>
        <button type="button" class="sd-details-close" aria-label="Close">×</button>
      </div>
      <ul class="sd-d-traffic">${rows}</ul>`;
  }

  /** Is this diagram node an empty "place here" slot? */
  isSlot(id) {
    const n = this.nodes[id];
    return Boolean(n && !n.virtual && n.role === this.slotRole && !this.gameState.isPlaced(n.role));
  }

  /** Requests per second along an arrow. */
  edgeRate(e, status) {
    const f = status.flows;
    if (!f) return 0;
    const appsUp = Math.max(1, status.appsUp || 1);
    const pagesToApp = this.nodes.web ? 0 : f.pagesOrigin;
    switch (e.flow) {
      case 'to-cdn': return f.reads + f.writes + f.pages + f.botsIn;
      case 'to-gateway': return f.botKind === 'write' ? f.reads * (1 - f.edgeHit) + f.writes + f.botsIn : (f.reads + f.botsIn) * (1 - f.edgeHit) + f.writes;
      case 'to-lb': return this.nodes.gateway ? f.apiOrigin
        : f.botKind === 'write' ? f.reads * (1 - f.edgeHit) + f.writes + f.botsIn : (f.reads + f.botsIn) * (1 - f.edgeHit) + f.writes;
      case 'to-app': return (f.apiOrigin + pagesToApp) / (this.appIds.length > 1 ? appsUp : 1);
      case 'to-app-tier': return f.apiOrigin + pagesToApp;
      case 'to-web': return f.pagesOrigin;
      case 'to-cache': return f.readsOrigin;
      case 'to-db': return f.dbReads + (f.dbWrites ?? f.writes);
      case 'to-db-writes': return f.dbWrites ?? f.writes;
      case 'cache-miss': return f.dbReads;
      case 'to-idgen': return f.idRequests || 0;
      case 'to-queue': return (f.queued || 0) * (1 - f.edgeHit);
      case 'edge-events': return (f.queued || 0) * f.edgeHit;
      case 'queue-batch': return f.batchWrites || 0;
      case 'to-blob': return f.bytesViaApp ? f.blobIn || 0 : 0;
      case 'direct-blob': return f.bytesViaApp ? 0 : f.blobIn || 0;
      case 'to-sync': return f.devices || 0;
      case 'sync-push': return f.pushes || 0;
      default: return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (ts) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (ts - (this.lastFrame || ts)) / 1000);
      this.lastFrame = ts;
      this.step(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** What kind of dot to send down an arrow, given the traffic mix. */
  pickKind(e, f) {
    const r = Math.random();
    if (e.flow === 'to-web') return 'page';
    if (['to-queue', 'edge-events', 'queue-batch'].includes(e.flow)) return 'event';
    if (e.flow === 'to-idgen') return 'write';
    if (e.flow === 'to-sync' || e.flow === 'sync-push') return 'event';
    if (e.flow === 'to-blob' || e.flow === 'direct-blob') return r < f.writes / Math.max(1e-9, f.writes + f.reads) ? 'write' : 'read';
    if (e.flow === 'to-db-writes') {
      // Spam that got through is written too
      const spam = f.botKind === 'write' ? f.botsPassed : 0;
      return r < spam / Math.max(1e-9, f.dbWrites ?? (f.writes + spam)) ? 'bot' : 'write';
    }
    if (e.flow === 'cache-miss') return 'read';
    const writes = f.writes;
    const bots = ['to-cdn', 'to-gateway'].includes(e.flow) || (e.flow === 'to-lb' && !this.nodes.gateway) || (['to-app', 'to-app-tier'].includes(e.flow) && !this.nodes.gateway && !this.nodes.lb)
      ? f.botsIn : f.botsPassed;
    const pages = e.flow === 'to-cdn' ? f.pages : (['to-app', 'to-app-tier'].includes(e.flow) && !this.nodes.web ? f.pagesOrigin : 0);
    const total = f.reads + writes + bots + pages || 1;
    if (r < bots / total) return 'bot';
    if (r < (bots + pages) / total) return 'page';
    if (r < (bots + pages + writes) / total) return 'write';
    return 'read';
  }

  step(dt) {
    const gs = this.gameState;
    const status = gs.serverStatus;
    // Keeps animating on a finished level too (showing its final traffic)
    const live = gs.appLive && status;
    const f = status?.flows;
    // Slow system = slow dots (latency 20 ms → normal, 140 ms → about 2.5× slower)
    const slow = live ? 1 + Math.max(0, (gs.metrics?.latency || 20) - 30) / 70 : 1;
    const crashed = gs.spike?.kind === 'crash' ? gs.spike.crashed : 0;
    const n = this.appIds?.length || 0;

    for (const e of this.edges) {
      const dest = this.nodes[e.to];
      const destPeak = dest ? peakOf(status, dest.role) : 0;
      const destDown = dest?.role === 'app' && dest.index >= n - crashed;
      const congested = live && (destPeak > 1 || destDown);
      const nearFull = live && destPeak > 0.85;

      // Spawn dots in proportion (log scale) to the real request rate
      if (live && e.rate > 0 && !(e.flow === 'to-app' && destDown && this.nodes.lb)) {
        const perSec = Math.min(14, 0.7 + Math.log2(1 + e.rate) * 1.1);
        e.spawnAcc += perSec * dt;
        while (e.spawnAcc >= 1) {
          e.spawnAcc -= 1;
          e.dots.push({ t: 0, kind: this.pickKind(e, f), jitter: (Math.random() - 0.5) * 6 });
          // Responses travel back on the same arrow (hollow rings)
          if (e.back && Math.random() < 0.6) (e.backDots ||= []).push({ t: -0.15 - Math.random() * 0.2, kind: 'resp' });
        }
      }
      if (e.backDots?.length) {
        const v = 1 / (BASE_TRIP * slow);
        for (const d of e.backDots) d.t += v * dt;
        e.backDots = e.backDots.filter(d => d.t < 1);
      }

      // Move dots; near an overloaded machine they slow down and queue up
      const speed = 1 / (BASE_TRIP * slow);
      e.dots.sort((a, b) => b.t - a.t); // front of the line first
      let queued = 0;
      for (const d of e.dots) {
        let v = speed;
        if (nearFull && d.t > 0.7) v *= destPeak > 1 ? 0.35 : 0.6;
        d.t += v * dt;

        // Bots bounce off the gateway (rate limited)
        if (d.kind === 'bot' && e.flow === 'to-gateway' && this.nodes.gateway && d.t > 0.9 && Math.random() < 0.95) {
          d.dead = true;
          const p = curvePoint(e, 0.92);
          this.falling.push({ x: p.x, y: p.y, vx: -60 - Math.random() * 60, vy: (Math.random() - 0.5) * 60, life: 0.9, color: COLORS.bot });
          const now = performance.now();
          if (!e.lastPopup || now - e.lastPopup > 1200) {
            e.lastPopup = now;
            this.popups.push({ x: p.x, y: p.y - 14, text: '429', life: 0.9, color: COLORS.bot });
          }
          continue;
        }

        if (congested) {
          // Wait in line at the entrance
          const maxT = 0.97 - queued * QUEUE_GAP;
          if (d.t > maxT) {
            d.t = maxT;
            d.waiting = (d.waiting || 0) + dt;
          }
          if (d.t >= maxT - 0.001) queued += 1;
          // Too long in line, or no room left: time out and drop
          if (queued > QUEUE_MAX || d.waiting > 2.5) {
            this.dropDot(e, d, 'timeout');
            continue;
          }
        }
        if (d.t >= 1) {
          d.dead = true;
          // Failures happen at the machine that's overloaded (or disk full for writes)
          const failChance = !live ? 0
            : (destPeak > 1 ? Math.min(0.9, (destPeak - 1) * 1.5) : 0)
              + (status.diskFull && d.kind === 'write' && dest?.role === status.space.role ? 1 : 0)
              + (status.collisionShare && d.kind === 'write' && dest?.role === 'db' ? status.collisionShare : 0);
          if (Math.random() < failChance) {
            const clash = status.collisionShare && d.kind === 'write' && dest?.role === 'db' && !(destPeak > 1);
            this.dropDot(e, d, clash ? 'clash' : 'fail', 1);
          }
        }
      }

      // Let the gate admit one queued dot now and then (the machine still works, just slowly)
      if (congested && !destDown) {
        e.gateAcc += dt * (1 / Math.max(1, destPeak)) * 3;
        if (e.gateAcc >= 1) {
          e.gateAcc = 0;
          const front = e.dots.find(d => !d.dead);
          if (front) front.t = 1.0001;
        }
      }
      e.dots = e.dots.filter(d => !d.dead && d.t <= 1.0001);
      e.queued = queued;
    }

    // Free-flying dots: dropped requests fall, bounced bots fly back
    for (const p of this.falling) {
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.falling = this.falling.filter(p => p.life > 0 && p.y < this.H + 20);
    for (const p of this.popups) { p.y -= 18 * dt; p.life -= dt; }
    this.popups = this.popups.filter(p => p.life > 0);
  }

  /** A request fails: it turns red and falls off the arrow. */
  dropDot(e, d, why, at = null) {
    d.dead = true;
    const p = curvePoint(e, at ?? d.t);
    this.falling.push({ x: p.x, y: p.y + d.jitter * 0.3, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, life: 1.2, color: COLORS.fail });
    // At most one label per arrow every ~1.2 s, so they stay readable
    const now = performance.now();
    if (!e.lastPopup || now - e.lastPopup > 1200) {
      e.lastPopup = now;
      const text = why === 'timeout' ? 'timeout' : why === 'clash' ? 'code clash' : '503';
      this.popups.push({ x: p.x, y: p.y - 12, text, life: 1, color: COLORS.fail });
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    for (const e of this.edges) {
      for (const d of e.dots) {
        const p = curvePoint(e, Math.min(1, d.t));
        // Small offset perpendicular-ish so parallel dots don't overlap exactly;
        // on two-way arrows requests stay tight on their own lane
        const spread = e.back ? Math.max(-1.5, Math.min(1.5, d.jitter * 0.3)) - 3 : d.jitter * 0.6;
        const y = p.y + (Math.abs(e.x2 - e.x1) > 10 ? spread : 0);
        const x = p.x + (Math.abs(e.x2 - e.x1) > 10 ? 0 : spread);
        const color = d.waiting > 1.2 ? COLORS.fail : COLORS[d.kind] || COLORS.read;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        drawShape(ctx, SHAPES[d.kind] || 'circle', x, y, d.kind === 'fail' ? 3.2 : 3.6);
      }
    }
    // Responses: hollow rings moving back toward the users
    for (const e of this.edges) {
      for (const d of e.backDots || []) {
        if (d.t < 0) continue;
        // On the return lane, moving back toward the users
        const p = curvePoint(e, 1 - d.t);
        ctx.fillStyle = COLORS.resp;
        ctx.shadowColor = COLORS.resp;
        ctx.shadowBlur = 4;
        drawShape(ctx, 'ring', p.x + e.nx * BACK_GAP, p.y + e.ny * BACK_GAP, 3);
      }
    }
    ctx.shadowBlur = 0;

    for (const p of this.falling) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      // Dropped requests fall as red crosses; bounced bots keep their triangle
      drawShape(ctx, p.color === COLORS.bot ? 'triangle' : 'cross', p.x, p.y, 3);
    }
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /** A quick visible request (e.g. the player's own Guestbook click). */
  pulse(method, failed) {
    const e = this.edges.find(x => x.flow === 'to-app' || x.flow === 'to-cdn' || x.flow === 'to-gateway' || x.flow === 'to-lb');
    if (!e) return;
    e.dots.push({ t: 0, kind: failed ? 'fail' : method === 'POST' ? 'write' : 'read', jitter: 0 });
  }

  /** Centre of a machine card on screen (for effects). */
  nodeCenter(role) {
    const n = Object.values(this.nodes).find(x => x.role === role && !x.virtual);
    return n ? { x: n.x, y: n.y } : null;
  }

  destroy() {
    this.running = false;
    this.resizeObserver?.disconnect();
    this.root?.remove();
  }
}
