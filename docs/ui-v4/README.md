# V4: minimal UI

Branch `v4` (from `v3`, 2026-10-27). Goal: players always know the next step and are never shown more than they need.
Research, before/after notes and mockups: https://claude.ai/artifact/C8yiLi7BiBGLJm8Kx7Y5Vu

## Rules
1. **Next step always visible.** The goal to work on, with a button that goes where you act, sits above the bottom bar (`js/ui/NextStep.js`).
2. **Primary first, details on tap.** Top bar = ☰ · level + goals · health · coins · users · speed. Meters, latency and reputation open from the health chip; Home, levels, money and feedback from ☰ (`js/ui/HUD.js`).
3. **Reveal just in time.** The health chip appears once there is a server.
4. **Say it once.** Reputation and latency are no longer shown twice; the Next step card hides while Goals (same goal) is open.
5. **One loud button per screen.** Start screen: Continue (or Play). Level complete: Start level N, with "Look around first" as a quiet link.

## What moved where
| v3 | v4 |
|---|---|
| 🏠 and 💬 in the top bar | ☰ menu (`#hud-home`, `#hud-feedback`) |
| 4 server meters + latency + reputation in the top bar | health chip `#hud-resources` → drop-down |
| "Next up" only inside Goals | Next step card `#next-step` (also inside Goals) |
| 9 stat tiles on level complete | 3 key stats + "All stats" fold |
| "Open Goals to start Level N" toast after a reload | Next step card: "Start Level N →" |
| 9 equal picker cards | playable first (easy → hard), "Start here" on the first easy game, locked games in one fold |

## Notes for later changes
- The Next step card hides while the tutorial guide, a panel, the server builder, the level intro or the level-complete screen is showing (`nextStepHidden()` in `js/main.js`).
- It reads goals with `peekChallenges()` (read-only). Do not use `evaluateChallenges()` in display-only UI: it latches goals as done and changes when levels finish.
- Styles: `css/v4.css`, loaded last.
- Tests: `tests/e2e/v4-ui.spec.mjs`.

**Update 2026-10-29:** the Next step card was removed at Nikhil's request (it covered the map on phones). The next goal is shown only in Goals ("Next up"), and Goals offers "Start Level N" after a level is done. See docs/popups/README.md.
