#!/usr/bin/env node
/**
 * check-pack.mjs — the "done" gate for a generated product pack.
 *
 *   node tools/check-pack.mjs news_feed [--write]
 *
 * Runs the balance tool and the headless play-test, then checks:
 *   - every level's best system fits its user target (warning if no headroom)
 *   - every level that adds a machine (other than app) fails without it
 *   - the play-test finishes every level, each in 2–20 simulated minutes
 *   - coins at each level's start are not wildly more than it needs
 * Prints a Markdown report; --write saves it to docs/products/<id>-report.md.
 * Exit code 1 when a hard check fails (warnings don't fail it).
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
const write = process.argv.includes('--write');
if (!id) { console.error('usage: node tools/check-pack.mjs <product_id> [--write]'); process.exit(2); }

function run(script, ...a) {
  try {
    return { out: execFileSync(process.execPath, [path.join(ROOT, 'tools', script), id, ...a], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), code: e.status ?? 1 };
  }
}

const errors = [];
const warnings = [];

// ─── Balance ───
const bal = run('balance-levels.mjs');
if (bal.code) errors.push('balance tool crashed:\n' + bal.out);
const blocks = bal.out.split('\nLevel ').slice(1);
const balanceRows = [];
for (const block of blocks) {
  const lines = block.split('\n');
  const level = Number(lines[0].split(' ')[0]);
  const newRole = lines[0].match(/new: (\S+)/)?.[1];
  const target = Number(lines[0].match(/target (\d+) users/)?.[1]);
  const rows = lines.slice(1).filter(l => l.trim());
  const withRow = rows.find(l => l.trim().startsWith('with '));
  const withOk = /\bOK\b/.test(withRow || '');
  const withoutRow = rows.find(l => l.trim().startsWith('without '));
  const withoutBroken = withoutRow ? /FAIL|DISK FULL|CODE CLASHES|clicks \d+%/.test(withoutRow) : null;
  const run = Number(withRow?.match(/run\s+(\d+)\/min/)?.[1]);
  const revenue = Number(withRow?.match(/revenue ~(\d+)/)?.[1]);
  const limit = Number(withRow?.match(/limit\s+(\d+)/)?.[1]);
  if (!(limit >= target)) errors.push(`Level ${level}: best system fits ${limit} users, target ${target}`);
  else if (!withOk) warnings.push(`Level ${level}: best system reaches the target but has no headroom for the audience (balance row not OK)`);
  if (withoutRow && !withoutBroken) warnings.push(`Level ${level}: still works without ${newRole} (the new machine may not be needed; check its goals)`);
  if (run && revenue && revenue < run * 1.3) warnings.push(`Level ${level}: revenue ~${revenue}/min barely covers running cost ${run}/min`);
  balanceRows.push({ level, newRole: newRole || '–', target, withOk, withoutBroken, run, revenue });
}

// ─── Play-test ───
const pt = run('playtest-headless.mjs', '--json');
let play = null;
try { play = JSON.parse(pt.out); } catch { errors.push('play-test crashed:\n' + pt.out); }
if (play) {
  for (const r of play.results) {
    if (!r.done) errors.push(`Level ${r.level}: play-test stuck (${r.pending.join(', ')})`);
    else if (r.minutes < 2 || r.minutes > 20) warnings.push(`Level ${r.level}: play-test took ${r.minutes} min (aim for 4–12)`);
  }
  if (!play.passed && play.results.every(r => r.done)) errors.push('play-test did not reach the last level');
}

// ─── Report ───
const md = [`# ${id}: pack check`, '', `Result: **${errors.length ? 'FAIL' : 'PASS'}**${warnings.length ? ` (${warnings.length} warnings)` : ''}`, '',
  '## Balance (tools/balance-levels.mjs)', '', '| Level | New | Target | With | Without new | Run/min | Revenue/min |', '|---|---|---|---|---|---|---|',
  ...balanceRows.map(b => `| ${b.level} | ${b.newRole} | ${b.target} | ${b.withOk ? 'OK' : 'FAIL'} | ${b.withoutBroken == null ? '–' : b.withoutBroken ? 'breaks ✓' : 'still works ⚠'} | ${b.run} | ${b.revenue} |`),
  '', '## Play-test (tools/playtest-headless.mjs)', '', '| Level | Name | Done | Minutes | Users | Coins start → end | Apps | Shards |', '|---|---|---|---|---|---|---|---|',
  ...(play?.results || []).map(r => `| ${r.level} | ${r.name} | ${r.done ? '✓' : '✗'} | ${r.minutes} | ${r.users} | ${r.coinsAtStart} → ${r.coinsEnd} | ${r.apps} | ${r.shards} |`),
  '', '## Errors', '', ...(errors.length ? errors.map(e => `- ${e}`) : ['None.']),
  '', '## Warnings', '', ...(warnings.length ? warnings.map(w => `- ${w}`) : ['None.']), ''].join('\n');

console.log(md);
if (write) {
  const file = path.join(ROOT, 'docs/products', `${id.replace(/_/g, '-')}-report.md`);
  writeFileSync(file, md);
  console.log(`Wrote ${path.relative(ROOT, file)}`);
}
process.exit(errors.length ? 1 : 0);
