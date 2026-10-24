#!/usr/bin/env node
/**
 * generate-designgame.mjs — make a new game from a prompt, on your machine.
 *
 *   node tools/generate-designgame.mjs "Ride hailing like Uber" [--levels 8] [--focus caching,sharding]
 *        [--audience beginner|interview] [--source https://...] [--out games/]
 *
 * Needs ANTHROPIC_API_KEY. Writes <out>/<id>.pack.json (play it with
 * `node tools/playtest-headless.mjs --pack <file>`) and <out>/<id>-report.md
 * (research notes, check results, cost). See tools/designgame/generate.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { generateGame } from './designgame/generate.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const prompt = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')).join(' ');
if (!prompt) {
  console.error('usage: node tools/generate-designgame.mjs "<what to design>" [--levels 8] [--focus a,b] [--audience beginner|interview] [--source url] [--out dir]');
  process.exit(2);
}
const input = {
  prompt,
  levels: Number(opt('levels') || 8),
  focus: (opt('focus') || '').split(',').map(s => s.trim()).filter(Boolean),
  audience: opt('audience') || 'beginner',
  sources: args.flatMap((a, i) => (a === '--source' ? [args[i + 1]] : []))
};
const outDir = path.resolve(opt('out') || 'games');
const started = Date.now();
const secs = () => `${Math.round((Date.now() - started) / 1000)}s`;

const STAGE_TEXT = {
  check: () => 'Checking the prompt…',
  research: i => `Researching ${i.name} on the web…`,
  research_done: i => `  ${i.sources.length} sources`,
  plan: () => 'Planning the levels (numbers, machines, goals)…',
  details: i => `Writing stories, hints and tutorials for ${i.levels} levels in parallel…`,
  test: i => (i.round ? `Testing the repaired game (round ${i.round})…` : 'Balancing and test-playing every level…'),
  repair: i => `  ${i.problems.length} problems, asking for a fix:\n${i.problems.map(p => `    - ${p}`).join('\n')}`,
  done: i => (i.ok ? 'Passed.' : 'Still failing after repairs.')
};

try {
  const out = await generateGame(input, { onStage: (s, info = {}) => console.log(`[${secs()}] ${STAGE_TEXT[s]?.(info) ?? s}`) });
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${out.data.id}.pack.json`);
  fs.writeFileSync(file, JSON.stringify(out.data, null, 2) + '\n');
  const report = [
    `# ${out.check.name}: generated game`, '',
    `Prompt: ${input.prompt}`, '',
    `Result: **${out.ok ? 'PASS' : 'FAIL'}** after ${out.rounds} repair round(s), ${secs()}.`, '',
    `Cost: $${out.usage.dollars.toFixed(2)} (${out.usage.calls} calls, ${out.usage.input + out.usage.cacheRead + out.usage.cacheWrite} input / ${out.usage.output} output tokens, ${out.usage.searches} searches)`, '',
    '## Levels', '', ...out.data.levels.map(L => `${L.level}. **${L.name}**: ${L.subtitle}`), '',
    out.result.report?.markdown?.replace(/^# .*\n/, '') || `## Problems\n\n${out.result.problems.map(p => `- ${p}`).join('\n')}`, '',
    '## Research notes', '', out.research.notes, ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, `${out.data.id}-report.md`), report);
  console.log(`\n${out.ok ? 'PASS' : 'FAIL'}  ${file}  ($${out.usage.dollars.toFixed(2)}, ${secs()})`);
  process.exit(out.ok ? 0 : 1);
} catch (e) {
  console.error(`\nFailed after ${secs()}: ${e.message}`);
  process.exit(1);
}
