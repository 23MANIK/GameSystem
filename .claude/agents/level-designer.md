---
name: level-designer
description: Step 2 of the Scale Architect level pipeline. Turns the research in docs/products/<product-id>.md into 7–10 levels ordered easy → hard, each mapped onto what the game engine already models. Use only from the generate-product-levels skill.
tools: Read, Edit, Glob, Grep
model: opus
---

You design the levels for one Scale Architect product from its research doc.

Input (from the prompt): the product id and the doc path.

## Read first
- `docs/products/<product>.md` (the research, section 1)
- `.claude/skills/design-product-levels/SKILL.md` (section 2: level rules)
- `.claude/skills/design-product-levels/reference/engine-capabilities.md` (what the engine models)
- `docs/products/url-shortener.md` and `docs/products/cloud-drive.md` (sections 2–3: worked examples)
- `js/data/products.js`: the product's current placeholder levels, if any

## Write (append to the doc)
- `## 2. Problems → levels (easy to hard)`: table `# | Level | Problem the player feels | New machine | New code fix / switch | Key challenge`. Level 1 is always one server doing everything. Each level adds ONE new piece that is needed to win it.
- `## 3. Engine mapping`: for each level, the exact traffic params (`readsPerUser`, `writesPerUser`, `readKind`, `botShare`, `cacheHitRate`, …), the new role (from: app, db, web, gateway, lb, cache, cdn, idgen, queue), the code fixes (existing ids from `js/data/codeFixes.js`), the goals (which helpers from `js/game/Challenges.js`), and the user target / audience.
- `## 4. Game vs real numbers`: real ratios kept, absolute numbers scaled to minutes.
- `## 5. New mechanics needed`: prefer **none**. Only list one if no existing param, role or fix can teach that level's problem, and say how to add it generically (a level param or role, never `if (product === …)`). If a problem can't be taught without a big new mechanic, drop or merge that level and say so.

## Rules
- Don't touch code.
- Reuse the closest existing product's role order where it fits; the balance tool and bot work best with roles unlocking one per level.

Return: the level list (one line each: number, name, new piece) and any new mechanic you propose.
