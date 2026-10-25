/**
 * generate.mjs — the Create DesignGame agent: prompt in, playable data pack out.
 *
 * Stages (each one is its own function, so a server job can run them one at a
 * time and save the result in between):
 *   1. checkPrompt  Claude Haiku 5.5: is this a system to design? Name and id.
 *   2. research     Claude Opus 5.5 + web search / fetch: requirements, numbers,
 *                   deep dives, the order a real system adds its parts, sources.
 *   3. plan         Claude Opus 5.5: the outline (numbers, machines, goals) as JSON.
 *   4. details      Claude Opus 5.5, one call per level in parallel: stories,
 *                   hints, tutorial. Split this way so no call runs for long
 *                   (server functions have a time limit) and repairs stay small.
 *   5. gate         Our own code: validate, auto-tune the money numbers, then the
 *                   balance check and headless play-test (tools/designgame/checkGame.mjs).
 *   6. repair       Claude Opus 5.5 fixes the outline (and rewrites the words of
 *                   any level that changed), up to 2 rounds.
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
import { splitPack, mergePack } from './split.mjs';
import { loadLibrary, libraryMenu, pickNotes } from './library.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// The deployed copy keeps the skill's engine notes next to the format doc (see tools/sync-deploy.sh)
const readEngineNotes = () => {
  for (const rel of ['.claude/skills/design-product-levels/reference/engine-capabilities.md', 'docs/designgame/engine-capabilities.md']) {
    if (fs.existsSync(path.join(ROOT, rel))) return read(rel);
  }
  throw new Error('engine-capabilities.md not found');
};

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
    slug: { type: 'string' },
    notes: { type: 'array', items: { type: 'string' } }
  },
  required: ['ok', 'reason', 'name', 'likeWhat', 'icon', 'slug', 'notes'],
  additionalProperties: false
};

let libraryCache = null;
/** The design notes library (loaded once). Tests can pass their own. */
export function library(set) {
  if (set !== undefined) libraryCache = set;
  if (!libraryCache) libraryCache = loadLibrary();
  return libraryCache;
}

/** Is this a software system someone could design? Returns { ok, reason, name, likeWhat, icon, id, notes }. */
export async function checkPrompt(client, input, usage = newUsage()) {
  const lib = library();
  const menu = lib.length
    ? ' notes: the ids of up to 2 notes from the list below that cover this system or its hardest problem (the closest breakdown first, then a deep dive if one fits), or [] if none is close.\n\nNotes:\n' + libraryMenu(lib)
    : ' notes: [].';
  const message = await client.messages.create({
    model: MODELS.check,
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CHECK_SCHEMA } },
    system: 'You screen requests for Scale Architect, a game that teaches system design by scaling a product level by level. '
      + 'Accept any real software product or backend system someone could design at scale (a URL shortener, chat app, ride hailing, payments, a search engine, a rate limiter...). '
      + 'Reject anything that is not a software system to design, is harmful, or asks you to do something else. '
      + 'name: a short product name in Title Case (e.g. "Ride Hailing"). likeWhat: "like <well-known example>" (e.g. "like Uber"). '
      + 'icon: one emoji. slug: lowercase words joined by _ (e.g. ride_hailing). reason: one short sentence.' + menu,
    messages: [{ role: 'user', content: `<request>${String(input.prompt).slice(0, 600)}</request>` }]
  });
  addUsage(usage, MODELS.check, message.usage);
  checkStop(message, 'prompt check');
  const out = JSON.parse(textOf(message));
  const slug = String(out.slug || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'game';
  return { ...out, notes: pickNotes(lib, out.notes).map(n => n.id), id: `dg_${slug}` };
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
  const notes = pickNotes(library(), check.notes);
  const ask = [
    notes.length ? `Main source: these study notes (summaries of Hello Interview breakdowns). Build your findings on them and keep their design choices; use the web only to fill gaps (real numbers, anything the notes skip) and to check anything that looks out of date.\n\n${libraryBlock(notes)}` : '',
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
        // With notes the web only fills gaps, so fewer searches
        { type: 'web_search_20260209', name: 'web_search', max_uses: notes.length ? 4 : 10 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: notes.length ? 3 : 8, max_content_tokens: 30000 }
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
  const text = textOf(message).trim();
  if (text.length < 400) throw new GenerateError('The research came back nearly empty.', 'thin_research');
  const fromLibrary = notes.filter(n => n.source).map(n => ({ title: `Hello Interview: ${n.title}`, url: n.source }));
  return { notes: text, sources: dedupeSources([...fromLibrary, ...sources], text, fromLibrary.length), library: notes.map(n => n.id) };
}

/** Notes as a block for a prompt. */
function libraryBlock(notes) {
  return notes.map(n => `<note id="${n.id}" title="${n.title}">\n${n.text}\n</note>`).join('\n\n');
}

/** Keep the sources the notes actually cite, else the first few found. */
function dedupeSources(found, notes, keep = 0) {
  const seen = new Set();
  const all = found.filter(s => !seen.has(s.url) && seen.add(s.url));
  const cited = all.filter((s, i) => i < keep || notes.includes(s.url));
  return (cited.length > keep ? cited : all).slice(0, 10);
}

// ─── 3. Design: an outline, then every level's details in parallel ───

/** What the engine can do, listed from the live game data so it never goes stale. */
function engineReference() {
  const roles = Object.values(ROLES).map(r => `- \`${r.id}\` ${r.name}: ${r.job || ''}`).join('\n');
  const fixes = Object.values(CODE_FIXES).map(f => `- \`${f.id}\` ${f.name}${f.toggle ? ' (a switch with a trade-off)' : ''}: ${f.short || ''}`).join('\n');
  return `## Machines (roles)\n${roles}\n\n## Code fixes (one-time purchases)\n${fixes}\n\n`
    + `## Stats goals can watch\n- counter goals (gs.liveStats): ${COUNTER_STATS.join(', ')}\n- statAtLeast goals (gs.serverStatus, 0–1): ${SHARE_STATS.join(', ')}\n`;
}

const example = () => splitPack(JSON.parse(read('tools/designgame/url-shortener.pack.json')));

const GAME_INTRO = 'Scale Architect is a browser game that teaches system design. The player grows one product from a single server to a large system. Each level is one real problem the player feels (things get slow, a disk fills up, bots attack, a server crashes) and one new piece that solves it.';

let planSystemCache = null;
function planSystem() {
  if (planSystemCache) return planSystemCache;
  planSystemCache = `${GAME_INTRO}

You write the OUTLINE of a new game: every level's numbers, machines, code fixes and goals, as JSON. Another step writes the stories, hints and tutorial afterwards, so leave those out.

The game can only use the machines, code fixes, traffic params and goal types listed below: you cannot invent new ones. When a real-world piece has no match, map it onto the closest existing machine or leave it out.

# Rules for levels
- Level 1 is always "one server does everything" (mode "single-server", roles app only, startingCoins 500, coinRate 25, spikeRange [1.2, 1.4]).
- Level 2 moves the data to its own database (mode "app-db" from here on).
- Order levels easy → hard, following the real order of growth from the research.
- Each level adds ONE new machine (or one scale-out step: more app servers behind a load balancer, or database shards), unlocked at that level in "roles". Two pieces share a level only when they are one problem (e.g. shards + ID generator). Set levelRole for every level.
- The new piece must be needed: set the level's traffic params so the level can't be won without it (bots via botShare need the gateway; far-away users via globalShare/distanceMs need the CDN; heavy reads with cacheHitRate need the cache; crashes: true needs a load balancer and several app servers; clickTracking needs the queue).
- Keep real ratios and orders of magnitude (read:write ratio, item sizes), but scale absolute numbers so a level takes minutes. User targets grow roughly 100 → 400 → 600 → 1,500 → 2,500 → 3,500 → 5,000.
- audience ≈ 1.25 × userTarget. coinRate: 25 on level 1, then about 4–8 (the game re-tunes money numbers automatically, so rough values are fine).
- Goals per level: a "placed" goal for its new machine (or a "machines" goal for scale-out), a "users" goal at its userTarget, one or two goals about the level's problem (latency, counter, errorRate, statAtLeast, cpuUnder, fixOwned), often an "incident" goal, and a "profit" goal last. Give goals a short label when the default wouldn't say what this product does. Leave out "hint": it is written later.
- vocab: the product's own words (record "ride", records "rides", writeFails "every new ride request fails", readName "location lookup"). incidents: 2–3 short stories per kind, in this product's world. Wording overrides (roleText, fixText…) only where the default would be wrong for this product.
- playtest (optional): how many app servers / shards the test bot should run per level, e.g. { "apps": { "4": 3 }, "shards": { "7": 3 } }; add it when a goal asks for a specific number.
- Only <strong>, <em> and <code> are allowed inside text.

# The full data pack format (the outline is this without "tutorial", without goal "hint", and without the level fields intro, story, completionMessage, realWorld, unlockedFeatures, feature)
${read('docs/designgame/data-pack-format.md')}

# Traffic params the engine models
${readEngineNotes().split('## Code fixes')[0]}

# The game's machines, code fixes and stats
${engineReference()}

# Example: the URL Shortener's outline
\`\`\`json
${JSON.stringify(example().outline)}
\`\`\`

Answer with only the outline JSON, in one \`\`\`json block.`;
  return planSystemCache;
}

let detailSystemCache = null;
function detailSystem() {
  if (detailSystemCache) return detailSystemCache;
  const ex = example().details;
  detailSystemCache = `${GAME_INTRO}

The game's outline (numbers, machines, goals) is done. You write the words for ONE level, as JSON:

{
  "level": <number>,
  "intro": "one sentence: the problem, as the level opens",
  "story": "what the player faces, 2–3 sentences, in this product's world",
  "completionMessage": "what they learned and what comes next (the next level's problem), 1–2 sentences",
  "realWorld": ["2–3 real numbers or services, one per item"],
  "unlockedFeatures": ["the new machine and fixes, as short chip labels"],
  "feature": { "name": "...", "summary": "1–2 sentences", "endpoints": [{ "method": "GET|POST|...", "path": "/api/...", "does": "...", "rate": "readsPerSec|writesPerSec" }] },
  "goalHints": ["one hint per goal of this level, in the same order as the outline's goals"],
  "tutorial": <this level's tutorial>
}

Rules:
- Hints are practical: which tab to open (Server → <machine> tab, Code fixes), what to watch, why it works. Plain words, short sentences.
- Tutorial: levels 1 and 2 use step lists shaped exactly like the examples below (same ids, kinds, events and highlights; your own words for this product). Later levels use { "newMachine": { "role", "welcome", "buy", "explain" } } with the level's new machine; for a scale-out level add "extra" steps like the level 4 example (builderTab "app" + advanceOn "appServerPlaced", or builderTab "db" + advanceOn "dbShardPlaced").
- "welcome" opens with "Level N!" and names the problem; "buy" says which parts matter for that machine and ends with "(Closed it? Tap Server again.)"; "explain" says what changed and points to <strong>Goals</strong>.
- Use the product's own words (its vocab). Only <strong>, <em> and <code> are allowed inside text. Write in your own words: never copy sentences from the research sources.

# Tutorial step format
${read('docs/designgame/data-pack-format.md').split('## Tutorial')[1].split('## Text')[0]}

# Examples (URL Shortener levels 1, 2 and 4)
\`\`\`json
${JSON.stringify([ex[0], ex[1], ex[3]])}
\`\`\`

Answer with only this level's JSON, in one \`\`\`json block.`;
  return detailSystemCache;
}

async function callModel(client, { system, messages, effort, maxTokens }, usage, stage) {
  const message = await client.beta.messages.stream({
    model: MODELS.main,
    max_tokens: maxTokens,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages
  }).finalMessage();
  addUsage(usage, MODELS.main, message.usage);
  checkStop(message, stage);
  return message;
}

function briefing(input, check, researchOut) {
  return [
    `Game: "${check.name}" (${check.likeWhat}). id: "${check.id}". meta.icon: "${check.icon}".`,
    input.focus?.length ? `Lean the levels toward: ${input.focus.join(', ')}.` : '',
    input.audience === 'interview'
      ? 'The players are preparing for system design interviews: use the real terms and the trade-offs interviewers ask about; keep the tutorial short.'
      : 'The players are beginners: explain each idea simply.',
    `The player's request: <request>${String(input.prompt).slice(0, 600)}</request>`,
    `Research:\n<research>\n${researchOut.notes}\n</research>`,
    researchOut.library?.length
      ? `Main reference (the design notes the research is built on; follow their design choices and order of growth where the game allows):\n${libraryBlock(pickNotes(library(), researchOut.library))}`
      : ''
  ].filter(Boolean).join('\n\n');
}

/** Plan the game: the outline JSON. Returns { outline, messages } (messages let repair continue). */
export async function plan(client, input, check, researchOut, usage = newUsage()) {
  const messages = [{
    role: 'user',
    content: `${briefing(input, check, researchOut)}\n\nNumber of levels: ${input.levels}.\nPut these in meta.sources: ${JSON.stringify(researchOut.sources)}`
  }];
  const message = await callModel(client, { system: planSystem(), messages, effort: 'high', maxTokens: 48000 }, usage, 'plan');
  messages.push({ role: 'assistant', content: message.content });
  const outline = extractJson(textOf(message));
  outline.id = check.id;
  outline.format = 1;
  return { outline, messages };
}

/** Write the words for some levels, in parallel. Returns [details, …] in level order. */
export async function writeDetails(client, input, check, researchOut, outline, levels, usage = newUsage(), notes = {}) {
  const shared = `${briefing(input, check, researchOut)}\n\nThe game's outline:\n\`\`\`json\n${JSON.stringify(outline)}\n\`\`\``;
  return Promise.all(levels.map(async n => {
    const ask = `${shared}\n\nWrite the details for level ${n} (it has ${outline.goals[n]?.length || 0} goals).${notes[n] ? `\n\nFix these problems from the last version:\n${notes[n].map(p => `- ${p}`).join('\n')}` : ''}`;
    const message = await callModel(client, { system: detailSystem(), messages: [{ role: 'user', content: ask }], effort: 'medium', maxTokens: 16000 }, usage, `level ${n} details`);
    const d = extractJson(textOf(message));
    d.level = n;
    return d;
  }));
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

/** Which levels' words a problem points at (tutorial, hints, stories), or null for the outline. */
export function detailLevelOf(problem, outline) {
  let m = problem.match(/^tutorial\.(\d+)/) || problem.match(/^goals\.(\d+)\[\d+\]\.hint/);
  if (m) return Number(m[1]);
  m = problem.match(/^levels\[(\d+)\]\.(intro|story|completionMessage|realWorld|unlockedFeatures|feature)/);
  if (m) return outline.levels[Number(m[1])]?.level ?? null;
  return null;
}

/** Ask the planner to fix the outline. Returns { outline, messages }. */
export async function repairOutline(client, messages, outline, problems, warnings, stage, usage = newUsage()) {
  const ask = [
    'The game checker found problems. Fix the outline and answer with the whole corrected outline in one ```json block.',
    stage === 'format'
      ? 'These fields are not valid:'
      : 'It is valid, but the balance check and test-play bot found these problems (a level the bot is "stuck" on usually has a goal that cannot be reached, or traffic too heavy for the machines available at that level; "still works without X" means the level\'s traffic doesn\'t need its new machine yet):',
    problems.map(p => `- ${p}`).join('\n'),
    warnings?.length ? `Warnings (fix if easy):\n${warnings.map(w => `- ${w}`).join('\n')}` : '',
    'The current outline (money numbers re-tuned by the game):',
    '```json\n' + JSON.stringify(outline) + '\n```'
  ].filter(Boolean).join('\n\n');
  const convo = [...messages, { role: 'user', content: ask }];
  const message = await callModel(client, { system: planSystem(), messages: convo, effort: 'high', maxTokens: 48000 }, usage, 'repair');
  convo.push({ role: 'assistant', content: message.content });
  const fixed = extractJson(textOf(message));
  fixed.id = outline.id;
  fixed.format = 1;
  return { outline: fixed, messages: convo };
}

/** Levels whose words must be rewritten after the outline changed (new machine or different goals). */
export function changedLevels(before, after) {
  const sig = (o, n) => JSON.stringify([o.levelRole?.[n], (o.goals?.[n] || []).map(g => [g.type, g.role, g.kind, g.fix, g.stat])]);
  return after.levels.map(L => L.level).filter(n => !before.levels.some(L => L.level === n) || sig(before, n) !== sig(after, n));
}

// ─── Whole pipeline, one step at a time ───

/*
 * A job is plain JSON, so a server can save it between steps:
 *   { input, stage, check, research, outline, messages, details, round, result, data, usage, log, error }
 * stage: check → research → plan → details → test → (repair → redetail → test)* → done | failed
 * Each step is one or a few model calls (each well under five minutes).
 */

export function newJob(input, { idSuffix } = {}) {
  return { input: normalizeInput(input), idSuffix, stage: 'check', round: 0, usage: newUsage(), log: [], createdAt: new Date().toISOString() };
}

const say = (job, text) => job.log.push({ at: new Date().toISOString(), stage: job.stage, text });

/** Run the job's next step (mutates and returns the job). */
export async function runStep(job, client, { maxRepairs = 2 } = {}) {
  const { input, usage } = job;
  try {
    switch (job.stage) {
      case 'check': {
        job.check = await checkPrompt(client, input, usage);
        if (job.idSuffix) job.check.id = `${job.check.id.slice(0, 44)}_${job.idSuffix}`;
        if (!job.check.ok) throw new GenerateError(`This doesn't look like a system to design: ${job.check.reason}`, 'rejected');
        say(job, `Making "${job.check.name}" (${job.check.likeWhat}).`);
        job.stage = 'research';
        break;
      }
      case 'research': {
        job.research = await research(client, input, job.check, usage);
        say(job, `Read ${job.research.sources.length} source${job.research.sources.length === 1 ? "" : "s"}.`);
        job.stage = 'plan';
        break;
      }
      case 'plan': {
        const { outline, messages } = await plan(client, input, job.check, job.research, usage);
        Object.assign(job, { outline, messages });
        say(job, `Planned ${outline.levels.length} levels: ${outline.levels.map(L => L.name).join(', ')}.`);
        job.stage = 'details';
        break;
      }
      case 'details':
      case 'redetail': {
        const levels = job.stage === 'details' ? job.outline.levels.map(L => L.level) : job.redo;
        const fresh = await writeDetails(client, input, job.check, job.research, job.outline, levels, usage, job.wordNotes || {});
        const old = job.details || [];
        job.details = job.outline.levels.map(L => fresh.find(d => d.level === L.level) || old.find(d => d.level === L.level) || { level: L.level });
        say(job, `Wrote the stories, hints and tutorials for ${levels.length} level${levels.length === 1 ? '' : 's'}.`);
        delete job.redo;
        delete job.wordNotes;
        job.stage = 'test';
        break;
      }
      case 'test': {
        const tuned = gateAndTune(mergePack(job.outline, job.details));
        job.data = tuned.data;
        job.result = { ok: tuned.result.ok, stage: tuned.result.stage, problems: tuned.result.problems, warnings: tuned.result.warnings, report: tuned.result.report?.markdown };
        if (tuned.result.ok) {
          say(job, `Every level passed the balance check and the test-play bot${tuned.result.warnings.length ? ` (${tuned.result.warnings.length} warnings)` : ''}.`);
          finish(job);
        } else if (job.round >= maxRepairs) {
          say(job, `Still ${tuned.result.problems.length} problems after ${job.round} repairs.`);
          job.stage = 'failed';
          job.error = { code: 'unbalanced', stage: 'test', message: `The game still has problems after ${job.round} repairs: ${tuned.result.problems.slice(0, 3).join('; ')}` };
        } else {
          say(job, `Found ${tuned.result.problems.length} problem${tuned.result.problems.length === 1 ? '' : 's'}; fixing them.`);
          job.stage = 'repair';
        }
        break;
      }
      case 'repair': {
        job.round += 1;
        const tunedOutline = splitPack(job.data).outline;
        // Problems in the words go back to that level's writer; the rest to the planner
        const wordNotes = {};
        const outlineProblems = [];
        for (const p of job.result.problems) {
          const n = detailLevelOf(p, tunedOutline);
          if (n) (wordNotes[n] ||= []).push(p); else outlineProblems.push(p);
        }
        let next = tunedOutline;
        if (outlineProblems.length || job.result.stage === 'play') {
          ({ outline: next, messages: job.messages } = await repairOutline(client, job.messages, tunedOutline,
            outlineProblems.length ? outlineProblems : job.result.problems, job.result.warnings, job.result.stage, usage));
        }
        job.redo = [...new Set([...changedLevels(tunedOutline, next), ...Object.keys(wordNotes).map(Number)])].sort((a, b) => a - b);
        job.wordNotes = wordNotes;
        job.outline = next;
        say(job, `Repair ${job.round}: adjusted the plan${job.redo.length ? `, rewriting level${job.redo.length === 1 ? '' : 's'} ${job.redo.join(', ')}` : ''}.`);
        job.stage = job.redo.length ? 'redetail' : 'test';
        break;
      }
      default:
        throw new GenerateError(`Nothing to do in stage "${job.stage}".`, 'bad_stage');
    }
  } catch (e) {
    job.error = { code: e.code || 'error', message: e.message || String(e), stage: job.stage };
    say(job, `Failed: ${job.error.message}`);
    job.stage = 'failed';
  }
  job.updatedAt = new Date().toISOString();
  return job;
}

function finish(job) {
  const final = job.data;
  final.meta = { ...final.meta, sources: final.meta?.sources?.length ? final.meta.sources : job.research.sources };
  final.generated = { at: new Date().toISOString(), model: MODELS.main, prompt: job.input.prompt, input: job.input, repairs: job.round };
  job.stage = 'done';
}

export const isFinished = job => job.stage === 'done' || job.stage === 'failed';

/**
 * Run a whole job here and now (the CLI). onStage(job) is called before each step.
 * Returns the finished job: job.stage is 'done' (job.data is the game) or 'failed' (job.error).
 */
export async function generateGame(input, { client, onStep = () => {}, maxRepairs = 2 } = {}) {
  client ??= await makeClient();
  const job = newJob(input);
  while (!isFinished(job)) {
    onStep(job);
    await runStep(job, client, { maxRepairs });
  }
  return job;
}

/** Fill in defaults and clamp the player's choices. */
export function normalizeInput(input = {}) {
  const inp = { ...DEFAULT_INPUT, ...input };
  inp.prompt = String(inp.prompt || '').trim().slice(0, 600);
  inp.levels = Math.min(10, Math.max(5, Math.round(Number(inp.levels) || 8)));
  inp.focus = (Array.isArray(inp.focus) ? inp.focus : []).map(f => String(f).slice(0, 40)).slice(0, 6);
  inp.audience = inp.audience === 'interview' ? 'interview' : 'beginner';
  inp.sources = (Array.isArray(inp.sources) ? inp.sources : []).filter(u => /^https:\/\/[^\s]+$/.test(u)).slice(0, 5);
  return inp;
}
