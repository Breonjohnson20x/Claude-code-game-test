# Duels: engine and screen reference

OmniStrat's real-time single combat. The pure, deterministic engine lives in
`src/game/duel/*`; the React/canvas screen that plays it lives in `src/ui/duel/*`. This doc covers
the design intent, the engine's model and fairness contract, every tunable number, the three
foes, the event stream, the post-duel analysis, the bots used in tests, the campaign wiring, and
the screen's controls.

**Contents:** [Intent](#design-intent) · [Model](#the-model) · [Config](#config) · [Input](#input) ·
[Answer rules](#answer-rules-the-fairness-contract) · [Player kit](#the-player-kit) · [TUNING](#tuning) ·
[Foes](#the-three-foes) · [Events](#the-event-stream) · [Telegraph](#gettelegraph) · [Result and misreads](#result-and-misreads) ·
[Bots](#bots-and-measured-results) · [Campaign wiring](#campaign-wiring) · [The screen](#the-duelscreen) ·
[Extending](#how-to-add-an-archetype-or-tune-difficulty) · [Porting](#porting-to-another-engine)

## Design intent

From the Cycle System Design Doc §6: *the Sovereign is controlled, not selected*. Duels are real
time with direct control and no menus: you time strikes, dodges and parries yourself and fire
Arc Pulse on your own read. Scope is deliberately small: one arena (a torch-lit stone circle), one
enemy family with three variants, three input methods, and a full kit. Defeat never ends the story
(except a last stand), and the success test is **"a first-time player loses the first duel, can
name why, wins the rematch"**, which is what the misread analysis exists for.

## The model

- **Pure and deterministic.** `stepDuel(duel, inputs, dtMs)` returns a *new* duel; the input is
  never mutated. Randomness comes from a seeded mulberry32 RNG (`src/game/core/rng.js`); there is
  no `Math.random` or `Date.now`. The same config and the same input script give an identical duel
  (a test checks this).
- **Fixed timestep.** Time advances in sub-steps of `STEP_MS` (1000/60 ms) through an accumulator,
  so any frame rate gives the same result. A single call's `dtMs` is clamped to 250 ms
  (`MAX_DT_MS`); the screen also clamps real frame time to 50 ms.
- **Events per call.** After each `stepDuel`, `duel.events` holds only that call's events.
- `createDuel(config)` builds the state; `isDuelOver(duel)` and `getDuelResult(duel)` end it.

Duel state (abridged): `{ config, archetypeId, def (the resolved archetype), legacy: { aegis,
wargTruce, marasOath, oathbreaker }, ward, tick, timeMs, phase: 'fight'|'over', outcome,
player: { hp, maxHp, stamina, maxStamina, guardHeld, guardPressedAt, guardLockoutMs, wardHeld,
wardBrokenMs, dodge: { active, side, elapsedMs, cooldownMs, iframeEndAt }, swingMs, swingDurMs,
swingDir, stunMs, combo, comboTier, arcCharge (0..1), royalUsed, royalWindowMs, buffer },
enemy: { hp, maxHp, poise, maxPoise, state ('idle'|'hesitate'|'windup'|'active'|'recovery'|'open'|'staggered'),
stateMs, stateDurMs, step, guardSide, … }, telegraph, stats, misreads, events }`.

## Config

What `createDuel` takes (and what the controller builds with `duelConfig` / `trialConfig`):

```js
{
  archetypeId: 'blade_adept' | 'warg_alpha' | 'fallen_champion',
  seed: number | string,
  title: 'Lieutenant Nyra Kell',            // shown as the foe's name
  subtitle: 'Ace of the Fourth Walker Lance',
  modifiers: {
    cycleNumber: 1,                          // scales the foe across reigns
    legacies: [],                            // the Sovereign's active Legacies
    companion: 'mara' | 'sparky' | null,     // who answers Royal Command
    champion: { name, epithet, mirror? },    // a named foe keeps this name in the result
    stakes: 'drill' | 'practice' | 'march' | 'champion' | 'last_stand',
  },
  allowRetreat: true,
  script: [{ move, dir? }],                  // optional fixed enemy pattern (tests, drills)
  opening: { speaker, text },                // optional opening line instead of the foe's own
  drill: { stat, target },                   // optional training goal (see "Training yard")
}
```

## Input

`stepDuel(duel, inputs)` accepts an array of input objects, applied before the time step:

| Input | Effect |
|---|---|
| `{ type: 'strike', dir: 'up'|'down'|'left'|'right' }` | Swing (unknown directions become `up`). Buffered for 180 ms if you are still committed. |
| `{ type: 'dodge', side: 'left'|'right' }` | Dodge with i-frames. Buffered like strikes. |
| `{ type: 'guard', down: true|false }` | Hold or release guard (parry). Pressing marks the press time for perfect parries. |
| `{ type: 'ward', down: true|false }` | Hold or release Shield Ward. |
| `{ type: 'arc' }` | Fire Arc Pulse if fully charged. |
| `{ type: 'royal' }` | Royal Command, once per duel. |
| `{ type: 'retreat' }` | Ends the duel as a retreat if `allowRetreat`. |

Striking the side the foe is guarding (`enemy.guardSide`, for foes with a stance) barely
scratches; strike the other side.

## Answer rules (the fairness contract)

Quoted from the top of `engine.js`, which is the source of truth. Every attack is a wind-up
(telegraph, progress 0→1) ending in one **impact**, then `active` follow-through, then `recovery`
(the punish window). `dir` is the side the blow comes **from**: `left`, `right`, `overhead`,
`thrust`.

- **Light / combo (steel-white glow).** *Parry*: guard held at impact (not mid-swing, stunned or
  dodging); **perfect parry** if pressed ≤ 200 ms before impact (more poise damage, more Arc
  charge, longer recoil). *Dodge*: i-frames active at impact and dodging **away** from the attack
  side (left → dodge right, right → dodge left; overhead and thrust: either side); dodging toward
  it is a `wrong_dodge`. *Ward*: blocks fully, costs stamina, earns nothing.
- **Heavy (red-gold glow, rising pulse, `heavy_warn`).** *Dodge only.* Guarding fails: full
  damage and a broken guard (`parried_heavy`). Ward reduces but does not negate it.
- **Feint (flickering glow).** The wind-up cancels before impact. Guarding during it is a **panic
  parry**: stamina drained, guard locked out for 650 ms, and a quick real follow-up you must
  dodge. Dodging a feint is `bit_feint`. The right answer is to hold still: the foe is then
  **open** (strikes land in full with a bonus), then throws a real light strike.
- **Greed.** An impact that lands while you are mid-swing hits you (`greedy_strike`); swinging
  into active follow-through gets you countered. Strikes land fully during recovery, stagger and
  feint openings; during idle they are mostly blocked, and pecking provokes a telegraphed riposte.
- **Poise.** Strikes and parries drain poise; at 0 the foe is **staggered** (a big punish window).
- Every wind-up is at least 420 ms, and follow-ups arrive after your own commitments end, so a
  perfect reader can answer everything with zero damage. The test suite proves it: for every
  archetype and Legacy variant, every (move, direction) pattern has a zero-damage answer.

## The player kit

- **Strike**: 300 ms commitment, 6 stamina, 5 damage and 7 poise (scaled by foe state, combo and
  the Royal window). Out of stamina, strikes are weak (×0.5).
- **Dodge**: 300 ms i-frames within a 380 ms dodge, 520 ms cooldown, 12 stamina.
- **Guard / parry**: costs 4 stamina per parry; perfect parries deal 14 poise.
- **Combo**: every 3 clean hits without taking damage raises the combo tier (+10% damage per tier,
  up to 3 tiers).
- **Arc Pulse** (you fire it): charges from clean hits (+7%), parries (+8%), perfect parries
  (+22%), dodges (+5%, +12% against heavies) and read feints (+6%). Deals 16 damage and 55 poise,
  gives 350 ms of i-frames and interrupts a wind-up for 1 s.
- **Royal Command** (once per duel): heals 18 (32 with Mara's Oath), refills stamina, clears stun,
  and opens a 6 s window of ×1.3 damage. Your companion answers: Sparky's acid also staggers the
  foe (15% poise and a 1 s interrupt); Mara or Cassian speak a line.
- **Shield Ward** (hold): drains stamina while held, blocks lights, softens heavies, and breaks
  when stamina runs out. With Aegis Mastery it drains half as fast and softens heavies more.

## TUNING

`TUNING` in `src/game/duel/engine.js` (frozen):

| Key | Value | Key | Value |
|---|---:|---|---:|
| PLAYER_MAX_HP | 100 | STAMINA_MAX | 100 |
| STAMINA_REGEN_PER_S | 26 | STAMINA_DELAY_MS | 450 |
| STRIKE_DMG | 5 | STRIKE_POISE | 7 |
| STRIKE_COMMIT_MS | 300 | WARD_STRIKE_COMMIT_MS | 420 |
| STRIKE_COST | 6 | WEAK_STRIKE_MULT | 0.5 |
| DODGE_IFRAMES_MS | 300 | DODGE_DURATION_MS | 380 |
| DODGE_COOLDOWN_MS | 520 | DODGE_COST | 12 |
| PERFECT_WINDOW_MS | 200 | PARRY_POISE | 7 |
| PERFECT_POISE | 14 | PARRY_COST | 4 |
| LATE_WINDOW_MS | 260 | EARLY_DODGE_WINDOW_MS | 380 |
| BUFFER_MS | 180 | HIT_STUN_MS | 240 |
| HEAVY_STUN_MS | 420 | GUARD_BREAK_STUN_MS | 460 |
| PANIC_STAMINA | 20 | GUARD_LOCKOUT_MS | 650 |
| PANIC_FOLLOW_WINDUP_MS | 520 | FEINT_OPEN_BONUS | 1.15 |
| GREED_COUNTER_MULT | 0.6 | ARC_DMG | 16 |
| ARC_POISE | 55 | ARC_IFRAMES_MS | 350 |
| ARC_INTERRUPT_MS | 1000 | ARC_GAIN_CLEAN_HIT | 0.07 |
| ARC_GAIN_PARRY | 0.08 | ARC_GAIN_PERFECT | 0.22 |
| ARC_GAIN_DODGE | 0.05 | ARC_GAIN_DODGE_HEAVY | 0.12 |
| ARC_GAIN_FEINT_READ | 0.06 | ROYAL_HEAL | 18 |
| ROYAL_HEAL_OATH | 32 | ROYAL_WINDOW_MS | 6000 |
| ROYAL_DMG_MULT | 1.3 | SPARKY_STAGGER_MS | 1000 |
| COMBO_PER_TIER | 3 | COMBO_TIER_BONUS | 0.1 |
| COMBO_MAX_TIER | 3 | POISE_REGEN_DELAY_MS | 2500 |
| STAGGER_DMG_MULT | 1.4 | | |

Shield Ward parameters (`WARD_BASE` / `WARD_AEGIS`): drain 12 / 6 per s, light cost 9 / 5, heavy
cost 22 / 12, heavy reduction 55% / 80%, broken for 900 / 700 ms. Strike multipliers by foe
state (`STRIKE_TABLE`): idle 0.35, idle on the guarded side 0.1, idle on the open side 0.6,
hesitating 0.8, winding up 0.25, recovery 1, open after a feint 1.15, staggered 1.4.

## The three foes

`ARCHETYPES` in `src/game/duel/archetypes.js`. All have a 3.2 s grace period before the first
attack. Stakes scale damage / health (`STAKES`): drill 0.6 / 4 (a drill ends on its goal, not a
kill), practice 0.75 / 0.85, march 1 / 1, champion 1.05 / 1.05, last stand 1.15 / 1.1. Reign scaling: +4% health and +3% damage per reign after the
first (capped), stronger for the Fallen Champion (+10% health, +6% damage, faster wind-ups).

| Foe | HP / poise | Style | Moves (wind-up ms, damage) |
|---|---|---|---|
| **Blade-Adept** (`blade_adept`), Syndicate duelist. "The duelist check." | 300 / 50 | Fast; guards one side while idle; feints. | slash light 640/9 (left, right, overhead); flurry combo ×3 620 then 440/7; feint 540 then a 470 follow-up; lunge heavy thrust 950/17 |
| **Warg Alpha** (`warg_alpha`), first of the Frost Wargs. "The patience check." | 240 / 110 | Slow, devastating; long recoveries. | rend heavy 1250/18 (left, right); pounce heavy overhead 1450/22; maul heavy ×2 1250 then 950/16; bite light 720/9 |
| **Fallen Champion** (`fallen_champion`), a crown of a cycle undone. "The story check." | 280 / 80 | Mirrors one of your Legacies: Aegis (warded guard, more poise), Warg (paired heavies), Shadow (feints). | royal cut light 680/10; cleave heavy 1150/20; spear thrust light 620/9; twin cut combo ×2 640 then 450/8 |

Legacy effects in duels: **Warg Truce** gives the Warg Alpha a hesitation window; **Oathbreaker's
Shadow** makes every foe hit 25% harder with shorter recoveries and slightly quicker wind-ups;
**Aegis Mastery** strengthens the ward; **Mara's Oath** strengthens Royal Command. Each foe's
`lesson` line is shown after the duel.

## The event stream

Each `stepDuel` call fills `duel.events` with:

| type | Fields | Examples |
|---|---|---|
| `sfx` | `name` | strike, hit, parry, perfect_parry, dodge, heavy_warn, telegraph, poise_break, arc_pulse, royal_command, ward, victory, defeat, hurt |
| `fx` | `name`, extras | hit, parry, perfect_parry, player_hit, guard_broken, guard_baited, poise_break, arc_pulse, arc_ready, royal_command, sparky_acid, ward_block, ward_broken, dodge_clean, feint_read, combo_up, interrupt |
| `line` | `speaker` (enemy, narrator, mara, sparky, cassian), `text` | opening taunts, hesitation, Royal Command answers (`src/game/duel/lines.js`) |
| `misread` | `kind`, `label` | the short in-fight callout |
| `damage` | `target` (player/enemy), `amount`, `clean?`, `heavy?`, `arc?` | |

Every event also carries `t` (duel time in ms).

## getTelegraph

`duel.telegraph` (or `getTelegraph(duel)`) is non-null during a wind-up:

```js
{ stepId, moveId, kind: 'light'|'combo'|'heavy'|'feint', dir, progress (0..1), windupMs,
  timeToImpactMs, isHeavy, isFeint, telegraphColor: 'steel'|'red_gold'|'flicker',
  comboIndex, comboTotal, followUp, panicFollow,
  answer: 'parry_or_dodge'|'dodge'|'wait', dodgeSides: ['left'|'right', …] }
```

`telegraphColorFor(kind)` and `correctDodgeSides(dir)` are exported for UIs.

## Result and misreads

`getDuelResult(duel)` (null until the duel is over):

```js
{ outcome: 'victory'|'defeat'|'retreat', archetypeId, durationMs, playerHpRemaining (0..1),
  flawless, cleanHits, perfectParries, maxCombo, poiseBreaks, panicParries, heavyHitsTaken,
  feintsBitten, usedRoyalCommand, usedArcPulse,
  misreads: [{ kind, count, advice }],          // most frequent first
  enemyName, enemyHpRemaining, parries, cleanDodges, damageTaken, stakes, mirroredLegacy,
  feintsRead, feintsPunished,                   // feints let pass / openings struck after them
  drill: { stat, target, value, met } | null }
```

Misread kinds (`MISREAD_INFO` in `src/game/duel/analysis.js`): `parried_heavy`, `panic_parry`,
`bit_feint`, `greedy_strike`, `wrong_dodge`, `early_dodge`, `late_guard`, `late_dodge`,
`no_response`, `warded_heavy`, `ward_broken`. Each has a short in-fight `label`, a `title` and a
kind `advice(count)` sentence. `summarizeDuel(result, def)` builds the result card: a title
(Victory, Flawless Victory, Withdrawn, Retreated), a line, up to four tips (always at least one
after a defeat: "it simply outlasted you" when nothing was misread), and the foe's lesson.

## Bots and measured results

`src/game/duel/bots.js`:

- `createOracleBot({ mode: 'parry'|'dodge'|'mixed', strike, arc, royal, royalBelowHp })` reads only
  what the screen shows (the telegraph and visible foe state) and answers perfectly: guard 120 ms
  before impact, dodge 150 ms before. It proves a skilled human can always win.
- `createGuardSpamBot()` holds guard forever: the classic newcomer mistake, used to lose on purpose.
- `simulateDuel(config, bot, { maxMs, collect, onStep })` → `{ duel, events }`.

Measured with seed 42 at `march` stakes (`node` + `simulateDuel`):

| Foe | Oracle (parry) | Oracle (dodge) | Guard-spam | Idle |
|---|---|---|---|---|
| Blade-Adept | win, 16.5 s, full health | win, 28.0 s, full health | loss in 50.6 s: panic_parry ×6, no_response ×6, parried_heavy ×3 | loss in 27.0 s: no_response ×11 |
| Warg Alpha | win, 20.2 s, full health | win, 28.0 s, full health | loss in 28.4 s: parried_heavy ×6 | loss in 20.8 s: no_response ×7 |
| Fallen Champion | win, 16.2 s, full health | win, 30.0 s, full health | loss in 62.7 s: panic_parry ×4, no_response ×4, parried_heavy ×3 | loss in 23.4 s: no_response ×11 |

`src/game/duel/engine.test.js` (49 tests) covers determinism, outcomes per archetype and Legacy,
misread detection, telegraph shape, specials, and the full fairness sweep.

## Campaign wiring

- **March and deployments**: `duelConfig(state, exp, beat, archetypeId, champion, stakes,
  allowRetreat)` in `src/game/content/expedition.js` builds configs for the wilds (warg alpha),
  Greywater Ford (Nyra, champion stakes), the skirmish and the last stand (no retreat).
  `EXPEDITION_DUEL_COMPLETE` applies `duelOutcomeEffects`: a win gives readiness +2 (+4 for a
  champion), Mara respect, and a memory (flawless: a little more); a loss costs stability −1
  (−2 for a champion) and records it; champion and skirmish fights cost lives (`casualtiesFor`:
  1–5, fewer when the Marches are FORTIFIED). After a defeat the beat offers a rematch.
  A lost **last stand** is a fall: the reign ends and the Passing begins.
- **Trial of Blades**: `trialConfig(state, archetypeId)` (practice stakes, retreat allowed,
  Mara as companion) and `TRIAL_COMPLETE` (rewards once per turn; see [GAME_GUIDE.md](GAME_GUIDE.md)).
- **Training yard** (title screen, outside any reign): see below. Never touches GameState.

## Training yard

`src/game/duel/drills.js` holds the yard's content; `src/ui/screens/TrainingScreen.jsx` runs it.

- **Drills** (`DRILLS`, `drillConfig(id, seed)`): a fixed move cycle (`script`) from one of the
  yard's partners (`YARD_FOES`: Sword-Master Ilvane and Greymane, shared with the Trial of
  Blades), Mara's opening line, `drill` stakes, and a goal the engine counts. When the goal is
  met the duel ends in victory. Goals (`DRILL_STATS` in `engine.js`): `turned_aside` (parries +
  clean dodges), `dodges`, `perfect_parries`, `feints_read`, `feints_punished` (first clean strike
  into each feint's opening), `poise_breaks`. `drillProgress(duel)` gives `{ stat, target, value,
  met }` for the HUD.

  | Drill | Teaches | Partner and pattern | Goal |
  |---|---|---|---|
  | Steel light | parry or dodge | Ilvane: slash left, right, overhead, flurry | turn aside 6 |
  | Red-gold glow | dodge, never parry | Greymane: rend left, right, pounce, maul | dodge 4 |
  | The flicker | wait, then punish | Ilvane: feints between slashes | strike 3 feint openings |
  | Break the guard | parry, then punish | Ilvane: slash, flurry, slash, lunge | stagger once |

  `drills.test.js` proves the oracle bot passes every drill (6–23 s at full health), standing
  idle passes none, and holding guard into everything fails the red-gold and flicker drills
  (holding guard *is* a fair answer to steel light).
- **Sparring** (`SPARRING`, `sparringConfig(archetypeId, seed, { mirror })`): the three real foes
  at practice stakes; the Fallen Champion's mirrored Legacy can be picked.
- The yard's progress (drills passed, bouts won) is a per-device convenience in localStorage
  (`elvia.training.v1`, `src/ui/screens/training/records.js`), not game state.

## The DuelScreen

`src/ui/duel/DuelScreen.jsx` (`<DuelScreen config onComplete showHints? />`) and
`src/ui/duel/draw.js` (canvas drawing).

- Full-viewport canvas (DPR capped at 2, resize-aware) driven by `requestAnimationFrame`:
  real frame time is clamped to 50 ms and fed to `stepDuel`; the loop pauses when the tab is
  hidden or while the withdraw confirmation is open. The HUD re-renders about 10 times a second.
- **Intro**: a "Read the wind-up" card with controls for touch or keyboard/mouse (auto-detected).
  The fight stays paused until Ready, the first input, or 6 seconds. The `showHints` setting
  turns the card off.
- **Controls**:

  | Action | Touch / mouse | Keyboard | Gamepad |
  |---|---|---|---|
  | Strike | swipe / drag (≥ 30 px) | Arrow keys (W = up) | left stick flick |
  | Dodge | tap the left or right 22% edge strip | A / D | LB / RB |
  | Guard / parry | hold the blade (bottom right) or the "Hold to guard" bar | hold Space or S | hold A |
  | Arc Pulse | tap the sigil when it glows | E | Y |
  | Royal Command | tap the crown | R | X |
  | Shield Ward | hold the shield button | hold Shift | hold RT |
  | Withdraw | the Withdraw button (with confirm) | Esc (with confirm) | — |

- **Feedback**: telegraph arcs and chevrons by colour with a label ("Dodge", "Parry or dodge",
  "Feint: wait"), sparks, flashes, rings, screen shake (off under reduced motion), captions for
  `line` events, misread callouts, haptics on hits and parries, and audio cues from `sfx` events
  (`audio.ambient('duel')` on mount). An assertive live region announces each wind-up in words
  ("Heavy from the left: dodge right.") for screen-reader users.
- **Result**: Victory / Flawless Victory / Withdrawn / Retreated, four stats, "What you misread"
  (or "Sharpen next time"), the foe's lesson, and Continue → `onComplete(result)`. Defeat copy says
  it is not the end, except in a last stand.
- **Dev hook**: in dev builds, `window.__elviaDuel.current` is the live duel (read-only). The e2e
  playthrough uses it to play duels with real key presses.

## How to add an archetype or tune difficulty

1. Add the definition to `ARCHETYPES` (`id, name, epithet, check, lesson, rig, maxHp, maxPoise,
   staggerMs, poiseRegen, idleMs, graceMs, stance, wardGuard, armor, riposte, moves`). Keep every
   wind-up ≥ 420 ms and follow-ups after the player's commitments, or the fairness tests fail.
2. Add it to `ARCHETYPE_IDS`, opening lines in `lines.js`, a silhouette in `src/ui/duel/draw.js`
   (`drawEnemy`), and a Trial foe or a march beat that uses it.
3. Run `npx vitest run src/game/duel`: the oracle must still win, idle must lose, every pattern
   must have a zero-damage answer.
4. Tune with `TUNING`, the move timings, and `STAKES`. Re-measure with `simulateDuel` and update
   the table above. Then play it: `npm run dev` → War Room → Trial of Blades.

## Porting to another engine

The engine is engine-agnostic by design (the Cycle doc's plan: browser now, Unreal later). Port
`engine.js`, `archetypes.js`, `analysis.js` and `lines.js` as a fixed 60 Hz tick with the same
state machine (idle → windup → active → recovery / open / staggered), the same input semantics
and the same answer rules. Keep the RNG (mulberry32) and the tests: replay the input scripts from
`engine.test.js` and compare results to prove the port is identical. Rendering, input mapping and
feel (hit-stop, camera) are the new engine's job; the rules should not change.
