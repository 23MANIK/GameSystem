---
name: deploy-game
description: Deploy Scale Architect: to the dev site (scale-architect-dev.vercel.app) by default, and to production (scale-architect.vercel.app) only after the user has checked dev and says to move it to prod. Always runs the full test suite FIRST (tools/test-all.sh: checks, unit tests and browser tests that play every product, in parallel); nothing ships if any test fails. Use whenever the user says deploy, release, ship, publish, push to prod, or update the live site.
---

# Deploy Scale Architect (tests first, always)

Production: https://scale-architect.vercel.app (Vercel project `scale-architect`, team `23maniks-projects`).
The deployable copy lives OUTSIDE the home-folder git repo, at `/Users/Shared/scale-architect`, which is already linked to that project.

## Dev first, then prod

Every deploy goes to the **dev site** first: https://scale-architect-dev.vercel.app (its own Vercel project, `scale-architect-dev`, built in `/Users/Shared/scale-architect-dev`).
- "Deploy" with no target means dev: run the test gate (step 1), then step 3. Give the user the dev link and stop.
- Production (step 4) only when the user has checked dev and says so in their own words ("move it to prod", "ship to prod"). Deploy the same commit they checked on dev.
- Dev has no production secrets (Redis, Resend, Anthropic), so live player counts, feedback email and Create DesignGame may say they aren't set up there. That's expected.

## V1 is frozen on production

Production runs **V1** (git tag `v1.0.0`, branch `main` in this folder's own repo). V2 work happens on the `v2` branch.
- On `v2`, or any branch other than `main`: run the test gate and deploy a **preview only** (step 3). Skip step 4, give the user the preview URL, and say production is still V1.
- Promote V2 to production only when the user explicitly says to release V2 (for example "release V2" or "put V2 on prod"). Then tag the release (`v2.0.0`) and merge it into `main`.
- A fix for V1 itself: make it on `main` and deploy it to production as usual.

**Never deploy to production without a PASS from step 1 for this exact code.** If the user asks to skip the tests, explain the risk and ask them to confirm in their own words first.

## 1. Test gate (one command, runs in parallel)

```bash
bash tools/test-all.sh
```
It runs three groups at the same time and needs no subagents:
- `tools/run-tests.mjs`: syntax, files, packs, balance, headless play-test, rate limiter, feedback API
- `tests/unit` (`node --test`): game rules, save/load, tutorial, every pack's levels, goals and guide steps
- `tests/e2e` (Playwright, several workers, each test in its own browser context so saves never mix): start screen, picker, level intro and Back, Level 1 by hand with the guide, Server Builder and upgrades, Goals, save/Continue/Home/Retry, feedback form, top bar, phone layout (375×812), and **every playable product played from Level 1 to the end in the real page**

The first run installs the test tools (`npm install`, `npx playwright install chromium`). It ends with `✅ ALL TESTS PASSED` (exit 0) or `❌ TESTS FAILED` with the failing tests; screenshots and traces are in `test-results/` (`npx playwright show-report`).

Tests for bugs listed in `tests/helpers/known-bugs.mjs` are reported as "known bug" and don't fail the gate. When one starts passing, the summary says "remove from known-bugs.mjs": do that, so it guards against the bug coming back.

`tools/deploy-dev.sh` runs this gate itself on the exact commit it deploys and stops if it fails. For production (step 4), run it on that commit too. If anything fails: stop, show the user what failed, and offer to fix it. Do not deploy.

## 2. Build the deploy copy

```bash
bash tools/sync-deploy.sh
```
It copies `index.html`, `css/`, `js/`, plus `deploy/middleware.js` (the edge rate limiter) and `deploy/vercel.json` (cache headers). Check the copy matches with `diff -rq js /Users/Shared/scale-architect/js`.

## 3. Dev site

In a terminal tab (the user can watch it), run from the repo:
```bash
bash tools/deploy-dev.sh v2      # or the branch the user named
```
It builds from a clean checkout of the pushed branch, so push first. For production, deploy through `bash tools/vercel-deploy.sh --prod` (never a bare `npx vercel`): it tags the deploy with its git version, commit and branch. Then smoke-test https://scale-architect-dev.vercel.app with `curl`:
- `/`, `/js/main.js` and `/css/mobile.css` return 200.
- The page title is "Scale Architect — System Design Game".

Give the user the dev link and the commit it was built from, and wait for them to say it can go to prod.

## 4. Production

```bash
cd /Users/Shared/scale-architect && npx vercel --prod --yes
```
Then check https://scale-architect.vercel.app:
- the same three URLs return 200
- **rate limiter:** 35 quick page loads from this machine (`for i in $(seq 35); do curl -s -o /dev/null -w "%{http_code} " https://scale-architect.vercel.app/; done`) end in `429`, and the 429 body contains "The system is busy". The limit is 30 page loads per minute per visitor; tell the user their own IP is limited for up to a minute.

If production is broken, redeploy the previous good deployment (`npx vercel rollback` or `vercel promote <previous-url>`) and tell the user.

## 5. Report

Tell the user:
- the test summary (tests passed, levels played)
- the live URL
- the rate-limit check result
- anything skipped or not verified

Nothing in this flow commits to git.
