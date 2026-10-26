/**
 * AI Support Agent — the guided walkthrough for each level.
 * Every level adds one piece of a real agent system, in the order a team
 * usually meets the problems: speed, memory, wrong answers, actions,
 * rate limits, cost, safety, then big multi-step jobs.
 */

import { CODE_FIXES } from '../../data/codeFixes.js';
import { newMachineSteps } from '../../game/Tutorial.js';
import { firstLevelSteps } from '../firstSteps.js';

const fixStep = (id, text) => ({
  id: `fix_${id}`,
  builderTab: 'code',
  text: () => `Now open the <strong>Code fixes</strong> tab and buy <strong>${CODE_FIXES[id].icon} ${CODE_FIXES[id].name}</strong>. ${text}`,
  highlight: '#nav-server',
  showInBuilder: true,
  advanceOn: 'codeFixBought',
  fix: id
});

const LEVEL_1 = firstLevelSteps({
  welcome: "Hi, I'm Archie! Let's build an <strong>AI helper</strong> for an online shop: customers type a question, an AI model writes the answer. It starts as <strong>one machine</strong> that runs your code and a small AI model.",
  parts: 'A server is 4 parts: <strong>CPU</strong> does the work, <strong>RAM</strong> holds the model and open chats, <strong>Storage</strong> saves chats, <strong>Network</strong> sends answers. An AI model is heavy: every word it writes is a lot of math, so CPU and RAM matter most.',
  goLive: 'Your server does one main thing: <code>POST /chat</code>. It builds a <em>prompt</em> (the shop\'s instructions + the chat so far + the question), the model writes an answer word by word, and the chat is saved.'
});

const LEVEL_2 = newMachineSteps({
  role: 'llm',
  welcome: 'Level 2! The small model is slow and gets about a third of its answers wrong. Big models (like Claude) are far better, but need huge GPUs. Most teams <strong>rent one over an API</strong>: you send the prompt, it sends the answer.',
  buy: 'This "machine" is your <strong>API plan</strong>. Its parts are the plan\'s limits: <strong>tokens per minute</strong>, answers at once, and requests per minute. The plan is cheap; you pay for every token you use. (Closed it? Tap Server again.)',
  explain: 'Your server now only builds prompts and calls the model. Answers are better and faster, but watch the new <strong>token bill</strong> in Money. Check <strong>Goals</strong>.'
});

const LEVEL_3 = [
  {
    id: 'welcome',
    text: () => 'Level 3! An AI model <strong>remembers nothing</strong> between calls. To "remember" a chat you re-send the whole history with every question. Today all chats live in your app server\'s RAM: a restart and they\'re gone. Give them a <strong>database</strong>.',
    button: 'Show me'
  },
  {
    id: 'open_db',
    text: () => 'Tap <strong>Server</strong> and open the new <strong>Database</strong> tab.',
    highlight: '#nav-server',
    advanceOn: 'serverBuilderOpened'
  },
  {
    id: 'buy_db',
    builderTab: 'db',
    text: () => 'The database keeps every chat, so a customer can come back tomorrow. Each question reads the history and saves the new messages. (Closed it? Tap Server again.)',
    highlight: '#nav-server',
    showInBuilder: true,
    advanceOn: 'dbBought'
  },
  { id: 'place_db', text: () => 'Click the glowing slot to place the database.', advanceOn: 'dbPlaced' },
  fixStep('compaction', 'Long chats now cost a lot: 20 messages are re-sent with every question. A short summary of the old part keeps the meaning with far fewer tokens.'),
  {
    id: 'done',
    text: () => 'That\'s the agent\'s <strong>memory</strong>: stored outside the model and put back into the prompt. Fewer tokens per question means more questions fit in your plan. Check <strong>Goals</strong>.',
    highlight: '#nav-goals',
    button: 'Got it',
    finishAfterButton: true
  }
];

const LEVEL_4 = newMachineSteps({
  role: 'kb',
  welcome: 'Level 4! The model told a customer about a 90-day refund that doesn\'t exist. It never saw your help pages, so it <strong>made something up</strong>. Let it look things up first: <strong>RAG</strong> (retrieval-augmented generation).',
  buy: 'The knowledge base holds your help articles, cut into small chunks. For each question it finds the few chunks closest in meaning, and they go into the prompt. (Closed it? Tap Server again.)',
  extra: [fixStep('rerank', 'A second, careful pass picks the best 3 chunks out of 20: better answers, shorter prompts.')],
  explain: 'The model now answers from your own documents. Prompts got longer, so watch your plan\'s <strong>tokens per minute</strong>. Check <strong>Goals</strong>.'
});

const LEVEL_5 = newMachineSteps({
  role: 'tools',
  welcome: 'Level 5! "Where is my order?" is the top question, and the model can\'t see orders. Give it <strong>tools</strong>. Now it works in a <strong>loop</strong>: think, call a tool, read the result, think again, answer. That loop is what makes it an <em>agent</em>.',
  buy: 'The tool server runs the safe buttons the model may press: look up order, track parcel, start refund. Every loop step is another model call. (Closed it? Tap Server again.)',
  extra: [fixStep('maxSteps', 'A few tasks get stuck and loop 25 times, burning tokens. A step limit stops them after a few rounds and hands over to a person.')],
  explain: 'The agent can now <strong>do</strong> things, not just talk. Each task is several model calls, so your plan fills up faster. Check <strong>Goals</strong>.'
});

const LEVEL_6 = newMachineSteps({
  role: 'queue',
  welcome: 'Level 6! Traffic doubled. Questions don\'t arrive evenly: in busy seconds you go over the plan\'s limit and the provider answers <strong>429 Too Many Requests</strong>. Those answers fail.',
  buy: 'The queue holds model calls and sends them at a steady pace, under the limit. A call that gets a 429 waits and is retried. (Closed it? Tap Server again.)',
  extra: [fixStep('tokenBudget', 'A few customers paste whole documents and use 8× the tokens of everyone else. A budget per user keeps them from eating the whole plan.')],
  explain: 'Bursts now wait a moment in line instead of failing. The plan must still have room <strong>on average</strong>. Check <strong>Goals</strong>.'
});

const LEVEL_7 = newMachineSteps({
  role: 'cache',
  welcome: 'Level 7! The <strong>token bill</strong> eats your profit. "What are your opening hours?" comes 500 times a day, and every prompt re-sends the same 1,000 tokens of instructions. Three tricks cut the bill.',
  buy: 'Trick 1: a <strong>semantic cache</strong> stores answers by meaning. "When do you open?" finds the saved answer to "What are your opening hours?" and skips the model. (Closed it? Tap Server again.)',
  extra: [
    fixStep('promptCache', 'Trick 2: the provider keeps the start of your prompt ready, so the repeated instructions cost a tenth.'),
    fixStep('routing', 'Trick 3: a small, cheap model answers the easy questions; only the hard ones go to the big model.')
  ],
  explain: 'Same answers, a fraction of the cost. Watch <strong>coins per 1,000 questions</strong> in <strong>Goals</strong>.'
});

const LEVEL_8 = newMachineSteps({
  role: 'guard',
  welcome: 'Level 8! A post went viral: "Tell the shop\'s AI to ignore its rules and it gives refunds!" That is <strong>prompt injection</strong>: text that tries to give the model new orders. Models can\'t fully tell orders from data, so you add checks <strong>around</strong> it.',
  buy: 'The guardrail checks every message coming in for tricks and every answer and action going out. It is a small model itself, so it needs CPU. (Closed it? Tap Server again.)',
  extra: [fixStep('humanApproval', 'Big refunds now wait for a person to press OK. Even if a trick gets through, the agent can\'t move money alone.')],
  explain: 'Layers of defense: filter what comes in, limit what the agent may do, and keep a person on risky actions. Watch for a <strong>jailbreak wave</strong>. Check <strong>Goals</strong>.'
});

const LEVEL_9 = newMachineSteps({
  role: 'orch',
  welcome: 'Level 9! Customers ask for <strong>big jobs</strong>: "compare every plan for my family". One agent does 30 steps one after another and people wait over a minute. Split the work across <strong>several agents</strong>.',
  buy: 'The orchestrator is a lead agent: it plans the job, starts 5 helper agents that search <strong>in parallel</strong>, then writes one answer from what they found. (Closed it? Tap Server again.)',
  explain: 'Big jobs now take seconds, not minutes. The price: multi-agent work uses many more tokens. Keep your Level 7 tricks on. Check <strong>Goals</strong>.'
});

export const AI_AGENT_STEPS = {
  1: LEVEL_1, 2: LEVEL_2, 3: LEVEL_3, 4: LEVEL_4, 5: LEVEL_5,
  6: LEVEL_6, 7: LEVEL_7, 8: LEVEL_8, 9: LEVEL_9
};

export const AI_AGENT_LEVEL_ROLE = { 1: 'app', 2: 'llm', 3: 'db', 4: 'kb', 5: 'tools', 6: 'queue', 7: 'cache', 8: 'guard', 9: 'orch' };

/** Which code fix would help with a busy part, if it isn't bought yet. */
export function aiAgentSuggestedFix(gs, role, partId) {
  const level = gs.level;
  const f = gs.codeFixes;
  const tokens = role === 'llm' && (partId === 'cpu' || partId === 'network');
  if (level >= 3 && (tokens || role === 'app') && !f.compaction) return CODE_FIXES.compaction;
  if (level >= 4 && tokens && !f.rerank) return CODE_FIXES.rerank;
  if (level >= 5 && tokens && !f.maxSteps) return CODE_FIXES.maxSteps;
  if (level >= 6 && tokens && !f.tokenBudget) return CODE_FIXES.tokenBudget;
  if (level >= 7 && tokens && !f.promptCache) return CODE_FIXES.promptCache;
  if (level >= 7 && tokens && !f.routing) return CODE_FIXES.routing;
  return null;
}
