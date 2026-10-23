/**
 * GuideBubble — shows the current tutorial step and highlights what to press.
 */

import { getSteps } from '../game/Tutorial.js';
import { linkTerms } from './Glossary.js';

export default class GuideBubble {
  constructor(el, tutorial, gameState) {
    this.el = el;
    this.tutorial = tutorial;
    this.gameState = gameState;
    this.highlighted = null;
    tutorial.onChange(() => this.render());
    gameState.on('serverBuilderOpened', () => this.render());
    gameState.on('serverBuilderClosed', () => this.render());
  }

  render() {
    const t = this.tutorial;
    const step = t.step;
    // While the Server Builder is open, the tip shows inside it instead
    const builderOpen = document.body.classList.contains('builder-open');

    if (!t.active || !step || t.minimized || builderOpen) {
      this.el.hidden = true;
      this.clearHighlight();
      return;
    }

    const stepNum = t.state.step + 1;
    this.el.hidden = false;
    this.el.innerHTML = `
      <div class="guide-avatar" aria-hidden="true">👷</div>
      <div class="guide-body">
        <div class="guide-meta">
          <span class="guide-name">Archie · Guide</span>
          <span class="guide-step">Level ${this.gameState.level} · Step ${stepNum} of ${t.steps.length}</span>
        </div>
        <p class="guide-text">${linkTerms(step.text(this.gameState, t.context))}</p>
        <div class="guide-actions">
          ${step.button ? `<button class="btn btn-primary guide-btn" id="guide-btn">${step.button}</button>` : ''}
          <button class="guide-skip" id="guide-skip">Skip tutorial</button>
        </div>
      </div>`;

    this.el.querySelector('#guide-btn')?.addEventListener('click', () => t.pressButton());
    this.el.querySelector('#guide-skip').addEventListener('click', () => t.skip());

    this.el.classList.remove('guide-pop');
    void this.el.offsetWidth; // restart the pop animation
    this.el.classList.add('guide-pop');

    this.refreshHighlight();
  }

  /** Re-apply the highlight (call after panels re-render their content). */
  refreshHighlight() {
    this.clearHighlight();
    const t = this.tutorial;
    const selector = t.active && !t.minimized ? t.step?.highlight : null;
    if (!selector) return;
    const target = document.querySelector(selector);
    if (target) {
      target.classList.add('guide-highlight');
      this.highlighted = target;
    }
  }

  clearHighlight() {
    document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight'));
    this.highlighted = null;
  }
}
