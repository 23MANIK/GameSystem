/**
 * split.mjs — cut a data pack into an outline (numbers, machines, goals) and
 * one "details" part per level (story, hints, tutorial), and put them back.
 *
 * The generator writes the outline first, then every level's details in
 * parallel, so no single model call runs for many minutes (a server function
 * has a time limit) and a repair only has to touch the outline.
 */

const DETAIL_LEVEL_FIELDS = ['intro', 'story', 'completionMessage', 'realWorld', 'unlockedFeatures', 'feature'];

/** { outline, details: [{ level, ...texts, goalHints: [], tutorial }] } */
export function splitPack(pack) {
  const outline = JSON.parse(JSON.stringify(pack));
  delete outline.tutorial;
  const details = [];
  for (const L of outline.levels) {
    const d = { level: L.level };
    for (const k of DETAIL_LEVEL_FIELDS) if (L[k] !== undefined) { d[k] = L[k]; delete L[k]; }
    d.goalHints = (outline.goals[L.level] || []).map(g => { const h = g.hint; delete g.hint; return h; });
    d.tutorial = pack.tutorial?.[L.level];
    details.push(d);
  }
  return { outline, details };
}

/** Put an outline and its details back together into a data pack. */
export function mergePack(outline, details) {
  const pack = JSON.parse(JSON.stringify(outline));
  pack.tutorial = {};
  for (const L of pack.levels) {
    const d = details.find(x => x.level === L.level) || {};
    for (const k of DETAIL_LEVEL_FIELDS) if (d[k] !== undefined) L[k] = d[k];
    (pack.goals[L.level] || []).forEach((g, i) => { g.hint = d.goalHints?.[i] ?? g.hint ?? ''; });
    if (d.tutorial !== undefined) pack.tutorial[L.level] = d.tutorial;
  }
  // Keep the usual key order (texts first) so the file reads like a hand-made pack
  pack.levels = pack.levels.map(L => {
    const { level, name, subtitle, intro, ...rest } = L;
    return Object.fromEntries(Object.entries({ level, name, subtitle, intro, ...rest }).filter(([, v]) => v !== undefined));
  });
  return pack;
}
