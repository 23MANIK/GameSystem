/**
 * LevelIntro — a short card before each level: what's wrong, what you'll add,
 * how many goals. The level's clock only starts when the player presses Start.
 */

import { getProduct } from '../data/products.js';
import { LEVELS } from '../data/levels.js';
import { ROLES } from '../data/roles.js';
import { CODE_FIXES } from '../data/codeFixes.js';
import { getChallenges } from '../game/Challenges.js';
import { activeProduct } from '../products/registry.js';
import { linkTerms } from './Glossary.js';

/** The first sentence of a text (the story is often 2–3 sentences). */
function firstSentence(text = '') {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

export default class LevelIntro {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'level-intro';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    document.body.appendChild(this.el);
  }

  /** onBack: leave the intro for the start screen (players must never be stuck here). */
  open(gs, onStart, onBack) {
    const L = gs.levelDef();
    const product = getProduct(gs.productId);
    const pack = activeProduct();
    const role = pack.levelRole?.[L.level];
    const isFirst = L.level === 1;
    const newRole = role && ROLES[role];
    const fixes = Object.values(CODE_FIXES).filter(f => f.unlockLevel === L.level);
    const goals = getChallenges(L.level);

    const adds = [];
    if (newRole) adds.push(`<li><span class="li-chip-icon">${newRole.icon}</span>${isFirst ? 'Your first server' : newRole.name}</li>`);
    if (pack.scaleOut?.db?.level === L.level) adds.push(`<li><span class="li-chip-icon">🧱</span>Database shards</li>`);
    for (const f of fixes) adds.push(`<li><span class="li-chip-icon">${f.icon}</span>${f.name}</li>`);

    this.el.innerHTML = `
      <div class="li-card">
        <div class="li-top">
          ${onBack ? '<button type="button" class="li-back" id="li-back" aria-label="Back to the start screen">← Back</button>' : ''}
          <span class="li-product">${product.icon} ${product.name}</span>
          <span class="li-step">Level ${L.level} of ${LEVELS.length}</span>
        </div>
        <div class="li-badge">${L.level}</div>
        <h2 class="li-title">${L.name}</h2>
        <p class="li-sub">${L.subtitle || ''}</p>
        <p class="li-problem">${linkTerms(L.intro || firstSentence(L.story))}</p>
        ${adds.length ? `<div class="li-section"><span class="li-label">New this level</span><ul class="li-chips">${adds.join('')}</ul></div>` : ''}
        <div class="li-section">
          <span class="li-label">${goals.length} goals to finish</span>
          <div class="li-goals">${goals.map(g => `<span title="${g.label.replace(/"/g, '&quot;')}">${g.icon}</span>`).join('')}</div>
        </div>
        <button type="button" class="btn btn-primary li-start" id="li-start">${isFirst ? "Let's build" : 'Start level'} →</button>
      </div>`;

    this.el.hidden = false;
    document.body.classList.add('level-intro-open');
    const btn = this.el.querySelector('#li-start');
    btn.focus();
    btn.addEventListener('click', () => {
      this.close();
      onStart();
    });
    this.el.querySelector('#li-back')?.addEventListener('click', () => {
      this.close();
      onBack();
    });
  }

  close() {
    this.el.hidden = true;
    document.body.classList.remove('level-intro-open');
  }
}
