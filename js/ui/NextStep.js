/**
 * NextStep — the one thing to do now, always on screen above the bottom bar.
 *
 * It shows the goal in focus (the same one as "Next up" in Goals), its
 * progress and a button that goes straight to where you act. When the level
 * is done it offers the next level instead.
 *
 * It steps aside while something else is talking to the player: the tutorial
 * guide, the Goals panel (which shows the same goal), the server builder, the
 * level intro card and the level-complete screen.
 */

import { LEVELS } from '../data/levels.js';
import { evaluateChallenges } from '../game/Challenges.js';

const pendingIcon = icon => (/^[✅✔☑]/.test(icon || '') ? '🎯' : icon);
const fmt = n => Math.round(n).toLocaleString();

export default class NextStep {
  /**
   * @param {HTMLElement} el - #next-step
   * @param {object} gameState
   * @param {object} hooks - { goalsPanel, isHidden(), onAct(tab, place), onOpenGoals(), onStartNext() }
   */
  constructor(el, gameState, hooks) {
    this.el = el;
    this.gameState = gameState;
    this.hooks = hooks;
    this.key = null;
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        if (act.dataset.act === 'next') this.hooks.onStartNext?.();
        else if (act.dataset.act === 'goals') this.hooks.onOpenGoals?.();
        else this.hooks.onAct?.(act.dataset.tab, act.dataset.place === '1');
        return;
      }
      if (e.target.closest('.ns-body')) this.hooks.onOpenGoals?.();
    });
    const refresh = () => this.update();
    for (const ev of ['metricsUpdated', 'stateChanged', 'usersChanged', 'coinsChanged', 'levelUp', 'serverUpgraded', 'serverBuilderOpened', 'serverBuilderClosed']) {
      gameState.on(ev, refresh);
    }
  }

  /** What to show: { key, html, value, pct } or null. */
  model() {
    const gs = this.gameState;
    if (gs.levelCompleted) {
      const next = LEVELS[gs.level];
      const playable = next && !next.comingSoon;
      return {
        key: `done-${gs.level}-${playable}`,
        html: `
          <div class="ns-body">
            <span class="ns-kicker">Level ${gs.level} complete</span>
            <strong class="ns-label">🏆 ${playable ? `Next: ${next.name}` : 'Next level coming soon'}</strong>
          </div>
          ${playable ? `<button type="button" class="btn btn-primary ns-act" data-act="next">Start Level ${next.level} →</button>` : ''}`
      };
    }
    const { results, doneCount } = evaluateChallenges(gs);
    const pending = results.filter(c => !c.done);
    if (!pending.length) return null;
    const gp = this.hooks.goalsPanel;
    const focus = pending.find(c => c.id === gp?.focusId) || pending[0];
    // No server yet: whatever the goal, building one comes first
    const action = !gs.server && !this.hooks.isPlacing?.()
      ? { tab: null, label: '🖥️ Build your server' }
      : gp?.actionFor(focus);
    const pct = Math.min(100, Math.round((focus.value / focus.target) * 100)) || 0;
    const value = focus.unit ? `${fmt(Math.min(focus.value, focus.target))}/${fmt(focus.target)}` : (focus.id.startsWith('survive-') ? (gs.spike ? 'now!' : 'waiting') : '');
    const button = action
      ? `<button type="button" class="btn btn-primary ns-act" data-act="build" data-tab="${action.tab || ''}" data-place="${action.place ? 1 : 0}">${action.label}</button>`
      : '<button type="button" class="btn btn-secondary ns-act" data-act="goals">See goals</button>';
    return {
      key: `${gs.level}-${focus.id}-${action?.label || ''}-${doneCount}`,
      value,
      pct,
      html: `
        <div class="ns-body" role="button" tabindex="0" aria-label="Open goals">
          <span class="ns-kicker">Next step · ${doneCount} of ${results.length} goals done</span>
          <span class="ns-row">
            <strong class="ns-label">${pendingIcon(focus.icon)} ${focus.label}</strong>
            <span class="ns-val" id="ns-val">${value}</span>
          </span>
          <span class="ns-bar"><i id="ns-fill" style="width:${pct}%"></i></span>
        </div>
        ${button}`
    };
  }

  update() {
    if (!this.el) return;
    const hidden = this.hooks.isHidden?.() ?? false;
    const m = hidden ? null : this.model();
    if (!m) {
      this.el.hidden = true;
      document.body.classList.remove('next-step-on');
      return;
    }
    this.el.hidden = false;
    document.body.classList.add('next-step-on');
    if (m.key !== this.key) {
      // Rebuild only when the step itself changes, so a press is never lost to a refresh
      this.key = m.key;
      this.el.innerHTML = m.html;
      this.el.classList.toggle('ns-complete', this.gameState.levelCompleted);
      return;
    }
    const val = this.el.querySelector('#ns-val');
    if (val && m.value !== undefined && val.textContent !== m.value) val.textContent = m.value;
    const fill = this.el.querySelector('#ns-fill');
    if (fill && m.pct !== undefined) fill.style.width = `${m.pct}%`;
  }
}
