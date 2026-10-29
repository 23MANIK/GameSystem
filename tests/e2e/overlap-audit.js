// In-page overlap checker, injected by tests/e2e/popups.spec.mjs (and usable
// from the browser console). It defines window.__overlapAudit().
//
// It answers one question: can the player press every button they can see?
// For each visible button it asks the browser what is on top at the button's
// centre. If something else is on top, the button is blocked. Being under a
// full-screen modal scrim (level intro, level complete, a dialog) is fine:
// that is the modal doing its job. Being under a toast, the guide, the Next
// step card or a popover is a bug.
//
// It also lists pairs of floating cards (toasts, guide, Next step, popovers)
// whose boxes overlap, because one then hides the other's text.
window.__overlapAudit = (() => {
  const INTERACTIVE = 'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, summary';

  // Floating, non-modal cards that must never sit on top of each other
  const FLOATING = {
    toast: '#notification-container .toast:not(.dismissing)',
    guide: '#guide-bubble',
    hudPop: '.hud-pop',
    levelPop: '.level-pop',
    infoPop: '.info-pop',
    spike: '#hud-spike-wrap',
    sideSheet: 'body:not(.layer-modal) #side-panel.open',
    navBar: '#nav-bar'
  };

  const visible = el => {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden]')) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  const describe = el => {
    if (!el) return 'nothing';
    const named = el.closest('[id]');
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const label = (el.getAttribute?.('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${named && named !== el ? ` in #${named.id}` : ''}${label ? ` "${label}"` : ''}`;
  };

  /** A full-screen layer (modal scrim, start screen): covering things is its job. */
  const isScrim = el => {
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      const r = n.getBoundingClientRect();
      if (r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.9) return n;
    }
    return null;
  };

  /** A modal that owns the screen even without a full-screen scrim (the phone bottom sheet). */
  const modalOwner = el => (document.body.classList.contains('layer-modal') ? el.closest('#side-panel.open') : null);

  /** World content (the system map) may sit under the bars and panels: it pans. */
  const inWorld = el => Boolean(el.closest('#game-world')) && !el.closest('#side-panel');

  /** Is the point inside every scrolling/clipping ancestor (so it could be seen at all)? */
  const unclipped = (el, x, y) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        const r = n.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      }
    }
    return true;
  };

  function blockedButtons() {
    const out = [];
    const all = [...document.querySelectorAll(INTERACTIVE)];
    // Native <dialog> modals live in the top layer; when one is open only its buttons count
    const topDialog = [...document.querySelectorAll('dialog[open]')].find(d => d.matches(':modal'));
    for (const el of all) {
      if (!visible(el) || el.disabled) continue;
      if (topDialog && !topDialog.contains(el)) continue;
      // Inside a closed <details>, or a link inside a button: the outer control counts
      if (el.parentElement?.closest(INTERACTIVE) && !el.matches('summary')) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; // scrolled away
      if (!unclipped(el, x, y)) continue;
      // Walk down the stack at that point until we reach the button
      for (const hit of document.elementsFromPoint(x, y)) {
        if (el === hit || el.contains(hit) || hit.contains(el)) break;
        // Behind a full-screen modal: expected, unless the button is part of that modal
        const scrim = isScrim(hit) || modalOwner(hit);
        if (scrim && !scrim.contains(el)) break;
        if (inWorld(el) && !inWorld(hit)) break;
        out.push({ button: describe(el), coveredBy: describe(hit) });
        break;
      }
    }
    return out;
  }

  function floatingOverlaps(minPx = 4) {
    const boxes = [];
    for (const [name, sel] of Object.entries(FLOATING)) {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (visible(el)) boxes.push({ name: `${name}${i ? '#' + (i + 1) : ''}`, el, r: el.getBoundingClientRect() });
      });
    }
    const out = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // Toasts in the same stack never overlap each other by design
        if (a.name.startsWith('toast') && b.name.startsWith('toast')) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > minPx && h > minPx) out.push(`${a.name} overlaps ${b.name} (${Math.round(w)}×${Math.round(h)}px)`);
      }
    }
    return out;
  }

  return function audit() {
    return { blocked: blockedButtons(), overlaps: floatingOverlaps() };
  };
})();
