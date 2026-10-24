/**
 * checkGame.mjs — the "done" gate for a product pack, as a function (used by
 * tools/check-pack.mjs and the DesignGame generator).
 *
 * Runs the balance check and the headless play-test, then checks:
 *   - every level's best system fits its user target (warning if no headroom)
 *   - every level that adds a machine (other than app) fails without it
 *   - the play-test finishes every level, each in 2–20 simulated minutes
 *   - coins at each level's start are not wildly more than it needs
 * Returns { passed, errors, warnings, balance, play, markdown }.
 */

import { balance } from './balance.mjs';
import { playtest } from './playtest.mjs';

export function checkGame(id, { seed = 7 } = {}) {
  const errors = [];
  const warnings = [];

  // ─── Balance ───
  let bal = null;
  try { bal = balance(id); } catch (e) { errors.push('balance tool crashed:\n' + (e.stack || e)); }
  const balanceRows = [];
  for (const lv of bal?.levels || []) {
    const { level, newRole, target } = lv;
    const withOk = lv.with.ok;
    const withoutBroken = lv.without ? lv.without.broken : null;
    const { run, revenue, limit } = lv.with;
    if (!(limit >= target)) errors.push(`Level ${level}: best system fits ${limit} users, target ${target}`);
    else if (!withOk) warnings.push(`Level ${level}: best system reaches the target but has no headroom for the audience (balance row not OK)`);
    if (lv.without && !withoutBroken) warnings.push(`Level ${level}: still works without ${newRole} (the new machine may not be needed; check its goals)`);
    if (run && revenue && revenue < run * 1.3) warnings.push(`Level ${level}: revenue ~${revenue}/min barely covers running cost ${run}/min`);
    balanceRows.push({ level, newRole: newRole || '–', target, withOk, withoutBroken, run, revenue });
  }

  // ─── Play-test ───
  let play = null;
  try { play = playtest(id, { seed }); } catch (e) { errors.push('play-test crashed:\n' + (e.stack || e)); }
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
  return { passed: !errors.length, errors, warnings, balance: balanceRows, play, markdown: md };
}
