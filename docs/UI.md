# UI contract — screens, kit, and how they talk to the game

Read `docs/ARCHITECTURE.md` first. The game is pure (`src/game/**`); the UI renders `view` and calls
`act(action)`. Screens never mutate state and never compute outcomes — every number, line of prose
and choice comes from the game layer.

## Routing (`src/App.jsx`, lead-owned)

`state === null` → `TitleScreen`, or `TrainingScreen` while `training` is set (`openTraining()` /
`closeTraining()` in `useGame()`). Otherwise by `state.phase`:
`war_room → WarRoomScreen`, `resolution → ResolutionScreen`, `expedition → ExpeditionScreen`,
`campfire → CampfireScreen`, `passing → PassingScreen`. Overlays (`overlay` in `useGame()`):
`'settings' | 'saves' | 'chronicle' | 'dossier'` → `SettingsSheet`, `SavesSheet`, `ChronicleSheet`,
`DossierSheet`. Each screen file exports a named component with no props.

Between screens a `.screen-veil` (keyed by the screen) dips to night for about half a second and
lifts as the new screen arrives; it never blocks input and is instant under reduced motion.

Where the screens live (helpers sit in a folder named after the screen):

| Screen / overlay | File | Helpers |
|---|---|---|
| Title | `src/ui/screens/TitleScreen.jsx` | `ui/pwa.js` (`useInstallState`, `promptInstall`: the install button and the iOS hint) |
| Training yard | `src/ui/screens/TrainingScreen.jsx` (shown when `training` is set in `useGame()` and no reign is loaded) | `screens/training/records.js` (per-device progress) |
| War Room | `src/ui/screens/WarRoomScreen.jsx` | `screens/warroom/` (Crisis, Council, Orders, CustomDecree, Trial, shared, words, ornate, tones) |
| Resolution | `src/ui/screens/ResolutionScreen.jsx` | `screens/resolution/` (Report, Decisions) |
| March | `src/ui/screens/ExpeditionScreen.jsx` | `screens/expedition/` (MarchRail, ChoiceList, DuelOutcome, words) |
| Campfire | `src/ui/screens/CampfireScreen.jsx` | — |
| The Passing | `src/ui/screens/PassingScreen.jsx` | `screens/passing/` (one component per step, Backdrop, StepIndicator, StepHeader, ActionBar, Manuscript, copy) |
| Duel | `src/ui/duel/DuelScreen.jsx` | `duel/hud.jsx` (nameplate, bars, controls, intro), `duel/render/` (canvas renderer), `duel/colors.js` |
| Chronicle | `src/ui/overlays/ChronicleSheet.jsx` | `overlays/chronicle/` |
| Council dossier | `src/ui/overlays/DossierSheet.jsx` | `overlays/dossier/` (Council, Factions, World tabs) |
| Settings, Saves | `src/ui/overlays/SettingsSheet.jsx`, `SavesSheet.jsx` | — |

Dev: `npm run dev` then `/?scenario=<name>` loads a real state built through the controller.
Names (see `src/game/dev/scenarios.js`): `war_room_t1, resolution_t1, march_road,
march_checkpoint, march_checkpoint_scout, march_wilds, march_ruin, march_champion, duel_pending,
champion_defeated, campfire, war_room_t3, resolution_t4_skirmish, resolution_t5_skaela,
passing_campfire, passing_chronicle, passing_legacies, cycle2_war_room`.

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
  slots, hasAnySave, startNewGame, loadSlot, saveSlot, removeSlot, exportSlot, importSlot,
  quitToTitle, toasts,
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
  { key: delta }, relationshipShifts: [{ character, from, to }]` (tier words), `factionShifts:
  [{ faction, from: { attitude, tension }, to }]` (label words such as "Hostile", "Uneasy", never
  numbers), `regionBefore, regionAfter, newMemories: [{ characterId, description, sentiment }],
  newChronicle: [entry] }`, `expedition` (the march that ended **this turn**, else null:
  `{ kind, title, duels, fallen: string[], log, retreated?, cycle, turn }`), `deployments:
  [{ kind, title, text, recommender, line, danger? }]`, `campfire` (offer or null),
  `isFinalTurn`.
- **expedition**: `expedition = { kind, title, beats, index, picked, phase: 'main'|'after_victory'|
  'after_defeat'|'after_retreat', lastResult: { beat, label, lines } | null, lastDuel: { outcome,
  enemyName, misreads, playerHpRemaining, attempt, fallen } | null, pendingDuel: config | null,
  fallen }`, `beat = { id, title, subtitle, scene: { beat, timeOfDay }, speaker?: { id, line },
  text: string[], choices: [{ id, kind: 'talk'|'advance'|'duel', label, hint?, warning?,
  effects, result }] }`, `canRetreat`. Never show a choice's `result` or `effects` before it is
  picked. When `pendingDuel` is set, render `<DuelScreen config={pendingDuel}
  showHints={settings.showHints} onComplete={(r) => act({ type: 'EXPEDITION_DUEL_COMPLETE',
  result: r })} />` instead of the beat (only one `<h1>` on screen).
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
`Screen({ backdrop, wide })`, `Shift({ label, from, to, good })`, `Toggle({ checked, onChange, label, id })`
(a `role="switch"` in `.switch`), `Segmented({ options, value, onChange, label })` (a radiogroup with
arrow keys, `.seg` / `.seg__opt`; `overlays/chronicle/Segmented.jsx` re-exports it), `signed(n)` (deltas
with a true minus sign, U+2212), `cx(...)`, `RESOURCE_META`,
`Icon({ name, size, label })` (names: treasury manpower readiness stability unrest intel chronicle
council saves settings close back forward sword crown fire map check alert quill scroll menu flag
heart sound mute download upload trash). `TopBar` (`src/ui/game/TopBar.jsx`) is the in-game header.

Theme classes (`src/styles/theme.css`): `.panel .panel--quiet .panel-parchment .btn-royal .btn-ghost
.btn-danger .btn-icon .order-card (.order-card__key/__body/__title/__desc/__meta, .order-card--danger,
.order-card--quiet, aria-pressed for selected) .chip--* .meter .gold-rule .plaque .text-gilded
.text-engraved .text-glow-gold .glow-gold .vignette .drop-cap .scroll-elvia .bg-war-room .chrome-bar
.topbar-nav .screen-veil .switch .seg .range-elvia .field`, and the nested-surface materials below;
tokens `navy-950…500, stone-*, parchment-50…500, ink-*, gold-200…800,
ember-*, crimson-*, lattice-*, iron-*, brass-*, frost-*, acid-*, moss-*`; fonts `font-display`
(Cinzel), `font-serif` (Cormorant Garamond), `font-body`.

**Surface ranking.** `.panel` is the hero surface (bevel, hairline, gilded corner caps): one per
screen. Panels that are direct children of a `.grid`, and `.panel--quiet`, drop the caps. Inside
sheets and panels use `.tablet` (raised card), `.tablet--stone` (dead or settled), `.well`
(recessed), `.well--lit` (earned or in effect) and `.well--stone`, never flat rgba boxes. Helpers:
`.label-engraved` (small kicker labels), `.coin` (struck gold numerals), `.socket` (an icon in a
brass socket), `.pip` / `.pip--on` (diamond progress). Council, Factions and World cards, the
Chronicler's Pen, save slots, monuments and Legacies in effect use them.

**Chrome.** `TopBar` icon buttons are 44 px on phones and 48 px from `sm` up, 6 px apart, with a
1 px focus offset (`.topbar-nav`); resource delta tabs straddle the plaque's top-right corner.
`.chrome-bar` is opaque on a brass rail with a 14 px fade under it; the War Room and Resolution
HUDs override it with an opaque gradient and no backdrop-filter. Sheets: the scrim is navy-950 at
80% with no blur. Saves shows exactly one gold button: "Save here" on the first empty slot during
a reign, "Load" on the newest save from the title. Dossier tabs share the `.seg` look and take an
optional `short` label for phones ("World"; the full label stays the accessible name), sit on an
opaque sticky row, and show crests at 88 px from `sm` up.

## Screens: what they look like

- **War Room**: the `WarRoomBackdrop` with its room layer. The crisis eyebrow is the season
  followed by five inline season diamonds (the diamonds carry the `aria-label`; "Turn n of 5"
  words show from `sm` up); the location is an engraved gold line; a `TitleRule` runs the full
  title width. The briefing's opening paragraph gets a `.drop-cap` when it is at least 150
  characters (`dropCapClass`). Royal orders do not use `.order-card`: they are dossier cards with
  a struck letter `Medallion` (48 px on phones, 58 px from `sm`), a category accent from
  `tones.js` (only the first category's short name on phones), a brass cost plate, and
  `aria-pressed` while their confirm sheet is open. Order and reaction portraits at small sizes
  render as head crops with a hairline. Voices put the quote glyph inside the card with an
  italic gold attribution.
- **Resolution**: a static gradient backdrop; the header is a hero view of the Marches at dusk (a
  still `RegionScene` whose beat follows the order's category) with the eyebrow, `h1` and
  `TitleRule` over its masked foot, full-bleed on phones and a card with gilt corners from `sm`
  up. New Chronicle entries sit on a `Manuscript` page.
- **Campfire**: an `h-dvh` column. The `CampfireScene` is the full-bleed hero behind everything,
  with its fire group in a clear band at the foot of the screen (`clamp(220px,30dvh,280px)`, 30dvh
  under 600 px tall) that words never cover. The talk scrolls above the band over scrims passed
  as the scene's `scrim` (dark where text sits, clear over the band; a further dimming layer fades
  in once the conversation or the short moment starts) and returns to the top on each view
  change. Answers are kit `.order-card`s with a tone plaque; quotes are typographic.
- **The Passing**: step I, the last fire, sits under the left column on `lg` screens (the
  backdrop hides its vignette for this step) and in a 248 px strip (300 px from `sm`, `lg:hidden`)
  inside the step on phones; farewells get smart quotes. The Chronicle step is an illuminated
  `Manuscript`. Legacy cards carry a `Medallion` with the Legacy's roman numeral; earned cards are
  warm parchment with a brass spine, unearned ones dimmed parchment with a wax "Not earned" stamp,
  the status chip under the name.
- **Duel HUD** (`duel/hud.jsx`): the foe's name card is drawn on the canvas in the sky band at the
  start, and the HUD nameplate fades in once `r.introShowing()` turns false. `FoePlate` never
  truncates the name (it steps down in size and may wrap); the epithet line still truncates.
  `FoePlate` and `Controls` are memoized. `Controls` is one CSS grid: on a phone the Sovereign's
  bar, then abilities and Royal, then Dodge / Guard / Dodge; from `lg` the controls split around
  the foe column, the bar centred under the foe, captions at 0.82rem. Bars are bevelled with
  quarter ticks, a warm damage chip and a lit leading edge; round controls share a brass `Medal`
  rim.

## Art (`src/ui/art/index.js`) and duel

`RegionScene({ beat, regionState, timeOfDay, season, monuments, label, animated, card })` (an
unlabelled scene is decorative and still unless `animated`), `WarRoomBackdrop({ threats: {
syndicate, wargs, refugees }, regionState, dim })`, `Portrait({ id, size, mood, label, ring })` (ids
mara vale cassian sparky mika nyra vex skaela sovereign chronicler), `FactionCrest({ id: 'iron_syndicate'
|'frost_wargs'|'elvia', size })`, `ArchitectSymbol({ size, glow, animated })`, `CampfireScene({
intensity, fireX, fireY, band, moon, zoom, variant, scrim })`, `Sigil`, `GoldDivider`, `PanelCorners`;
`LightRays` and `Motes` from `src/ui/art/Atmosphere.jsx`. Duel: `DuelScreen` from
`src/ui/duel/DuelScreen.jsx` (`{ config, onComplete(result), showHints? }`, full-screen, owns its
own music). `StageBackdrop({ stage, noSymbol })` (`src/ui/duel/StageBackdrop.jsx`) puts a living
duel stage behind a page: the title screen shows the broken-circle ruin at night, the training
yard its morning courtyard. Details: [ART_AND_AUDIO.md](ART_AND_AUDIO.md), [DUEL.md](DUEL.md).
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

Mobile-first at 390×844, then desktop. The War Room, Resolution and march headers stick to the top
as an opaque `.chrome-bar`, so the story scrolls cleanly under them (no `backdrop-filter`
over animated art: see the performance rules in [ART_AND_AUDIO.md](ART_AND_AUDIO.md#performance-and-accessibility)). Body ≥ 15px (`text-base` or larger, serif prose
`text-[1.18rem]`). Tap targets ≥ 48px. Every action reachable by keyboard (real `<button>`s,
visible focus). Headline per screen (`h1`), `aria-live="polite"` on results. Respect reduced
motion. Regal magitech: stone, brass, navy, gold light, ember — no neon/cyan. AAA-inspired
presentation: strong composition, layered depth, restrained animation, typographic hierarchy,
breathing room. Long text in readable measure (`max-w-prose`). Danger/irreversible actions use a
confirm `Sheet`.
