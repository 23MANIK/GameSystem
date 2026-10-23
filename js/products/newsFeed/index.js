/**
 * News feed (like Twitter / Instagram) — everything the game needs to play it.
 * See js/products/registry.js for what a product pack contains.
 */

import { NEWS_FEED_LEVELS } from './levels.js';
import { NEWS_FEED_CHALLENGES } from './challenges.js';
import { NEWS_FEED_STEPS, NEWS_FEED_LEVEL_ROLE, newsFeedSuggestedFix } from './tutorial.js';
import {
  NEWS_FEED_VOCAB, NEWS_FEED_INCIDENTS, NEWS_FEED_ROLE_TEXT, NEWS_FEED_PART_TEXT,
  NEWS_FEED_FIX_TEXT, NEWS_FEED_EXPLANATIONS
} from './content.js';

export default {
  id: 'news_feed',
  levels: NEWS_FEED_LEVELS,
  challenges: NEWS_FEED_CHALLENGES,
  steps: NEWS_FEED_STEPS,
  levelRole: NEWS_FEED_LEVEL_ROLE,
  suggestFix: newsFeedSuggestedFix,
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    db: { unlockLevel: 2, maxCount: 4 },
    gateway: { unlockLevel: 3 },
    lb: { unlockLevel: 4 },
    cache: { unlockLevel: 5 },
    queue: { unlockLevel: 6 },
    idgen: { unlockLevel: 8 },
    cdn: { unlockLevel: 9 }
  },
  scaleOut: {
    app: { level: 4, needs: 'lb', noun: 'app server' },
    db: { level: 8, noun: 'shard' }
  },
  fixes: { pagination: 2, index: 2, archive: 4, hybridFanout: 7, idRanges: 8 },
  xlLevel: { default: 4, storage: 3 },
  // Hints for tools/playtest-headless.mjs: Level 4 asks for 3 app servers, Level 8 for 3 shards
  playtest: { apps: { 4: 3 }, shards: { 8: 3 } },
  roleText: NEWS_FEED_ROLE_TEXT,
  partText: NEWS_FEED_PART_TEXT,
  fixText: NEWS_FEED_FIX_TEXT,
  explanations: NEWS_FEED_EXPLANATIONS,
  incidents: NEWS_FEED_INCIDENTS,
  vocab: NEWS_FEED_VOCAB,
  tryIt: false
};
