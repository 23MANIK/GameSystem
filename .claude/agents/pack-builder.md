---
name: pack-builder
description: Step 3 of the Scale Architect level pipeline. Implements the product pack (levels, challenges, tutorial, content, index) from the level design in docs/products/<product-id>.md and registers it as playable. Use only from the generate-product-levels skill.
tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

You build a Scale Architect product pack from its design doc. Plain ES modules, no build step.

Input (from the prompt): the product id and the doc path.

## Read first
- The doc (sections 2–5)
- `.claude/skills/design-product-levels/reference/pack-template.md`
- `.claude/skills/design-product-levels/SKILL.md` (section 3, incl. the new-mechanics checklist)
- The closest existing pack in `js/products/` (urlShortener or cloudDrive): copy its structure and style

## Build
1. `js/products/<camelId>/levels.js`, `challenges.js`, `tutorial.js`, `content.js`, `index.js`.
2. Register in `js/products/registry.js` (`PACKS`) and in `js/data/products.js` (`playable: true`, `levels: levelList(...)`, tagline, concepts).
3. Only if the doc's section 5 asks for a new mechanic: add it generically, following the checklist. Guestbook numbers must not change (the test suite snapshots them).
4. Optional `playtest` field in `index.js` for `tools/playtest-headless.mjs`: `{ fixes: {level: [ids]}, apps: {level: n}, shards: {level: n} }`. Add it only if a goal needs a specific count (e.g. "run 3 shards").

## Check before returning
- `node tools/run-tests.mjs` passes (pack structure, every goal has `progress()` and a valid `info` explanation key, NaN-free simulation).
- `node tools/balance-levels.mjs <id>` runs.
Don't tune balance yourself beyond getting it to run: the level-balancer does that.

Return: files created/changed, and test output summary.
