/**
 * GoalsPanel — this level's goals, built like a good quest tracker:
 *   1. a slim progress strip (one segment per goal) and the reward at stake
 *   2. "Next up": ONE goal in focus, with a real progress bar, its hint and a
 *      button that takes you where to act
 *   3. the full checklist in level order (ticks stay visible); tap a goal to
 *      put it in focus
 * Money lives in the Money panel (click Coins); the level's story, feature and
 * real-world notes in the Levels tab.
 * (i) buttons and underlined terms open plain explanations.
 */

import { LEVELS } from '../data/levels.js';
import { ROLES } from '../data/roles.js';
import { evaluateChallenges } from '../game/Challenges.js';
import { calculateFunding } from '../data/funding.js';
import { infoButton } from './InfoTips.js';
import { linkTerms } from './Glossary.js';

function fmt(n) {
  return Math.round(n).toLocaleString();
}

function rate(perSec) {
  if (!perSec) return '0/s';
  if (perSec >= 1) return `${perSec.toFixed(1)}/s`;
  return `${(perSec * 60).toFixed(1)}/min`;
}

export default class GoalsPanel {
  constructor(container, gameState, onTryFeature = null, onStartNext = null, onOpenBuilder = null) {
    this.container = container;
    this.gameState = gameState;
    this.onTryFeature = onTryFeature;
    this.onStartNext = onStartNext;
    this.onOpenBuilder = onOpenBuilder;
    this.open = new Set();   // folds the player opened (kept across live refreshes)
    this.focusId = null;     // the goal the player tapped (otherwise the first one left)
    this.focusLevel = null;
  }

  /** Where to go to work on a goal. */
  actionFor(c) {
    const gs = this.gameState;
    if (c.id.startsWith('place-')) {
      const role = c.id.slice(6);
      const r = ROLES[role];
      if (!r) return null;
      return gs.getServerConfig(role)
        ? { tab: role, label: `${r.icon} Place it: click its glowing slot`, place: true }
        : { tab: role, label: `${r.icon} Build ${r.name.toLowerCase()}` };
    }
    if (c.id.startsWith('fix-')) return { tab: 'code', label: '🧑‍💻 Open Code fixes' };
    if (c.id === 'shards') return { tab: 'db', label: '🧱 Add a shard' };
    if (c.id === 'three-apps') return { tab: 'app', label: '🖥️ Add an app server' };
    if (c.id.startsWith('survive-') || c.id === 'profit') return null;
    const role = gs.serverStatus?.bottleneckRole;
    return role && ROLES[role] ? { tab: role, label: `${ROLES[role].icon} Upgrade what runs out first` } : null;
  }

  /** Short right-hand text for a checklist row. */
  rowValue(c) {
    if (c.done) return '';
    if (c.unit) return `${fmt(Math.min(c.value, c.target))}/${fmt(c.target)}`;
    if (c.id.startsWith('survive-')) return this.gameState.spike ? 'now!' : 'waiting';
    return 'not yet';
  }

  fold(key, summary, body, cls = '') {
    return `<details class="gp-fold ${cls}" data-fold="${key}" ${this.open.has(key) ? 'open' : ''}>
      <summary>${summary}<span class="gp-chev" aria-hidden="true">▸</span></summary>${body}</details>`;
  }

  renderStrip(results, doneCount) {
    const gs = this.gameState;
    const segs = results.map(c => `<span class="gp-seg${c.done ? ' done' : ''}" title="${c.label.replace(/"/g, '&quot;')}"></span>`).join('');
    const reward = gs.levelCompleted ? '' : `<span class="gp-reward" title="What investors would put in if you finished now">💸 ${fmt(calculateFunding(gs.level, gs.getEconomySummary()).amount)} if done now ${infoButton('funding')}</span>`;
    return `
      <div class="gp-strip">
        <div class="gp-segs">${segs}</div>
        <div class="gp-strip-text">
          <span><strong>${doneCount}</strong> of ${results.length} goals</span>
          ${reward}
        </div>
      </div>`;
  }

  renderComplete() {
    const gs = this.gameState;
    const next = LEVELS[gs.level];
    const funding = gs.fundingHistory?.at(-1);
    const got = funding && funding.level === gs.level ? `<span class="gp-done-funding">+${fmt(funding.amount)} coins from investors</span>` : '';
    const button = next && !next.comingSoon
      ? `<button type="button" class="btn btn-primary gp-next" id="goals-next">Start Level ${next.level}: ${next.name} →</button>`
      : '<span class="goals-muted">Next level coming soon.</span>';
    return `
      <section class="gp-complete">
        <div class="gp-complete-head"><span class="gp-trophy">🏆</span><div><strong>Level complete</strong>${got}</div></div>
        <p>The clock is paused at your final results.</p>
        ${button}
      </section>`;
  }

  renderFocus(c) {
    const pct = Math.min(100, Math.round((c.value / c.target) * 100));
    const now = c.display || `${fmt(Math.min(c.value, c.target))} / ${fmt(c.target)} ${c.unit}`;
    const action = this.actionFor(c);
    return `
      <section class="gp-focus">
        <span class="gp-focus-kicker">Next up</span>
        <div class="gp-focus-head">
          <span class="gp-focus-icon">${c.icon}</span>
          <strong>${c.label}</strong>
          ${c.info ? infoButton(c.info) : ''}
        </div>
        <div class="gp-bar"><span style="width:${pct}%"></span></div>
        <span class="gp-now">${now}</span>
        <p class="gp-hint">${linkTerms(c.hint, { skip: [c.info] })}</p>
        ${action ? `<button type="button" class="btn btn-secondary gp-act" data-tab="${action.tab}" ${action.place ? 'data-place="1"' : ''}>${action.label}</button>` : ''}
      </section>`;
  }

  renderList(results, focus) {
    return `<ol class="gp-list">${results.map(c => {
      const pct = Math.min(100, Math.round((c.value / c.target) * 100));
      const isFocus = focus && c.id === focus.id;
      return `
        <li>
          <button type="button" class="gp-row${c.done ? ' done' : ''}${isFocus ? ' focus' : ''}" data-goal="${c.id}" ${c.done ? 'disabled' : ''}>
            <span class="gp-check" style="--p:${c.done ? 100 : pct}">${c.done ? '✓' : c.icon}</span>
            <span class="gp-label">${c.label}</span>
            <span class="gp-val">${this.rowValue(c)}</span>
          </button>
        </li>`;
    }).join('')}</ol>`;
  }

  renderMoney() {
    const gs = this.gameState;
    const eco = gs.getEconomySummary();
    const runCost = gs.totalRunningCostPerMinute();
    const stat = (label, value, info, cls = '') => `
      <div><span>${label} ${info ? infoButton(info, label) : ''}</span><strong class="${cls}">${value}</strong></div>`;
    const key = `
      <div class="gp-money">
        ${stat('Profit', `${eco.profit >= 0 ? '+' : ''}${fmt(eco.profit)}`, 'profit', eco.profit >= 0 ? 'pos' : 'neg')}
        ${stat('Per minute', fmt(eco.profitPerMin), 'profit', eco.profitPerMin >= 0 ? 'pos' : 'neg')}
        ${stat('Running cost', `${runCost}/min`, 'runningCost')}
      </div>`;
    const more = this.fold('money', '<span>More money stats</span>', `
      <div class="goals-economy gp-fold-body">
        ${stat('Revenue', `+${fmt(eco.revenue)}`, 'revenue', 'pos')}
        ${stat('Server cost', `−${fmt(eco.cost)}`, 'runningCost', 'neg')}
        ${stat('Outage penalties', `−${fmt(eco.penalties)}`, 'penalties', 'neg')}
        ${stat('Lost to failures', fmt(eco.lost), 'lostRevenue', 'neg')}
        ${stat('Uptime', `${eco.uptime}%`, 'uptime')}
        ${stat('Reputation', `${eco.reputation}/100`, 'reputation', eco.reputation >= 70 ? 'pos' : 'neg')}
        ${stat('Avg users online', eco.avgUsers, null)}
        ${stat('Est. daily users', fmt(eco.estDailyUsers), 'dailyUsers')}
        ${stat('Funding raised', fmt(gs.totalFunding()), 'funding', 'pos')}
      </div>`, 'gp-fold-small');
    return key + more;
  }

  render() {
    const gs = this.gameState;
    if (this.focusLevel !== gs.level) { this.focusId = null; this.focusLevel = gs.level; }
    const { results, doneCount } = evaluateChallenges(gs);
    const pending = results.filter(c => !c.done);
    const focus = pending.find(c => c.id === this.focusId) || pending[0] || null;

    this.container.innerHTML = `
      <div class="gp">
        ${gs.levelCompleted ? this.renderComplete() : ''}
        ${this.renderStrip(results, doneCount)}
        ${focus && !gs.levelCompleted ? this.renderFocus(focus) : ''}
        <h4 class="gp-heading">Checklist <small>tap a goal to focus it</small> ${infoButton('challenges')}</h4>
        ${this.renderList(results, gs.levelCompleted ? null : focus)}
      </div>`;

    this.container.querySelector('#goals-next')?.addEventListener('click', () => this.onStartNext?.());
    this.container.querySelector('#feat-try')?.addEventListener('click', () => this.onTryFeature?.());
    this.container.querySelector('.gp-act')?.addEventListener('click', (e) => {
      this.onOpenBuilder?.(e.currentTarget.dataset.tab, Boolean(e.currentTarget.dataset.place));
    });
    this.container.querySelectorAll('.gp-row:not(.done)').forEach(row => {
      row.addEventListener('click', () => {
        this.focusId = row.dataset.goal;
        this.render();
        this.container.scrollTop = 0;
      });
    });
    this.container.querySelectorAll('details[data-fold]').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open) this.open.add(d.dataset.fold);
        else this.open.delete(d.dataset.fold);
      });
    });
  }

  update() {
    // Hold still while the player is reading an (i) explanation
    if (document.querySelector('.info-pop:not([hidden])')) return;
    const scroll = this.container.scrollTop;
    this.render();
    this.container.scrollTop = scroll;
  }
}
