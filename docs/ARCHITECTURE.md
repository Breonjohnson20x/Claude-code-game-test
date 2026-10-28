# OmniStrategy: Empire of Elvia — Browser Vertical Slice Architecture

Source of truth: the three design docs (Master Build Prompt, Narrative & Living-World Bible,
Cycle System Design Doc). This is the **browser prototype** the Cycle doc calls for
("Now: systems + text in the browser demo… Later: same rules port to Unreal").

## Non-negotiable rules (from the docs)

1. **The simulation owns truth** (§19). `GameState` is a plain JSON object. Nothing writes to it
   except `applyEffects()` in `src/game/core/effects.js`, and only after `validateEffects()`.
2. **The game works with zero AI** (§18, §28). Every generator has an authored, deterministic
   fallback. The optional Claude narrator only *requests* low-stakes effects (`source: 'ai'`).
3. **Determinism.** No `Math.random()` in game logic. Use `src/game/core/rng.js` with
   `state.rngSeed`. Same state + same input ⇒ same result.
4. **Pure transitions.** Game logic functions are `(state, input) => newState`. No React, no DOM,
   no storage inside `src/game/**` except `src/game/save/**` (storage adapter) and `src/game/ai/**`
   (network client).
5. **Mobile-first, keyboard-complete.** Every interaction works by touch; every interaction also
   has a keyboard path. Never bury important info in tiny text (§37): min body text 15px on mobile.
6. **Visual target** (§7, §35): *regal magitech* — stone, brass, deep navy, warm gold light,
   arcane geometry, ember. **Avoid generic cyberpunk neon.** No scanlines, no cyan glow.

## Directory layout

```
src/
  game/                 pure, deterministic game logic (no React, no DOM)
    core/               state.js · rng.js · effects.js · relationships.js
    sim/                resolver.js · orderParser.js · intensity.js · threads.js
    content/            crises.js · expedition.js · campfire.js · legacies.js · names.js · effectHelpers.js
    cycle/              passing.js (the Passing and the Return)
    duel/               engine.js · archetypes.js · analysis.js · lines.js · bots.js
    save/               saveSystem.js · storage.js · migrate.js · dynasty.js
    ai/                 client.js · generators.js · prompts.js · schemas.js · cache.js · status.js
    dev/                scenarios.js (dev-only states built through the controller)
    actions.js          the controller: dispatch(state, action), getView(state)
    *.test.js           vitest, next to the code
  ui/
    game/               GameProvider (useGame) · TopBar · settings.js
    kit/                kit.jsx (buttons, panels, sheets, meters, HUD) · icons.jsx
    screens/            Title · WarRoom · Resolution · Expedition · Campfire · Passing (+ helper folders)
    overlays/           Settings · Saves · Chronicle · Dossier (+ helper folders)
    duel/               DuelScreen.jsx · hud.jsx · render/ (stages, foes, telegraph, player, fx)
    dev/                DuelLab.jsx (dev-only duel lab, /?lab=duel)
    art/                RegionScene · WarRoomBackdrop · CampfireScene · Portrait · FactionCrest · ArchitectSymbol · Ornaments · scene/
    audio/              audio.js (Web Audio engine + haptics)
    pwa.js              service worker registration and the install prompt (useInstallState)
  styles/theme.css      Tailwind v4 tokens and component classes
scripts/                e2e.mjs · e2e-play.mjs · context-bundle.mjs · gen-content-doc.mjs
  pwa/                  plugin.mjs (Vite plugin: manifest, icons, sw.js) · icon.mjs · sw.js (template)
.github/workflows/      ci.yml (test, lint, build) · pages.yml (deploy main to GitHub Pages)
docs/                   HANDOFF · DESIGN_DIGEST · GAME_GUIDE · CONTENT · API · DUEL · SAVES_AND_AI · UI · ART_AND_AUDIO · TESTING
```

Full references: [API.md](API.md) (game layer), [UI.md](UI.md) (screens), [DUEL.md](DUEL.md),
[SAVES_AND_AI.md](SAVES_AND_AI.md), [ART_AND_AUDIO.md](ART_AND_AUDIO.md), [TESTING.md](TESTING.md).
The contracts below are the short versions.

## GameState (see `src/game/core/state.js` for the factory)

Top-level keys: `version, campaignId, rngSeed, phase, cycle{number, sovereign{name,ordinal,title},
startYear, activeLegacies[], cause}, year, turn (1..5 within a cycle), totalTurns,
resources{treasury, manpower, readiness, stability, unrest, intel}, factions{iron_syndicate,
frost_wargs}, characters{mara, vale, cassian, sparky, mika, nyra}, memories[], flags{}, counters{},
threads{…}, regions{southern_marches}, intensity (0–100, hidden), campfire{cooldown, history[],
offer}, chronicle[], decisions[], voices[], expedition, trial, lastResolution, history[]`.

`phase` ∈ `war_room | resolution | expedition | campfire | passing`.

## Effects (the only way to change state)

See the header comment of `src/game/core/effects.js`. `validateEffects(effects, state,
{source:'sim'|'ai'}) → {valid, rejected, repaired}`; `applyEffects(state, valid) → newState`.
AI-sourced effects are restricted to `resource | relationship | faction | memory | intensity | voice`
with tight magnitude caps.

---

## Contract: Duel

Full reference: [DUEL.md](DUEL.md).

Real-time, direct-control, Infinity-Blade-inspired single combat (Cycle doc §6, §10).
**No menus in combat.** Touch: swipe = strike (4 directions), tap left/right edge = dodge,
hold on the blade = guard/parry, tap charged sigil = Arc Pulse, tap crown = Royal Command
(once per duel), hold ward button = Shield Ward. Keyboard: Arrow keys = strike direction,
A / D = dodge left / right, hold Space (or S) = guard, E = Arc Pulse, R = Royal Command,
hold Shift = Shield Ward. Mouse: drag = strike, click near left/right edge = dodge, hold on blade
= guard. Gamepad (basic): left stick flick = strike, LB/RB = dodge, A held = guard,
Y = Arc Pulse, X = Royal Command, RT held = ward.

```js
// src/game/duel/engine.js — pure + deterministic (fixed timestep)
createDuel(config) → duel            // config below
stepDuel(duel, inputs, dtMs) → duel  // inputs: array of DuelInput
getDuelResult(duel) → null | DuelResult
// DuelInput: {type:'strike', dir:'up'|'down'|'left'|'right'} | {type:'dodge', side:'left'|'right'}
//          | {type:'guard', down:boolean} | {type:'ward', down:boolean} | {type:'arc'} | {type:'royal'}
//          | {type:'retreat'}
```

`config = { archetypeId: 'blade_adept'|'warg_alpha'|'fallen_champion', seed, title, subtitle,
modifiers: { cycleNumber, legacies: string[], companion: 'mara'|'sparky'|null,
champion?: {name, epithet}, stakes?: 'practice'|'march'|'champion'|'last_stand' },
allowRetreat: boolean }`

Legacy hooks inside the duel: `aegis_mastery` → Shield Ward starts stronger; `warg_truce` →
Warg Alpha opens with a hesitation window; `maras_oath` → Royal Command heals more and Mara's line
plays; `oathbreakers_shadow` → enemies punish harder (high risk). Fallen Champion uses one of the
player's own legacies against them (cycle-scaled).

`DuelResult = { outcome:'victory'|'defeat'|'retreat', archetypeId, durationMs,
playerHpRemaining (0..1), flawless, cleanHits, perfectParries, maxCombo, poiseBreaks,
panicParries, heavyHitsTaken, feintsBitten, usedRoyalCommand, usedArcPulse,
misreads: [{kind, count, advice}] }` — `misreads` lets a first-time player **name why they lost**
(Cycle doc success test). Defeat is never game over; the campaign records it.

```jsx
// src/ui/duel/DuelScreen.jsx
<DuelScreen config={config} onComplete={(result) => …} showHints={settings.showHints} />
```

Fairness rule: every enemy attack is answerable by movement or timing, telegraphed by
direction-readable wind-ups (shoulder drop, blade glow, paw scrape). Heavy = must dodge (red-gold
glow). Light = parry or dodge. Feint = punishes panic parry.

## Contract: Save + AI seam

```js
// src/game/save/saveSystem.js
createSaveSystem({ storage? }) → {
  listSlots() → [{ slot:'auto'|1|2|3, summary|null }]
  save(slot, state) → summary            // manual slots 1..3
  autosave(state, reason) → summary      // reason: 'before_resolution'|'after_resolution'|'after_campfire'|'cycle_start'|'expedition'
  load(slot) → state                     // validated + migrated + merged with dynasty meta
  remove(slot)
  hasAnySave() → boolean
  loadMeta() → meta ; commitDynasty(state) → meta   // called at the Passing
  exportSave(slot) → string ; importSave(slot, json) → summary
}
```

Dynasty meta (Cycle doc §8 "Save rule"): stored **above** save slots. Holds the cross-cycle
chronicle, civilization memory per faction, completed-cycle summaries and legacies taken.
**Loading an older save does not roll back earned civilization memory or dynasty chronicle.**

```js
// src/game/ai/generators.js — every generator: async (context, fallback?) => { ok, output, source:'ai'|'cache'|'fallback', proposals, rejected }
createGenerators({ getSettings }) → { narrative, campfire, dialogue, diplomacy, character, event, chronicle, orderInterpreter }
```
Pipeline per call: compact structured context → Claude (optional) → JSON validate → repair →
retry once → deterministic fallback. Proposed effects go through
`validateEffects(..., {source:'ai'})`. Cost control (§29): calls only at meaningful moments
(custom orders, campfires, Passing chronicle read-back), cached by context hash, session budget.

## Contract: Art + Audio

```jsx
<RegionScene beat="road|checkpoint|wilds|ruin|champion|camp" regionState="STABLE|FORTIFIED|AFTERMATH"
             timeOfDay="day|dusk|night" monuments={[]} className />
<WarRoomBackdrop threats={{ syndicate:0..100, wargs:0..100, refugees:0..100 }} regionState />
<Portrait id="mara|vale|cassian|sparky|mika|nyra|vex|skaela|sovereign|chronicler" size={64} mood? />
<FactionCrest id="iron_syndicate|frost_wargs|elvia" size />
<ArchitectSymbol size glow animated />
<CampfireScene intensity={0..1} />   // animated fire, night camp
```

```js
// src/ui/audio/audio.js
audio.unlock()                       // call on first user gesture
audio.setMuted(bool); audio.setVolume(0..1)
audio.ambient(theme)                 // 'title'|'war_room'|'march'|'duel'|'campfire'|'passing'|null
audio.sfx(name)                      // 'click','confirm','order','turn','chronicle','symbol','strike',
                                     // 'hit','parry','perfect_parry','dodge','heavy_warn','telegraph',
                                     // 'poise_break','arc_pulse','royal_command','ward','victory',
                                     // 'defeat','hurt','fire','page','legacy','passing'
haptic(pattern)                      // navigator.vibrate wrapper, respects settings
```
Warm, regal, procedural (Web Audio, zero assets): low strings-like drones, bells, brass-ish
stabs, crackling fire — not sci-fi beeps.
