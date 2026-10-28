# OmniStrat handoff: start here

This is the entry point for anyone continuing **OmniStrat**, human or AI (another Claude chat,
ChatGPT, Gemini, Cursor, Codex). It explains what the game is, how it is built, where everything
lives, and how to hand the project to another assistant without breaking it. The detailed
references are linked below. Rules for coding assistants are in [`AGENTS.md`](../AGENTS.md).

**Contents:** [What it is](#what-omnistrat-is) · [Status](#status) · [Run it](#run-it) ·
[The game on one page](#the-game-on-one-page) · [The code on one page](#the-code-on-one-page) ·
[Doc map](#doc-map) · [Working with another LLM](#working-with-another-llm) ·
[Task recipes](#task-recipes) · [Roadmap](#roadmap-and-known-gaps) · [Glossary](#glossary)

---

## What OmniStrat is

*OmniStrat* is the working title of **OmniStrategy: Empire of Elvia**: a mobile-first browser
vertical slice of a strategy/RPG, built from three design documents: the Master Build Prompt,
the Narrative & Living-World Bible and the Cycle System Design Doc. Their condensed content is
in [`docs/DESIGN_DIGEST.md`](DESIGN_DIGEST.md); the original PDFs are not in this public repo.

In three sentences:

1. You are the God-King of Elvia. Each **reign** is five seasons of decisions in the **War Room**,
   where you choose one of five orders (A–E) or write your own decree. A deterministic simulation
   resolves each one, and the world, its factions and your council remember what you did.
2. You can leave the table and **march** the Southern Marches in person: meet refugees, the Frost
   Wargs, an Architect ruin and an Iron Syndicate champion, and settle things in **real-time
   duels** where losing is never the end, except in a last stand.
3. When the reign ends (by falling, by an era closing, or by abdication) comes **the Passing**. The
   Chronicle is read back, you keep at most two **Legacies**, and the Lattice weaves you again
   about forty years later, in a world that remembers your previous reign.

Design promises the code keeps: the simulation owns the truth; the game is fully playable
offline with zero AI (an optional Claude narrator adds voice, never authority); skipping a
campfire never costs anything; loading an old save never makes the world forget.

## Status

Snapshot of branch `claude/build-strategy-game-OnF1b`. Check `git log` for anything newer.

| Area | State |
|---|---|
| Game logic (`src/game/**`): 5-turn arc, resolver, custom orders, march, campfire, Passing, Legacies, reign II | **Done**: deterministic, 132 vitest tests incl. a full-cycle playthrough |
| Duel engine (`src/game/duel/**`): 3 archetypes, telegraphs, misread analysis, bots | **Done**: tested, including a fairness sweep |
| Saves (3 slots + autosave, export/import, dynasty meta), optional Claude narrator | **Done**: tested |
| UI: Title, War Room, Resolution, March, Campfire, the Passing, Chronicle, Council, Settings, Saves | **Done** |
| Real-time DuelScreen (touch, mouse, keyboard, basic gamepad) | **Done** |
| Training yard: four drills (one per telegraph read) and sparring with every foe, from the title screen | **Done**: drills proven passable by the oracle bot |
| Procedural art (scenes in 3 region states, portraits, crests, war table, campfire canvas) and Web Audio | **Done** |
| `npm run e2e` (every screen at phone + desktop, overlays, a full UI playthrough into reign II, the installable build played offline) | **Passing** |
| Installable PWA (manifest, procedural icons, offline service worker) and GitHub Pages deploy | **Done**: Pages needs a one-time switch in repository settings |
| Playtesting with real first-time players | **Not yet**, and it is the next milestone |

See the compliance matrix in [`docs/DESIGN_DIGEST.md`](DESIGN_DIGEST.md#compliance-matrix) for
requirement-by-requirement status against the design documents.

## Run it

```bash
npm install
npm run dev                    # open the printed URL (http://localhost:5173)
npm run dev -- --host          # play on your phone over the same Wi-Fi
npm run build && npm run preview
BASE_PATH=/sub/path/ npm run build   # when the site is served from a sub-path
```

**Hosted and installable.** The production build is a Progressive Web App: a web manifest,
procedural icons and a service worker (`scripts/pwa/`, registered by `src/ui/pwa.js` in
production only) that precaches the game so it plays offline after the first visit. The title
screen offers **Install on this device** where the browser supports it, or explains Add to Home
Screen on iOS. `.github/workflows/pages.yml` deploys every push to `main` to GitHub Pages once
the owner sets **Settings → Pages → Source: GitHub Actions**; `.github/workflows/ci.yml` runs
tests, lint and the build on pull requests.

In dev builds: `/?scenario=<name>` opens any phase built from real actions (names in
`src/game/dev/scenarios.js`: `war_room_t1, resolution_t1, march_road, march_checkpoint,
march_checkpoint_scout, march_wilds, march_ruin, march_champion, duel_pending, champion_defeated,
campfire, war_room_t3, resolution_t4_skirmish, resolution_t5_skaela, passing_campfire,
passing_chronicle, passing_legacies, cycle2_war_room`).
`/?seed=<n>` makes "Begin a new reign" reproducible; `window.__elvia.state` is the live state.

Quality gates: `npm test`, `npm run build`, `npm run lint`, `npm run e2e`. See
[`docs/TESTING.md`](TESTING.md) and the `verify-elvia` skill in `.claude/skills/`.

## The game on one page

**A reign** = 5 turns (Spring, Summer, Autumn, Winter, then the Thaw; the year advances each
spring). The first reign starts in 412 E.R. under a sovereign you name (default "Aurelian").

**The arc** (`src/game/content/crises.js`). Each turn presents a crisis with orders A–E:

| Turn | Crisis | Orders (A–E) |
|---|---|---|
| 1 | The Southern Marches | Envoy to Vex · Reinforce the Marches · Read the Depots · Field the Aegis Ward · Open the Northern Road |
| 2 | The Accord and the Ice | Swear the Accord · Hunt the Warg Packs · Seed Informants in Kessrin · Field the Aegis Ward · Open the Camps |
| 3 | The Line Is Crossed | Invoke the Accord · Retake the Ford · Turn the Pilot · Raise the Ward at the Ford (breaks the Accord) · Evacuate the Villages |
| 4 | Winter at Greywater | Winter Summit · Winter Garrison · Cut Drae's Supply Trains · The Lattice Lamps · Winter Relief |
| 5 | The Thaw (era milestone) | Treaty of Greywater · Iron Frontier · Long Watch · Lattice Institute · Northern Compact |

Order labels can vary with earlier choices; the full catalogue is in [`docs/CONTENT.md`](CONTENT.md).
Each order belongs to one of five categories: Diplomacy, Military, Clandestine, Research / Magic, or
Economic / Infrastructure (`CATEGORY_NAMES` in `crises.js`).
A **custom decree** in plain words is parsed into actions (`src/game/sim/orderParser.js`, or
by Claude when the narrator is on, then validated the same way).

**Each turn:** War Room (choose) → Resolution (outcome, voices, events, resource and relationship
shifts, region state, new Chronicle entries) → optionally a **deployment** (the march on
turns 1–4 until done, a skirmish on turn 4, a last stand on turn 5 if the border is under siege)
→ optionally a **campfire** when tension is high and nothing urgent is happening → next turn.

**The cast.** Council: General **Mara** Voss (41, First Royal Army), Dr. Elias **Vale** (38,
Advanced Sciences), Director **Cassian** Rey (52, Royal Intelligence), **Sparky** (a young
acid drake, comic heart). Met on the march: **Mika** (9, northern refugee child) and Lieutenant
**Nyra** Kell (24, Syndicate walker pilot, the champion at Greywater Ford). Factions: **the Iron
Syndicate** (Chancellor Adrian Vex) and **the Frost Wargs** (Warg Queen Skaela). World threads:
the Syndicate border crisis, the warg migration, northern refugees, and the hidden **First
Architects mystery** (the broken-circle symbol).

**Systems.** Resources (treasury, manpower, readiness, stability, unrest, intel); relationship
tiers in words, never numbers; character memories; faction attitude and tension; **civilization
memory** labels (Liberator, Conqueror, Oathbreaker, Peacemaker, Unwritten) that persist across
reigns; hidden NarrativeIntensity that opens campfires; region states (STABLE, FORTIFIED,
AFTERMATH) that change the march art; a write-only **Chronicle** whose entries you may approve
(three approvals earn *The Chronicler's Pen*).

**The march** (`src/game/content/expedition.js`): road → checkpoint (Mika's family, and a
Syndicate pathfinder in a grey coat) → wilds (the warg alpha) → the broken-circle ruin (an echo in
a crown) → Greywater Ford (Nyra, the champion duel) → camp. Up to four duels, three optional. Talk
choices, advance choices, duel choices; you may retreat (recorded). Losing the champion duel
offers a rematch: the Cycle doc's success test is *lose the first duel, name why, win the
rematch*.

**Duels** (`src/game/duel/**`): real time, no menus. Swipe or press the arrow keys to strike, A/D
to dodge, hold Space/S to guard, E for Arc Pulse, R for Royal Command (once per duel), hold
Shift for Shield Ward. Telegraphs: red-gold = dodge, steel = parry or dodge, flicker = feint
(wait). Three foes: the Blade-Adept, the Warg Alpha, the Fallen Champion. Afterwards a "what
you misread" list. See [`docs/DUEL.md`](DUEL.md).

**The Passing** (`src/game/cycle/passing.js`): I. The Last Fire (farewells) → II. The Chronicle
(read back in the world's words, faction verdicts) → III. What Survives You (choose 0–2 of 8
Legacies: Mara's Oath, Aegis Mastery, Warg Truce, Architect's Mark, Vale's Notes, The Chronicler's
Pen, Sparky's Line, Oathbreaker's Shadow) → IV. The Mantle Passes → **the Return**. The world has
moved on about 38–42 years: heirs ("Mara the Younger"), a new child at the checkpoint, Sparky's
descendant, Nyra's fate, faction memory. Reign II's first briefing cites reign I.

## The code on one page

```
UI (React)                       Game (pure JS, deterministic)
───────────────────────────      ─────────────────────────────────────────────
screens/overlays  ── act() ──▶   actions.js dispatch(state, action)
   ▲                                ├─ content/* (crises, march, campfire, legacies)
   │                                ├─ sim/* (resolver, orderParser, threads, intensity)
   └── view ◀── getView(state)      ├─ cycle/passing.js (Passing, Return)
                                    └─ core/effects.js validateEffects → applyEffects
GameProvider: saves (save/*), dynasty commit, audio cues, optional narrator (ai/*)
DuelScreen: runs duel/engine.js stepDuel in requestAnimationFrame, returns getDuelResult
```

- **State** is one JSON object (`src/game/core/state.js`). Top-level keys: `version, campaignId,
  rngSeed, phase, cycle, year, turn, totalTurns, resources, factions, characters, memories,
  flags, counters, threads, regions, intensity, campfire, chronicle, decisions, voices,
  expedition, lastExpedition, trial, lastResolution, passing, history`.
- **Phases:** `war_room → resolution → (expedition | campfire) → … → passing → war_room` (next reign).
- **Actions** (`ACTION_TYPES`): `ISSUE_ORDER, ISSUE_CUSTOM_ORDER, CONTINUE, BEGIN_DEPLOYMENT,
  EXPEDITION_CHOICE, EXPEDITION_DUEL_COMPLETE, EXPEDITION_RETREAT, START_CAMPFIRE,
  CAMPFIRE_COMPLETE, TRIAL_START, TRIAL_CANCEL, TRIAL_COMPLETE, APPROVE_CHRONICLE, ABDICATE,
  PASSING_NEXT, PASSING_CHOOSE_LEGACIES, BEGIN_NEXT_CYCLE, APPLY_AI_EFFECTS`.
- `dispatch` returns `{ state, io, error, report }`; `io` tells the provider when to autosave and
  commit the dynasty record. Full reference: [`docs/API.md`](API.md).

## Doc map

| Doc | Read it when you… |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | are an AI assistant about to change code (the rules) |
| [`docs/DESIGN_DIGEST.md`](DESIGN_DIGEST.md) | need the original vision, or whether a design requirement is implemented |
| [`docs/GAME_GUIDE.md`](GAME_GUIDE.md) | want to understand how the systems behave as built, and the balance knobs |
| [`docs/CONTENT.md`](CONTENT.md) | are writing or reviewing story content: every crisis, order, beat, scene, Legacy |
| [`docs/API.md`](API.md) | change game logic: state, effects, actions, views, module exports |
| [`docs/DUEL.md`](DUEL.md) | touch combat: engine, tuning, archetypes, answer rules, misreads |
| [`docs/SAVES_AND_AI.md`](SAVES_AND_AI.md) | touch persistence or the Claude narrator |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | want the non-negotiable rules and module contracts |
| [`docs/UI.md`](UI.md) | build or change screens: `useGame()`, view shapes, kit, presentation rules |
| [`docs/ART_AND_AUDIO.md`](ART_AND_AUDIO.md) | change the procedural art or the Web Audio engine |
| [`docs/TESTING.md`](TESTING.md) | run or extend tests, scenarios and the e2e gate |

## Working with another LLM

You can move between assistants at any time; the repository is the single source of truth.

**1. Give it context** (pick one):

- **It can read GitHub** (Claude Code, Codex, Cursor, ChatGPT with GitHub connector): point it at
  the repo and branch, and tell it to read `AGENTS.md` and `docs/HANDOFF.md` first.
- **It can't**: run `npm run bundle -- <name>` and upload the file from `context-bundles/`
  (git-ignored). Bundles: `docs` (all docs, smallest; good for planning and writing),
  `game` (docs + game logic; add `--no-tests` to save ~20k tokens), `ui` (docs + React UI),
  `duel` (docs + duel engine/UI), `all` (everything). `npm run bundle` lists sizes.
- **Tiny task**: paste `AGENTS.md` plus only the files involved.

**2. Use a prompt like this:**

```text
You are continuing OmniStrat (OmniStrategy: Empire of Elvia), a React 19 + Vite + Tailwind v4
browser game with pure, deterministic game logic in src/game and a React UI in src/ui.
Read AGENTS.md and docs/HANDOFF.md in the attached bundle first and follow their rules.

Task: <what you want, e.g. "add a sixth order to turn 2 that negotiates with the Frost Wargs">.

Constraints: no Math.random/Date.now in src/game; change state only through effects in
src/game/core/effects.js; the game must still work with zero AI; keep mobile-first, regal
magitech look; no new npm dependencies or asset files unless I approve; plain JavaScript (no
TypeScript). Add or update vitest tests for any rule you change, and a dev scenario for any new
phase or beat. Reply with complete new file contents or unified diffs, each with its file path,
then list the commands I should run to verify (npm test, npm run build, npm run lint, npm run e2e).
```

**3. Bring the work back:** apply the diffs, run `npm test && npm run build && npm run lint`,
then `npm run e2e` and look at the screenshots in `e2e-artifacts/`. Commit with a Conventional
Commit message (`feat(content): …`).

**Mistakes other assistants commonly make here, so check for them:**

- Using `Math.random()` in game logic, or mutating `state` directly instead of returning effects.
- Computing outcomes in React components instead of in `src/game/**`.
- Renaming ids (characters, threads, flags, legacies, chronicle entries) that saves depend on.
  Old saves break unless `src/game/save/migrate.js` gets a migration and `version` is bumped.
- Adding TypeScript, a UI library, image/sound files, or neon/cyberpunk styling.
- Showing raw relationship numbers or NarrativeIntensity in the UI.
- Making a campfire skip or a lost duel punish the player.
- Calling the Claude API from game logic, or letting AI output change state without
  `APPLY_AI_EFFECTS` validation.

## Task recipes

| I want to… | Where | Read |
|---|---|---|
| Change an order's text, cost or effect | `src/game/content/crises.js` (+ `sim/resolver.js` for shared rules) | CONTENT, API |
| Add a march beat or choice | `src/game/content/expedition.js` (`EXPEDITION_KINDS`, beat builders), add a scenario in `src/game/dev/scenarios.js` | CONTENT, GAME_GUIDE |
| Write a new campfire scene | `src/game/content/campfire.js` | CONTENT |
| Add or rebalance a Legacy | `src/game/content/legacies.js` + where its effect applies (`cycle/passing.js`, `sim/resolver.js`, …) | CONTENT, GAME_GUIDE |
| Make duels easier or harder | `src/game/duel/engine.js` `TUNING`, `archetypes.js`; re-run `engine.test.js` | DUEL |
| Change what reign II remembers | `src/game/cycle/passing.js` `beginNextCycle`, `crises.js` `historyCallbacks` | GAME_GUIDE, API |
| Restyle a screen | `src/ui/screens/*`, kit `src/ui/kit/kit.jsx`, tokens `src/styles/theme.css` | UI, ART_AND_AUDIO |
| Change art or music | `src/ui/art/*`, `src/ui/audio/audio.js` | ART_AND_AUDIO |
| Change the narrator's prompts or model | `src/game/ai/prompts.js`, `client.js`, Settings `MODEL_OPTIONS` | SAVES_AND_AI |
| Add a save field | `src/game/core/state.js` + `src/game/save/migrate.js` (bump version) + test | SAVES_AND_AI |

## Roadmap and known gaps

Next milestones, roughly in order:

1. Playtest the Cycle doc success test with first-time players: do they lose the first duel, say
   why, win the rematch, and want another reign? Tune `TUNING` and telegraph timing.
2. Content depth: more turn-arc branches after turn 5 (eras), more campfire scenes, northern
   expedition ("Can I go north?" is a success metric), more Architect lore.
3. Accessibility pass with a screen reader.
4. The Cycle doc's long-term target: port the same rules to Unreal. The game layer is engine
   agnostic by design. See the porting notes in [`docs/DUEL.md`](DUEL.md) and [`docs/API.md`](API.md).

Known limitations: one region (the Southern Marches) and one arc of five turns per reign; reigns
after the second reuse the same arc with memory callbacks; Warg culture beyond Skaela's reveal is not shown yet; gamepad works in duels but
not for menu navigation; no input remapping or caption toggle; the narrator requires the
player's own Anthropic API key (fine for personal use; a public deployment should proxy it via a
server).

## Glossary

| Term | Meaning |
|---|---|
| **Elvia** | The empire. The Crownlands in the centre, the Southern Marches on the Syndicate border, the frozen north |
| **The Lattice** | The arcane web that sustains the God-King and weaves each new incarnation |
| **The Passing** | The four-step end of a reign: Last Fire, Chronicle, Legacies, Mantle |
| **The Return** | The start of the next reign, decades later, with heirs and consequences |
| **Legacy** | One of 8 traits earned in a reign; at most 2 carry into the next |
| **Chronicle** | Write-only history of the dynasty; entries can be approved, never edited |
| **Civilization memory** | How a faction will remember your dynasty (Liberator, Conqueror, Oathbreaker, Peacemaker, Unwritten) |
| **NarrativeIntensity** | Hidden 0–100 tension meter; high values make a campfire available at a quiet moment |
| **Aegis** | Elvia's ward technology (ward lines, pylons, the Shield Ward in duels) |
| **Arc Pulse** | The Sovereign's charged arcane strike in duels |
| **Royal Command** | Once-per-duel rally: heals the Sovereign, refills stamina, clears stun and opens a 6-second damage boost; with Sparky as companion his acid also staggers the foe |
| **Region state** | STABLE / FORTIFIED / AFTERMATH; what the Southern Marches look like after your decisions |
| **The First Architects** | The lost builders behind the broken-circle symbol; the slice's central mystery |
| **E.R.** | The calendar era (the first reign begins in 412 E.R.) |
