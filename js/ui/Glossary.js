/**
 * Glossary — turns system design terms in any text into clickable words.
 * Clicking one opens its explanation (same popover as the (i) buttons).
 *
 *   linkTerms('Add an ID generator so shards never clash')
 *   → 'Add an <button class="term" data-info="idGenerator">ID generator</button> so …'
 *
 * Only the first mention of each term in a piece of text is linked, and only
 * terms that have an explanation for the product being played.
 */

import { EXPLANATIONS } from '../data/explanations.js';

// Longer phrases first, so "API gateway" wins over "gateway"
const TERMS = [
  ['horizontal scaling', 'horizontalScaling'],
  ['vertical scaling', 'verticalScaling'],
  ['full table scan', 'index'],
  ['primary key', 'index'],
  ['primary-key index', 'index'],
  ['consistent hashing', 'sharding'],
  ['click analytics', 'clickAnalytics'],
  ['message queue', 'messageQueue'],
  ['ID generator', 'idGenerator'],
  ['ID ranges', 'idRanges'],
  ['load balancer', 'loadBalancer'],
  ['API gateway', 'gateway'],
  ['rate limiting', 'rateLimiting'],
  ['rate-limit', 'rateLimiting'],
  ['token bucket', 'rateLimiting'],
  ['Too Many Requests', 'rateLimiting'],
  ['hit rate', 'cache'],
  ['cache-aside', 'cache'],
  ['disk space', 'diskSpace'],
  ['web server', 'webServer'],
  ['running cost', 'runningCost'],
  ['user limit', 'userLimit'],
  ['ticket server', 'idGenerator'],
  ['Snowflake', 'idGenerator'],
  ['Base62', 'base62'],
  ['B-tree', 'index'],
  ['stateless', 'stateless'],
  ['sharding', 'sharding'],
  ['shards', 'sharding'],
  ['shard', 'sharding'],
  ['Kafka', 'messageQueue'],
  ['asynchronously', 'messageQueue'],
  ['Redis', 'cache'],
  ['CDN', 'cdn'],
  ['bottleneck', 'bottleneck'],
  ['latency', 'latency'],
  ['pagination', 'pagination'],
  ['index', 'index'],
  ['301', 'redirect301'],
  ['302', 'redirect301'],
  ['expiry', 'expiry'],
  ['cache', 'cache'],
  ['reputation', 'reputation'],
  ['funding', 'funding']
];

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = TERMS.map(([word, key]) => ({ key, re: new RegExp(`(^|[^\\w-])(${escape(word)})(?![\\w-])`, 'i') }));

// Text inside these tags is left alone
const SKIP = new Set(['button', 'a', 'code', 'h1', 'h2', 'h3', 'h4', 'kbd', 'summary']);

/** Wrap known terms in an HTML string with clickable buttons. */
export function linkTerms(html, { skip = [] } = {}) {
  if (!html) return html;
  const used = new Set(skip);
  const parts = String(html).split(/(<[^>]+>)/);
  const open = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      const m = part.match(/^<\/?\s*([a-z0-9]+)/i);
      const tag = m?.[1]?.toLowerCase();
      if (!tag || part.endsWith('/>')) continue;
      if (part.startsWith('</')) {
        const idx = open.lastIndexOf(tag);
        if (idx >= 0) open.splice(idx, 1);
      } else if (!['br', 'img', 'input', 'hr'].includes(tag)) {
        open.push(tag);
      }
      continue;
    }
    if (!part.trim() || open.some(t => SKIP.has(t))) continue;
    let text = part;
    for (const { key, re } of PATTERNS) {
      if (used.has(key) || !EXPLANATIONS[key]) continue;
      const m = text.match(re);
      if (!m) continue;
      used.add(key);
      const start = m.index + m[1].length;
      const word = m[2];
      // Mark with placeholders so later terms don't match inside the button
      text = `${text.slice(0, start)}\u0001${key}\u0002${word}\u0003${text.slice(start + word.length)}`;
    }
    parts[i] = text.replace(/\u0001([^\u0002]+)\u0002([^\u0003]+)\u0003/g,
      (_, key, word) => `<button type="button" class="term" data-info="${key}">${word}</button>`);
  }
  return parts.join('');
}
