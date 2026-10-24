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
  check: 'Checking the prompt…',
  research: 'Researching the system on the web…',
  plan: 'Planning the levels (numbers, machines, goals)…',
  details: 'Writing stories, hints and tutorials, all levels in parallel…',
  redetail: 'Rewriting the changed levels…',
  test: 'Balancing and test-playing every level…',
  repair: 'Repairing the plan…'
};

let shown = 0;
const job = await generateGame(input, {
  onStep: j => {
    for (; shown < j.log.length; shown++) console.log(`  ${j.log[shown].text}`);
    console.log(`[${secs()}] ${STAGE_TEXT[j.stage] || j.stage}`);
  }
});
for (; shown < job.log.length; shown++) console.log(`  ${job.log[shown].text}`);
const ok = job.stage === 'done';
const cost = `$${job.usage.dollars.toFixed(2)} (${job.usage.calls} calls, ${job.usage.input + job.usage.cacheRead + job.usage.cacheWrite} input / ${job.usage.output} output tokens, ${job.usage.searches} searches)`;
if (!job.data) {
  console.error(`\nFailed after ${secs()}: ${job.error?.message}  ${cost}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${job.data.id}.pack.json`);
fs.writeFileSync(file, JSON.stringify(job.data, null, 2) + '\n');
const report = [
  `# ${job.check.name}: generated game`, '',
  `Prompt: ${input.prompt}`, '',
  `Result: **${ok ? 'PASS' : 'FAIL'}** after ${job.round} repair round(s), ${secs()}.`, '',
  `Cost: ${cost}`, '',
  '## Levels', '', ...job.data.levels.map(L => `${L.level}. **${L.name}**: ${L.subtitle}`), '',
  '## Log', '', ...job.log.map(l => `- ${l.text}`), '',
  job.result?.report?.replace(/^# .*\n/, '') || `## Problems\n\n${(job.result?.problems || []).map(p => `- ${p}`).join('\n')}`, '',
  '## Research notes', '', job.research?.notes || '', ''
].join('\n');
fs.writeFileSync(path.join(outDir, `${job.data.id}-report.md`), report);
console.log(`\n${ok ? 'PASS' : 'FAIL'}  ${file}  ${cost}, ${secs()}`);
process.exit(ok ? 0 : 1);
