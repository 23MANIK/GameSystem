/**
 * Layers — which kind of pop-up owns the screen right now, so pop-ups never
 * cover each other's buttons. The rules are written up in docs/popups/README.md.
 *
 * Every pop-up belongs to one layer, from bottom to top (z-index tokens in
 * css/index.css):
 *
 *   world → top bar / bottom bar → side panel → coach (guide, Next step)
 *   → toasts → popovers (☰ menu, health, level card) → modals → screens
 *   → tooltips (i) → crash screen
 *
 * Rules this module enforces:
 *   1. One thing talks at a time. While a modal (level intro, level complete,
 *      Server Builder, a dialog, the start screen, a phone bottom sheet) or a
 *      popover is open, new toasts wait and visible toasts step out of sight.
 *      When it closes, the newest waiting toasts show (they are always in the
 *      Alerts tab anyway).
 *   2. Coach cards (guide, Next step) step aside while a big popover is open,
 *      the same way they already do for panels and modals.
 *
 * It sets body classes the CSS reacts to:
 *   layer-modal    a modal or phone sheet is open
 *   layer-popover  the ☰ menu, health or level/money popover is open
 *   toasts-held    toasts are waiting (either of the above, or an (i) tooltip)
 */

const shown = el => Boolean(el) && !el.hidden && el.getClientRects().length > 0;
// Below this width the side panel covers the play area (phone bottom sheet, narrow tablet)
const SHEET_COVERS = 760;

/** The open modal, by name, or null. */
export function openModal() {
  const body = document.body;
  if (body.classList.contains('crashed')) return 'crash';
  if (body.classList.contains('level-intro-open')) return 'level intro';
  if (document.getElementById('level-up-overlay')?.classList.contains('active')) return 'level complete';
  if (body.classList.contains('builder-open') || document.getElementById('modal-backdrop')?.classList.contains('open')) return 'server builder';
  if (document.querySelector('dialog[open]')) return 'dialog';
  for (const id of ['create-screen', 'product-screen', 'intro-screen']) {
    if (shown(document.getElementById(id))) return id.replace('-', ' ');
  }
  if (body.classList.contains('sheet-open') && window.innerWidth < SHEET_COVERS) return 'sheet';
  return null;
}

/** The open popover (☰ menu, health, level card, money), or null. */
export function openPopover() {
  for (const el of document.querySelectorAll('.hud-pop, .level-pop')) {
    if (shown(el)) return el;
  }
  return null;
}

/** Why toasts must wait right now, or null if they can show. */
export function toastsHeldBy() {
  const modal = openModal();
  if (modal) return modal;
  if (openPopover()) return 'popover';
  if (shown(document.querySelector('.info-pop'))) return 'tooltip';
  return null;
}

const listeners = new Set();
let timer = null;
let last = '';

/** Re-read the layers now: updates the body classes and tells listeners. */
export function refreshLayers() {
  const modal = openModal();
  const popover = Boolean(openPopover());
  const held = toastsHeldBy();
  const body = document.body;
  body.classList.toggle('layer-modal', Boolean(modal));
  body.classList.toggle('layer-popover', popover);
  body.classList.toggle('toasts-held', Boolean(held));
  const key = `${modal}|${popover}|${held}`;
  if (key !== last) {
    last = key;
    for (const fn of listeners) fn({ modal, popover, held });
  }
}

/**
 * Watch the layers. Pop-ups open from many places, so instead of wiring every
 * one of them this checks a few elements after each click/key and every 250 ms.
 */
export function watchLayers(onChange) {
  if (onChange) listeners.add(onChange);
  if (timer) return;
  const soon = () => requestAnimationFrame(refreshLayers);
  document.addEventListener('click', soon, true);
  document.addEventListener('keydown', soon, true);
  window.addEventListener('resize', soon);
  timer = setInterval(refreshLayers, 250);
  refreshLayers();
}
