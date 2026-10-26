/**
 * Ad click aggregator — everything the game needs to play it.
 * See js/products/registry.js for what a product pack contains.
 */

import { AD_CLICKS_LEVELS } from './levels.js';
import { AD_CLICKS_CHALLENGES } from './challenges.js';
import { AD_CLICKS_STEPS, AD_CLICKS_LEVEL_ROLE, adClicksSuggestedFix } from './tutorial.js';
import {
  AD_CLICKS_VOCAB, AD_CLICKS_INCIDENTS, AD_CLICKS_ROLE_TEXT, AD_CLICKS_PART_TEXT,
  AD_CLICKS_FIX_TEXT, AD_CLICKS_EXPLANATIONS
} from './content.js';

export default {
  id: 'ad_clicks',
  levels: AD_CLICKS_LEVELS,
  challenges: AD_CLICKS_CHALLENGES,
  steps: AD_CLICKS_STEPS,
  levelRole: AD_CLICKS_LEVEL_ROLE,
  suggestFix: adClicksSuggestedFix,
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    db: { unlockLevel: 2, maxCount: 4 },
    queue: { unlockLevel: 3 },
    cache: { unlockLevel: 5 },
    lb: { unlockLevel: 6 },
    blob: { unlockLevel: 8 }
  },
  scaleOut: {
    app: { level: 6, needs: 'lb', noun: 'click processor' },
    db: { level: 9, noun: 'shard' }
  },
  fixes: { index: 2, rollups: 4, dedupIds: 5, saltKeys: 7, reconcile: 8 },
  xlLevel: { default: 6, storage: 3, ram: 3, cpu: 3 },
  // Hints for tools/playtest-headless.mjs: Level 6 asks for 3 app servers, Level 9 for 3 shards
  playtest: { apps: { 6: 3 }, shards: { 9: 3 } },
  roleText: AD_CLICKS_ROLE_TEXT,
  partText: AD_CLICKS_PART_TEXT,
  fixText: AD_CLICKS_FIX_TEXT,
  explanations: AD_CLICKS_EXPLANATIONS,
  incidents: AD_CLICKS_INCIDENTS,
  vocab: AD_CLICKS_VOCAB,
  tryIt: false
};
