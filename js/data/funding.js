/**
 * funding.js — investors put money in after each completed level.
 *
 * Each round is sized to fund the next stage (roughly what the next level's new
 * machines cost), then scaled by how well you did:
 *   users       your average users vs the level's target   (×0.5 – ×1.2)
 *   profit      how much of your revenue you kept as profit (×0.7 – ×1.3)
 *   reliability outages cut it, down to half                (×0.5 – ×1)
 * So a lean, reliable system gets up to ~1.5× the round; a shaky, wasteful one
 * gets a fraction, and has to pay for the next level out of its own profit.
 */

import { LEVELS } from './levels.js';

export const FUNDING_ROUNDS = {
  1: { name: 'Angel round', investor: 'A friendly angel investor', base: 1500 },
  2: { name: 'Seed round', investor: 'A seed fund', base: 2500 },
  3: { name: 'Series A', investor: 'A venture capital firm', base: 4000 },
  4: { name: 'Series B', investor: 'A growth fund', base: 6000 },
  5: { name: 'Series C', investor: 'A late-stage fund', base: 8000 },
  6: { name: 'Series D', investor: 'A crossover fund', base: 10000 },
  7: { name: 'Series E', investor: 'A sovereign wealth fund', base: 12000 },
  8: { name: 'IPO', investor: 'The public markets', base: 20000 }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Work out the funding for a finished level.
 * stats come from gameState.getEconomySummary().
 */
export function calculateFunding(level, stats) {
  // The last level of any product is the IPO
  const round = (level >= LEVELS.length ? FUNDING_ROUNDS[8] : FUNDING_ROUNDS[level]) || FUNDING_ROUNDS[1];
  const target = LEVELS[level - 1]?.userTarget || 100;

  const usersFactor = clamp((stats.avgUsers || 0) / target, 0.5, 1.2);
  const margin = stats.revenue > 0 ? clamp(stats.profit / stats.revenue, 0, 1) : 0;
  const profitFactor = 0.7 + 0.6 * margin;
  const reliability = 0.5 + 0.5 * ((stats.reputation ?? 100) / 100);

  const before = round.base * usersFactor * profitFactor;
  const amount = Math.round((before * reliability) / 50) * 50;
  return {
    level,
    round: round.name,
    investor: round.investor,
    amount,
    base: round.base,
    usersFactor: Math.round(usersFactor * 100) / 100,
    margin: Math.round(margin * 100),
    profitFactor: Math.round(profitFactor * 100) / 100,
    reliability: Math.round(reliability * 100),
    reliabilityCut: Math.round(before - before * reliability),
    // A typical round sells ~10% of the company
    valuation: amount * 10
  };
}
