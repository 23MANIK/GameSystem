/**
 * MoneyPanel — everything about coins this level, opened by clicking Coins
 * in the top bar: the three key numbers, where money comes from and goes,
 * health, and funding.
 */

import { calculateFunding } from '../data/funding.js';
import { ROLES, ROLE_ORDER } from '../data/roles.js';
import { infoButton } from './InfoTips.js';

function fmt(n) {
  return Math.round(n).toLocaleString();
}

export default class MoneyPanel {
  constructor(container, gameState) {
    this.container = container;
    this.gameState = gameState;
  }

  render() {
    const gs = this.gameState;
    const eco = gs.getEconomySummary();
    const runCost = gs.totalRunningCostPerMinute();
    const stat = (label, value, info, cls = '') => `
      <div><span>${label} ${info ? infoButton(info, label) : ''}</span><strong class="${cls}">${value}</strong></div>`;
    // Running cost per machine type, biggest first
    const bills = ROLE_ORDER.filter(r => gs.isPlaced(r))
      .map(r => ({ r, cost: gs.roleRunningCostPerMinute(r), n: Math.max(1, gs.machineCount(r)) }))
      .sort((a, b) => b.cost - a.cost);
    const top = Math.max(1, ...bills.map(b => b.cost));
    const billRows = bills.slice(0, 3).map(b => `
      <li class="mp-bill">
        <span>${ROLES[b.r].icon} ${ROLES[b.r].name}${b.n > 1 ? ` ×${b.n}` : ''}</span>
        <span class="mp-bill-bar"><span style="width:${Math.round((b.cost / top) * 100)}%"></span></span>
        <strong>${fmt(b.cost)}/min</strong>
      </li>`).join('');

    // At a glance: what you have, whether you're earning, and the biggest bill
    const earning = eco.profitPerMin >= 0;
    const biggest = bills[0];
    const status = earning
      ? `📈 Earning <strong class="pos">${fmt(eco.profitPerMin)}</strong> coins a minute`
      : `📉 Losing <strong class="neg">${fmt(-eco.profitPerMin)}</strong> coins a minute`;
    const tip = biggest
      ? `Biggest cost: ${ROLES[biggest.r].icon} ${ROLES[biggest.r].name}${biggest.n > 1 ? ` ×${biggest.n}` : ''} · ${fmt(biggest.cost)}/min`
      : '';

    this.container.innerHTML = `
      <div class="gp mp">
        <div class="gp-money">
          ${stat('Coins', fmt(gs.coins), null)}
          ${stat('Per minute', `${earning ? '+' : ''}${fmt(eco.profitPerMin)}`, 'profit', earning ? 'pos' : 'neg')}
          ${stat('Running cost', `${fmt(runCost)}/min`, 'runningCost')}
        </div>
        <p class="mp-status">${status}</p>
        ${tip ? `<p class="mp-tip">${tip}</p>` : ''}

        <details class="gp-fold mp-details" ${this.detailsOpen ? 'open' : ''}>
          <summary><span>Details</span><small class="gp-fold-meta">profit, health, top costs</small><span class="gp-chev" aria-hidden="true">▸</span></summary>
          <div class="gp-fold-body mp-details-body">
            <div class="goals-economy">
              ${stat('Level profit', `${eco.profit >= 0 ? '+' : ''}${fmt(eco.profit)}`, 'profit', eco.profit >= 0 ? 'pos' : 'neg')}
              ${stat('Uptime', `${eco.uptime}%`, 'uptime')}
              ${stat('Reputation', `${eco.reputation}/100`, 'reputation', eco.reputation >= 70 ? 'pos' : 'neg')}
              ${gs.levelCompleted ? stat('Raised so far', fmt(gs.totalFunding()), 'funding', 'pos') : stat('If you finish now', fmt(calculateFunding(gs.level, eco).amount), 'funding')}
            </div>
            ${bills.length ? `<h4 class="gp-heading">Top costs ${infoButton('runningCost')}</h4><ul class="mp-bills">${billRows}</ul>` : ''}
          </div>
        </details>
      </div>`;
    // Keep "Details" open or closed across the live refresh
    this.container.querySelector('.mp-details')?.addEventListener('toggle', (e) => {
      this.detailsOpen = e.currentTarget.open;
    });
  }

  update() {
    if (document.querySelector('.info-pop:not([hidden])')) return;
    const scroll = this.container.scrollTop;
    this.render();
    this.container.scrollTop = scroll;
  }
}
