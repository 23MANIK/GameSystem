// The product picker's list and the packs behind it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../helpers/harness.mjs';

const m = await loadModules();
const { PRODUCTS, getProduct } = m.products;
const { PACKS } = m.registry;

// Every design the game knows about. Playable ones need a pack; the rest are "coming soon".
// Ticket Booking and Ad Click Aggregator arrive with PR #7 / #8; until then they may be missing.
const DESIGNS = {
  guestbook: 'Guestbook', url_shortener: 'URL Shortener', news_feed: 'News Feed', cloud_drive: 'Cloud Drive',
  chat: 'Chat', video: 'Video', ride_hailing: 'Ride Hailing', ticketing: 'Ticket', ad_clicks: 'Ad Click'
};
const ALWAYS_PRESENT = ['guestbook', 'url_shortener', 'news_feed', 'cloud_drive', 'chat', 'video', 'ride_hailing'];

test('picker lists every design with a unique id, name, icon and level list', () => {
  const ids = PRODUCTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
  for (const id of ALWAYS_PRESENT) assert.ok(ids.includes(id), `${id} missing from the picker`);
  for (const p of PRODUCTS) {
    assert.ok(p.name && p.icon && p.tagline, `${p.id}: name, icon or tagline missing`);
    assert.ok(Array.isArray(p.levels) && p.levels.length > 0, `${p.id}: no levels listed`);
    assert.ok(Array.isArray(p.concepts), `${p.id}: no concepts`);
    if (DESIGNS[p.id]) assert.match(p.name, new RegExp(DESIGNS[p.id], 'i'), `${p.id} is called "${p.name}"`);
    if (p.difficulty !== undefined) assert.ok(['easy', 'medium', 'hard'].includes(p.difficulty), `${p.id}: difficulty "${p.difficulty}"`);
  }
});

test('every playable design has a pack, and every pack is playable in the picker', () => {
  for (const p of PRODUCTS.filter(p => p.playable)) assert.ok(PACKS[p.id], `${p.id} is playable but has no pack`);
  for (const id of Object.keys(PACKS)) assert.ok(getProduct(id)?.playable, `pack ${id} is not playable in the picker`);
});

test('designs without a pack are locked, so they cannot be started', () => {
  for (const p of PRODUCTS.filter(p => !PACKS[p.id])) {
    assert.ok(!p.playable, `${p.id} has no pack but is marked playable`);
    assert.ok(p.levels.every(l => !l.playable), `${p.id}: a level is playable without a pack`);
  }
});

test('Ticket Booking and Ad Click Aggregator, when present, are playable medium / hard designs', (t) => {
  const present = ['ticketing', 'ad_clicks'].filter(id => getProduct(id)?.id === id);
  if (!present.length) return t.skip('not merged into this branch yet (PR #7 / #8)');
  for (const id of present) assert.ok(PACKS[id] && getProduct(id).playable, `${id} is not playable`);
  if (present.includes('ticketing') && getProduct('ticketing').difficulty) assert.equal(getProduct('ticketing').difficulty, 'medium');
  if (present.includes('ad_clicks') && getProduct('ad_clicks').difficulty) assert.equal(getProduct('ad_clicks').difficulty, 'hard');
});

test('getProduct falls back to a real product for an unknown id', () => {
  const p = getProduct('does-not-exist');
  assert.ok(p && p.id, 'getProduct returned nothing');
});
