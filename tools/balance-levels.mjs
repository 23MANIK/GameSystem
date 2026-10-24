#!/usr/bin/env node
/**
 * balance-levels.mjs — check that every level of a product is beatable and
 * actually needs what it teaches (see tools/designgame/balance.mjs).
 *
 *   node tools/balance-levels.mjs url_shortener
 *   node tools/balance-levels.mjs --pack game.json   (a data pack)
 */

import { productFromArgs } from './designgame/pack-arg.mjs';
import { balance } from './designgame/balance.mjs';
import { hasPack, PACKS } from '../js/products/registry.js';

const productId = await productFromArgs(process.argv.slice(2));
if (!hasPack(productId)) {
  console.error(`Unknown product "${productId}". Known: ${Object.keys(PACKS).join(', ')}`);
  process.exit(1);
}
console.log(balance(productId).text);
