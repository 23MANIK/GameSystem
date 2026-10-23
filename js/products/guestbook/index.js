/**
 * Guestbook — the tutorial product. Its data still lives in the original files
 * (data/levels.js, game/Challenges.js, game/Tutorial.js).
 */

import { GUESTBOOK_LEVELS } from '../../data/levels.js';
import { GUESTBOOK_CHALLENGES } from '../../game/Challenges.js';
import { GUESTBOOK_STEPS, GUESTBOOK_LEVEL_ROLE } from '../../game/Tutorial.js';
import { GUESTBOOK_INCIDENTS } from '../../game/TrafficSpikes.js';

export default {
  id: 'guestbook',
  levels: GUESTBOOK_LEVELS,
  challenges: GUESTBOOK_CHALLENGES,
  steps: GUESTBOOK_STEPS,
  levelRole: GUESTBOOK_LEVEL_ROLE,
  suggestFix: null,
  roles: {
    app: { unlockLevel: 1, maxCount: 6 },
    db: { unlockLevel: 2, maxCount: 1 },
    web: { unlockLevel: 3 },
    gateway: { unlockLevel: 4 },
    lb: { unlockLevel: 5 },
    cache: { unlockLevel: 6 },
    cdn: { unlockLevel: 7 }
  },
  scaleOut: {
    app: { level: 5, needs: 'lb', noun: 'app server' }
  },
  fixes: { pagination: 2, index: 2, archive: 3 },
  xlLevel: 5,
  roleText: {},
  partText: {},
  fixText: {},
  explanations: {},
  incidents: GUESTBOOK_INCIDENTS,
  vocab: { record: 'entry', records: 'entries', writeFails: 'every signature fails', readName: 'read' },
  tryIt: true
};
