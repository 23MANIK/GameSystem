# Pop-ups that never block each other

Nikhil asked (2026-10-28) for UX research so pop-ups don't get in each other's way, for example a toast or the tutorial guide covering another pop-up's Back button.

## What the audit found (v4 before this change)

Every pop-up was opened together with two long toasts on desktop (1280×800), tablet (768×1024), phone (390×844) and small phone (360×640). A checker (`tests/e2e/overlap-audit.js`) asks the browser what is on top at the centre of each visible button.

| # | Where | What went wrong |
|---|-------|-----------------|
| 1 | Level intro card, small phone | Toasts sat on top of the card and covered **← Back**. Toasts (z 400) were above modals (z 300–355). |
| 2 | Level 2 intro | "Level 2 needs more…" warning fires the moment the intro opens, so it always lands on the card. |
| 3 | Server Builder, phone | Toasts moved to the very top and covered ☰, the level card, coins and speed. |
| 4 | Server Builder, desktop | A toast covered an (i) button in the builder's summary. |
| 5 | Goals / Alerts panel, desktop | Bottom-right toasts covered the panel's goal rows. |
| 6 | Goals sheet, small phone | A toast covered the sheet's ✕ (close). |
| 7 | ☰ menu / health popover, phone | Toasts and popovers shared the space under the top bar. |
| 8 | Level popover | It covered the Next step card's button (the card stayed "on"). |
| 9 | Map, before the first server | "No servers yet" sat on top of the Users card and its (i) button. |

PR #21 (login) and #22 (profile) add native `<dialog>` modals. Those use the browser's top layer, so nothing can cover them; the rules below still hold toasts while they are open.

## What good games and design systems do

- **Snackbars/toasts: one place, a short queue, never on top of a dialog.** Material shows one snackbar at a time, queues the rest, and places them so they don't cover the bottom navigation ([Material snackbars](https://material.io/components/snackbars), [Android Snackbar docs](https://github.com/material-components/material-components-android/blob/master/docs/components/Snackbar.md)).
- **Toasts must not block the user.** They go where the player isn't working and can be dismissed ([non-blocking toast systems](https://dev.to/137foundry/how-to-build-a-toast-notification-system-that-does-not-block-the-user-27l4), [Scottish Government design system: modals and toasts](https://designsystem.gov.scot/components/notification-message/modals-toasts)).
- **One modal at a time.** A modal owns the screen; nothing non-essential should sit on top of it ([overlay layers explained](https://besthub.dev/articles/mastering-overlay-layers-dialogs-toasts-and-snackbars-explained-1d10ae57900a), [modals and overlays](https://uiux-atlas.pages.dev/lessons/ui-patterns/modals-dialogs-and-overlays)).
- **A named z-index scale instead of magic numbers**, so the order of layers is a decision made once ([z-index token scales](https://designsystemproblems.pages.dev/token-management/z-index-token-scale), [Reshaped z-index tokens](https://reshaped.so/docs/tokens/z-index), [Singapore GDS layer tokens](https://designsystem.tech.gov.sg/foundations/layer/layer-tokens)).

## The rules

1. **One layer order.** Every pop-up uses a token from `css/index.css`, bottom to top:
   world → top/bottom bars (`--z-hud`) → side panel (`--z-panel`) → coach: the tutorial guide (`--z-coach`) → toasts (`--z-notification`) → popovers: ☰, health, level, money (`--z-popover`) → modals: Server Builder, level intro, level complete (`--z-modal`) → full screens: start, picker, create (`--z-screen`) → (i) tooltips (`--z-tooltip`) → crash (`--z-crash`). No raw z-index numbers for pop-ups.
2. **One thing talks at a time.** While a modal, a covering bottom sheet (screens under 760 px), a popover or an (i) tooltip is open, toasts wait. Toasts already showing step out of sight. When it closes, the newest two waiting toasts show; anything that waited over 30 s is dropped. Every toast is in the Alerts tab anyway.
3. **Safe zones.** Pop-ups that can be on screen together never share space:
   - top: the top bar, then toasts right under it (top-right on desktop, full width on phones);
   - bottom: the tutorial guide above the bottom bar (nothing else floats over the map);
   - right (desktop): the side panel; toasts move to its left while it is open;
   - popovers hang from the button that opened them; modals take the whole screen.
4. **The guide steps aside** while a big popover is open.
5. **Tested.** `tests/e2e/popups.spec.mjs` opens every pairing above on all four screen sizes and fails if any visible button is covered by something other than its own modal's backdrop, or if two floating cards overlap.

## Decisions made without Nikhil

- Toasts moved from bottom-right to top-right on desktop. The bottom-left is the coach zone, and on tablets (768 px) a bottom toast and the guide collided.
- Toasts wait (are not dropped) during a modal, but only the newest two and only for 30 s, so a long Server Builder visit doesn't end with a stale burst.
- The phone bottom sheet still covers the bottom bar. That is a modal sheet by design (close with ✕, swipe or tapping the dimmed area).

## Update 2026-10-29: Next step card removed

On the dev site Nikhil found the Next step card hid the map on his iPhone (My Server and its CPU bar). He asked for it to go: the next goal now lives only in Goals ("Next up"), and after "Look around first" the next level starts from Goals. Nothing floats over the map once the tutorial is done; a test checks every map card stays above the bottom bar on two phone sizes.

## Code

- `js/ui/Layers.js`: which layer owns the screen; sets `layer-modal`, `layer-popover`, `toasts-held` on `<body>`.
- `js/ui/Notifications.js`: the waiting queue.
- `css/layers.css`: safe zones and the hide rules.
- `tests/e2e/overlap-audit.js` + `tests/e2e/popups.spec.mjs`: the checker and the tests. In a browser console you can paste `overlap-audit.js` and run `__overlapAudit()` on any screen.
