/**
 * pack-arg.mjs — let the balance and play-test tools run a data pack (JSON file).
 *
 *   node tools/playtest-headless.mjs --pack path/to/game.json
 *
 * Returns the product id to use: the data pack's id when --pack is given
 * (after compiling and registering it), otherwise the first plain argument.
 */
import fs from 'node:fs';

export async function productFromArgs(args, fallback = 'guestbook') {
  const i = args.indexOf('--pack');
  if (i < 0) return args.find((a, j) => !a.startsWith('--') && args[j - 1] !== '--seed') || fallback;
  const root = new URL('../../js/', import.meta.url).href;
  const { compileDataPack } = await import(root + 'products/dataPack.js');
  const { registerPack } = await import(root + 'products/registry.js');
  const data = JSON.parse(fs.readFileSync(args[i + 1], 'utf8'));
  return registerPack(compileDataPack(data)).id;
}
