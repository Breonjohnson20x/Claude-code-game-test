# UI contract — screens, kit, and how they talk to the game

Read `docs/ARCHITECTURE.md` first. The game is pure (`src/game/**`); the UI renders `view` and calls
`act(action)`. Screens never mutate state and never compute outcomes — every number, line of prose
and choice comes from the game layer.

## Routing (`src/App.jsx`, lead-owned)

`state === null` → `TitleScreen`. Otherwise by `state.phase`:
`war_room → WarRoomScreen`, `resolution → ResolutionScreen`, `expedition → ExpeditionScreen`,
`campfire → CampfireScreen`, `passing → PassingScreen`. Overlays (`overlay` in `useGame()`):
`'settings' | 'saves' | 'chronicle' | 'dossier'` → `SettingsSheet`, `SavesSheet`, `ChronicleSheet`,
`DossierSheet`. Each screen file exports a named component with no props.

Dev: `npm run dev` then `/?scenario=<name>` loads a real state built through the controller.
Names (see `src/game/dev/scenarios.js`): `war_room_t1, resolution_t1, march_road,
march_checkpoint, march_wilds, march_ruin, march_champion, duel_pending, champion_defeated,
campfire, war_room_t3, resolution_t4_skirmish, passing_campfire, passing_chronicle,
passing_legacies, cycle2_war_room`.

## `useGame()` (`src/ui/game/GameProvider.jsx`)

```js
const {
  state, view,            // GameState and getView(state) (see "Views" below)
  act,                    // act({ type, ...payload }) → { state, io, error, report? } — errors toast automatically
  lastResult,             // last successful act() result
  settings, updateSettings,
  openOverlay, closeOverlay, overlay, notify(text, tone?),
  generators, aiOn,       // optional Claude narrator; aiOn = enabled && key present
  aiStatus,
} = useGame();
```

Saves, autosave (`before/after_resolution`, `after_campfire`, `cycle_start`, `expedition`), the
dynasty commit, ambient music per phase and action sound cues are handled by the provider — screens
don't call the save system. Screens may call `audio.sfx(...)` / `haptic(...)` from
`src/ui/audio/audio.js` for local feedback (e.g. selecting a card).

## Actions (`src/game/actions.js` → `dispatch`)

| type | payload | phase |
|---|---|---|
| `ISSUE_ORDER` | `{ orderId: 'A'..'E' }` | war_room → resolution |
| `ISSUE_CUSTOM_ORDER` | `{ text, interpretation? }` (interpretation from AI or `parseOrder`) | war_room → resolution |
| `TRIAL_START` | `{ archetypeId: 'blade_adept'|'warg_alpha'|'fallen_champion' }` → `state.trial.pending` = duel config | war_room |
| `TRIAL_COMPLETE` | `{ result }` (DuelResult) → `state.trial.last` | war_room |
| `TRIAL_CANCEL` | — | war_room |
| `APPROVE_CHRONICLE` | `{ entryId }` (this reign's entries; feeds The Chronicler's Pen) | any |
| `ABDICATE` | — (confirm first! ends the reign) | war_room, resolution |
| `CONTINUE` | — next turn, or the Passing after turn 5 | resolution |
| `BEGIN_DEPLOYMENT` | `{ kind: 'march'|'skirmish'|'last_stand' }` | resolution → expedition |
| `START_CAMPFIRE` | — (only when `view.campfire`) | resolution → campfire |
| `EXPEDITION_CHOICE` | `{ choiceId }`; a `duel` choice sets `expedition.pendingDuel` | expedition |
| `EXPEDITION_DUEL_COMPLETE` | `{ result }` | expedition |
| `EXPEDITION_RETREAT` | — (only when `view.canRetreat`; recorded in the Chronicle) | expedition → resolution |
| `CAMPFIRE_COMPLETE` | `{ mode: 'enter'|'short'|'skip', responseId? }` | campfire → resolution |
| `PASSING_NEXT` | — campfire → chronicle → legacies | passing |
| `PASSING_CHOOSE_LEGACIES` | `{ ids: string[] }` (0–2 earned ids) → step `mantle` | passing |
| `BEGIN_NEXT_CYCLE` | — new incarnation, cycle + 1, war_room turn 1 | passing |
| `APPLY_AI_EFFECTS` | `{ effects }` (AI proposals; validated with source 'ai', capped) | any |

## Views (`getView(state)`)

Common: `{ phase, season, sovereign, cycle, turn, turnsPerCycle }`.

- **war_room**: `crisis = { id, title, location, season, briefing: string[], conflict, advisors:
  [{ id, line }], orders: [{ id, category, categoryName, label, text, cost: { treasury, manpower },
  affordable, reactions?: { mara|cassian|vale: 'approves'|'doubts'|'neutral' }, warning?, locked? }],
  era?, borderOutcome? }`, `trial` (`{ pending, last: { outcome, foe, misreads, stakes } }`),
  `trialRewardAvailable`. In reign II+ the first briefing lines cite earlier reigns.
- **resolution**: `report = { orderLabel, category, custom: { text, actions } | null, underfunded,
  outcome: string[], voices: [{ speaker, text }], events: [{ title, text }], resourceDeltas:
  { key: delta }, relationshipShifts: [{ character, from, to }], factionShifts: [{ faction, from:
  { attitude, tension }, to }], regionBefore, regionAfter, newMemories: [{ characterId,
  description, sentiment }], newChronicle: [entry] }`, `expedition` (= `state.lastExpedition`
  after a march: `{ kind, title, duels, fallen: string[], log, retreated? }`), `deployments:
  [{ kind, title, text, recommender, line, danger? }]`, `campfire` (offer or null),
  `isFinalTurn`.
- **expedition**: `expedition = { kind, title, beats, index, picked, phase: 'main'|'after_victory'|
  'after_defeat'|'after_retreat', lastResult: { beat, label, lines } | null, lastDuel: { outcome,
  enemyName, misreads, playerHpRemaining, attempt, fallen } | null, pendingDuel: config | null,
  fallen }`, `beat = { id, title, subtitle, scene: { beat, timeOfDay }, speaker?: { id, line },
  text: string[], choices: [{ id, kind: 'talk'|'advance'|'duel', label, hint?, warning?,
  result }] }`, `canRetreat`. When `pendingDuel` is set, render
  `<DuelScreen config={pendingDuel} onComplete={(r) => act({ type: 'EXPEDITION_DUEL_COMPLETE',
  result: r })} />`.
- **campfire**: `offer = { sceneId, topic, prompt }`, `scene` (enter mode: `{ topic, lines,
  question, sparky: { text }, responses: [{ id, tone, label, reply: string[] }] }`), `shortScene`
  (`{ lines, sparky, closing }`). Enter → pick a response → show its `reply` + `scene.sparky.text` →
  `CAMPFIRE_COMPLETE { mode:'enter', responseId }`. Short → show `shortScene.lines` →
  `CAMPFIRE_COMPLETE { mode:'short' }`. Skip → `CAMPFIRE_COMPLETE { mode:'skip' }` — say plainly that
  skipping costs nothing.
- **passing**: `passing = { cause: 'era'|'fall'|'abdication', step: 'campfire'|'chronicle'|
  'legacies'|'mantle', earned, chosen }`, `farewells: [{ id, name, tier, line }]`, `readback =
  { sovereign, years, lines: [{ id, title, year, voice, text, detail, approved }], verdicts: [{
  faction, name, label, text }] }`, `legacies: [{ id, name, earn, effect, cost, earned, progress }]`.

State you may read directly: `state.resources`, `state.characters[id]` (`name, short, role, status,
age, rel`), `state.factions[id]` (`name, leader, attitude, tension, memory`), `state.threads`
(show only `visibility !== 'hidden'`), `state.chronicle`, `state.memories`, `state.voices`,
`state.regions.southern_marches` (`state, casualties, monuments`), `state.cycle.activeLegacies`,
`state.history`. Presentation helpers: `relationshipLabel, relationshipNotes, attitudeLabel,
tensionLabel, civilizationLabel` (`src/game/core/relationships.js`), `legacyName`
(`src/game/content/legacies.js`), `CATEGORY_NAMES` (`src/game/content/crises.js`). Never show raw
relationship numbers or NarrativeIntensity (§16, §22).

## Kit (`src/ui/kit/kit.jsx`, `src/ui/kit/icons.jsx`)

`Button({ variant: 'royal'|'ghost'|'danger', icon })`, `IconButton({ icon, label, badge })`,
`Panel({ parchment, tight, as })`, `Eyebrow`, `Title({ as })`, `Rule`, `Prose({ lines, serif })`,
`Chip({ tone: gold|ember|crimson|frost|iron|parchment })`, `Meter({ value, max, label, tone })`,
`ResourceHud({ resources, deltas, compact })`, `Sheet({ open, onClose, title, eyebrow, footer, wide })`,
`Screen({ backdrop, wide })`, `Shift({ label, from, to, good })`, `cx(...)`, `RESOURCE_META`,
`Icon({ name, size, label })` (names: treasury manpower readiness stability unrest intel chronicle
council saves settings close back forward sword crown fire map check alert quill scroll menu flag
heart sound mute download upload trash). `TopBar` (`src/ui/game/TopBar.jsx`) is the in-game header.

Theme classes (`src/styles/theme.css`): `.panel .panel-parchment .btn-royal .btn-ghost .order-card
(.order-card__key/__body/__title/__desc/__meta, .order-card--danger, aria-pressed for selected)
.chip--* .meter .gold-rule .text-gilded .text-engraved .text-glow-gold .glow-gold .vignette
.scroll-elvia .bg-war-room`; tokens `navy-950…500, stone-*, parchment-50…500, ink-*, gold-200…800,
ember-*, crimson-*, lattice-*, iron-*, brass-*, frost-*, acid-*, moss-*`; fonts `font-display`
(Cinzel), `font-serif` (Cormorant Garamond), `font-body`.

## Art (`src/ui/art/index.js`) and duel

`RegionScene({ beat, regionState, timeOfDay, monuments })`, `WarRoomBackdrop({ threats: {
syndicate, wargs, refugees }, regionState, dim })`, `Portrait({ id, size, mood, label })` (ids
mara vale cassian sparky mika nyra vex skaela sovereign chronicler), `FactionCrest({ id: 'iron_syndicate'
|'frost_wargs'|'elvia', size })`, `ArchitectSymbol({ size, glow, animated })`, `CampfireScene({
intensity })`, `Sigil`, `GoldDivider`, `PanelCorners`. Duel: `DuelScreen` from
`src/ui/duel/DuelScreen.jsx` (`{ config, onComplete(result) }`, full-screen, owns its own music).
Threat values for the backdrop: `state.threads.IRON_SYNDICATE_BORDER_CRISIS.urgency`,
`FROST_WARG_MIGRATION.urgency`, `NORTHERN_REFUGEES.urgency`.

## Optional Claude narrator (cost-controlled: only at meaningful moments)

Every generator: `await generators.<name>(context, fallbackFn)` → `{ ok, output, source:
'ai'|'cache'|'fallback', proposals, rejected }`. Always pass a fallback; never block the UI on AI
(show a quiet "The scribes are writing…" state, keep the authored text usable meanwhile).
- Custom decrees: `generators.orderInterpreter({ state, crisis, text }, () => parseOrder(text))` →
  `output = { actions, summary, understood }` → `ISSUE_CUSTOM_ORDER { text, interpretation: output }`.
- Campfire voices (after a response): `generators.campfire({ state, participants: ['mara','sparky'],
  topic, mood }, () => null)` → extra `output.lines` to show; `proposals` →
  `APPLY_AI_EFFECTS { effects: proposals }`.
- Chronicle read-back at the Passing: `generators.chronicle({ state, entries: state.chronicle.filter(e => e.cycle === state.cycle.number), cause: passing.cause }, () => null)` →
  `output.paragraphs` shown above the authored lines, clearly labelled "as the scribes tell it".
Only call when `aiOn`. Label AI text subtly ("Narrated by Claude").

## Presentation rules

Mobile-first at 390×844, then desktop. Body ≥ 15px (`text-base` or larger, serif prose
`text-[1.18rem]`). Tap targets ≥ 48px. Every action reachable by keyboard (real `<button>`s,
visible focus). Headline per screen (`h1`), `aria-live="polite"` on results. Respect reduced
motion. Regal magitech: stone, brass, navy, gold light, ember — no neon/cyan. AAA-inspired
presentation: strong composition, layered depth, restrained animation, typographic hierarchy,
breathing room. Long text in readable measure (`max-w-prose`). Danger/irreversible actions use a
confirm `Sheet`.
