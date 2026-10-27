---
name: verify-elvia
description: Verify a change to OmniStrategy: Empire of Elvia end to end — unit tests, build, lint, the scripted Playwright sweep and playthrough, and a screenshot review against the design rules. Use after changing anything under src/, before committing, or when asked to check that the game still works.
---

# Verify Empire of Elvia

The game is a pure, deterministic simulation (`src/game/**`) under a React UI (`src/ui/**`).
A change is verified only when all four gates pass **and** you have looked at the screenshots.

## 1. Gates (run from the repo root)

```bash
npm test          # vitest: sim, duel engine, saves, AI seam, full-cycle playthrough, dev scenarios
npm run build     # vite production build must succeed
npm run lint      # eslint must be clean
npm run e2e       # Playwright: scenario sweep + full UI playthrough (phone 390x844 + desktop 1280x800)
```

`npm run e2e` starts its own Vite server, writes screenshots and `report.json` to
`e2e-artifacts/` (git-ignored) and exits non-zero on any failure. `-- --sweep` or `-- --play`
runs one half. It needs Playwright with Chromium; it falls back to a global install
(`npm root -g`). In the Claude Code cloud sandbox Chromium is preinstalled — never run
`playwright install` there.

What the sweep audits for every dev scenario × viewport: no console errors, exactly one `<h1>`,
no horizontal scroll, every visible control has an accessible name, phone tap targets ≥ 44px.
What the playthrough proves: title → new reign → orders → march with keyboard-played duels →
campfire → Passing → Legacies → reign II, whose first briefing cites reign I.

## 2. Look at the screenshots

Open the PNGs in `e2e-artifacts/sweep/` and `e2e-artifacts/play/` with the Read tool. A green
run with an ugly or broken screen is a failed run. Check:

- Regal magitech look: stone, brass, navy, gold light, ember. No neon, no cyan glow, no scanlines.
- One clear focal point per screen; primary action reachable by thumb near the bottom on phones.
- Body text ≥ 15px on phones, serif prose in a readable measure; nothing clipped or truncated
  that matters (names, costs, warnings).
- Never a raw relationship number or the hidden NarrativeIntensity on screen.
- Region states read at a glance in the march art: STABLE / FORTIFIED / AFTERMATH.

## 3. Look at one phase by hand

`npm run dev`, then open `/?scenario=<name>` (names in `src/game/dev/scenarios.js`, e.g.
`war_room_t3`, `march_champion`, `duel_pending`, `campfire`, `passing_legacies`,
`cycle2_war_room`). Every scenario is built by dispatching real actions, so it is a real state.
Add `?seed=<n>` to make "Begin a new reign" reproducible. In dev, `window.__elvia.state` is the
live (read-only) game state.

## 4. Rules a change must not break (docs/ARCHITECTURE.md)

- The simulation owns the truth: state changes only through `validateEffects` → `applyEffects`.
- Determinism: no `Math.random()` / `Date.now()` in `src/game/**` (outside `save/` and `ai/`).
- Works with zero AI; Claude only *requests* small, capped effects (`source: 'ai'`).
- Skipping a campfire never costs anything; losing a duel is never game over except a last stand.
- Loading an older save never rolls back the dynasty's Chronicle or civilization memory.
- Every interaction works by touch and by keyboard; reduced motion is respected.
- All art and audio are procedural. No third-party game assets, names or likenesses.

If you change a game rule, add or update a vitest test next to it. If you add a phase or beat,
add a dev scenario for it in `src/game/dev/scenarios.js` so the sweep covers it.
