# Create DesignGame

Players name a system ("Ride hailing like Uber"). Claude researches how it is really built, turns it into levels in the game's own format, test-plays every level with the game's bot, and the game appears under **Community games** in the product picker. Only someone with the passcode can create games.

## How it works

| Step | Who | Where |
|---|---|---|
| Check the idea | Claude Haiku 5.5 | `checkPrompt` in `tools/designgame/generate.mjs` |
| Research on the web | Claude Opus 5.5 + web search / fetch | `research` |
| Plan the levels (numbers, machines, goals) | Claude Opus 5.5 | `plan` |
| Stories, hints, tutorials, one call per level in parallel | Claude Opus 5.5 | `writeDetails` |
| Re-tune money, balance check, test-play every level | our code | `gateAndTune` → `tools/designgame/checkGame.mjs` |
| Fix what failed (up to 2 rounds) | Claude Opus 5.5 | `repairOutline` |

A game is a **data pack**: plain JSON, no code (`docs/designgame/data-pack-format.md`, loader `js/products/dataPack.js`). It can only use machines, code fixes and traffic params the engine already has.

On the server (`/api/designgame`, `tools/designgame/service.mjs`) a game is a job saved in Redis and run one step per request: the creator's browser asks for the next step until it's done. Each step is one or two model calls, well under the 300 s function limit. Closing the screen pauses the job; opening it again carries on. New games are playable by link and appear in Community games once published from the result screen.

## Setup (Vercel)

| Env var | What |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key. Set a monthly spend limit in the Claude Console too. |
| `DESIGNGAME_PASSCODE` | The creator passcode. Without it, creating is off. |
| `DESIGNGAME_DAILY_MAX` | Games per day, site-wide (default 5). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Already set for presence/feedback. |

`tools/sync-deploy.sh` copies the server code (`tools/designgame/`, `package.json`) next to `api/`; the edge middleware stops `/tools`, `/docs` and `package.json` being served.

## Run it locally

```bash
npm install
node tools/designgame/dev-server.mjs --fake          # the whole flow with a stand-in model (passcode "dev")
ANTHROPIC_API_KEY=… node tools/designgame/dev-server.mjs   # with Claude
ANTHROPIC_API_KEY=… node tools/generate-designgame.mjs "Ride hailing like Uber" --levels 8   # CLI → games/<id>.pack.json
node tools/check-pack.mjs --pack games/<id>.pack.json   # re-check a generated game
```

Roughly $0.50–2 per game (measured cost is shown on the progress screen and in the CLI report).
