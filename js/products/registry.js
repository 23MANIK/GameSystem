/**
 * registry.js — product packs, and switching the game to one of them.
 *
 * A product pack (see js/products/<product>/index.js) holds everything that
 * differs between products:
 *   levels       level definitions (traffic params, feature, story, realWorld notes)
 *   challenges   { level: [challenge, ...] }      (see game/Challenges.js)
 *   steps        { level: [tutorial step, ...] }  (see game/Tutorial.js)
 *   levelRole    { level: the new machine that level is about }
 *   suggestFix   (gs, role, partId) → code fix to suggest for a busy part
 *   roles        { role: { unlockLevel, maxCount } }  (roles not listed are hidden)
 *   scaleOut     { app|db: { level, needs?, noun } } running several side by side
 *   fixes        { fixId: unlockLevel }               (fixes not listed are hidden)
 *   xlLevel      level the XL server parts unlock at (or { default, cpu, ram, storage, network })
 *   roleText / partText / fixText / explanations      wording overrides
 *   incidents    spike / bots / crash stories
 *   vocab        { record, records, writeFails, readName }
 *
 * The shared engine (simulator, diagram, builder) reads the active pack
 * through the live LEVELS binding and these setters.
 */

import { setLevels } from '../data/levels.js';
import { setChallenges } from '../game/Challenges.js';
import { setTutorial, registerSteps } from '../game/Tutorial.js';
import { setIncidents } from '../game/TrafficSpikes.js';
import { setExplanationOverrides } from '../data/explanations.js';
import { ROLES } from '../data/roles.js';
import { CODE_FIXES } from '../data/codeFixes.js';
import { SERVER_PARTS } from '../data/serverParts.js';
import guestbook from './guestbook/index.js';
import urlShortener from './urlShortener/index.js';
import cloudDrive from './cloudDrive/index.js';
import newsFeed from './newsFeed/index.js';
import aiAgent from './aiAgent/index.js';
import ticketing from './ticketing/index.js';
import adClicks from './adClicks/index.js';

export const PACKS = {
  guestbook,
  url_shortener: urlShortener,
  cloud_drive: cloudDrive,
  news_feed: newsFeed,
  ai_agent: aiAgent,
  ticketing,
  ad_clicks: adClicks
};

// Original shared wording, so switching products can restore it
const BASE_ROLES = JSON.parse(JSON.stringify(ROLES));
const BASE_FIXES = JSON.parse(JSON.stringify(CODE_FIXES));
const BASE_PARTS = Object.fromEntries(Object.entries(SERVER_PARTS).map(([id, p]) => [id, { whatItDoes: p.whatItDoes }]));
const BASE_XL = Object.fromEntries(Object.entries(SERVER_PARTS).map(([id, p]) => [id, p.options.map(o => o.unlockLevel)]));

for (const pack of Object.values(PACKS)) registerSteps(pack.steps);

let active = guestbook;

export function activeProduct() {
  return active;
}

export function hasPack(id) {
  return Boolean(PACKS[id]);
}

/** Switch every product-specific table to this product. */
export function setActiveProduct(id) {
  const pack = PACKS[id] || guestbook;
  active = pack;
  setLevels(pack.levels);
  setChallenges(pack.challenges);
  setTutorial({ steps: pack.steps, levelRole: pack.levelRole, suggestFix: pack.suggestFix });
  setIncidents(pack.incidents);
  setExplanationOverrides(pack.explanations);

  for (const [role, base] of Object.entries(BASE_ROLES)) {
    const cfg = pack.roles[role];
    Object.assign(ROLES[role], base, pack.roleText?.[role] || {}, {
      unlockLevel: cfg ? cfg.unlockLevel : Infinity,
      maxCount: cfg?.maxCount ?? 1
    });
  }
  for (const [fixId, base] of Object.entries(BASE_FIXES)) {
    Object.assign(CODE_FIXES[fixId], base, pack.fixText?.[fixId] || {}, {
      unlockLevel: pack.fixes[fixId] ?? Infinity
    });
  }
  for (const [partId, part] of Object.entries(SERVER_PARTS)) {
    part.whatItDoes = pack.partText?.[partId]?.whatItDoes || BASE_PARTS[partId].whatItDoes;
    part.options.forEach((o, i) => {
      if (!BASE_XL[partId][i]) return;
      const xl = typeof pack.xlLevel === 'object' ? (pack.xlLevel[partId] ?? pack.xlLevel.default) : pack.xlLevel;
      o.unlockLevel = xl || BASE_XL[partId][i];
    });
  }
  return pack;
}

/** Product words, e.g. vocab('records') → 'links'. */
export function vocab(key) {
  return active.vocab?.[key] || guestbook.vocab[key];
}

/** Running more than one machine of a role at this level, if allowed. */
export function scaleOutRule(role, level) {
  const rule = active.scaleOut?.[role];
  return rule && level >= rule.level ? rule : null;
}
