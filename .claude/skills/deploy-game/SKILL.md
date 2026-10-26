---
name: deploy-game
description: Deploy Scale Architect: to the dev site (scale-architect-dev.vercel.app) by default, and to production (scale-architect.vercel.app) only after the user has checked dev and says to move it to prod. Always runs the full test suite and an in-browser playthrough of every product FIRST, in four parallel subagents on Opus 5.5 at low effort (one per product on its own port, plus unit tests and a phone check); nothing ships if any test fails. Use whenever the user says deploy, release, ship, publish, push to prod, or update the live site.
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

## 1. Test gate (parallel subagents: Opus 5.5, low effort)

Spawn FOUR subagents with the Agent tool in ONE message, so they run in parallel. Each one uses `model: "opus"`, `effort: "low"`, `subagent_type: "general-purpose"`, and each brief starts with "Do not edit any files and do not deploy. Project: `/Users/nikhilrajpoot/Desktop/justDoIt/GameSystem`."

Each product gets its own origin (port), so their localStorage saves never mix:

| Agent | Server (`.claude/launch.json`) | Port | Product |
|---|---|---|---|
| A | `game-guestbook` | 8011 | guestbook: FIXES `{2:['pagination','index'],3:['archive']}`, APPS `{5:3,6:4,7:4}`, SHARDS `{}` |
| B | `game-url` | 8012 | url_shortener: FIXES `{2:['index','base62'],4:['expiry'],7:['idRanges']}`, APPS `{4:3,5:4,6:5,7:6,8:5}`, SHARDS `{7:3}` |
| C | `game-drive` | 8013 | cloud_drive: FIXES `{2:['index'],3:['presigned'],4:['chunking'],5:['verifyUploads'],6:['dedup'],7:['sharesTable'],8:['deltaSync'],9:['versions'],10:['coldTier']}`, APPS `{7:3,8:3,9:4,10:5,11:5}`, SHARDS `{10:3}` |
| D | `game` | 8000 | unit tests + phone check |

**Brief for A, B and C** (fill in the server, product and settings):
> Start the `<server>` preview server and work only in that tab.
> - First back up `localStorage['scale_architect_save_v4']` into `sessionStorage`. At the end, restore it exactly, even if something fails; if the key was absent, leave it absent.
> - Clear localStorage, reload, click New Game, pick `<product>`, and click `#li-start`.
> - Run `.claude/skills/design-product-levels/reference/playtest-bot.js` with these settings: `<settings>`.
>   - Make it return its results instead of calling `console.table`.
>   - After each `startNextLevel()`, wait until `#li-start` is visible, then click it. Clicking too early stalls the level.
> - Every level must report done, and no `window` errors may be thrown.
> - Stop the preview server when you finish.
> - Reply with `PASS` or `FAIL` on the first line, then the minutes per level and the exact failure, if any.

**Brief for D:**
> 1. Run `node tools/run-tests.mjs`. Every test must pass (exit code 0).
> 2. Start the `game` preview server and back up the save as above.
> 3. Set the viewport to the mobile preset (375×812), reload, click Continue (or New Game if there is no save), and confirm:
>    - `window.__game.diagram.vertical === true`
>    - the Goals panel opens as a full-width sheet
>    - no `.sd-node` sits outside the screen
> 4. Reset the viewport to desktop and restore the save.
> 5. Reply with `PASS` or `FAIL` on the first line, then the run-tests summary, the phone check result, and the exact failure, if any.

The gate passes only when all four reply PASS. If a subagent can't use the browser, run its part yourself before going on. If any part fails: stop, show the user what failed, and offer to fix it. Do not deploy.

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
It builds from a clean checkout of the pushed branch, so push first. Then smoke-test https://scale-architect-dev.vercel.app with `curl`:
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
