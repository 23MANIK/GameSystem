/**
 * "System crashed" screen: shown when coins have been stuck at 0 with no way
 * back up. Glitchy animated card with what went wrong and two ways out:
 * retry the level from its start, or go home.
 */
export default class CrashScreen {
  constructor({ onRetry, onHome }) {
    this.onRetry = onRetry;
    this.onHome = onHome;
    this.el = document.createElement('div');
    this.el.className = 'crash-overlay';
    this.el.hidden = true;
    this.el.setAttribute('role', 'alertdialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'crash-title');
    document.body.appendChild(this.el);
  }

  open({ level, levelName, earnedPerMin, spentPerMin, users, canRetry }) {
    const fmt = (n) => Math.round(n).toLocaleString();
    this.el.innerHTML = `
      <div class="crash-scanlines" aria-hidden="true"></div>
      <div class="crash-card">
        <div class="crash-icon" aria-hidden="true">
          <span class="crash-server">🖥️</span>
          <span class="crash-spark s1">⚡</span>
          <span class="crash-spark s2">💥</span>
          <span class="crash-smoke">💨</span>
        </div>
        <h2 class="crash-title" id="crash-title" data-text="SYSTEM CRASHED">SYSTEM CRASHED</h2>
        <p class="crash-sub">You ran out of coins and couldn't pay for your servers. The lights went out.</p>

        <div class="crash-stats">
          <div class="crash-stat">
            <span class="crash-stat-label">Coins</span>
            <span class="crash-stat-value bad">0</span>
          </div>
          <div class="crash-stat">
            <span class="crash-stat-label">Money in</span>
            <span class="crash-stat-value">${fmt(earnedPerMin)}<small>/min</small></span>
          </div>
          <div class="crash-stat">
            <span class="crash-stat-label">Money out</span>
            <span class="crash-stat-value bad">${fmt(spentPerMin)}<small>/min</small></span>
          </div>
          <div class="crash-stat">
            <span class="crash-stat-label">Users left</span>
            <span class="crash-stat-value">${fmt(users)}</span>
          </div>
        </div>

        <div class="crash-tip">
          <strong>💡 Next time</strong>
          <span>Keep some coins in reserve. Failing requests earn nothing and cost refunds, so fix the part that "runs out first" before buying bigger machines.</span>
        </div>

        <div class="crash-actions">
          ${canRetry ? `<button type="button" class="btn btn-primary crash-retry">↻ Retry Level ${level}</button>` : ''}
          <button type="button" class="btn btn-secondary crash-home">🏠 Home</button>
        </div>
        <p class="crash-level">Level ${level} · ${levelName}</p>
      </div>
    `;
    this.el.querySelector('.crash-retry')?.addEventListener('click', () => this.onRetry());
    this.el.querySelector('.crash-home').addEventListener('click', () => this.onHome());

    this.el.hidden = false;
    document.body.classList.add('crashed');
    // Next frame, so the entrance animation plays
    requestAnimationFrame(() => this.el.classList.add('show'));
    (this.el.querySelector('.crash-retry') || this.el.querySelector('.crash-home')).focus({ preventScroll: true });
  }
}
