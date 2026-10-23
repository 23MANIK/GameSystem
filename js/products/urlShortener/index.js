/**
 * URL shortener (like bit.ly) — everything the game needs to play it.
 * See js/products/registry.js for what a product pack contains.
 */

import { URL_SHORTENER_LEVELS } from './levels.js';
import { URL_SHORTENER_CHALLENGES } from './challenges.js';
import { URL_SHORTENER_STEPS, URL_SHORTENER_LEVEL_ROLE, urlShortenerSuggestedFix } from './tutorial.js';
import {
  URL_SHORTENER_VOCAB, URL_SHORTENER_INCIDENTS, URL_SHORTENER_ROLE_TEXT, URL_SHORTENER_PART_TEXT,
  URL_SHORTENER_FIX_TEXT, URL_SHORTENER_EXPLANATIONS
} from './content.js';

export default {
  id: 'url_shortener',
  levels: URL_SHORTENER_LEVELS,
  challenges: URL_SHORTENER_CHALLENGES,
  steps: URL_SHORTENER_STEPS,
  levelRole: URL_SHORTENER_LEVEL_ROLE,
  suggestFix: urlShortenerSuggestedFix,
  // Level each machine unlocks at, and how many can run side by side
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    db: { unlockLevel: 2, maxCount: 4 },
    gateway: { unlockLevel: 3 },
    lb: { unlockLevel: 4 },
    cache: { unlockLevel: 5 },
    queue: { unlockLevel: 6 },
    idgen: { unlockLevel: 7 },
    cdn: { unlockLevel: 8 }
  },
  // More than one of a machine: app servers (behind the LB), database shards
  scaleOut: {
    app: { level: 4, needs: 'lb', noun: 'app server' },
    db: { level: 7, noun: 'shard' }
  },
  // Code fixes and the level each one unlocks at
  fixes: { index: 2, base62: 2, expiry: 4, idRanges: 7, redirect301: 8 },
  // Bigger (XL) parts unlock with scaling out; the big disk a level earlier (links pile up)
  xlLevel: { default: 4, storage: 3 },
  // Hints for tools/playtest-headless.mjs: Level 7's goal asks for 3 shards
  playtest: { shards: { 7: 3 } },
  roleText: URL_SHORTENER_ROLE_TEXT,
  partText: URL_SHORTENER_PART_TEXT,
  fixText: URL_SHORTENER_FIX_TEXT,
  explanations: URL_SHORTENER_EXPLANATIONS,
  incidents: URL_SHORTENER_INCIDENTS,
  vocab: URL_SHORTENER_VOCAB,
  // The optional hands-on panel (Guestbook only for now)
  tryIt: false
};
