/**
 * ProductPicker — choose which product to build before a new game.
 * Products (and levels) that aren't built yet are shown locked. Below them:
 * Create DesignGame, and Community games (generated with Claude, see js/designgame/).
 */

import { PRODUCTS } from '../data/products.js';
import { listGames, ensureGame } from '../designgame/client.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** One product card. Generated games' text is already cleaned (dataPack.js), but summaries from the list are escaped here. */
function card(p, { community = false, clean = false } = {}) {
  const t = community && !clean ? esc : (s => s);
  const levels = p.levels.map(l => `
    <li class="pp-level${l.playable !== false ? ' open' : ''}" title="${t(l.focus)}">
      ${l.playable !== false ? '' : '🔒 '}Lv.${l.level} ${t(l.name)}
    </li>`).join('');
  const playable = community || p.playable;
  return `
    <article class="pp-card${playable ? '' : ' locked'}${community ? ' pp-community' : ''}" data-product="${t(p.id)}">
      <div class="pp-card-head">
        <span class="pp-icon">${t(p.icon)}</span>
        <div>
          <h3 class="pp-name">${t(p.name)}</h3>
          <span class="pp-like">${t(p.likeWhat)}</span>
        </div>
        ${playable ? (community ? '<span class="pp-lock pp-badge">✨ Made with Claude</span>' : '') : '<span class="pp-lock">🔒 Coming soon</span>'}
      </div>
      <p class="pp-tagline">${t(p.tagline)}</p>
      <div class="pp-concepts">${(p.concepts || []).map(c => `<span>${t(c)}</span>`).join('')}</div>
      <ul class="pp-levels">${levels}</ul>
      <button class="btn ${playable ? 'btn-primary' : 'btn-secondary'} pp-play" data-product="${t(p.id)}"${community ? ' data-community="1"' : ''} ${playable ? '' : 'disabled'}>
        ${playable ? '▶ Play from Level 1' : 'Locked'}
      </button>
    </article>`;
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
            <article class="pp-card pp-create" id="pp-create" tabindex="0" role="button">
              <div class="pp-card-head"><span class="pp-icon">✨</span><div><h3 class="pp-name">Create DesignGame</h3><span class="pp-like">Name a system, get a game · invite only</span></div></div>
              <p class="pp-tagline">Type what to design (ride hailing, payments, a chat app…). Claude researches it, builds the levels and tests them.</p>
              <button class="btn btn-secondary pp-play" type="button">+ Create a game</button>
            </article>` : ''}
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
          btn.disabled = true;
          btn.textContent = 'Loading…';
          if (!(await ensureGame(id))) {
            btn.textContent = 'Couldn\'t load it. Try again';
            btn.disabled = false;
            return;
          }
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
      create.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
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
