/**
 * /api/feedback — players send feedback, it arrives in the owner's inbox.
 *
 * Mail goes out through Resend (env RESEND_API_KEY). The address it goes to is
 * FEEDBACK_TO (falls back to the owner's address below). Neither is ever sent to the browser.
 *
 * Abuse limits (checked before any mail is sent):
 *   - per visitor (IP, stored only as a hash): 3 per hour, 5 per day
 *   - whole site: 80 per day (Resend's free plan allows 100)
 *   - same text twice from the same visitor is ignored
 *   - message 5–1000 chars, optional name/contact ≤ 80 chars, hidden "website" trap field for bots
 * Counters live in Upstash Redis when it's connected, otherwise in this
 * function's memory (best effort). The edge middleware also caps /api calls per minute.
 */

import { createHash } from 'node:crypto';
import { redisConfig, pipeline } from './presence.js';

export const FEEDBACK_LIMITS = { PER_HOUR: 3, PER_DAY: 5, SITE_PER_DAY: 80, MAX_LEN: 1000, MIN_LEN: 5, FIELD_LEN: 80 };
const DEFAULT_TO = 'nikssefish2@gmail.com';
const HOUR = 3600, DAY = 86400;

const memory = new Map(); // key → { count, expires }

export function parseFeedback(body) {
  if (!body || typeof body !== 'object') return { error: 'Empty feedback.' };
  if (body.website) return { spam: true }; // bots fill every field
  const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);
  const message = clean(body.message, FEEDBACK_LIMITS.MAX_LEN + 1);
  if (message.length < FEEDBACK_LIMITS.MIN_LEN) return { error: 'Please write a little more.' };
  if (message.length > FEEDBACK_LIMITS.MAX_LEN) return { error: `Please keep it under ${FEEDBACK_LIMITS.MAX_LEN} characters.` };
  return {
    message,
    name: clean(body.name, FEEDBACK_LIMITS.FIELD_LEN),
    contact: clean(body.contact, FEEDBACK_LIMITS.FIELD_LEN),
    context: clean(body.context, 120)
  };
}

const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 24);

/** Count one hit on each key; returns the new counts. Uses Redis if available. */
export async function bump(keys, { cfg, now = Date.now(), fetchImpl = fetch } = {}) {
  if (cfg) {
    const cmds = [];
    for (const [k, ttl] of keys) cmds.push(['INCR', k], ['EXPIRE', k, String(ttl), 'NX']);
    const out = await pipeline(cfg, cmds, fetchImpl);
    return keys.map((_, i) => Number(out[i * 2]));
  }
  return keys.map(([k, ttl]) => {
    let e = memory.get(k);
    if (!e || e.expires <= now) e = { count: 0, expires: now + ttl * 1000 };
    e.count += 1;
    memory.set(k, e);
    return e.count;
  });
}

/** Decide whether this visitor may send. Returns null (ok) or a message to show. */
export async function checkLimits(ip, message, opts = {}) {
  const now = opts.now ?? Date.now();
  const id = hash(ip || 'unknown');
  const hourSlot = Math.floor(now / 1000 / HOUR), daySlot = Math.floor(now / 1000 / DAY);
  const [hour, day, site, dup] = await bump([
    [`fb:ip:${id}:h${hourSlot}`, HOUR],
    [`fb:ip:${id}:d${daySlot}`, DAY],
    [`fb:site:d${daySlot}`, DAY],
    [`fb:dup:${id}:${hash(message.toLowerCase())}`, DAY]
  ], { ...opts, now });
  if (dup > 1) return 'You already sent this one. Thanks!';
  if (hour > FEEDBACK_LIMITS.PER_HOUR) return 'You\'ve sent a lot of feedback this hour. Please try again later.';
  if (day > FEEDBACK_LIMITS.PER_DAY) return 'You\'ve reached today\'s feedback limit. Please try again tomorrow.';
  if (site > FEEDBACK_LIMITS.SITE_PER_DAY) return 'Feedback is full for today. Please try again tomorrow.';
  return null;
}

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function sendMail(fb, { env = process.env, fetchImpl = fetch } = {}) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FEEDBACK_FROM || 'Scale Architect <onboarding@resend.dev>',
      to: [env.FEEDBACK_TO || DEFAULT_TO],
      subject: `Feedback: ${fb.message.slice(0, 60)}`,
      ...(/^\S+@\S+\.\S+$/.test(fb.contact) ? { reply_to: fb.contact } : {}),
      text: `${fb.message}\n\nName: ${fb.name || '-'}\nContact: ${fb.contact || '-'}\nWhere: ${fb.context || '-'}`,
      html: `<p style="white-space:pre-wrap">${esc(fb.message)}</p><hr><p>Name: ${esc(fb.name || '-')}<br>Contact: ${esc(fb.contact || '-')}<br>Where: ${esc(fb.context || '-')}</p>`
    })
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ ok: false, error: 'Feedback isn\'t set up yet.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const fb = parseFeedback(body);
  if (fb.spam) return res.status(200).json({ ok: true });
  if (fb.error) return res.status(400).json({ ok: false, error: fb.error });
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  try {
    const limited = await checkLimits(ip, fb.message, { cfg: redisConfig() });
    if (limited) return res.status(429).json({ ok: false, error: limited });
    await sendMail(fb);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback send failed:', err && err.message);
    res.status(502).json({ ok: false, error: 'Couldn\'t send right now. Please try again later.' });
  }
}
