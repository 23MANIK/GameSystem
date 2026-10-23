/**
 * LevelsPanel — the product's level roadmap, and a blueprint of the system
 * you've built (machines, parts and real cloud equivalents, copyable as JSON).
 */

import { getProduct } from '../data/products.js';
import { LEVELS } from '../data/levels.js';
import { ROLES, ROLE_ORDER, CLOUD_EQUIVALENTS } from '../data/roles.js';
import { CODE_FIXES } from '../data/codeFixes.js';
import { PART_ORDER, getOption, runningCostPerMinute } from '../data/serverParts.js';
import { evaluateChallenges } from '../game/Challenges.js';
import { infoButton } from './InfoTips.js';
import { linkTerms } from './Glossary.js';
import { activeProduct, vocab } from '../products/registry.js';

function rate(perSec) {
  if (!perSec) return '0/s';
  if (perSec >= 1) return `${perSec.toFixed(1)}/s`;
  return `${(perSec * 60).toFixed(1)}/min`;
}

export default class LevelsPanel {
  constructor(container, gameState, notifications = null, onTryFeature = null) {
    this.container = container;
    this.gameState = gameState;
    this.notifications = notifications;
    this.onTryFeature = onTryFeature;
  }

  /** Your current architecture as plain data (what "Copy" puts on the clipboard). */
  blueprint() {
    const gs = this.gameState;
    const product = getProduct(gs.productId);
    const machines = ROLE_ORDER.filter(role => gs.isPlaced(role)).map(role => {
      const cfg = gs.getServerConfig(role);
      const parts = {};
      for (const partId of PART_ORDER) parts[partId] = getOption(partId, cfg[partId])?.label || cfg[partId];
      return {
        role,
        name: ROLES[role].name,
        count: Math.max(1, gs.machineCount(role)),
        parts,
        runningCostPerMinute: runningCostPerMinute(cfg),
        equivalents: CLOUD_EQUIVALENTS[role] || {}
      };
    });
    const status = gs.serverStatus;
    return {
      product: product.name,
      level: `${gs.level}: ${gs.levelDef().name}`,
      requestPath: ['users', ...ROLE_ORDER.filter(r => gs.isPlaced(r))],
      machines,
      codeFixes: Object.keys(gs.codeFixes).filter(id => gs.codeFixes[id]).map(id => CODE_FIXES[id]?.name || id),
      traffic: status ? {
        usersOnline: gs.users,
        requestsPerSecond: status.reqPerSec,
        latencyMs: status.latency,
        cacheHitRate: status.cacheHit || undefined,
        edgeHitRate: status.edgeHit || undefined,
        records: gs.guestbook.count
      } : null
    };
  }

  renderRoadmap() {
    const gs = this.gameState;
    const product = getProduct(gs.productId);
    const { doneCount, results } = evaluateChallenges(gs);
    return product.levels.map(l => {
      const current = l.level === gs.level;
      const completed = l.level < gs.level || (current && gs.levelCompleted);
      const locked = !l.playable;
      const state = completed ? 'done' : current ? 'current' : locked ? 'locked' : 'upcoming';
      const mark = completed ? '✓' : locked ? '🔒' : l.level;
      const def = LEVELS[l.level - 1];
      const extra = current && !gs.levelCompleted
        ? `<span class="lv-progress">${doneCount}/${results.length} goals done</span>`
        : completed ? '<span class="lv-progress">Complete</span>' : '';
      const unlocks = def?.unlockedFeatures?.length && !locked
        ? `<span class="lv-unlocks">${def.unlockedFeatures.map(f => `<em>${f}</em>`).join('')}</span>` : '';
      return `
        <li class="lv lv-${state}">
          <span class="lv-mark">${mark}</span>
          <div class="lv-body">
            <strong>Level ${l.level} · ${l.name}</strong>
            <span class="lv-focus">${locked ? 'Coming soon' : l.focus}</span>
            ${unlocks}
            ${extra}
          </div>
        </li>`;
    }).join('');
  }

  renderBlueprint() {
    const bp = this.blueprint();
    if (!bp.machines.length) {
      return '<p class="goals-empty">No machines yet. Build your first server and it shows up here.</p>';
    }
    const rows = bp.machines.map(m => `
      <li class="bp-row">
        <span class="bp-icon">${ROLES[m.role].icon}</span>
        <div class="bp-main">
          <strong>${m.name}${m.count > 1 ? ` ×${m.count}` : ''}</strong>
          <span class="bp-parts">${PART_ORDER.map(p => m.parts[p]).join(' · ')}</span>
          <span class="bp-cloud">AWS ${m.equivalents.aws || '–'} · GCP ${m.equivalents.gcp || '–'}</span>
        </div>
      </li>`).join('');
    const fixes = bp.codeFixes.length ? `<p class="goals-muted">Code: ${bp.codeFixes.join(', ')}</p>` : '';
    return `
      <p class="bp-path">${bp.requestPath.map(r => (r === 'users' ? '👥' : ROLES[r].icon)).join(' → ')}</p>
      <ul class="bp-list">${rows}</ul>
      ${fixes}
      <button type="button" class="btn btn-secondary bp-copy" id="bp-copy">📋 Copy blueprint (JSON)</button>`;
  }

  /** The current level: its story, the feature it runs, and real-world notes. */
  renderAbout() {
    const gs = this.gameState;
    const L = gs.levelDef();
    let feature = null;
    for (let l = gs.level; l >= 1 && !feature; l--) feature = LEVELS[l - 1]?.feature || null;
    const status = gs.serverStatus;
    const eps = feature ? feature.endpoints.map(ep => `
      <li class="feat-ep">
        <code class="gb-method gb-${ep.method.toLowerCase()}">${ep.method}</code>
        <code>${ep.path}</code>
        <span class="feat-does">${ep.does}</span>
        <span class="feat-rate">${status && gs.appLive ? rate(status[ep.rate]) : '–'}</span>
      </li>`).join('') : '';
    const notes = L.realWorld?.length
      ? `<h5 class="gp-sub">🌍 In the real world ${infoButton('realWorld')}</h5><ul class="gp-notes">${L.realWorld.map(n => `<li>${linkTerms(n)}</li>`).join('')}</ul>`
      : '';
    const count = gs.guestbook.count ? `<p class="goals-muted">${gs.guestbook.count.toLocaleString()} ${vocab('records')} stored so far</p>` : '';
    return `
      <section class="lv-about">
        <span class="gp-focus-kicker">Now playing · Level ${L.level}</span>
        <strong class="lv-about-title">${L.name}</strong>
        <span class="goals-muted">${L.subtitle || ''}</span>
        <p class="gp-story">${linkTerms(L.story || '')}</p>
        ${feature ? `<h5 class="gp-sub">✨ ${feature.name} ${infoButton('feature')}</h5><p class="feat-summary">${linkTerms(feature.summary)}</p><ul class="feat-eps">${eps}</ul>` : ''}
        ${count}
        ${notes}
        ${activeProduct().tryIt && gs.isServerPlaced() ? '<button type="button" class="feat-try" id="feat-try">Try it yourself →</button>' : ''}
      </section>`;
  }

  /**
   * mode 'all': the Levels tab (roadmap + blueprint).
   * mode 'level': opened from the Lv card in the top bar: everything about the
   * level being played.
   */
  render(mode = this.mode || 'all') {
    this.mode = mode;
    const gs = this.gameState;
    const product = getProduct(gs.productId);
    if (mode === 'level') {
      this.container.innerHTML = `<div class="goals levels-panel">${this.renderAbout()}</div>`;
      this.container.querySelector('#feat-try')?.addEventListener('click', () => this.onTryFeature?.());
      return;
    }
    this.container.innerHTML = `
      <div class="goals levels-panel">
        <header class="goals-hero">
          <span class="goals-hero-icon">${product.icon}</span>
          <div class="goals-hero-text">
            <span class="goals-hero-kicker">${product.likeWhat}</span>
            <strong>${product.name}</strong>
            <span class="goals-muted">${product.levels.length} levels, each harder than the last</span>
          </div>
        </header>
        <ol class="lv-list">${this.renderRoadmap()}</ol>

        <h4 class="goals-section">Your blueprint ${infoButton('blueprint')}</h4>
        ${this.renderBlueprint()}
      </div>`;

    this.container.querySelector('#bp-copy')?.addEventListener('click', () => this.copyBlueprint());
    this.container.querySelector('#feat-try')?.addEventListener('click', () => this.onTryFeature?.());
  }

  async copyBlueprint() {
    const text = JSON.stringify(this.blueprint(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.notifications?.show('📋 Blueprint copied as JSON.', 'success', 3000);
    } catch {
      // Clipboard blocked: show it so it can be copied by hand
      const pre = document.createElement('textarea');
      pre.className = 'bp-text';
      pre.value = text;
      pre.readOnly = true;
      document.querySelector('#bp-copy')?.after(pre);
      pre.select();
    }
  }

  update() {
    if (document.querySelector('.info-pop:not([hidden])')) return;
    const scroll = this.container.scrollTop;
    this.render();
    this.container.scrollTop = scroll;
  }
}
