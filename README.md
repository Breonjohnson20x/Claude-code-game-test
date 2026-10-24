# OmniStrategy: Empire of Elvia

A mobile-first browser vertical slice of **OmniStrategy: Empire of Elvia** — the strategy/RPG
described in the Master Build Prompt, the Narrative & Living-World Bible and the Cycle System
Design Doc. This is the browser prototype the Cycle doc calls for ("Now: systems + text in the
browser demo… Later: same rules port to Unreal").

You are the God-King of Elvia. Each **reign** is five seasons in the War Room. You can walk the
Southern Marches in person and settle things in real-time duels. When the reign ends — by falling,
by an era closing, or by abdication — **the Passing** reads your Chronicle back, you choose one or
two **Legacies**, and the Lattice weaves you again decades later, in a world that remembers what
you did.

## Play it

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

**On your phone:** run `npm run dev -- --host`, then open the `Network:` address it prints
(phone and computer on the same Wi-Fi).

**Share a build:** `npm run build` writes a static site to `dist/`. Any static host works
(Netlify, Vercel, GitHub Pages, Cloudflare Pages). `npm run preview` serves the build locally.

### Controls

- **War Room, march, campfire, Passing:** tap or click; everything also works with the keyboard
  (Tab, Enter, Esc closes sheets).
- **Duels** (real time, no menus):

  | Action | Touch / mouse | Keyboard |
  |---|---|---|
  | Strike | swipe / drag up, down, left, right | Arrow keys |
  | Dodge | tap the left or right edge | A / D |
  | Guard / parry | hold on the blade | hold Space or S |
  | Arc Pulse | tap the charged sigil | E |
  | Royal Command (once) | tap the crown | R |
  | Shield Ward | hold the ward button | hold Shift |

  Read the wind-up: a **red-gold** glow means *dodge*, steel light means *parry or dodge*, and a
  flicker is a feint: *wait*. Losing a duel never ends the game; the result screen tells you what
  you misread.

### Optional Claude narrator

The whole game plays offline, without AI. In **Settings → Claude narrator** you can add your own
Anthropic API key. Claude then interprets custom decrees, adds voices at the campfire and reads
the Chronicle back at the Passing. Claude can only *request* small changes; the simulation
validates and caps every one. The key is stored only in your browser and sent only to Anthropic.
Server-side refusal fallbacks are enabled, so a refused request falls back to another model instead
of failing. A per-session call budget limits cost.

## Saves

Three manual slots plus an autosave (before and after each decision, after campfires, on the
march, at the start of each reign), with export and import as JSON. Saves hold a reign; a
**dynasty record** above them holds the cross-reign Chronicle and civilization memory, so
loading an older save never makes the world forget.

## Development

```bash
npm test          # vitest: simulation, duel engine, saves, AI seam, full-cycle playthrough
npm run build     # production build
npm run lint
```

- `docs/ARCHITECTURE.md`: rules (the simulation owns the truth, determinism, works with zero
  AI) and module contracts.
- `docs/UI.md`: screen contracts, `useGame()`, actions and view shapes.
- In dev, `/?scenario=<name>` opens any phase through the real game controller (for example
  `/?scenario=march_champion` or `/?scenario=passing_legacies`). The names are listed in
  `src/game/dev/scenarios.js`.

```
src/game/      pure, deterministic game logic (no React, no DOM)
  core/        state, effects validator/mutator, seeded RNG, relationship labels
  sim/         turn resolver, custom-order parser, world threads, narrative intensity
  content/     the five-turn War Room arc, the march, campfire, Legacies
  cycle/       the Passing and the Return
  duel/        real-time duel engine (fixed timestep) + archetypes + misread analysis
  save/        save slots, migration, dynasty meta
  ai/          optional Claude narrator (structured outputs, cache, budget, fallbacks)
  actions.js   the controller: dispatch(state, action)
src/ui/        React UI: screens, overlays, kit, procedural art (SVG/canvas), Web Audio
```

All art and audio are procedural (SVG, canvas, Web Audio). No third-party game assets are used.
