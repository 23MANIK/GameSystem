/**
 * client.js — the browser side of Create DesignGame: talk to /api/designgame,
 * and load generated games (data packs) into the game.
 *
 * A generated game is plain JSON. Loading one compiles it (js/products/dataPack.js),
 * registers it as a product pack and adds it to the product list, so the rest
 * of the game plays it like any hand-made product.
 */

import { compileDataPack, productEntry } from '../products/dataPack.js';
import { registerPack, hasPack } from '../products/registry.js';
import { PRODUCTS } from '../data/products.js';

const API = '/api/designgame';
const CACHE = id => `sa-dg-pack:${id}`;
const PASS = 'sa-dg-pass';
const JOB = 'sa-dg-job';

export const isGeneratedId = id => typeof id === 'string' && /^dg_[a-z0-9_]{3,60}$/.test(id);

const store = {
  get: (k, session = false) => { try { return (session ? sessionStorage : localStorage).getItem(k); } catch { return null; } },
  set: (k, v, session = false) => { try { (session ? sessionStorage : localStorage).setItem(k, v); } catch { /* private mode */ } },
  del: (k, session = false) => { try { (session ? sessionStorage : localStorage).removeItem(k); } catch { /* private mode */ } }
};

async function call(method, params) {
  const res = method === 'GET'
    ? await fetch(`${API}?${new URLSearchParams(params)}`, { cache: 'no-store' })
    : await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON (e.g. the rate limiter's 429 text) */ }
  if (!res.ok && res.status !== 409) {
    const err = new Error(body?.error || (res.status === 429 ? 'Too many requests. Wait a minute and try again.' : `Server error (${res.status}).`));
    err.status = res.status;
    throw err;
  }
  return { status: res.status, body };
}

// ─── Playing generated games ───

/** Add a compiled game to the product list (once). */
function install(data) {
  const pack = registerPack(compileDataPack(data));
  const entry = productEntry(pack);
  const i = PRODUCTS.findIndex(p => p.id === pack.id);
  if (i >= 0) PRODUCTS[i] = entry; else PRODUCTS.push(entry);
  return entry;
}

/**
 * Make sure a generated game can be played: from this browser's copy, else the server.
 * Returns its product entry, or null if it can't be loaded.
 */
export async function ensureGame(id, { refresh = false } = {}) {
  if (!isGeneratedId(id)) return null;
  if (hasPack(id) && !refresh) return PRODUCTS.find(p => p.id === id) || null;
  const cached = !refresh && store.get(CACHE(id));
  if (cached) {
    try { return install(JSON.parse(cached)); } catch { store.del(CACHE(id)); }
  }
  try {
    const { body } = await call('GET', { action: 'game', id });
    const entry = install(body);
    store.set(CACHE(id), JSON.stringify(body));
    return entry;
  } catch (e) {
    console.warn(`Couldn't load game ${id}:`, e.message);
    return null;
  }
}

/** Published community games (summaries). Empty when the API isn't there. */
export async function listGames() {
  try {
    const { body } = await call('GET', { action: 'list' });
    return Array.isArray(body?.games) ? body.games : [];
  } catch {
    return [];
  }
}

/** The product id saved in this browser, without loading the whole save. */
export function savedProductId(saveKey) {
  try { return JSON.parse(localStorage.getItem(saveKey) || 'null')?.productId || null; } catch { return null; }
}

/** A game shared by link: ?game=dg_… */
export function linkedGameId() {
  try {
    const id = new URLSearchParams(location.search).get('game');
    return isGeneratedId(id) ? id : null;
  } catch { return null; }
}

export function shareLink(id) {
  return `${location.origin}${location.pathname}?game=${encodeURIComponent(id)}`;
}

// ─── Creating games ───

export const passcode = {
  get: () => store.get(PASS, true) || store.get(PASS),
  set: (v, remember) => { store.set(PASS, v, true); if (remember) store.set(PASS, v); },
  clear: () => { store.del(PASS, true); store.del(PASS); }
};

export const currentJob = {
  get: () => store.get(JOB),
  set: id => store.set(JOB, id),
  clear: () => store.del(JOB)
};

export const api = {
  auth: code => call('POST', { action: 'auth', passcode: code }),
  start: input => call('POST', { action: 'start', passcode: passcode.get(), input }),
  step: jobId => call('POST', { action: 'step', passcode: passcode.get(), jobId }),
  job: id => call('GET', { action: 'job', id }),
  publish: (id, isPublic) => call('POST', { action: 'publish', passcode: passcode.get(), id, public: isPublic })
};
