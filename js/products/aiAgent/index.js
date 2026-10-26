/**
 * AI Support Agent (an online shop's help agent) — everything the game needs to play it.
 * See js/products/registry.js for what a product pack contains.
 */

import { AI_AGENT_LEVELS } from './levels.js';
import { AI_AGENT_CHALLENGES } from './challenges.js';
import { AI_AGENT_STEPS, AI_AGENT_LEVEL_ROLE, aiAgentSuggestedFix } from './tutorial.js';
import {
  AI_AGENT_VOCAB, AI_AGENT_INCIDENTS, AI_AGENT_ROLE_TEXT, AI_AGENT_PART_TEXT,
  AI_AGENT_FIX_TEXT, AI_AGENT_EXPLANATIONS
} from './content.js';

export default {
  id: 'ai_agent',
  levels: AI_AGENT_LEVELS,
  challenges: AI_AGENT_CHALLENGES,
  steps: AI_AGENT_STEPS,
  levelRole: AI_AGENT_LEVEL_ROLE,
  suggestFix: aiAgentSuggestedFix,
  roles: {
    app: { unlockLevel: 1, maxCount: 1 },
    llm: { unlockLevel: 2 },
    db: { unlockLevel: 3 },
    kb: { unlockLevel: 4 },
    tools: { unlockLevel: 5 },
    queue: { unlockLevel: 6 },
    cache: { unlockLevel: 7 },
    guard: { unlockLevel: 8 },
    orch: { unlockLevel: 9 }
  },
  fixes: { compaction: 3, rerank: 4, maxSteps: 5, tokenBudget: 6, promptCache: 7, routing: 7, humanApproval: 8 },
  xlLevel: { default: 5, ram: 4 },
  roleText: AI_AGENT_ROLE_TEXT,
  partText: AI_AGENT_PART_TEXT,
  fixText: AI_AGENT_FIX_TEXT,
  explanations: AI_AGENT_EXPLANATIONS,
  incidents: AI_AGENT_INCIDENTS,
  vocab: AI_AGENT_VOCAB,
  tryIt: false
};
