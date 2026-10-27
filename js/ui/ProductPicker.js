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
function card(p, { community = false, clean = false, start = false, saved = null } = {}) {
  const t = community && !clean ? esc : (s => s);
  const playable = community || p.playable;
  const d = difficultyOf(p);
  const n = (p.levels || []).length;
  const tag = saved ? `Level ${saved.level}/${n || '?'}` : `${DIFFICULTY[d]}${playable && n ? ` · ${n} levels` : ''}`;
  return `
    <button type="button" class="pp-card pp-play${playable ? '' : ' locked'}${community ? ' pp-community' : ''}${start ? ' pp-start' : ''}${saved ? ' pp-saved' : ''}" data-product="${t(p.id)}"${community ? ' data-community="1"' : ''} ${playable ? '' : 'disabled'}
      aria-label="${t(p.name)}, ${DIFFICULTY[d]}${playable ? '' : ', coming soon'}${start ? ', recommended first game' : ''}${saved ? ', your saved game' : ''}">
      ${start ? '<span class="pp-flag">Start here</span>' : ''}${saved ? '<span class="pp-flag pp-flag-saved">In progress</span>' : ''}
      <span class="pp-icon" aria-hidden="true">${t(p.icon)}</span>
      <span class="pp-name">${t(p.name)}</span>
      <span class="pp-tags">
        <span class="pp-diff pp-diff-${saved ? 'saved' : d}">${tag}</span>
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
  open(onPick, onBack, savedGame = '', { onCreate, saved = null } = {}) {
    // Playable games first, easy → hard; the ones not built yet fold into one line
    const order = { easy: 0, medium: 1, hard: 2 };
    const built = PRODUCTS.filter(p => !p.generated);
    const playable = built.filter(p => p.playable).sort((a, b) => order[difficultyOf(a)] - order[difficultyOf(b)]);
    const soon = built.filter(p => !p.playable);
    // A first-time player gets one clear place to start: the first easy game
    const startId = saved ? null : playable.find(p => difficultyOf(p) === 'easy')?.id;
    const cards = playable.map(p => card(p, { start: p.id === startId, saved: saved?.productId === p.id ? saved : null })).join('');
    const soonHtml = soon.length ? `
        <details class="pp-soon">
          <summary>🔒 ${soon.length} more coming soon <span class="pp-soon-names">${soon.map(p => p.name).join(', ')}</span></summary>
          <div class="pp-grid">${soon.map(p => card(p)).join('')}</div>
        </details>` : '';

    this.el.innerHTML = `
      <div class="pp-inner">
        <header class="pp-header">
          <button class="pp-back" id="pp-back">← Back</button>
          <h2 class="pp-title">Choose a game</h2>
          <p class="pp-sub">Each game is a real system design problem. Beat a level's goals to unlock the next.</p>
          ${savedGame ? `<p class="pp-save">💾 Starting a game replaces your saved game (${savedGame}). Press Back and Continue to keep playing it.</p>` : ''}
        </header>
        <div class="pp-grid">${cards}</div>
        ${soonHtml}

        <section class="pp-section">
          <h3 class="pp-section-title">Community games</h3>
          <p class="pp-sub">Made by Claude from a prompt, researched and test-played.</p>
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
