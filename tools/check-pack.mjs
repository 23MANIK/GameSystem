#!/usr/bin/env node
/**
 * check-pack.mjs — the "done" gate for a generated product pack.
 *
 *   node tools/check-pack.mjs news_feed [--write]
 *   node tools/check-pack.mjs --pack game.json   (a data pack)
 *
 * Runs the balance check and the headless play-test in this process
 * (tools/designgame/checkGame.mjs), then checks:
 *   - every level's best system fits its user target (warning if no headroom)
 *   - every level that adds a machine (other than app) fails without it
 *   - the play-test finishes every level, each in 2–20 simulated minutes
 *   - coins at each level's start are not wildly more than it needs
 * Prints a Markdown report; --write saves it to docs/products/<id>-report.md.
 * Exit code 1 when a hard check fails (warnings don't fail it).
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productFromArgs } from './designgame/pack-arg.mjs';
import { checkGame } from './designgame/checkGame.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const write = argv.includes('--write');
if (!argv.filter(a => a !== '--write').length) { console.error('usage: node tools/check-pack.mjs <product_id> [--write]  |  --pack game.json'); process.exit(2); }
const id = await productFromArgs(argv.filter(a => a !== '--write'));

const result = checkGame(id);
console.log(result.markdown);
if (write) {
  const file = path.join(ROOT, 'docs/products', `${id.replace(/_/g, '-')}-report.md`);
  writeFileSync(file, result.markdown);
  console.log(`Wrote ${path.relative(ROOT, file)}`);
}
process.exit(result.passed ? 0 : 1);
