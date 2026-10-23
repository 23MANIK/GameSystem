/**
 * /api/presence — "how many people are playing right now?"
 *
 * Each open game tab POSTs { id, product } about once a minute (only while
 * visible). We keep one Redis sorted set per product: member = random session
 * id, score = last ping time. "Playing now" = pings in the last 90 seconds.
 * No names or IP addresses are stored.
 *
 * Redis: Upstash (Vercel Marketplace). Reads either env var naming:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL / KV_REST_API_TOKEN.
 * Without them the endpoint answers { configured: false } and the game hides the counter.
 *
 * Cost: one ping ≈ 4 Redis commands (ZADD + 3 × ZCOUNT, plus an occasional cleanup).
 */

export const PRODUCTS = ['guestbook', 'url_shortener', 'cloud_drive'];
export const ACTIVE_MS = 90_000;     // a session counts as "playing" for 90 s after its last ping
const PRUNE_CHANCE = 0.05;           // 1 in 20 pings also removes stale sessions
const KEY = p => `presence:${p}`;

export function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** Run several Redis commands in one HTTP call (Upstash REST pipeline). */
export async function pipeline(cfg, commands, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = await res.json();
  return out.map(r => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

/** Validate a ping. Returns { id, product } or null. */
export function parsePing(body) {
  const id = typeof body?.id === 'string' ? body.id : '';
  const product = typeof body?.product === 'string' ? body.product : '';
  if (!/^[a-z0-9]{8,32}$/.test(id)) return null;
  return { id, product: PRODUCTS.includes(product) ? product : null };
}

/**
 * Record a ping (if any) and count who's playing.
 * Returns { configured, online, byProduct }.
 */
export async function presence(ping, { cfg, now = Date.now(), fetchImpl = fetch, random = Math.random } = {}) {
  if (!cfg) return { configured: false, online: null, byProduct: {} };
  const since = now - ACTIVE_MS;
  const commands = [];
  if (ping?.product) {
    commands.push(['ZADD', KEY(ping.product), String(now), ping.id]);
    if (random() < PRUNE_CHANCE) commands.push(['ZREMRANGEBYSCORE', KEY(ping.product), '0', String(since)]);
  }
  const countAt = commands.length;
  for (const p of PRODUCTS) commands.push(['ZCOUNT', KEY(p), String(since), '+inf']);
  const out = await pipeline(cfg, commands, fetchImpl);
  const byProduct = {};
  PRODUCTS.forEach((p, i) => { byProduct[p] = Number(out[countAt + i]) || 0; });
  const online = Object.values(byProduct).reduce((a, b) => a + b, 0);
  return { configured: true, online, byProduct };
}

/** Vercel Node function. GET = just count; POST { id, product } = ping + count. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }
  let ping = null;
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    ping = parsePing(body);
    if (!ping) {
      res.status(400).json({ error: 'bad ping' });
      return;
    }
  }
  try {
    res.status(200).json(await presence(ping, { cfg: redisConfig() }));
  } catch (err) {
    // Never break the game over a counter
    res.status(200).json({ configured: true, online: null, byProduct: {}, error: 'unavailable' });
  }
}
