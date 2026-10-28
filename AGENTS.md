# AGENTS.md — rules for any AI coding assistant working on OmniStrat

OmniStrat (working title; in game: **OmniStrategy: Empire of Elvia**) is a mobile-first browser
vertical slice of a strategy/RPG. You rule Elvia from a War Room for a five-season reign, walk the
Southern Marches in person, settle things in real-time duels, sit at campfires, and when the reign
ends the Passing turns you into a new incarnation in a world that remembers what you did.

Start with `docs/HANDOFF.md` for the full map. This file is the short list of rules.

## Stack and commands

React 19 + Vite 7 + Tailwind CSS v4 (`@tailwindcss/vite`, tokens in `src/styles/theme.css`),
plain JavaScript ES modules (no TypeScript), vitest, Playwright for end-to-end checks.
Node 20+.

```bash
npm install
npm run dev            # http://localhost:5173 ; /?scenario=<name> jumps to any phase (dev only)
npm test               # vitest — must stay green
npm run build          # must succeed
npm run lint           # must have no errors
npm run e2e            # Playwright sweep + full playthrough (phone + desktop), screenshots in e2e-artifacts/
npm run bundle -- docs # pack docs (or game/ui/duel/all) into one file for another LLM
```

## Non-negotiable rules

1. **The simulation owns the truth.** `GameState` is plain JSON. Game state changes only through
   effects: `validateEffects()` then `applyEffects()` (`src/game/core/effects.js`), usually via the
   controller `dispatch(state, action)` in `src/game/actions.js`. UI code never mutates state and
   never computes outcomes. It renders `getView(state)` and calls `act({ type, ...payload })`.
2. **Deterministic.** No `Math.random()` or `Date.now()` in `src/game/**` (except `save/` and
   `ai/`). Use the seeded RNG in `src/game/core/rng.js`. Same state + same action = same result.
3. **Works with zero AI.** Every narrator call has an authored fallback. Claude may only *request*
   small effects (`source: 'ai'`: resource/relationship/faction/memory/intensity/voice, capped).
4. **Pure logic.** `src/game/**` has no React, DOM or storage, except `save/` (storage adapter)
   and `ai/` (network client).
5. **Design promises.** Skipping a campfire never costs anything. Losing a duel is never game over
   except in a last stand. The Chronicle is write-only. Loading an older save never rolls back the
   dynasty's Chronicle or civilization memory. Never show raw relationship numbers or the hidden
   NarrativeIntensity on screen. At most 2 Legacies carry over.
6. **Mobile-first and keyboard-complete.** 390×844 first. Body text ≥ 15px, tap targets ≥ 44px
   (48px preferred), real `<button>`s with visible focus, one `<h1>` per screen, respect reduced
   motion (`prefers-reduced-motion` and `html[data-motion="reduced"]`).
7. **Look: regal magitech.** Stone, brass, deep navy, warm gold light, ember. No neon, no cyan
   glow, no scanlines. Use the kit (`src/ui/kit/kit.jsx`) and theme tokens; don't invent new colors.
8. **Procedural, original assets only.** Art is SVG/canvas, audio is Web Audio. Never add images,
   sounds, fonts, names or likenesses from other games or copyrighted works. The two Google Fonts
   (Cinzel, Cormorant Garamond) are loaded at runtime.
9. **Secrets.** The player's Anthropic API key lives only in their browser's localStorage and is
   sent only to Anthropic. Never log it, commit it or send it anywhere else.

## Where things live

```
src/game/            pure game logic (see docs/API.md)
  core/              state factory, effects validator/mutator, seeded RNG, relationship labels
  sim/               turn resolver, custom-order parser, world threads, narrative intensity
  content/           the five-turn arc (crises), the march, campfire, Legacies, names
  cycle/passing.js   the Passing and the Return (next incarnation)
  duel/              real-time duel engine (fixed timestep), archetypes, misread analysis, bots
  save/              save slots, autosave, migration, dynasty meta
  ai/                optional Claude narrator (client, generators, prompts, schemas, cache, status)
  dev/scenarios.js   dev-only states built through the real controller (UI previews, e2e)
  actions.js         the controller: dispatch(state, action) and getView(state)
src/ui/              React UI
  game/              GameProvider (useGame), TopBar, settings
  kit/               buttons, panels, sheets, meters, icons
  screens/           Title, WarRoom, Resolution, Expedition, Campfire, Passing
  overlays/          Settings, Saves, Chronicle, Dossier (council/factions/world)
  duel/              DuelScreen (canvas, real-time input)
  art/               procedural SVG/canvas art (region scenes, portraits, crests, backdrops)
  audio/audio.js     procedural Web Audio engine + haptics
scripts/             e2e.mjs (Playwright gate), context-bundle.mjs, pwa/ (manifest, icons, service worker)
.github/workflows/   ci.yml (test, lint, build), pages.yml (deploy main to GitHub Pages)
docs/                HANDOFF, DESIGN_DIGEST, GAME_GUIDE, CONTENT, API, DUEL, SAVES_AND_AI,
                     ARCHITECTURE, UI, ART_AND_AUDIO, TESTING
```

## Conventions

- ES modules, named exports, React function components. Match the surrounding file's style and
  comment density. Prettier-like formatting: 2 spaces, single quotes, semicolons, ~140 columns.
- Game content is data plus small pure functions in `src/game/content/*`. Prose lives next to the
  rules that use it.
- A new rule needs a vitest test next to it. A new phase or beat needs a dev scenario in
  `src/game/dev/scenarios.js` so `npm run e2e` covers it.
- Commits: Conventional Commits (`feat(scope): …`, `fix(ui): …`, `docs: …`), focused and buildable.

## Definition of done for any change

`npm test`, `npm run build` and `npm run lint` pass. `npm run e2e` passes, and you have *looked at*
the screenshots it writes to `e2e-artifacts/`. The docs you touched are still true; update
`docs/*.md` in the same change.
