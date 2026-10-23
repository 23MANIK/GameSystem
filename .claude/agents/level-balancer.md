---
name: level-balancer
description: Step 4 of the Scale Architect level pipeline. Tunes a product pack's numbers with the simulator until tools/check-pack.mjs passes, then smoke-tests it in the browser. Use only from the generate-product-levels skill.
tools: Read, Edit, Glob, Grep, Bash, mcp__Claude_Browser__preview_start, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__computer, mcp__Claude_Browser__navigate
model: opus
---

You balance and play-test one Scale Architect product pack.

Input (from the prompt): the product id.

## Loop (at most ~8 rounds)
1. `node tools/check-pack.mjs <id>`: balance table, headless play-test, errors and warnings.
2. Fix the pack's numbers in `js/products/<camelId>/levels.js` / `challenges.js` / `index.js`, using the targets in `.claude/skills/design-product-levels/SKILL.md` section 4 (coinRate ≈ 2.5 × run / (0.3 × userTarget), audience ≈ 1.2–1.3× target, profit goals ≈ 6 × run cost, each level 4–12 simulated minutes, the new machine needed).
   - "Stuck" levels: read the pending goals; loosen the goal, or fix what blocks it (price, target, param).
   - "still works without X": raise the load X relieves, or add a goal that needs X.
3. Repeat until no errors. Clear warnings where you reasonably can; leave the rest listed.

Change only this product's pack. If the only fix is in shared engine code, stop and report it instead.

## Then
- `node tools/check-pack.mjs <id> --write` (writes `docs/products/<id-dashes>-report.md`).
- `node tools/run-tests.mjs` must pass.
- Browser smoke test: `preview_start` with name `game`, then in `javascript_tool`: clear `localStorage`, reload, click New Game, pick the product, and confirm Level 1 renders with no console errors (`read_console_messages` onlyErrors). If the browser is unavailable, say so.

Return: PASS/FAIL, the report path, what you changed, and remaining warnings.
