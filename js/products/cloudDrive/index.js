/**
 * Cloud Drive (like Dropbox / Google Drive) — everything the game needs to play it.
 * Base source: Hello Interview "Design Dropbox". See docs/products/cloud-drive.md.
 */

import { CLOUD_DRIVE_LEVELS } from './levels.js';
import { CLOUD_DRIVE_CHALLENGES } from './challenges.js';
import { CLOUD_DRIVE_STEPS, CLOUD_DRIVE_LEVEL_ROLE, cloudDriveSuggestedFix } from './tutorial.js';
import {
  CLOUD_DRIVE_VOCAB, CLOUD_DRIVE_INCIDENTS, CLOUD_DRIVE_ROLE_TEXT, CLOUD_DRIVE_PART_TEXT,
  CLOUD_DRIVE_FIX_TEXT, CLOUD_DRIVE_EXPLANATIONS
} from './content.js';

export default {
  id: 'cloud_drive',
  levels: CLOUD_DRIVE_LEVELS,
  challenges: CLOUD_DRIVE_CHALLENGES,
  steps: CLOUD_DRIVE_STEPS,
  levelRole: CLOUD_DRIVE_LEVEL_ROLE,
  suggestFix: cloudDriveSuggestedFix,
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    blob: { unlockLevel: 2 },
    db: { unlockLevel: 2, maxCount: 4 },
    gateway: { unlockLevel: 4 },
    lb: { unlockLevel: 4 },
    cache: { unlockLevel: 7 },
    sync: { unlockLevel: 8 },
    cdn: { unlockLevel: 11 }
  },
  scaleOut: {
    app: { level: 4, needs: 'lb', noun: 'app server' },
    db: { level: 10, noun: 'shard' }
  },
  fixes: {
    index: 2, presigned: 3, chunking: 4, verifyUploads: 5, dedup: 6, compress: 6,
    sharesTable: 7, deltaSync: 8, versions: 9, coldTier: 10
  },
  xlLevel: { default: 4, storage: 2, network: 3 },
  roleText: CLOUD_DRIVE_ROLE_TEXT,
  partText: CLOUD_DRIVE_PART_TEXT,
  fixText: CLOUD_DRIVE_FIX_TEXT,
  explanations: CLOUD_DRIVE_EXPLANATIONS,
  incidents: CLOUD_DRIVE_INCIDENTS,
  vocab: CLOUD_DRIVE_VOCAB,
  tryIt: false
};
