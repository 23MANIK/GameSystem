# Versions

Scale Architect has 5 versions so far: V1, V2, V3, V4, plus a combined dev build of V4 with its open pull requests.
Each version is a git branch, and each new version starts from the one before it (v1 → v2 → v3 → v4).

Last checked: 2026-10-28 (from git and Vercel).

## Where each version runs right now

| Site | URL | Version | Commit |
| --- | --- | --- | --- |
| **Production** | https://scale-architect.vercel.app | **V2** | `33815b3` (live since 2026-10-28) |
| **Dev** | https://scale-architect-dev.vercel.app | **V4 + open PRs #21, #22, #23** | `08feb80` (deployed 2026-10-28) |
| **Preview** | https://scale-architect-enku267uo-23maniks-projects.vercel.app | **V2** (same code as production) | `33815b3` (behind Vercel login) |

Rollback point for production: https://scale-architect-bbg43z1sn-23maniks-projects.vercel.app (V1, last V1 production deploy, 2026-10-24).

Rule: every change goes to the dev site first, and to production only after Nikhil checks it.

## V1: the first game (retired)

- **Branch:** `v1` (frozen, do not change). `master` holds only the initial commit.
- **What's in it:** pick a product (Guestbook, URL Shortener, Cloud Drive), build one server, and grow it level by level with a separate database, load balancer, cache, CDN and more. Includes the phone layout fix.
- **Pull requests:** none (built before PRs were used).
- **Deployed:** was production until 2026-10-28. Kept so it can be rolled back to at any time.

## V2: the redesign (live on production)

- **Branch:** `v2`, started from V1. Tag `v2.0.0` marks the first V2 release (`6c9df87`, 2026-10-24).
- **What's in it:**
  - New journey and screen map, nav order Build, Server, Goals, Alerts; goals, incidents and results screens.
  - Phone layout fixes, speed button, crash screen, clearer bottlenecks.
  - 3D isometric Buildings gallery with level-by-level upgrades.
  - News Feed product and the level-generation pipeline.
  - New designs: Ticket Booking (medium) and Ad Click Aggregator (hard).
  - Product picker with small rounded cards (name and difficulty).
  - Back button on the level intro.
  - Play-test fixes (disk downgrade guard, tutorial skip, level-start overload, goal icons, Escape).
  - Automated test suite (`bash tools/test-all.sh`) that runs before every dev deploy.
  - Dev site first, then production (deploy scripts).
- **Merged PRs:** #1 Back button, #3 Dev site first, #5 Product picker, #7 Ticket Booking + Ad Click designs, #9 Test suite, #11 Known-bugs cleanup.
- **Open PRs:** #4 deploy-dev clean-up on older git, #17 AI Support Agent design (9 levels).
- **Deployed:** production (https://scale-architect.vercel.app) and the V2 preview link.

## V3: Create DesignGame (AI game generator)

- **Branch:** `v3`, started from V2 on 2026-10-24. Has everything in V2, plus:
  - **Create DesignGame:** type a prompt and an AI agent researches the system, writes the levels, balances and play-tests them, and publishes a new game without a redeploy. Generated games are data-only packs. Only Nikhil can create games (passcode). Uses Hello Interview notes as the main research source.
  - Community games list.
- **Merged PRs:** #2 Back button, #6 Product picker, #8 Ticket Booking + Ad Click designs, #10 Test suite, #12 Known-bugs cleanup (the V3 copies of the V2 changes).
- **Open PRs:** #18 AI Support Agent design, #19 Google sign-in with Firebase.
- **Deployed:** not on production. Has been on the dev site before; the V3 preview deploy is on hold (needs `ANTHROPIC_API_KEY`, `DESIGNGAME_PASSCODE` and Redis on Vercel).

## V4: minimal UI

- **Branch:** `v4`, started from V3 on 2026-10-27. Has everything in V3, plus:
  - Minimal UI: always-visible Next step card, 4-item top bar with a ☰ menu and one health chip, shorter level-complete screen, Continue-first start screen, clearer game picker.
- **Merged PRs:** #20 Minimal UI.
- **Open PRs:**
  - #21 Google sign-in with Firebase (cloud saves + analytics).
  - #22 Player profile (name, picture, bio, progress, sign out, delete account). Needs #21 first.
  - #23 Pop-ups never block each other (layer order, toast queue, safe zones).
- **Deployed:** dev site, as a combined build of V4 + #21 + #22 + #23 (branch `claude/project-thread-rq502w-dev`, commit `08feb80`). Not on production.

## Keeping this file up to date

Update this file whenever a version is created, a PR is merged, or something is deployed to production, dev or preview.
