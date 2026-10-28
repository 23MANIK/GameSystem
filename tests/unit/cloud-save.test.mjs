// Which save wins when a signed-in player has one here and one in the cloud.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseSave, saveSummary, mergeProgress } from '../../js/firebase/cloudSave.js';

const L = (json, savedAt) => ({ json, savedAt });

test('nothing anywhere → none; only local → push; only cloud → pull', () => {
  assert.equal(chooseSave({ local: L(null, 0), cloud: null, uid: 'a' }), 'none');
  assert.equal(chooseSave({ local: L('{"x":1}', 5), cloud: null, uid: 'a' }), 'push');
  assert.equal(chooseSave({ local: L(null, 0), cloud: L('{"x":1}', 5), uid: 'a' }), 'pull');
});

test('identical saves → same', () => {
  assert.equal(chooseSave({ local: L('{"x":1}', 1), cloud: L('{"x":1}', 9), uid: 'a' }), 'same');
});

test('the newer save wins', () => {
  assert.equal(chooseSave({ local: L('{"x":1}', 10), cloud: L('{"x":2}', 20), uid: 'a' }), 'pull');
  assert.equal(chooseSave({ local: L('{"x":1}', 30), cloud: L('{"x":2}', 20), uid: 'a' }), 'push');
});

test('a local save last synced with another account never overwrites this account', () => {
  const r = chooseSave({ local: L('{"x":1}', 99), cloud: L('{"x":2}', 1), uid: 'b', lastSync: { uid: 'a', savedAt: 99 } });
  assert.equal(r, 'pull');
});

test('summary and progress per product', () => {
  assert.deepEqual(saveSummary('{"productId":"guestbook","level":3,"levelCompleted":false}'), { productId: 'guestbook', level: 3, levelCompleted: false });
  assert.deepEqual(saveSummary('not json'), { productId: null, level: null, levelCompleted: false });
  assert.deepEqual(mergeProgress({ guestbook: 4 }, { productId: 'guestbook', level: 3, levelCompleted: true }), { guestbook: 4 });
  assert.deepEqual(mergeProgress({}, { productId: 'news_feed', level: 2, levelCompleted: false }), { news_feed: 1 });
});
