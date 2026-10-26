// Money, buying machines, upgrades and code fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadModules } from '../helpers/harness.mjs';

const m = await loadModules();
const SP = m.parts;

test('server parts: prices, upgrade cost without refunds, XL parts unlock at Level 5', () => {
  const cheap = SP.cheapestServer();
  assert.deepEqual(Object.keys(cheap), SP.PART_ORDER);
  assert.equal(SP.serverCost(cheap), SP.PART_ORDER.reduce((s, p) => s + SP.SERVER_PARTS[p].options[0].cost, 0));
  const bigger = { ...cheap, cpu: 'cpu_2' };
  assert.equal(SP.upgradeCost(cheap, bigger), 150, 'upgrade costs the price difference');
  assert.equal(SP.upgradeCost(bigger, cheap), 0, 'picking something cheaper is never a refund');
  assert.equal(SP.upgradeCost(null, cheap), SP.serverCost(cheap), 'a first build costs the full price');
  for (const part of SP.PART_ORDER) {
    assert.ok(!SP.optionsForLevel(part, 4).some(o => o.unlockLevel === 5), `${part}: XL option offered before Level 5`);
    assert.ok(SP.optionsForLevel(part, 5).length >= SP.optionsForLevel(part, 4).length);
  }
  assert.ok(SP.runningCostPerMinute(cheap) > 0 && SP.runningCostPerMinute(null) === 0);
});

test('buying a server spends coins and fails without enough', async () => {
  const { gs } = await newGame('guestbook');
  const cost = SP.serverCost(SP.cheapestServer());
  const start = gs.coins;
  assert.ok(gs.setServer(SP.cheapestServer(), cost, 'app'));
  assert.equal(gs.coins, start - cost);
  gs.coins = 5;
  assert.equal(gs.setServer({ ...SP.cheapestServer(), cpu: 'cpu_4' }, 500, 'app'), false, 'bought with 5 coins');
  assert.equal(gs.server.cpu, 'cpu_1', 'a failed purchase changed the server');
  assert.equal(gs.coins, 5);
});

test('buying a server emits serverBought, an upgrade emits serverUpgraded', async () => {
  const { gs } = await newGame('guestbook');
  const seen = [];
  for (const e of ['serverBought', 'serverUpgraded']) gs.on(e, () => seen.push(e));
  gs.setServer(SP.cheapestServer(), 0, 'app');
  gs.setServer({ ...SP.cheapestServer(), ram: 'ram_2' }, 0, 'app');
  assert.deepEqual(seen, ['serverBought', 'serverUpgraded']);
});

test('placing the server makes it count; upgrading RAM raises the user limit', async () => {
  const game = await newGame('guestbook');
  const { gs } = game;
  assert.ok(game.buy('app'));
  assert.equal(gs.isServerPlaced(), false, 'placed before clicking the slot');
  assert.ok(game.place('app'));
  assert.ok(gs.isServerPlaced());
  gs.users = 30;
  gs.recalculateMetrics();
  const before = gs.serverStatus.userLimit;
  const part = gs.serverStatus.bottleneck;
  assert.ok(game.bump('app', part), `could not upgrade ${part}`);
  assert.ok(gs.serverStatus.userLimit > before, `user limit ${before} → ${gs.serverStatus.userLimit} after upgrading the bottleneck (${part})`);
});

test('code fixes are bought once', async () => {
  const game = await newGame('guestbook');
  const { gs } = game;
  gs.level = 2;
  gs.coins = 10000;
  const fix = m.fixes.fixesForLevel(2).find(f => !f.toggle);
  assert.ok(fix, 'Guestbook Level 2 has no code fix to buy');
  assert.ok(gs.buyCodeFix(fix.id, fix.cost));
  assert.equal(gs.coins, 10000 - fix.cost);
  assert.equal(gs.buyCodeFix(fix.id, fix.cost), false, 'bought twice');
  assert.equal(gs.coins, 10000 - fix.cost, 'charged twice');
});

test('coins never go below zero when spending', async () => {
  const { gs } = await newGame('guestbook');
  gs.coins = 10;
  assert.equal(gs.spendCoins(11), false);
  assert.equal(gs.coins, 10);
  assert.equal(gs.canAfford(10), true);
});

test('extra app servers need a load balancer level and cost a full server', async () => {
  const game = await newGame('guestbook');
  const { gs } = game;
  game.buy('app'); game.place('app');
  const cost = gs.extraMachineCost('app');
  assert.equal(cost, SP.serverCost(gs.server));
  gs.coins = cost - 1;
  assert.equal(gs.buyExtraMachine('app'), false, 'bought an extra server without the coins');
});

test('a level starts fresh: goals, money and tutorial reset, machines and coins carry over', async () => {
  const game = await newGame('guestbook');
  const { gs } = game;
  game.buy('app'); game.place('app');
  gs.challengesDone = ['x'];
  gs.economy.revenue = 999;
  gs.tutorial = { step: 4, done: true };
  const coins = gs.coins;
  gs.levelCompleted = true;
  gs.startLevel(2);
  assert.equal(gs.level, 2);
  assert.equal(gs.levelCompleted, false);
  assert.deepEqual(gs.challengesDone, []);
  assert.equal(gs.economy.revenue, 0);
  assert.deepEqual(gs.tutorial, { step: 0, done: false });
  assert.ok(gs.isServerPlaced(), 'the server did not carry over');
  assert.equal(gs.coins, coins, 'coins did not carry over');
});
