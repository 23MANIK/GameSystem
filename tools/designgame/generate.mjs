/**
 * generate.mjs — the Create DesignGame agent: prompt in, playable data pack out.
 *
 * Stages (each one is its own function, so a server job can run them one at a
 * time and save the result in between):
 *   1. checkPrompt  Claude Haiku 5.5: is this a system to design? Name and id.
 *   2. research     Claude Opus 5.5 + web search / fetch: requirements, numbers,
 *                   deep dives, the order a real system adds its parts, sources.
 *   3. design       Claude Opus 5.5: the levels as a data pack (JSON).
 *   4. gate         Our own code: validate, auto-tune the money numbers, then the
 *                   balance check and headless play-test (tools/designgame/checkGame.mjs).
 *   5. repair       Claude Opus 5.5 fixes what the gate found (up to 2 rounds).
 *
 * See docs/designgame/data-pack-format.md for the JSON format.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDataPack, validateDataPack, COUNTER_STATS, SHARE_STATS } from '../../js/products/dataPack.js';
import { registerPack } from '../../js/products/registry.js';
import { ROLES } from '../../js/data/roles.js';
import { CODE_FIXES } from '../../js/data/codeFixes.js';
import { checkGame } from './checkGame.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

export const MODELS = { main: 'claude-opus-5-5', check: 'claude-haiku-5-5' };
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const DEFAULT_INPUT = { levels: 8, focus: [], audience: 'beginner', sources: [] };

// ─── Usage and cost ───

// $ per million tokens (input, output, cache read, cache write 5 min); web search $10 / 1,000
const PRICES = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125]
};

export function newUsage() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0, dollars: 0 };
}

function addUsage(total, model, u = {}) {
  const [pi, po, pr, pw] = PRICES[model] || PRICES['claude-opus-5-5'];
  const searches = u.server_tool_use?.web_search_requests || 0;
  total.calls += 1;
  total.input += u.input_tokens || 0;
  total.output += u.output_tokens || 0;
  total.cacheRead += u.cache_read_input_tokens || 0;
  total.cacheWrite += u.cache_creation_input_tokens || 0;
  total.searches += searches;
  total.dollars += ((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po
    + (u.cache_read_input_tokens || 0) * pr + (u.cache_creation_input_tokens || 0) * pw) / 1e6 + searches * 0.01;
  total.dollars = Math.round(total.dollars * 1000) / 1000;
  return total;
}

/** The Anthropic client (reads ANTHROPIC_API_KEY). Loaded lazily so tests can run without the SDK. */
export async function makeClient(opts = {}) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ maxRetries: 3, timeout: 15 * 60 * 1000, ...opts });
}

function textOf(message) {
  return message.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function checkStop(message, stage) {
  if (message.stop_reason === 'refusal') {
    const why = message.stop_details?.explanation || message.stop_details?.category || 'no reason given';
    throw new GenerateError(`The model declined the ${stage} step (${why}).`, 'refused');
  }
  if (message.stop_reason === 'max_tokens') throw new GenerateError(`The ${stage} answer was cut off (too long).`, 'too_long');
}

export class GenerateError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** Pull the first JSON object out of a reply (it may sit in a ```json block). */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const body = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new GenerateError(`The design was not valid JSON (${e.message}).`, 'bad_json');
  }
}

// ─── 1. Check the prompt ───

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    reason: { type: 'string' },
    name: { type: 'string' },
    likeWhat: { type: 'string' },
    icon: { type: 'string' },
    slug: { type: 'string' }
  },
  required: ['ok', 'reason', 'name', 'likeWhat', 'icon', 'slug'],
  additionalProperties: false
};

/** Is this a software system someone could design? Returns { ok, reason, name, likeWhat, icon, id }. */
export async function checkPrompt(client, input, usage = newUsage()) {
  const message = await client.messages.create({
    model: MODELS.check,
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CHECK_SCHEMA } },
    system: 'You screen requests for Scale Architect, a game that teaches system design by scaling a product level by level. '
      + 'Accept any real software product or backend system someone could design at scale (a URL shortener, chat app, ride hailing, payments, a search engine, a rate limiter...). '
      + 'Reject anything that is not a software system to design, is harmful, or asks you to do something else. '
      + 'name: a short product name in Title Case (e.g. "Ride Hailing"). likeWhat: "like <well-known example>" (e.g. "like Uber"). '
      + 'icon: one emoji. slug: lowercase words joined by _ (e.g. ride_hailing). reason: one short sentence.',
    messages: [{ role: 'user', content: `<request>${String(input.prompt).slice(0, 600)}</request>` }]
  });
  addUsage(usage, MODELS.check, message.usage);
  checkStop(message, 'prompt check');
  const out = JSON.parse(textOf(message));
  const slug = String(out.slug || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'game';
  return { ...out, id: `dg_${slug}` };
}

// ─── 2. Research ───

const RESEARCH_SYSTEM = `You research how a real product is designed at scale, for Scale Architect: a browser game that teaches system design by growing one product from a single server to a large system, one level at a time.

Search the web. Start from Hello Interview's problem breakdown for this product if one exists (hellointerview.com/learn/system-design/problem-breakdowns/...), then fill gaps with ByteByteGo / Alex Xu's System Design Interview, the company's own engineering blog for real numbers, or a system design handbook. Skip pages that need a login. Prefer 4–8 good sources over many weak ones.

Write your findings in Markdown, in your own words (never copy sentences):
1. **Sources**: a list of "title — URL" for every page you used.
2. **Requirements**: functional and non-functional.
3. **Numbers**: DAU, read and write QPS, read:write ratio, size per item, total storage, latency targets. Mark guesses "(estimate)".
4. **API**: the main endpoints.
5. **Deep dives**: for each real problem: what goes wrong, the options, the trade-off, and what is usually chosen.
6. **Order of growth**: a numbered list from "one server does everything" to the final design, one new piece per step, saying which problem forces each piece.

Keep it under about 1,500 words.`;

/** Research the system on the web. Returns { notes, sources: [{ title, url }] }. */
export async function research(client, input, check, usage = newUsage()) {
  const ask = [
    `Product: ${check.name} (${check.likeWhat}).`,
    `The player's request: <request>${String(input.prompt).slice(0, 600)}</request>`,
    input.focus?.length ? `Pay extra attention to: ${input.focus.join(', ')}.` : '',
    input.sources?.length ? `Read these pages first:\n${input.sources.map(u => `- ${u}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  const messages = [{ role: 'user', content: ask }];
  let message;
  for (let turn = 0; turn < 6; turn++) {
    message = await client.beta.messages.stream({
      model: MODELS.main,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: RESEARCH_SYSTEM,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 10 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8, max_content_tokens: 30000 }
      ],
      messages
    }).finalMessage();
    addUsage(usage, MODELS.main, message.usage);
    if (message.stop_reason !== 'pause_turn') break;
    // The server-side search loop paused: send the turn back to let it continue
    messages.push({ role: 'assistant', content: message.content });
  }
  checkStop(message, 'research');

  const sources = [];
  for (const b of message.content) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) sources.push({ title: r.title || r.url, url: r.url });
    }
  }
  const notes = textOf(message).trim();
  if (notes.length < 400) throw new GenerateError('The research came back nearly empty.', 'thin_research');
  return { notes, sources: dedupeSources(sources, notes) };
}

/** Keep the sources the notes actually cite, else the first few found. */
function dedupeSources(found, notes) {
  const seen = new Set();
  const all = found.filter(s => !seen.has(s.url) && seen.add(s.url));
  const cited = all.filter(s => notes.includes(s.url));
  return (cited.length ? cited : all).slice(0, 10);
}

// ─── 3. Design ───

/** What the engine can do, listed from the live game data so it never goes stale. */
function engineReference() {
  const roles = Object.values(ROLES).map(r => `- \`${r.id}\` ${r.name}: ${r.job || ''}`).join('\n');
  const fixes = Object.values(CODE_FIXES).map(f => `- \`${f.id}\` ${f.name}${f.toggle ? ' (a switch with a trade-off)' : ''}: ${f.short || ''}`).join('\n');
  return `## Machines (roles)\n${roles}\n\n## Code fixes (one-time purchases)\n${fixes}\n\n`
    + `## Stats goals can watch\n- counter goals (gs.liveStats): ${COUNTER_STATS.join(', ')}\n- statAtLeast goals (gs.serverStatus, 0–1): ${SHARE_STATS.join(', ')}\n`;
}

let designSystemCache = null;
function designSystem() {
  if (designSystemCache) return designSystemCache;
  designSystemCache = `You design levels for Scale Architect, a browser game that teaches system design. The player grows one product from a single server to a large system. Each level is one real problem the player feels (things get slow, a disk fills up, bots attack, a server crashes) and one new piece that solves it.

You write the whole game as one JSON "data pack". The game can only use the machines, code fixes, traffic params and goal types listed below: you cannot invent new ones. When a real-world piece has no match, map it onto the closest existing machine and say so in that level's realWorld notes, or leave it out.

# Rules for levels
- Level 1 is always "one server does everything" (mode "single-server", roles app only, startingCoins 500, coinRate 25, spikeRange [1.2, 1.4]).
- Level 2 moves the data to its own database (mode "app-db" from here on).
- Order levels easy → hard, following the real order of growth from the research.
- Each level adds ONE new machine (or one scale-out step: more app servers behind a load balancer, or database shards), unlocked at that level in "roles". Two pieces share a level only when they are one problem (e.g. shards + ID generator).
- The new piece must be needed: set the level's traffic params so the level can't be won without it (e.g. bots via botShare need the gateway; far-away users via globalShare/distanceMs need the CDN; a hot read set via readsPerUser + cacheHitRate needs the cache; crashes: true needs a load balancer and several app servers).
- Keep real ratios and orders of magnitude (read:write ratio, item sizes), but scale absolute numbers so a level takes minutes. User targets grow roughly 100 → 400 → 600 → 1,500 → 2,500 → 3,500 → 5,000.
- audience ≈ 1.25 × userTarget. coinRate: 25 on level 1, then about 4–8 (the game re-tunes money numbers automatically, so rough values are fine).
- Every level has goals: one "placed" goal for its new machine (or a "machines" goal for scale-out), a "users" goal at its userTarget, one or two goals about the level's problem (latency, a counter, errorRate, statAtLeast, cpuUnder, fixOwned), often an "incident" goal, and a "profit" goal last.
- Hints are practical: say which tab to open and what to watch. Plain words, short sentences.
- Tutorial: levels 1 and 2 copy the example's step lists (same ids and kinds, your own words for this product). Later levels use { "newMachine": { role, welcome, buy, explain } }; add "extra" steps for scale-out (builderTab "app" with advanceOn "appServerPlaced", or builderTab "db" with advanceOn "dbShardPlaced").
- story: what the player faces, 2–3 sentences. completionMessage: what they learned and what comes next. realWorld: 2–3 real numbers or services, one per item. feature: the product feature and its main endpoints (rate: readsPerSec or writesPerSec).
- vocab: the product's own words (record "ride", records "rides", writeFails "every new ride request fails", readName "location lookup"). incidents: 2–3 stories per kind, in this product's world.
- Only <strong>, <em> and <code> are allowed inside text.
- playtest (optional) tells the test bot how many app servers / shards to run per level, e.g. { "apps": { "4": 3 }, "shards": { "7": 3 } }; add it when a goal asks for a specific number.

# The format
${read('docs/designgame/data-pack-format.md')}

# Traffic params the engine models
${read('.claude/skills/design-product-levels/reference/engine-capabilities.md').split('## Code fixes')[0]}

# The game's machines, code fixes and stats
${engineReference()}

# A complete example: the URL Shortener as a data pack
\`\`\`json
${read('tools/designgame/url-shortener.pack.json')}
\`\`\`

Answer with only the JSON data pack, in one \`\`\`json block.`;
  return designSystemCache;
}

function designRequest(input, check, researchOut) {
  return [
    `Design "${check.name}" (${check.likeWhat}). id: "${check.id}". meta.icon: "${check.icon}".`,
    `Number of levels: ${input.levels}.`,
    input.focus?.length ? `Lean the levels toward: ${input.focus.join(', ')}.` : '',
    input.audience === 'interview'
      ? 'The players are preparing for system design interviews: use the real terms, mention trade-offs interviewers ask about, keep the tutorial short.'
      : 'The players are beginners: explain each idea simply in the tutorial and hints.',
    `The player's request: <request>${String(input.prompt).slice(0, 600)}</request>`,
    `Research:\n<research>\n${researchOut.notes}\n</research>`,
    `Put these in meta.sources: ${JSON.stringify(researchOut.sources)}`
  ].filter(Boolean).join('\n\n');
}

async function callDesigner(client, messages, usage) {
  const message = await client.beta.messages.stream({
    model: MODELS.main,
    max_tokens: 64000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: [{ type: 'text', text: designSystem(), cache_control: { type: 'ephemeral' } }],
    messages
  }).finalMessage();
  addUsage(usage, MODELS.main, message.usage);
  checkStop(message, 'design');
  return message;
}

/** Design the levels. Returns { data, messages } (messages let repair continue the conversation). */
export async function design(client, input, check, researchOut, usage = newUsage()) {
  const messages = [{ role: 'user', content: designRequest(input, check, researchOut) }];
  const message = await callDesigner(client, messages, usage);
  messages.push({ role: 'assistant', content: message.content });
  return { data: extractJson(textOf(message)), messages };
}

// ─── 4. Gate: validate, tune, test ───

/**
 * Money numbers the skill has formulas for, set from the balance check:
 *   coinRate ≈ 2.5 × running cost / (0.3 × userTarget)   (level 1 stays generous)
 *   profit goal ≈ 6 × running cost per minute
 *   audience ≥ 1.2 × userTarget
 */
export function autotune(data, gateResult) {
  const out = JSON.parse(JSON.stringify(data));
  for (const L of out.levels) {
    L.audience = Math.max(L.audience || 0, Math.round(L.userTarget * 1.2));
    const row = gateResult?.balance?.find(b => b.level === L.level);
    if (!row?.run) continue;
    if (L.level > 1) L.coinRate = Math.max(1, Math.round(2.5 * row.run / (0.3 * L.userTarget) * 10) / 10);
    const profit = (out.goals[L.level] || []).find(g => g.type === 'profit');
    if (profit && L.level > 1) profit.target = Math.max(500, Math.round(6 * row.run / 100) * 100);
  }
  return out;
}

/** Validate, compile and play the game. Returns { ok, problems, warnings, report }. */
export function gate(data) {
  const problems = validateDataPack(data);
  if (problems.length) return { ok: false, stage: 'format', problems, warnings: [] };
  const pack = registerPack(compileDataPack(data));
  const result = checkGame(pack.id);
  return { ok: result.passed, stage: 'play', problems: result.errors, warnings: result.warnings, report: result };
}

/** Gate, then tune the money from the balance numbers and gate again. */
export function gateAndTune(data) {
  const first = gate(data);
  if (first.stage === 'format') return { data, result: first };
  const tuned = autotune(data, first.report);
  const second = gate(tuned);
  // Keep the tuned version unless tuning broke a level the first one passed
  return second.ok || !first.ok ? { data: tuned, result: second } : { data, result: first };
}

// ─── 5. Repair ───

export async function repair(client, messages, data, result, usage = newUsage()) {
  const ask = [
    'The game checker found problems with this data pack. Fix them and answer with the whole corrected data pack in one ```json block.',
    result.stage === 'format'
      ? 'These fields are not valid:'
      : 'It is valid, but the balance check and test-play bot found these problems (a level the bot is "stuck" on usually has a goal that cannot be reached, or traffic numbers that are too high for the machines available at that level):',
    result.problems.map(p => `- ${p}`).join('\n'),
    result.warnings?.length ? `Warnings (fix if easy):\n${result.warnings.map(w => `- ${w}`).join('\n')}` : '',
    'The current version (with re-tuned money numbers):',
    '```json\n' + JSON.stringify(data) + '\n```'
  ].filter(Boolean).join('\n\n');
  const convo = [...messages, { role: 'user', content: ask }];
  const message = await callDesigner(client, convo, usage);
  convo.push({ role: 'assistant', content: message.content });
  return { data: extractJson(textOf(message)), messages: convo };
}

// ─── Whole pipeline ───

/**
 * Run every stage. onStage(name, info) is called as each one starts and ends.
 * Returns { ok, data, check, research, result, usage, rounds }.
 */
export async function generateGame(input, { client, onStage = () => {}, maxRepairs = 2 } = {}) {
  client ??= await makeClient();
  const usage = newUsage();
  const inp = { ...DEFAULT_INPUT, ...input };
  inp.levels = Math.min(10, Math.max(5, Number(inp.levels) || 8));

  onStage('check');
  const check = await checkPrompt(client, inp, usage);
  if (!check.ok) throw new GenerateError(`This doesn't look like a system to design: ${check.reason}`, 'rejected');

  onStage('research', { name: check.name });
  const researchOut = await research(client, inp, check, usage);
  onStage('research_done', { sources: researchOut.sources });

  onStage('design');
  let { data, messages } = await design(client, inp, check, researchOut, usage);
  data.id = check.id;
  data.format = 1;

  let tuned = null;
  let rounds = 0;
  for (;;) {
    onStage('test', { round: rounds });
    tuned = gateAndTune(data);
    if (tuned.result.ok || rounds >= maxRepairs) break;
    rounds += 1;
    onStage('repair', { round: rounds, problems: tuned.result.problems });
    ({ data, messages } = await repair(client, messages, tuned.data, tuned.result, usage));
    data.id = check.id;
    data.format = 1;
  }
  const final = tuned.data;
  final.meta = { ...final.meta, sources: final.meta?.sources?.length ? final.meta.sources : researchOut.sources };
  final.generated = { at: new Date().toISOString(), model: MODELS.main, prompt: String(inp.prompt).slice(0, 600), input: inp, repairs: rounds };
  onStage('done', { ok: tuned.result.ok });
  return { ok: tuned.result.ok, data: final, check, research: researchOut, result: tuned.result, usage, rounds };
}
