# V2 redesign — user journey and screen map

Audit of the current game (branch `v2`) against the target journey. Rule for the
redesign: restyle and restructure existing screens, keep mechanics, saves
(`localStorage`) and APIs exactly as they are.

## Facts that shape the design

- Levels are **linear per product**: you play Level N, finish its challenges,
  then Level N+1. There is no free level jumping, so "level selection" shows
  progress (completed / current / locked) but only the current level is playable.
- One save slot. Starting a product replaces it (the picker already warns).
- Incidents are real: traffic spikes, server crashes and bot floods
  (`js/game/TrafficSpikes.js`), plus overload warnings from the simulator.
  They arrive as notifications (Alerts tab).
- `EventPanel`, `StatsPanel`, `ResearchPanel`, `BuildPanel`, `UpgradeModal` are
  legacy files nothing imports. They are not part of the journey.

## Journey

| Step | Target | Today | Work |
|---|---|---|---|
| 1 | First visit → Landing → New Game | `#intro-screen` in index.html | Redesign (phase 1) |
| 2 | Level selection | `ProductPicker` (products + level list) | Redesign as "Choose a mission": product cards, per-level states from the save (phase 1) |
| 2b | Mission briefing → Start | `LevelIntro` card | Redesign: story, objectives (real challenges), concepts, Start Mission (phase 1) |
| 3 | Guided tutorial → build & connect | `Tutorial` + `GuideBubble` + `ServerBuilder` + tap-the-slot placement | Keep; restyle in phase 4 |
| 4 | Simulation → metrics & health | `HUD` top bar + `SystemDiagram` map | Gameplay shell polish (phase 1), 3D buildings on map later |
| 5 | Incident → investigate → change → evaluate | Toasts + `NotificationsPanel` (Alerts) | Investigation view with live metrics and recommended actions (phase 3) |
| 6 | Complete → results → continue | `#level-up-overlay` (`showLevelCompleteOverlay`) | Redesign results (phase 3). Failing a level does not exist as a mechanic; reputation/outages show in results |
| 7 | Return → resume | Continue button with save label | Keep; returning players skip intro straight to the game |

## Screens

| Screen | Status | Phase |
|---|---|---|
| Landing page | exists, refine | 1 |
| Level selection | exists (product picker), refine | 1 |
| Mission briefing | exists (`LevelIntro`), refine | 1 |
| Gameplay shell: top HUD, map, bottom nav | exists, refine | 1 |
| Component library (Build tab) | done (`BuildingGallery`) | 2 ✓ |
| Component detail & upgrade | done (gallery detail, `ServerBuilder` for parts) | 2 ✓ |
| Goals & objective tracking | exists (`GoalsPanel`), refine | 3 |
| Alerts & incident investigation | alerts exist; investigation is new UI on real data | 3 |
| Mission results | exists (overlay), refine | 3 |
| Pause / settings | Home button saves and returns to landing; no settings screen | 4 |
| Tutorial states | exists (`GuideBubble`) | 4 |

## Navigation

Four gameplay destinations in the bottom nav: **Build** (component library),
**Server** (Server Builder: buy/upgrade parts), **Goals**, **Alerts**.
Desktop ≥ 1024px: panels open as a right-hand inspector; the map stays visible.

## Design tokens (existing, in `css/index.css`)

Dark navy `--bg-primary #0a0e17`, electric blue `--accent-blue #3b82f6`,
purple `--accent-purple #8b5cf6`, teal healthy `--accent-cyan #06d6a0`,
amber warnings `--accent-amber #fbbf24`, red failures `--accent-red #ef4444`.
Orbitron (`--font-title`) for display, Inter (`--font-body`) for UI.
Buildings: `js/components/IsoBuildings.js` (`isoSVG(type, level, state)`).
