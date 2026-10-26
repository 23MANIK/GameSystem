/**
 * AgentSim.js — how an AI agent product loads your machines (readKind 'agent').
 *
 * A user asks questions. For each one the app builds a prompt (instructions +
 * chat history + matching documents) and calls the AI model. An agent with
 * tools works in a loop: the model asks for a tool, the tool server runs it,
 * the result goes back into the next call, until the answer is ready
 * (Anthropic, "Building effective agents").
 *
 * What fills up:
 *   - the AI model's plan: tokens per minute (its "cpu"), answers in progress
 *     ("ram") and requests per minute ("network"). Providers enforce limits
 *     per second, so bursts hit 429s early unless a queue smooths them.
 *   - the token bill: paid per token (cached input ~10%, output ~5× input)
 *   - without an AI model building, a small open model runs on the app
 *     server itself: heavy on CPU and RAM, slow, and less accurate
 *
 * Every rate is "per online user per second". Tokens are counted in thousands.
 * Ratios follow real numbers (see docs/products/ai-agent.md); absolute sizes
 * are scaled so things happen in minutes.
 */

const TOKEN_LOAD = 0.12;    // AI model "tokens" part units per 1k tokens/s
const BURST = 1.4;          // without a queue, per-second limits trip at ~70% of the minute limit
const CALL_RAM = 8;         // "answers at once" units per call in flight (calls/s × seconds each)
const PRICE = 0.08;         // coins per 1k input tokens (output 5×, cached input 0.1×)
const ROUTED_PRICE = 0.3;   // a small model costs about a third
const ROUTED_LOAD = 0.2;    // …and mostly runs on its own limit
const HELPERS = 5;          // helper agents an orchestrator runs side by side
const MULTI_TOKENS = 1.6;   // multi-agent overhead: every helper re-reads context
const GUARD_PASS = 0.03;    // share of attacks a guardrail misses
const MAX_STEPS_LEFT = 4;   // a capped runaway loop still burns a few steps

/** Defaults for the agent's params (merged into trafficParams). */
export const AGENT_DEFAULTS = {
  promptK: 1,           // instructions + tool descriptions, sent with every call
  historyK: 1.5,        // chat history sent with every call
  docsK: 2,             // matching document chunks (with a knowledge base)
  outK: 0.3,            // answer tokens per call
  toolShare: 0,         // questions that need real data (order lookups)
  toolSteps: 3,         // model calls for one of those (think → tool → answer)
  runawayShare: 0,      // tasks where the agent gets stuck in a loop
  runawaySteps: 25,     // calls one stuck loop burns before it times out
  heavyShare: 0,        // share of users who fire questions nonstop (scripts, power users)
  heavyMult: 8,         // …this many times more than a normal user
  injectShare: 0,       // questions that are prompt-injection attacks (× attack size)
  easyShare: 0.6,       // questions a small, cheap model answers just as well
  researchPerUser: 0,   // big "research this" jobs per user per second
  researchSteps: 30     // model calls one research job needs
};

/** Per-user rates after each piece of the system has done its job. */
export function agentFlow(m, entries, fixes, p) {
  const local = !m.llm;
  const q = p.readsPerUser;
  const heavy = q * p.heavyShare * p.heavyMult * (fixes.tokenBudget ? 0.1 : 1);
  const attacks = q * p.injectShare * (p.botMult || 1);
  const attacksPassed = attacks * (m.guard ? GUARD_PASS : 1);
  const asked = q + heavy;
  // Semantic cache: a question close enough to one answered before gets that answer
  const cacheHit = m.cache ? (p.cacheHitRate ?? 0.35) : 0;
  const fresh = asked * (1 - cacheHit) + attacksPassed;

  // The agent loop: extra model calls (each one runs a tool) per question
  const toolLoop = m.tools ? p.toolShare * (p.toolSteps - 1) : 0;
  const runaway = m.tools ? p.runawayShare * (fixes.maxSteps ? MAX_STEPS_LEFT : p.runawaySteps) : 0;
  const loop = toolLoop + runaway;
  const steps = 1 + loop;
  const toolCalls = fresh * loop;
  const toolTasks = m.tools ? fresh * p.toolShare : 0;                      // questions answered with tools
  const stuck = m.tools && !fixes.maxSteps ? fresh * p.runawayShare : 0;   // tasks looping right now

  // Tokens per call
  const histK = p.historyK * (fixes.compaction ? 0.35 : 1);
  const docsK = m.kb ? p.docsK * (fixes.rerank ? 0.6 : 1) : 0;   // reranking keeps fewer, better chunks
  const toolK = loop > 0 ? 0.6 * loop / steps : 0;                 // tool results ride along in later calls
  const inK = p.promptK + histK + docsK + toolK;
  const cachedK = fixes.promptCache && !local ? Math.min(inK, p.promptK + histK * 0.6) : 0;
  const outK = p.outK;
  const routed = fixes.routing && !local ? p.easyShare : 0;
  const calls = fresh * steps;

  // Research jobs: one agent in a long loop, or a lead agent with helpers
  const orch = Boolean(m.orch);
  const research = p.researchPerUser;
  const researchCalls = research * p.researchSteps * (orch ? MULTI_TOKENS : 1);
  const researchInK = p.promptK + 3 - (fixes.promptCache && !local ? p.promptK + 1.5 : 0);   // big prompts; the shared start is cached
  const allCalls = calls + researchCalls;

  // Tokens per second that count toward the plan's limit (cached input doesn't)
  const chatTok = calls * (inK - cachedK + outK);
  const researchTok = researchCalls * (researchInK + outK);
  const limitTok = chatTok * (1 - routed * (1 - ROUTED_LOAD)) + researchTok;
  // Bill per user per second, in coins
  const chatBill = calls * ((inK - cachedK) + cachedK * 0.1 + outK * 5) * (1 - routed * (1 - ROUTED_PRICE));
  const researchBill = researchCalls * (researchInK + outK * 5);
  const bill = local ? 0 : (chatBill + researchBill) * PRICE;

  // Time for one model call (ms): reading the prompt, then writing the answer token by token
  const callMs = local
    ? 500 + inK * 120 + outK * 1000 * 12
    : 300 + (inK - cachedK * 0.85) * 25 + outK * 1000 * 6;
  const chatMs = steps * callMs * (1 - routed * 0.55) + (m.kb ? 120 : 0) + loop * 150 + (m.guard ? 80 : 0) + (m.db ? 10 : 0);
  const researchSec = research
    ? (orch ? (2 + p.researchSteps * MULTI_TOKENS / HELPERS) : p.researchSteps) * callMs / 1000
    : 0;

  // How good the answers are: a small local model makes more up; documents
  // ground it; questions about orders need the tools
  const base = local ? 0.55 : !m.kb ? 0.72 : fixes.rerank ? 0.95 : 0.86;
  const toolQ = m.tools ? 0.95 : 0.15;
  const quality = ((1 - p.toolShare) * base + p.toolShare * toolQ - routed * 0.02) * (1 - cacheHit * 0.03);

  // Attacks that get through make the agent misbehave; with a person approving
  // refunds they can't move money, but their answers are still junk
  const badActions = attacksPassed * (fixes.humanApproval ? 0 : 0.6);
  const harmShare = (attacksPassed * (fixes.humanApproval ? 0.3 : 1)) / Math.max(1e-9, asked + attacks);

  const w = p.writesPerUser;
  return {
    agent: true, local,
    // Shared fields the rest of the simulator reads
    r: q, w, wAll: w, R: 1, respKB: 4, splitUi: false, lookup: false,
    botsIn: attacks, botsPassed: attacksPassed, botReads: 0, edgeHit: 0, cacheHit,
    readsOrigin: asked + attacks, pagesOrigin: 0,
    dbReads: m.db ? fresh + toolCalls : 0,
    codeChecks: 0, collisionShare: 0, idRequests: 0,
    clicks: 0, clicksOrigin: 0, syncClickWrites: 0, queuedClicks: 0, dbWrites: w,
    fanoutPerPost: 0, fanoutWrites: 0, fanoutInline: 0, fanoutQueued: 0, mergeReads: 0,
    apiOrigin: asked + attacks + research, apiIn: asked + attacks + research,
    // Agent
    q, heavy, asked, attacks, attacksPassed, fresh, steps, loop, runaway, toolCalls,
    inK, cachedK, outK, routed, calls, stuck, toolTasks, research, researchCalls, allCalls, orch,
    limitTok, tokPerUser: chatTok + researchTok, bill, callMs, chatMs, researchSec,
    quality: Math.max(0, Math.min(1, quality)), badActions, harmShare,
    guardChecks: m.guard ? (asked + attacks) * 2 : 0,
    kbSearches: m.kb ? fresh + research * 10 : 0
  };
}

/** Per-part load ({ base, perUser }) of every machine, for an agent product. */
export function agentLoads(m, appCount, shards, fixes, p, f) {
  const N = Math.max(1, appCount);
  const S = Math.max(1, shards);
  const burst = m.queue ? 1 : BURST;
  const loads = {};

  // The app: receives questions, builds prompts, runs the loop, keeps chats.
  // Without an AI model building it also runs a small model itself.
  const localCpu = f.local ? f.calls * (f.inK * 0.25 + f.outK * 20) : 0;
  loads.app = {
    cpu: { base: 0, perUser: ((f.asked + f.attacks) * 0.15 + f.allCalls * 0.05 + f.research * 2 + localCpu) / N },
    ram: { base: f.local ? 600 : 300, perUser: (m.db ? 1.5 : 8) / N },     // chat history lives in RAM until a database keeps it
    storage: { base: 0, perUser: (m.db ? f.asked * 0.02 : f.fresh * 0.3 + f.w * 1) / N },
    network: { base: 0, perUser: ((f.asked + f.attacks) * 4) / N }
  };
  if (m.db) {
    // Chat history: one read per answer, tool lookups (orders), saved chats
    loads.db = {
      cpu: { base: 0, perUser: (f.fresh * 0.3 + f.toolCalls * 0.2 + f.w * 0.3) / S },
      ram: { base: 300 + 300 * N, perUser: 0 },
      storage: { base: 0, perUser: (f.fresh * 0.1 + f.toolCalls * 0.05 + f.w * 1) / S },
      network: { base: 0, perUser: (f.fresh * 2 + f.toolCalls + f.w) / S }
    };
  }
  if (m.llm) {
    loads.llm = {
      cpu: { base: 0, perUser: f.limitTok * TOKEN_LOAD * burst },
      ram: { base: 0, perUser: f.allCalls * (f.callMs / 1000) * CALL_RAM * burst },
      storage: { base: 0, perUser: 0 },
      network: { base: 0, perUser: f.allCalls * 60 * burst }
    };
  }
  if (m.kb) {
    // Vector search: the index lives in memory; reranking re-scores the top matches
    loads.kb = {
      cpu: { base: 0, perUser: f.kbSearches * 0.25 * (fixes.rerank ? 1.6 : 1) },
      ram: { base: 700, perUser: 0.2 },
      storage: { base: 0, perUser: f.kbSearches * 0.15 },
      network: { base: 0, perUser: f.kbSearches * 2 }
    };
  }
  if (m.tools) {
    loads.tools = {
      cpu: { base: 0, perUser: f.toolCalls * 0.25 },
      ram: { base: 200, perUser: 0.2 },
      storage: { base: 0, perUser: f.toolCalls * 0.05 },
      network: { base: 0, perUser: f.toolCalls * 1 }
    };
  }
  if (m.guard) {
    // A small classifier model checks what comes in and what goes out
    loads.guard = {
      cpu: { base: 0, perUser: f.guardChecks * 0.12 },
      ram: { base: 600, perUser: 0.1 },
      storage: { base: 0, perUser: 0 },
      network: { base: 0, perUser: f.guardChecks * 0.5 }
    };
  }
  if (m.cache) {
    // Semantic cache: embed the question, look for a close match
    loads.cache = {
      cpu: { base: 0, perUser: f.asked * 0.06 },
      ram: { base: 500, perUser: 0.3 },
      storage: { base: 0, perUser: 0 },
      network: { base: 0, perUser: f.asked * f.cacheHit * 4 }
    };
  }
  if (m.queue) {
    // Model calls wait here and are sent at a steady pace, retried after a 429
    loads.queue = {
      cpu: { base: 0, perUser: f.allCalls * 0.01 },
      ram: { base: 400, perUser: f.allCalls * 2 },
      storage: { base: 0, perUser: f.allCalls * 0.01 },
      network: { base: 0, perUser: f.allCalls * 1 }
    };
  }
  if (m.orch) {
    loads.orch = {
      cpu: { base: 0, perUser: f.research * 20 },
      ram: { base: 300, perUser: f.research * 2000 },
      storage: { base: 0, perUser: f.research * 5 },
      network: { base: 0, perUser: f.researchCalls * 0.5 }
    };
  }
  return loads;
}

/** Latency of an average answer (ms): cache hits are instant, the rest wait for the model. */
export function agentLatency(f, peak) {
  return Math.round(f.cacheHit * 80 + (1 - f.cacheHit) * f.chatMs + Math.max(0, peak - 0.7) * 4000);
}

/** Extra status fields for the HUD, goals and live counters. */
export function agentStatus(f, users, errorRate) {
  const ok = 1 - errorRate;
  return {
    answerQuality: f.quality,
    llmCallsPerSec: users * f.allCalls,
    tokensPerMin: Math.round(users * f.tokPerUser * 60 * 1000),
    tokenBillPerMin: users * f.bill * 60,
    // Token bill per 1,000 questions asked (cache hits cost nothing)
    billPer1k: f.asked > 0 ? Math.round(f.bill / f.asked * 1000) : 0,
    stepsPerTask: f.steps,
    toolCallsPerSec: users * f.toolCalls,
    toolTasksPerSec: users * f.toolTasks * ok,
    stuckLoopsPerSec: users * f.stuck,
    attacksPerSec: users * f.attacks,
    attacksBlockedPerSec: users * (f.attacks - f.attacksPassed),
    badActionsPerSec: users * f.badActions,
    researchPerSec: users * f.research,
    researchSec: f.researchSec,
    answersPerSec: users * f.asked * ok,
    goodAnswersPerSec: users * f.asked * ok * f.quality,
    cacheAnswersPerSec: users * f.asked * f.cacheHit,
    localModel: f.local
  };
}
