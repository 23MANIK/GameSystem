/**
 * ProductPicker — choose which product to build before a new game.
 * Products (and levels) that aren't built yet are shown locked. Below them:
 * Create DesignGame, and Community games (generated with Claude, see js/designgame/).
 */

import { PRODUCTS } from '../data/products.js';
import { listGames, ensureGame } from '../designgame/client.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DIFFICULTY = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** A product's difficulty: its own, else guessed from how many levels it has. */
export function difficultyOf(p) {
  if (DIFFICULTY[p.difficulty]) return p.difficulty;
  const n = (p.levels || []).length;
  return n <= 5 ? 'easy' : n <= 8 ? 'medium' : 'hard';
}

/**
 * One small card: icon, name and difficulty. The whole card is the play button.
 * Generated games' text is already cleaned (dataPack.js), but summaries from the list are escaped here.
 */
function card(p, { community = false, clean = false } = {}) {
  const t = community && !clean ? esc : (s => s);
  const playable = community || p.playable;
  const d = difficultyOf(p);
  return `
    <button type="button" class="pp-card pp-play${playable ? '' : ' locked'}${community ? ' pp-community' : ''}" data-product="${t(p.id)}"${community ? ' data-community="1"' : ''} ${playable ? '' : 'disabled'}
      aria-label="${t(p.name)}, ${DIFFICULTY[d]}${playable ? '' : ', coming soon'}">
      <span class="pp-icon" aria-hidden="true">${t(p.icon)}</span>
      <span class="pp-name">${t(p.name)}</span>
      <span class="pp-tags">
        <span class="pp-diff pp-diff-${d}">${DIFFICULTY[d]}</span>
        ${playable ? '' : '<span class="pp-lock">🔒 Soon</span>'}
        ${community ? '<span class="pp-lock pp-badge">✨ Claude</span>' : ''}
      </span>
    </button>`;
}

export default class ProductPicker {
  constructor(el) {
    this.el = el;
  }

  /**
   * Show the picker. `onPick(productId)` runs when a playable product is chosen,
   * `onCreate()` when Create DesignGame is pressed.
   */
  open(onPick, onBack, savedGame = '', { onCreate } = {}) {
    const cards = PRODUCTS.filter(p => !p.generated).map(p => card(p)).join('');

    this.el.innerHTML = `
      <div class="pp-inner">
        <header class="pp-header">
          <button class="pp-back" id="pp-back">← Back</button>
          <h2 class="pp-title">Choose what to build</h2>
          <p class="pp-sub">Each product is a classic system design problem. Every level has challenges; finish them all to unlock the next level.</p>
          ${savedGame ? `<p class="pp-save">💾 Starting a product replaces your saved game (${savedGame}). Press Back and Continue to keep playing it.</p>` : ''}
        </header>
        <div class="pp-grid">${cards}</div>

        <section class="pp-section">
          <h3 class="pp-section-title">Community games</h3>
          <p class="pp-sub">Games Claude made from a prompt: it researched how each system is really built and test-played every level.</p>
          <div class="pp-grid" id="pp-community">
            ${onCreate ? `
            <button type="button" class="pp-card pp-create" id="pp-create" aria-label="Create DesignGame">
              <span class="pp-icon" aria-hidden="true">✨</span>
              <span class="pp-name">Create DesignGame</span>
              <span class="pp-tags"><span class="pp-lock pp-badge">+ New</span></span>
            </button>` : ''}
            <p class="pp-loading" id="pp-loading">Loading…</p>
          </div>
        </section>
      </div>`;

    const bind = root => root.querySelectorAll('.pp-play[data-product]:not([disabled])').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        const id = btn.dataset.product;
        if (btn.dataset.community) {
          const tag = btn.querySelector('.pp-diff');
          const label = tag.textContent;
          btn.disabled = true;
          tag.textContent = 'Loading…';
          if (!(await ensureGame(id))) {
            tag.textContent = 'Couldn\'t load. Tap to retry';
            btn.disabled = false;
            return;
          }
          tag.textContent = label;
        }
        this.close();
        onPick(id);
      });
    });
    bind(this.el);

    const create = this.el.querySelector('#pp-create');
    if (create) {
      const go = () => { this.close(); onCreate(); };
      create.addEventListener('click', go);
    }
    this.el.querySelector('#pp-back').addEventListener('click', () => {
      this.close();
      if (onBack) onBack();
    });

    this.el.hidden = false;
    this.loadCommunity(bind);
  }

  /** Published games, plus any generated game this browser has open (e.g. from a link). */
  async loadCommunity(bind) {
    const grid = this.el.querySelector('#pp-community');
    const games = await listGames();
    const local = PRODUCTS.filter(p => p.generated && !games.some(g => g.id === p.id));
    this.el.querySelector('#pp-loading')?.remove();
    const all = [...local, ...games];
    if (!all.length) {
      grid.insertAdjacentHTML('beforeend', '<p class="pp-empty">No community games yet.</p>');
      return;
    }
    grid.insertAdjacentHTML('beforeend', all.map(g => card(g, { community: true, clean: local.includes(g) })).join(''));
    bind(grid);
  }

  close() {
    this.el.hidden = true;
  }
}
