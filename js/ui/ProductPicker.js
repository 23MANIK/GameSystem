/**
 * ProductPicker — choose which product to build before a new game.
 * Products (and levels) that aren't built yet are shown locked.
 */

import { PRODUCTS } from '../data/products.js';

const DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** A product's difficulty: its own, else guessed from how many levels it has. */
export function difficultyOf(p) {
  if (DIFFICULTY[p.difficulty]) return p.difficulty;
  const n = (p.levels || []).length;
  return n <= 5 ? 'easy' : n <= 8 ? 'medium' : 'hard';
}

/** One small card: icon, name and difficulty. The whole card is the play button. */
function card(p) {
  const d = difficultyOf(p);
  return `
    <button type="button" class="pp-card pp-play${p.playable ? '' : ' locked'}" data-product="${p.id}" ${p.playable ? '' : 'disabled'}
      aria-label="${p.name}, ${DIFFICULTY[d]}${p.playable ? '' : ', coming soon'}">
      <span class="pp-icon" aria-hidden="true">${p.icon}</span>
      <span class="pp-name">${p.name}</span>
      <span class="pp-tags">
        <span class="pp-diff pp-diff-${d}">${DIFFICULTY[d]}</span>
        ${p.playable ? '' : '<span class="pp-lock">🔒 Soon</span>'}
      </span>
    </button>`;
}

export default class ProductPicker {
  constructor(el) {
    this.el = el;
  }

  /** Show the picker; `onPick(productId)` runs when a playable product is chosen. */
  open(onPick, onBack, savedGame = '') {
    const cards = PRODUCTS.map(p => card(p)).join('');

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
