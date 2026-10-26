/**
 * Ticket booking (like Ticketmaster) — everything the game needs to play it.
 * See js/products/registry.js for what a product pack contains.
 */

import { TICKETING_LEVELS } from './levels.js';
import { TICKETING_CHALLENGES } from './challenges.js';
import { TICKETING_STEPS, TICKETING_LEVEL_ROLE, ticketingSuggestedFix } from './tutorial.js';
import {
  TICKETING_VOCAB, TICKETING_INCIDENTS, TICKETING_ROLE_TEXT, TICKETING_PART_TEXT,
  TICKETING_FIX_TEXT, TICKETING_EXPLANATIONS
} from './content.js';

export default {
  id: 'ticketing',
  levels: TICKETING_LEVELS,
  challenges: TICKETING_CHALLENGES,
  steps: TICKETING_STEPS,
  levelRole: TICKETING_LEVEL_ROLE,
  suggestFix: ticketingSuggestedFix,
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    db: { unlockLevel: 2, maxCount: 1 },
    gateway: { unlockLevel: 4 },
    lb: { unlockLevel: 5 },
    cache: { unlockLevel: 6 },
    queue: { unlockLevel: 8 }
  },
  scaleOut: {
    app: { level: 5, needs: 'lb', noun: 'app server' }
  },
  fixes: { index: 2, holds: 3, archive: 5, searchIndex: 7 },
  xlLevel: { default: 5, storage: 3, ram: 3 },
  // Hints for tools/playtest-headless.mjs: Level 5 asks for 3 app servers
  playtest: { apps: { 5: 3 } },
  roleText: TICKETING_ROLE_TEXT,
  partText: TICKETING_PART_TEXT,
  fixText: TICKETING_FIX_TEXT,
  explanations: TICKETING_EXPLANATIONS,
  incidents: TICKETING_INCIDENTS,
  vocab: TICKETING_VOCAB,
  tryIt: false
};
