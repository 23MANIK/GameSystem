/**
 * InfoTips — the (i) buttons. Put `infoButton('cpu')` anywhere in markup;
 * clicking it opens a small popover with the text from data/explanations.js.
 * One delegated listener handles every button, including ones rendered later.
 */

import { EXPLANATIONS } from '../data/explanations.js';

/** Markup for an (i) button. */
export function infoButton(key, label = '') {
  const title = EXPLANATIONS[key]?.title?.replace(/<[^>]+>/g, '') || 'More info';
  return `<button type="button" class="info-btn" data-info="${key}" aria-label="More info: ${label || title}">i</button>`;
}

export default class InfoTips {
  constructor() {
    this.pop = document.createElement('div');
    this.pop.className = 'info-pop';
    this.pop.setAttribute('role', 'dialog');
    this.pop.hidden = true;
    document.body.appendChild(this.pop);
    this.current = null;

    // Capture phase so clicks inside cards (e.g. the server) don't also trigger them
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.info-btn, .term');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (this.current === btn) this.close();
        else this.open(btn);
        return;
      }
      if (!this.pop.hidden && !this.pop.contains(e.target)) this.close();
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    window.addEventListener('resize', () => this.close());
  }

  open(btn) {
    const info = EXPLANATIONS[btn.dataset.info];
    if (!info) return;
    this.current = btn;
    this.pop.innerHTML = `
      <div class="info-pop-head">
        <strong>${info.title}</strong>
        <button type="button" class="info-pop-close" aria-label="Close">✕</button>
      </div>
      <div class="info-pop-body">${info.body}</div>`;
    this.pop.querySelector('.info-pop-close').addEventListener('click', () => this.close());
    this.pop.hidden = false;
    this.position(btn);
  }

  /** Place the popover below the button (or above if there's no room), inside the screen. */
  position(btn) {
    const r = btn.getBoundingClientRect();
    const pw = this.pop.offsetWidth;
    const ph = this.pop.offsetHeight;
    const margin = 12;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(margin, Math.min(window.innerWidth - pw - margin, left));
    let top = r.bottom + 8;
    if (top + ph > window.innerHeight - margin) top = Math.max(margin, r.top - ph - 8);
    this.pop.style.left = `${left}px`;
    this.pop.style.top = `${top}px`;
  }

  close() {
    this.pop.hidden = true;
    this.current = null;
  }
}
