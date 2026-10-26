// The guide (Archie): steps move forward with the player and never go backwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, packIds } from '../helpers/harness.mjs';
import { knownBugTest } from '../helpers/known-bugs.mjs';

test('Level 1 walks through buy → place → open to the public', async () => {
  const game = await newGame('guestbook');
  const t = game.tutorial;
  assert.equal(t.step.id, 'welcome');
  t.pressButton();
  assert.equal(t.step.id, 'open_builder');
  game.gs.emit('serverBuilderOpened');
  assert.equal(t.step.id, 'pick_parts');
  game.buy('app');
  assert.equal(t.step.id, 'place');
  game.place('app');
  assert.equal(t.step.id, 'go_live');
  t.pressButton();
  assert.equal(game.gs.appLive, true, '"Open to the public" did not start the app');
  assert.equal(t.step.id, 'grow');
});

test('after a reload, the guide skips steps already done', async () => {
  const game = await newGame('guestbook');
  game.buy('app'); game.place('app');
  game.gs.tutorial = { step: 0, done: false };
  game.tutorial.sync();
  assert.equal(game.tutorial.step.id, 'go_live');
});

test('Skip tutorial finishes it and opens the app', async () => {
  const game = await newGame('guestbook');
  game.tutorial.skip();
  assert.equal(game.tutorial.active, false);
  assert.equal(game.gs.appLive, true);
});

for (const id of await packIds()) {
  test(`${id}: the guide never moves backwards while the bot plays every level`, async () => {
    const game = await newGame(id);
    const { gs, tutorial: t } = game;
    for (;;) {
      let last = -1;
      gs.appLive = true;
      for (let i = 0; i < 1800 && !gs.levelCompleted; i++) {
        game.act(); game.tick();
        if (t.active) {
          assert.ok(gs.tutorial.step >= last, `level ${gs.level}: guide went from step ${last + 1} back to ${gs.tutorial.step + 1}`);
          last = gs.tutorial.step;
          // Press any plain "read this" button, as a player would
          if (t.step?.button && !t.step.onButton) t.pressButton();
          if (t.step?.onButton) t.pressButton();
        }
      }
      assert.ok(gs.levelCompleted, `level ${gs.level} not finished with the guide on`);
      if (!game.nextLevel()) break;
    }
  });
}

knownBugTest(test, 'tutorial-restarts-at-step-1', 'Level 2: buying the database before pressing "Show me" moves the guide past step 1', async () => {
  const game = await newGame('guestbook');
  const { gs, tutorial: t } = game;
  game.runLevel();
  assert.ok(gs.levelCompleted);
  game.nextLevel();
  t.sync();
  assert.equal(t.step.id, 'welcome', 'Level 2 should open on its welcome step');
  // The player goes straight to the builder and buys + places the database
  gs.emit('serverBuilderOpened');
  game.buy('db');
  game.place('db');
  assert.notEqual(t.step.id, 'welcome', 'guide is back at step 1 ("Show me") after the database is already placed');
  assert.ok(gs.tutorial.step > t.steps.findIndex(s => s.id === 'place_db'), `guide is on "${t.step.id}", a step the player already did`);
});
