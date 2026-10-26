/**
 * AI Support Agent — the goals each level must meet (see js/game/Challenges.js).
 */

import {
  placedChallenge, usersChallenge, incidentChallenge, profitChallenge
} from '../../game/Challenges.js';

const sec = ms => `${(ms / 1000).toFixed(1)} s`;

function chatsSaved(target, hint, info = 'storage') {
  return {
    id: 'chats',
    icon: '💬',
    info,
    label: `Save ${target.toLocaleString()} chats`,
    hint,
    progress: gs => ({ value: gs.guestbook.count, target, unit: 'chats' })
  };
}

/** Answers come back within `ms` while at least `users` are online. */
function answerTime(ms, users, hint) {
  return {
    id: 'latency',
    icon: '⏱️',
    info: 'latency',
    label: `Answers in under ${sec(ms)} with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const lat = gs.metrics?.latency || 99999;
      const ok = gs.users >= users && lat < ms;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${sec(gs.metrics?.latency || 0)} at ${gs.users.toLocaleString()} users` };
    }
  };
}

/** Share of answers that are right, with at least `users` online. */
function qualityAtLeast(pct, users, hint) {
  return {
    id: 'quality',
    icon: '🎯',
    info: 'answerQuality',
    label: `${pct}% of answers correct with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const q = gs.serverStatus?.answerQuality ?? 0;
      const ok = gs.users >= users && q * 100 >= pct;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${Math.round(q * 100)}% correct` };
    }
  };
}

function fixOwned(id, icon, info, label, hint) {
  return {
    id: `fix-${id}`,
    icon,
    info,
    label,
    hint,
    progress: gs => ({ value: gs.codeFixes[id] ? 1 : 0, target: 1, unit: '', display: gs.codeFixes[id] ? 'Done' : 'Not yet' })
  };
}

function cleanAnswers(users, hint) {
  return {
    id: 'clean-errors',
    icon: '🛡️',
    info: 'rateLimits',
    label: `Under 1% failed answers with ${users.toLocaleString()}+ users`,
    hint,
    progress: gs => {
      const err = gs.metrics?.errorRate ?? 1;
      const ok = gs.users >= users && err < 0.01;
      return { value: ok ? 1 : 0, target: 1, unit: '', display: `${(err * 100).toFixed(1)}% failing at ${gs.users.toLocaleString()} users` };
    }
  };
}

export const AI_AGENT_CHALLENGES = {
  1: [
    placedChallenge('app', '🖥️', 'Build and place your server', 'Open Server, pick parts, buy and place it.'),
    usersChallenge(100, 'Customers stop coming at your server\'s limit. The AI model needs lots of RAM and CPU: open Server and upgrade the part marked "runs out first".'),
    chatsSaved(200, 'Every finished conversation is saved. More customers = more chats.'),
    answerTime(6000, 100, 'A small model on a normal CPU writes slowly. Keep every part under ~70% busy so answers don\'t wait in line.'),
    incidentChallenge('spike', {
      hint: 'A spike adds 20–40% more customers for 20 seconds. Build room for ~150: in Server, "Can handle" should say 150+.'
    })
  ],

  2: [
    placedChallenge('llm', '🤖', 'Rent a big AI model', 'Open Server → AI tab, pick a plan and place it. Your server stops running the model and calls it instead.'),
    qualityAtLeast(70, 250, 'The big model gets far more right than the small one. Once it is placed, the server only builds prompts.'),
    answerTime(3000, 300, 'The big model writes about twice as fast. Check that no part is over ~70%.'),
    usersChallenge(300, 'With the model off your server, check what runs out first. The AI plan has limits too: tokens and requests per minute.'),
    profitChallenge(1500, 'You now pay for every token. Bigger plans cost a little more each minute; the token bill grows with customers.')
  ],

  3: [
    placedChallenge('db', '🗄️', 'Keep the chats in a database', 'Open Server → Database tab, buy a database server and place it. Chat history moves out of the app server\'s memory.'),
    fixOwned('compaction', '🗜️', 'compaction', 'Summarize old messages',
      'Server → Code fixes → Summarize old messages. Long chats get a short summary instead of being re-sent whole.'),
    usersChallenge(600, 'Without a database, every chat sits in the app server\'s RAM. With one, check what runs out first.'),
    chatsSaved(1500, 'Chats pile up. The database keeps them all, even after a restart.'),
    profitChallenge(3000, 'Shorter prompts are a smaller token bill. Watch the AI Model\'s cost in Money.')
  ],

  4: [
    placedChallenge('kb', '📚', 'Add a knowledge base', 'Open Server → Knowledge tab and place it. Your help articles get split into chunks the agent can search.'),
    fixOwned('rerank', '🥇', 'rerank', 'Rerank search results',
      'Server → Code fixes → Rerank search results. Only the best few chunks go into the prompt.'),
    qualityAtLeast(90, 900, 'Without your documents the model guesses. With them it is right far more often, and reranking picks the best parts.'),
    usersChallenge(900, 'Documents make prompts longer, so the AI plan fills up faster. Check what runs out first.'),
    profitChallenge(5000, 'Right answers earn money; wrong ones send the customer away.')
  ],

  5: [
    placedChallenge('tools', '🧰', 'Give the agent tools', 'Open Server → Tools tab and place it. The agent can now look up orders, track parcels and start refunds.'),
    fixOwned('maxSteps', '🛑', 'maxSteps', 'Set a step limit for the agent loop',
      'Server → Code fixes → Step limit. A stuck task stops after a few rounds instead of looping and burning tokens.'),
    qualityAtLeast(90, 1200, 'A third of the questions are about orders. Only tools can answer those correctly.'),
    {
      id: 'tool-tasks',
      icon: '📦',
      info: 'agentLoop',
      label: 'Finish 4,000 tasks with tools',
      hint: 'Counts questions the agent answered by working in a loop: think, call a tool, read the result, answer.',
      progress: gs => ({ value: Math.round(gs.liveStats.toolTasks || 0), target: 4000, unit: 'tasks' })
    },
    answerTime(6000, 1200, 'Each tool step is another model call, so answers take longer. Runaway loops make it much worse.')
  ],

  6: [
    placedChallenge('queue', '📨', 'Put model calls in a queue', 'Open Server → Queue tab and place it. Calls are sent at a steady pace and retried after a 429.'),
    cleanAnswers(1800, 'Without a queue, busy seconds go over the plan\'s per-second limit and the provider answers 429. With one, check what runs out first.'),
    usersChallenge(1800, 'A token budget per user (Code fixes) stops a few heavy users from eating the whole limit.'),
    incidentChallenge('spike', {
      hint: 'A spike is a burst of questions. The queue absorbs bursts; the plan must still have room on average.'
    }),
    profitChallenge(8000, 'Your plan now goes further without upgrading. The bill still grows with every question.')
  ],

  7: [
    placedChallenge('cache', '⚡', 'Add a semantic cache', 'Open Server → Cache tab and place it. Questions that mean the same as one answered before get that answer back.'),
    {
      id: 'bill',
      icon: '🧾',
      info: 'tokenBill',
      label: 'Token bill under 250 coins per 1,000 questions',
      hint: 'You need all three: the cache (repeat questions are free), prompt caching (the repeated start costs 10%) and routing easy questions to a small model.',
      progress: gs => {
        const per = gs.serverStatus?.billPer1k ?? 9999;
        const ok = gs.isPlaced('llm') && gs.users > 0 && per < 250;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${per} coins per 1,000 questions` };
      }
    },
    usersChallenge(2800, 'Cached and routed questions also free up your AI plan\'s limit. Check what runs out first.'),
    answerTime(3000, 2800, 'Cache hits come back instantly and the small model is fast.'),
    profitChallenge(15000, 'Same answers, a fraction of the bill: this is where the money is.')
  ],

  8: [
    placedChallenge('guard', '🛡️', 'Put a guardrail in front of the agent', 'Open Server → Guard tab and place it. It checks every message coming in and every answer going out.'),
    fixOwned('humanApproval', '🙋', 'humanApproval', 'A person approves big refunds',
      'Server → Code fixes → Human approval for refunds. A tricked agent can no longer move money by itself.'),
    {
      id: 'attacks-blocked',
      icon: '🚫',
      info: 'promptInjection',
      label: 'Block 1,000 trick messages',
      hint: 'Counts prompt-injection attempts the guardrail stopped before they reached the agent.',
      progress: gs => ({ value: Math.round(gs.liveStats.botsBlocked || 0), target: 1000, unit: 'blocked' })
    },
    incidentChallenge('bots', {
      icon: '🎭',
      info: 'promptInjection',
      label: 'Survive a jailbreak wave (under 5% failed answers)',
      hint: 'During a wave, trick messages triple or quadruple. Without a guardrail many get through.'
    }),
    usersChallenge(3000, 'The guardrail checks every message, so it needs CPU. Check what runs out first.')
  ],

  9: [
    placedChallenge('orch', '🧭', 'Add an orchestrator', 'Open Server → Orchestrator tab and place it. A lead agent splits each big job across helper agents.'),
    {
      id: 'research-time',
      icon: '🔬',
      info: 'orchestrator',
      label: 'Big jobs finish in under 30 s',
      hint: 'One agent does 30 steps one after another. With helpers working in parallel, the job takes a fraction of the time.',
      progress: gs => {
        const s = gs.serverStatus?.researchSec ?? 999;
        const ok = gs.users > 0 && s < 30;
        return { value: ok ? 1 : 0, target: 1, unit: '', display: `${Math.round(s)} s per big job` };
      }
    },
    {
      id: 'research-done',
      icon: '📑',
      info: 'orchestrator',
      label: 'Finish 600 big jobs',
      hint: 'Counts research jobs completed. More customers = more jobs.',
      progress: gs => ({ value: Math.round(gs.liveStats.researchDone || 0), target: 600, unit: 'jobs' })
    },
    usersChallenge(3500, 'Helper agents use many more tokens. Check that your AI plan still has room.'),
    profitChallenge(20000, 'Big jobs earn more, but cost more tokens too. Keep the cheap tricks from Level 7 on.')
  ]
};
