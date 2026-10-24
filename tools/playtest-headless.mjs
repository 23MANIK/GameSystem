#!/usr/bin/env node
/**
 * playtest-headless.mjs — play every level of a product in Node, no browser
 * (see tools/designgame/playtest.mjs for how the bot plays).
 *
 *   node tools/playtest-headless.mjs news_feed [--json] [--seed 7]
 *   node tools/playtest-headless.mjs --pack game.json   (a data pack, see js/products/dataPack.js)
 *
 * Exit code 1 if any level fails.
 */

import { productFromArgs } from './designgame/pack-arg.mjs';
import { playtest } from './designgame/playtest.mjs';
import { hasPack, PACKS } from '../js/products/registry.js';
import { LEVELS } from '../js/data/levels.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 7;

const productId = await productFromArgs(args);
if (!hasPack(productId)) {
  console.error(`Unknown product "${productId}". Known: ${Object.keys(PACKS).join(', ')}`);
  process.exit(2);
}
const { passed, results } = playtest(productId, { seed });

if (asJson) {
  console.log(JSON.stringify({ productId, passed, results }, null, 2));
} else {
  console.log(`\n${productId}: headless play-test (seed ${seed})\n`);
  for (const r of results) {
    console.log(`Level ${r.level} · ${r.name}: ${r.done ? 'DONE' : 'STUCK'} in ${r.minutes} min, ${r.users} users, coins ${r.coinsAtStart} → ${r.coinsEnd}`
      + `, apps ${r.apps} shards ${r.shards}, runs out: ${r.bottleneck}${r.notes.length ? ` [${r.notes.join(', ')}]` : ''}`);
    if (!r.done) console.log(`  pending: ${r.pending.join(' · ')}`);
  }
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: ${results.filter(r => r.done).length}/${LEVELS.length} levels finished\n`);
}
process.exit(passed ? 0 : 1);
