/**
 * firstSteps.js — the Level 1 and Level 2 walkthroughs every product shares
 * (one server, then its own database), with the product's own words.
 * Step ids (place, go_live, grow, place_db) are used to resume after a reload.
 */

import { SERVER_PARTS } from '../data/serverParts.js';
import { ROLE_NAME, suggestedFix } from '../game/Tutorial.js';

/** Level 1: build one server, open it to the public, upgrade the bottleneck. */
export function firstLevelSteps({ welcome, parts, goLive }) {
  return [
    { id: 'welcome', text: () => welcome, button: "Let's build" },
    {
      id: 'open_builder',
      text: () => 'Tap <strong>Server</strong> at the bottom to open the Server Builder.',
      highlight: '#nav-server',
      advanceOn: 'serverBuilderOpened'
    },
    {
      id: 'pick_parts',
      text: () => `${parts} Pick parts and press <strong>Buy</strong>. (Closed it? Tap Server again.)`,
      highlight: '#nav-server',
      showInBuilder: true,
      advanceOn: 'serverBought'
    },
    { id: 'place', text: () => 'Now click the glowing slot to place your server.', advanceOn: 'serverPlaced' },
    {
      id: 'go_live',
      text: () => `${goLive} Users also bring you coins.`,
      highlight: '#hud-resources',
      button: 'Open to the public',
      onButton: gs => { gs.appLive = true; }
    },
    {
      id: 'grow',
      text: () => 'To finish this level, complete every goal in <strong>Goals</strong>. Each has a hint, and any <span class="info-glyph">i</span> button explains more. I\'ll tell you when a part gets busy.',
      highlight: '#nav-goals',
      button: 'Got it',
      minimizeAfterButton: true,
      advanceOn: 'partWarning'
    },
    {
      id: 'bottleneck',
      text: (gs, ctx) => {
        const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
        const pct = Math.round((gs.serverStatus?.usage?.[part.id] || 0.8) * 100);
        return `${part.icon} <strong>${part.short}</strong> is at <strong>${pct}%</strong>, so it will run out first: your <em>bottleneck</em>. ${part.whenFull} Tap <strong>Server</strong> and buy a bigger ${part.short}.`;
      },
      highlight: '#nav-server',
      showInBuilder: true,
      advanceOn: 'serverUpgraded'
    },
    {
      id: 'scaled',
      text: () => 'That\'s <strong>vertical scaling</strong>: making the one machine bigger. Check <strong>Goals</strong> for what\'s left.',
      highlight: '#nav-goals',
      button: 'Got it',
      finishAfterButton: true
    }
  ];
}

/** Level 2: give the data its own database server, then fix what gets busy. */
export function databaseLevelSteps({ welcome, buy, dataGrows }) {
  return [
    { id: 'welcome', text: () => welcome, button: 'Show me' },
    {
      id: 'open_db',
      text: () => 'Tap <strong>Server</strong>. The builder now has tabs: <strong>App server</strong>, <strong>Database</strong> and <strong>Code fixes</strong>.',
      highlight: '#nav-server',
      advanceOn: 'serverBuilderOpened'
    },
    { id: 'buy_db', text: () => `${buy} (Closed it? Tap Server again.)`, highlight: '#nav-server', showInBuilder: true, advanceOn: 'dbBought' },
    { id: 'place_db', text: () => 'Click the glowing slot to place the database.', advanceOn: 'dbPlaced' },
    {
      id: 'data_grows',
      text: () => `${dataGrows} I'll tell you when something gets busy.`,
      highlight: '#hud-resources',
      button: 'Got it',
      minimizeAfterButton: true,
      advanceOn: 'partWarning'
    },
    {
      id: 'bottleneck',
      text: (gs, ctx) => {
        const role = ctx?.role || gs.serverStatus?.busiestRole || 'db';
        const part = SERVER_PARTS[ctx?.partId || gs.serverStatus?.busiest || 'cpu'];
        const pct = Math.round((gs.serverStatus?.servers?.[role]?.usage?.[part.id] || 0.8) * 100);
        const fix = suggestedFix(gs, role, part.id);
        const advice = fix
          ? `A bigger ${part.short} helps for a while, but the real problem is the code: try <strong>${fix.icon} ${fix.name}</strong> on the <strong>Code fixes</strong> tab. ${fix.short}`
          : `Open <strong>Server</strong>, pick the ${ROLE_NAME[role] || role} tab and buy a bigger ${part.short}.`;
        return `${part.icon} The <strong>${ROLE_NAME[role] || role}'s ${part.short}</strong> is at <strong>${pct}%</strong>. ${advice}`;
      },
      highlight: '#nav-server',
      showInBuilder: true,
      advanceOn: ['serverUpgraded', 'codeFixBought']
    },
    {
      id: 'done',
      text: () => 'Each time something fills up, ask: <strong>bigger machine, or better code?</strong> Check <strong>Goals</strong>.',
      highlight: '#nav-goals',
      button: 'Got it',
      finishAfterButton: true
    }
  ];
}

/** A level whose new piece is one code fix (no new machine). */
export function fixLevelSteps({ welcome, fix, buy, explain }) {
  return [
    { id: 'welcome', text: () => welcome, button: 'What can I do?' },
    { id: 'fix', builderTab: 'code', text: () => buy, highlight: '#nav-server', showInBuilder: true, advanceOn: 'codeFixBought', fix },
    { id: 'done', text: () => explain, highlight: '#nav-goals', button: 'Got it', finishAfterButton: true }
  ];
}
