---
name: generate-product-levels
description: Automatically generate a full, play-tested level pack for a new Scale Architect product (news feed, chat, video, ride hailing…) with a pipeline of four subagents - research → level design → pack build → simulator balance and play-test. Use when the user says "generate levels for <product>", "auto-build the <product> pack", or wants a product added without hand-designing it. For hand-guided design, use design-product-levels instead.
---

# Generate a product's levels with agents

Product name in → playable, balanced, play-tested pack out. Four subagents in `.claude/agents/` run in order; each hands over through files, so any step can be re-run alone.

| Step | Agent | Reads | Writes |
|---|---|---|---|
| 1 | `level-researcher` | the web | `docs/products/<id>.md` §1 (research, sources) |
| 2 | `level-designer` | §1 + engine docs | §2–5 (levels easy → hard, engine mapping, new mechanics) |
| 3 | `pack-builder` | §2–5 + pack template | `js/products/<camelId>/`, registry, `js/data/products.js` |
| 4 | `level-balancer` | `tools/check-pack.mjs` output | tuned pack, `docs/products/<id>-report.md` |

`<id>` in doc file names uses dashes (`news-feed.md`); the product id uses underscores (`news_feed`).

## Run it
1. Resolve the product id from `js/data/products.js` (or make a new snake_case id). Keep a task list with the four steps.
2. Spawn each agent with the Agent tool (`subagent_type` = the agent name; if the agent types aren't loaded yet in this session, use `general-purpose` and tell it to follow `.claude/agents/<name>.md`). Pass the product id, name and doc path. Wait for each before starting the next.
3. **Checkpoint after step 2:** show the user the level list and any proposed new mechanic. Continue on their OK. (Skip if they said to run unattended.)
4. After step 4, verify yourself:
   ```bash
   node tools/check-pack.mjs <id>
   node tools/run-tests.mjs
   ```
   Both must pass. If check-pack fails, send the balancer back once with the errors; if it still fails, report what's stuck.
5. Update `ROADMAP.md` (product table + "Done" entry).
6. Report to the user: levels (one line each), sources, report path, warnings left, anything unverified. Don't commit unless asked.

## The gate (what "done" means)
`tools/check-pack.mjs` passes:
- every level's best system (from `tools/balance-levels.mjs`) reaches its user target
- `tools/playtest-headless.mjs` (the playtest bot, run in Node on the real game systems) finishes every level
Warnings (new machine not strictly needed, level too quick/slow, thin margin) are listed in the report for the user's call.
