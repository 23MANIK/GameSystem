/**
 * ProductPicker — choose which product to build before a new game.
 * Products (and levels) that aren't built yet are shown locked.
 */

import { PRODUCTS } from '../data/products.js';

export default class ProductPicker {
  constructor(el) {
    this.el = el;
  }

  /** Show the picker; `onPick(productId)` runs when a playable product is chosen. */
  open(onPick, onBack, savedGame = '') {
    const cards = PRODUCTS.map(p => {
      const levels = p.levels.map(l => `
        <li class="pp-level${l.playable ? ' open' : ''}" title="${l.focus}">
          ${l.playable ? '' : '🔒 '}Lv.${l.level} ${l.name}
        </li>`).join('');
      return `
        <article class="pp-card${p.playable ? '' : ' locked'}" data-product="${p.id}">
          <div class="pp-card-head">
            <span class="pp-icon">${p.icon}</span>
            <div>
              <h3 class="pp-name">${p.name}</h3>
              <span class="pp-like">${p.likeWhat}</span>
            </div>
            ${p.playable ? '' : '<span class="pp-lock">🔒 Coming soon</span>'}
          </div>
          <p class="pp-tagline">${p.tagline}</p>
          <div class="pp-concepts">${p.concepts.map(c => `<span>${c}</span>`).join('')}</div>
          <ul class="pp-levels">${levels}</ul>
          <button class="btn ${p.playable ? 'btn-primary' : 'btn-secondary'} pp-play" data-product="${p.id}" ${p.playable ? '' : 'disabled'}>
            ${p.playable ? '▶ Play from Level 1' : 'Locked'}
          </button>
        </article>`;
    }).join('');

    this.el.innerHTML = `
      <div class="pp-inner">
        <header class="pp-header">
          <button class="pp-back" id="pp-back">← Back</button>
          <h2 class="pp-title">Choose what to build</h2>
          <p class="pp-sub">Each product is a classic system design problem. Every level has challenges; finish them all to unlock the next level.</p>
          ${savedGame ? `<p class="pp-save">💾 Starting a product replaces your saved game (${savedGame}). Press Back and Continue to keep playing it.</p>` : ''}
        </header>
        <div class="pp-grid">${cards}</div>
      </div>`;

    this.el.querySelectorAll('.pp-play:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this.close();
        onPick(btn.dataset.product);
      });
    });
    this.el.querySelector('#pp-back').addEventListener('click', () => {
      this.close();
      if (onBack) onBack();
    });

    this.el.hidden = false;
  }

  close() {
    this.el.hidden = true;
  }
}
