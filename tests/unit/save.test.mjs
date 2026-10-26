// Save, Continue and "Retry level" (all stored in localStorage).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadModules, installMemoryStorage, packIds } from '../helpers/harness.mjs';

const m = await loadModules();

test('a saved game loads back exactly: product, level, machines, coins, fixes, entries', async () => {
  installMemoryStorage();
  const game = await newGame('url_shortener');
  const { gs } = game;
  game.buy('app'); game.place('app');
  game.runLevel();
  assert.ok(gs.levelCompleted, 'bot did not finish Level 1');
  game.nextLevel();
  gs.coins = 1234;
  gs.save();

  const loaded = new m.GameState();
  assert.ok(loaded.load(), 'load() found no save');
  assert.equal(loaded.productId, 'url_shortener');
  assert.equal(loaded.level, 2);
  assert.equal(loaded.coins, 1234);
  assert.deepEqual(loaded.machines, gs.machines);
  assert.deepEqual(loaded.codeFixes, gs.codeFixes);
  assert.equal(loaded.guestbook.count, gs.guestbook.count);
  assert.equal(loaded.isServerPlaced(), true);
  assert.equal(m.levels.LEVELS, m.registry.activeProduct().levels, 'loading did not switch to the saved product');
});

for (const id of await packIds()) {
  test(`${id}: save → load keeps the same user limit and bottleneck`, async () => {
    installMemoryStorage();
    const game = await newGame(id);
    game.runLevel();
    game.gs.save();
    const before = { limit: game.gs.serverStatus.userLimit, bottleneck: game.gs.serverStatus.bottleneck };
    const loaded = new m.GameState();
    loaded.load();
    assert.deepEqual({ limit: loaded.serverStatus.userLimit, bottleneck: loaded.serverStatus.bottleneck }, before);
  });
}

test('New Game (reset) wipes the save', async () => {
  const storage = installMemoryStorage();
  const game = await newGame('guestbook');
  game.buy('app');
  game.gs.save();
  assert.ok(storage.getItem('scale_architect_save_v4'));
  game.gs.reset();
  assert.equal(storage.getItem('scale_architect_save_v4'), null);
  assert.equal(new m.GameState().load(), false);
});

test('no save → load() is false (Continue stays hidden)', () => {
  installMemoryStorage();
  assert.equal(new m.GameState().load(), false);
});

test('a broken save does not crash the game', () => {
  const storage = installMemoryStorage();
  storage.setItem('scale_architect_save_v4', '{not json');
  const gs = new m.GameState();
  const orig = console.error; console.error = () => {};
  try { assert.equal(gs.load(), false); } finally { console.error = orig; }
});

test('"Retry level" puts back the game as the level began', async () => {
  const storage = installMemoryStorage();
  const game = await newGame('guestbook');
  const { gs } = game;
  game.buy('app'); game.place('app');
  gs.snapshotLevelStart();
  const coinsAtStart = gs.coins;
  assert.ok(gs.hasLevelStart());
  gs.coins = 0;
  gs.save();
  assert.ok(gs.restoreLevelStart());
  const loaded = new m.GameState();
  loaded.load();
  assert.equal(loaded.coins, coinsAtStart);
  // A retry point from another product does not count
  loaded.productId = 'cloud_drive';
  assert.equal(loaded.hasLevelStart(), false);
  assert.ok(storage.getItem('scale_architect_level_start_v4'));
});
