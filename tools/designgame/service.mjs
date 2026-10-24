/**
 * service.mjs — the server side of Create DesignGame (served as /api/designgame,
 * see deploy/api/designgame.js).
 *
 * Making a game is a job saved in Redis and run one step per request: the
 * creator's browser calls "step" until the job is done, so no request runs
 * longer than one or two model calls. Closing the tab just pauses the job.
 *
 *   GET  ?action=list                    published games (for the product picker)
 *   GET  ?action=game&id=dg_…            one game's data pack (published, or anyone with the link)
 *   GET  ?action=job&id=…                a job's progress
 *   POST { action: 'auth', passcode }                      check the passcode
 *   POST { action: 'start', passcode, input }              start a job → { jobId }
 *   POST { action: 'step', passcode, jobId }               run the job's next step
 *   POST { action: 'publish', passcode, id, public }       show / hide a game in the picker
 *
 * Env: ANTHROPIC_API_KEY, DESIGNGAME_PASSCODE (no passcode = creating is off),
 * DESIGNGAME_DAILY_MAX (jobs per day, default 5), and the Upstash Redis vars
 * that presence.js reads.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { newJob, runStep, isFinished, makeClient } from './generate.mjs';

const DAY = 86400;
const JOB_TTL = 7 * DAY;
const LOCK_SECS = 330;
const BAD_PASS_PER_HOUR = 5;
const KEYS = {
  job: id => `dg:job:${id}`,
  lock: id => `dg:lock:${id}`,
  game: id => `dg:game:${id}`,
  index: 'dg:games',
  day: d => `dg:jobs:${d}`,
  badPass: (ip, h) => `dg:badpass:${ip}:${h}`
};

// ─── Redis (Upstash REST) ───

export function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** A tiny store over Upstash's REST pipeline; tests pass an in-memory one. */
export function redisStore(cfg, fetchImpl = fetch) {
  const run = async commands => {
    const res = await fetchImpl(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return (await res.json()).map(r => { if (r.error) throw new Error(r.error); return r.result; });
  };
  return {
    get: async k => (await run([['GET', k]]))[0],
    set: async (k, v, ttl) => { await run([ttl ? ['SET', k, v, 'EX', String(ttl)] : ['SET', k, v]]); },
    setNx: async (k, v, ttl) => (await run([['SET', k, v, 'NX', 'EX', String(ttl)]]))[0] === 'OK',
    del: async k => { await run([['DEL', k]]); },
    incr: async (k, ttl) => Number((await run([['INCR', k], ['EXPIRE', k, String(ttl), 'NX']]))[0]),
    hset: async (h, f, v) => { await run([['HSET', h, f, v]]); },
    hgetall: async h => {
      const flat = (await run([['HGETALL', h]]))[0] || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
      return out;
    }
  };
}

/** Same interface in memory (tests, or local runs without Redis). */
export function memoryStore() {
  const m = new Map();
  const live = k => { const e = m.get(k); if (e && e.exp && e.exp < Date.now()) { m.delete(k); return null; } return e; };
  return {
    get: async k => live(k)?.v ?? null,
    set: async (k, v, ttl) => { m.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }); },
    setNx: async (k, v, ttl) => { if (live(k)) return false; m.set(k, { v, exp: Date.now() + ttl * 1000 }); return true; },
    del: async k => { m.delete(k); },
    incr: async (k, ttl) => { const e = live(k) || { v: 0, exp: Date.now() + ttl * 1000 }; e.v = Number(e.v) + 1; m.set(k, e); return e.v; },
    hset: async (h, f, v) => { const e = live(h) || { v: {}, exp: 0 }; e.v[f] = v; m.set(h, e); },
    hgetall: async h => ({ ...(live(h)?.v || {}) })
  };
}

// ─── Passcode and limits ───

const digest = s => createHash('sha256').update(String(s)).digest();
const ipHash = ip => createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 20);

/** Is the passcode right? Wrong guesses are capped per visitor per hour. Returns null or an error. */
export async function checkPasscode(store, env, passcode, ip, now = Date.now()) {
  if (!env.DESIGNGAME_PASSCODE) return { status: 503, error: 'Creating games isn\'t switched on.' };
  const hour = Math.floor(now / 3600e3);
  const key = KEYS.badPass(ipHash(ip), hour);
  if (Number(await store.get(key) || 0) >= BAD_PASS_PER_HOUR) return { status: 429, error: 'Too many wrong passcodes. Try again in an hour.' };
  if (typeof passcode === 'string' && timingSafeEqual(digest(passcode), digest(env.DESIGNGAME_PASSCODE))) return null;
  await store.incr(key, 3600);
  return { status: 401, error: 'Wrong passcode.' };
}

/** Public view of a job (no conversation, no research text). */
export function jobView(id, job) {
  return {
    id,
    stage: job.stage,
    done: isFinished(job),
    name: job.check?.name || null,
    gameId: job.stage === 'done' ? job.data?.id : null,
    log: job.log,
    error: job.error || null,
    sources: job.research?.sources || [],
    levels: (job.data || job.outline)?.levels?.map(L => ({ level: L.level, name: L.name, subtitle: L.subtitle })) || [],
    warnings: job.result?.warnings || [],
    cost: Math.round((job.usage?.dollars || 0) * 100) / 100,
    round: job.round
  };
}

function summary(data, isPublic) {
  return {
    id: data.id,
    name: data.meta.name,
    icon: data.meta.icon,
    likeWhat: data.meta.likeWhat || '',
    tagline: data.meta.tagline,
    concepts: data.meta.concepts || [],
    levels: data.levels.map(L => ({ level: L.level, name: L.name, focus: L.subtitle })),
    createdAt: data.generated?.at || new Date().toISOString(),
    public: Boolean(isPublic)
  };
}

// ─── Actions ───

/**
 * Handle one API call. Returns { status, body }. deps: { store, env, ip, client? }.
 * The model client is only made when a step needs it.
 */
export async function handleAction(method, query, body, { store, env = process.env, ip = '', client, now = Date.now() }) {
  const action = method === 'GET' ? query.action : body?.action;

  if (method === 'GET') {
    if (action === 'list') {
      const all = Object.values(await store.hgetall(KEYS.index)).map(s => JSON.parse(s));
      return { status: 200, body: { games: all.filter(g => g.public).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) } };
    }
    if (action === 'game') {
      if (!/^dg_[a-z0-9_]{3,60}$/.test(String(query.id || ''))) return { status: 400, body: { error: 'Bad game id.' } };
      const raw = await store.get(KEYS.game(query.id));
      return raw ? { status: 200, body: JSON.parse(raw) } : { status: 404, body: { error: 'No such game.' } };
    }
    if (action === 'job') {
      if (!/^[a-f0-9]{16}$/.test(String(query.id || ''))) return { status: 400, body: { error: 'Bad job id.' } };
      const raw = await store.get(KEYS.job(query.id));
      return raw ? { status: 200, body: jobView(query.id, JSON.parse(raw)) } : { status: 404, body: { error: 'No such job.' } };
    }
    return { status: 400, body: { error: 'Unknown action.' } };
  }

  if (method !== 'POST') return { status: 405, body: { error: 'GET or POST only.' } };
  const denied = await checkPasscode(store, env, body?.passcode, ip, now);
  if (denied) return { status: denied.status, body: { error: denied.error } };

  if (action === 'auth') return { status: 200, body: { ok: true } };

  if (action === 'start') {
    if (!env.ANTHROPIC_API_KEY && !client) return { status: 503, body: { error: 'The Claude API key isn\'t set up.' } };
    const prompt = String(body.input?.prompt || '').trim();
    if (prompt.length < 3) return { status: 400, body: { error: 'Say what to design.' } };
    const max = Number(env.DESIGNGAME_DAILY_MAX || 5);
    const today = Math.floor(now / 1000 / DAY);
    if (await store.incr(KEYS.day(today), DAY) > max) return { status: 429, body: { error: `That's ${max} games today, the daily limit. Try again tomorrow.` } };
    const jobId = randomBytes(8).toString('hex');
    const job = newJob(body.input, { idSuffix: randomBytes(2).toString('hex') });
    await store.set(KEYS.job(jobId), JSON.stringify(job), JOB_TTL);
    return { status: 200, body: { jobId, job: jobView(jobId, job) } };
  }

  if (action === 'step') {
    const jobId = String(body.jobId || '');
    if (!/^[a-f0-9]{16}$/.test(jobId)) return { status: 400, body: { error: 'Bad job id.' } };
    const raw = await store.get(KEYS.job(jobId));
    if (!raw) return { status: 404, body: { error: 'No such job.' } };
    let job = JSON.parse(raw);
    if (isFinished(job)) return { status: 200, body: jobView(jobId, job) };
    // One step at a time per job, even if two tabs are open
    if (!(await store.setNx(KEYS.lock(jobId), '1', LOCK_SECS))) return { status: 409, body: { ...jobView(jobId, job), busy: true } };
    try {
      job = await runStep(job, client || await makeClient());
      if (job.stage === 'done') {
        await store.set(KEYS.game(job.data.id), JSON.stringify(job.data));
        await store.hset(KEYS.index, job.data.id, JSON.stringify(summary(job.data, false)));
      }
      await store.set(KEYS.job(jobId), JSON.stringify(job), JOB_TTL);
    } finally {
      await store.del(KEYS.lock(jobId));
    }
    return { status: 200, body: jobView(jobId, job) };
  }

  if (action === 'publish') {
    const raw = await store.get(KEYS.game(String(body.id || '')));
    if (!raw) return { status: 404, body: { error: 'No such game.' } };
    const s = summary(JSON.parse(raw), body.public !== false);
    await store.hset(KEYS.index, s.id, JSON.stringify(s));
    return { status: 200, body: { ok: true, game: s } };
  }

  return { status: 400, body: { error: 'Unknown action.' } };
}

/** Vercel Node function entry (req/res style, like the other /api functions). */
export async function handle(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = redisConfig();
  if (!cfg) return res.status(503).json({ error: 'Storage isn\'t set up.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try {
    const out = await handleAction(req.method, req.query || {}, body, { store: redisStore(cfg), ip });
    res.status(out.status).json(out.body);
  } catch (err) {
    console.error('designgame failed:', err && (err.stack || err.message));
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
