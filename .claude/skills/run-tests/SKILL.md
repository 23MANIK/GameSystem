---
name: run-tests
description: Run Scale Architect's test suite fast and in parallel after adding or changing any feature, level, product pack or UI, and add tests for the new feature. Use after every change before saying it is done, when the user says "run the tests", "test it", "check nothing broke", or before opening a PR or deploying.
---

# Run the tests (after every feature)

Everything runs from the repo root with one command. Three groups run at the same time; browser tests use several workers, each test in its own browser context.

| What changed | Command | Time |
|---|---|---|
| Anything (default, and always before a PR or deploy) | `bash tools/test-all.sh` | ~1–2 min |
| Only game logic / data, want a quick check first | `bash tools/test-all.sh --no-browser` | ~5 s |
| One area of the UI | `bash tools/test-all.sh -g "goals"` (any test-name match) | seconds |
| One product pack | `bash tools/test-all.sh -g "ticketing"` | ~30 s |

Pass = the last line says `✅ ALL TESTS PASSED` (exit code 0). First run on a machine installs the tools (`npm install`, Chromium for Playwright).

## What is covered

- `tools/run-tests.mjs`: syntax, every file the page loads, every pack's levels/goals/tutorial references, simulator snapshots, building art, balance, headless play-test of every level, rate limiter, presence and feedback APIs.
- `tests/unit/*.test.mjs` (`node --test`): picker list vs packs, every pack's levels, guide steps (text, highlight target, event) and goals, money and upgrades, save/load/Retry, the guide never moving backwards, levels not starting overloaded.
- `tests/e2e/*.spec.mjs` (Playwright): start screen, picker, level intro and Back, Level 1 by hand with the guide, Server Builder (upgrades, tabs, code fixes, extra servers, disk space), Goals, save/Continue/Home/Retry, feedback form, top bar, phone layout, and every playable product played from Level 1 to the last level in the real page.

New product packs are picked up automatically (the tests loop over `js/products/registry.js`).

## After adding a feature: add its test

1. Game rule or data → a test in `tests/unit/` (use `newGame()` from `tests/helpers/harness.mjs` to set up any state; `game.runLevel()` plays a level with the bot).
2. Something on screen → a test in `tests/e2e/` (use the `game` fixture from `tests/e2e/fixtures.mjs`: `game.newGame('guestbook')`, `game.playLevel()`, `game.run((g, gs) => …)`). Prefer one test per behaviour so they run in parallel.
3. Run `bash tools/test-all.sh` and make it pass.

## Known bugs

A bug someone is already fixing goes in `tests/helpers/known-bugs.mjs`, and its test uses `knownBugTest` (unit) or `knownBug` (browser). It is reported as "known bug" and doesn't block deploys. When the run says "✨ Now passing, remove from known-bugs.mjs", remove the entry in the same PR as the fix.

## If something fails

- Read the failure in the summary; for browser tests open `npx playwright show-report` (screenshot + trace of each failure).
- A playthrough "bot did not finish level N; pending: …" means that level can't be finished with the bot's strategy: a balance problem (check with `node tools/balance-levels.mjs <product>` and `node tools/playtest-headless.mjs <product>`).
- Fix the code, not the test, unless the test is wrong. Never delete or skip a test to get green.
