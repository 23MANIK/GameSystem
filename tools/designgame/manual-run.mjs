#!/usr/bin/env node
/**
 * manual-run.mjs — run the generator with hand-written answers instead of the API.
 *
 *   node tools/designgame/manual-run.mjs --dir runs/uber "Ride hailing like Uber" [--levels 6]
 *
 * Each run goes as far as it can. When a step needs a model answer it writes the
 * request to <dir>/<name>.request.md and stops; write <name>.answer.md and run
 * the same command again (the prompt is only needed the first time). The job is
 * kept in <dir>/job.json. When done, the game is <dir>/<id>.pack.json and the
 * check report is <dir>/report.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { newJob, runStep, isFinished } from './generate.mjs';
import { makeManualClient } from './manual-client.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const dir = opt('dir') || 'runs/manual';
const levels = opt('levels');
const prompt = args.join(' ').trim();
const jobFile = path.join(dir, 'job.json');

fs.mkdirSync(dir, { recursive: true });
let job = fs.existsSync(jobFile) ? JSON.parse(fs.readFileSync(jobFile, 'utf8')) : null;
if (!job) {
  if (!prompt) { console.error('Give a prompt the first time.'); process.exit(1); }
  job = newJob({ prompt, ...(levels ? { levels: Number(levels) } : {}) });
}

const client = makeManualClient(dir);
while (!isFinished(job)) {
  const before = JSON.stringify(job);
  console.log(`→ ${job.stage}`);
  job = await runStep(job, client);
  if (job.error?.code === 'manual_pending') {
    job = JSON.parse(before); // not a failure: the step runs again once answered
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
    console.log(`Waiting for answers:\n${[...new Set(client.pending)].map(f => `  ${f}`).join('\n')}`);
    process.exit(2);
  }
  fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  console.log(`  ${job.log.at(-1)?.text || ''}`);
}

if (job.stage === 'done') {
  fs.writeFileSync(path.join(dir, `${job.data.id}.pack.json`), JSON.stringify(job.data, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), job.result?.report || '');
  console.log(`Done: ${path.join(dir, `${job.data.id}.pack.json`)}`);
} else {
  console.log(`Failed at ${job.error?.stage}: ${job.error?.message}`);
  if (job.result?.report) fs.writeFileSync(path.join(dir, 'report.md'), job.result.report);
  process.exit(1);
}
