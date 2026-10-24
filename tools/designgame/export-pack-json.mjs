#!/usr/bin/env node
/**
 * export-pack-json.mjs — write a hand-made product pack as a data pack (JSON).
 *
 *   node tools/designgame/export-pack-json.mjs url_shortener goals.json > out.json
 *
 * Levels, machines, fixes, wording and tutorial text are copied from the pack.
 * Goals and fix suggestions are code in hand-made packs, so they come from the
 * second file ({ goals, suggestFix }). Used to prove the data-pack format can
 * describe a real product (see tools/designgame/parity.mjs).
 */
import fs from 'node:fs';
const [id, extraFile] = process.argv.slice(2);
const root = new URL('../../js/', import.meta.url).href;
const registry = await import(root + 'products/registry.js');
const { PRODUCTS } = await import(root + 'data/products.js');
const pack = registry.PACKS[id];
const extra = JSON.parse(fs.readFileSync(extraFile, 'utf8'));
const product = PRODUCTS.find(p => p.id === id);

const plain = v => JSON.parse(JSON.stringify(v));
function step(s, level) {
  if (s.id === 'bottleneck') return { kind: level === 1 ? 'bottleneckSingle' : 'bottleneckMulti' };
  if (s.id === 'go_live' && s.onButton) return { kind: 'goLive', text: s.text(), button: s.button };
  const out = { id: s.id, text: s.text() };
  for (const k of ['button', 'highlight', 'builderTab', 'role', 'advanceOn', 'showInBuilder', 'minimizeAfterButton', 'finishAfterButton']) if (s[k] != null) out[k] = s[k];
  return out;
}

const data = {
  format: 1,
  id: 'dg_' + id,
  meta: { name: product.name, icon: product.icon, likeWhat: product.likeWhat, tagline: product.tagline, concepts: product.concepts, sources: [] },
  levels: plain(pack.levels),
  roles: plain(pack.roles),
  scaleOut: plain(pack.scaleOut),
  fixes: plain(pack.fixes),
  xlLevel: plain(pack.xlLevel),
  playtest: plain(pack.playtest || {}),
  goals: extra.goals,
  tutorial: Object.fromEntries(Object.entries(pack.steps).map(([l, steps]) => [l, steps.map(s => step(s, Number(l)))])),
  levelRole: plain(pack.levelRole),
  suggestFix: extra.suggestFix,
  roleText: plain(pack.roleText), partText: plain(pack.partText), fixText: plain(pack.fixText),
  explanations: plain(pack.explanations), incidents: plain(pack.incidents), vocab: plain(pack.vocab)
};
process.stdout.write(JSON.stringify(data, null, 2) + '\n');
