# Game guide: how OmniStrat plays, as built

How the systems behave in code: the loop, every rule that moves a number, and where each
balance knob lives. This doc is for designers and developers. For the story content itself
(every order, beat, scene) see [CONTENT.md](CONTENT.md). For the original design intent see
[DESIGN_DIGEST.md](DESIGN_DIGEST.md). For exact function signatures see [API.md](API.md).

**Contents:** [The loop](#the-loop) · [A reign](#a-reign) · [Resources](#resources) ·
[Relationships and memory](#relationships-memories-and-voices) · [Factions](#factions-and-civilization-memory) ·
[World threads](#world-threads) · [Region state](#region-state) · [Turn resolution](#how-a-turn-resolves) ·
[Custom decrees](#custom-decrees) · [Deployments and the march](#deployments-and-the-march) ·
[Duels](#duels) · [Trial of Blades](#the-trial-of-blades) · [NarrativeIntensity and campfires](#narrativeintensity-and-campfires) ·
[The Chronicle](#the-chronicle) · [The Passing](#the-passing) · [Legacies](#legacies) · [The Return](#the-return) ·
[Determinism and AI](#determinism-saves-and-the-optional-narrator) · [Balance knobs](#balance-knobs)

## The loop

```
          ┌──────────────── next turn (CONTINUE) ──────────────────┐
          ▼                                                        │
     war_room ── ISSUE_ORDER / ISSUE_CUSTOM_ORDER ──▶ resolution ──┤
       │  ▲                                            │  │  │      │
       │  └ TRIAL_START / TRIAL_COMPLETE (same turn)   │  │  └ START_CAMPFIRE ─▶ campfire ─▶ resolution
       │                                               │  └ BEGIN_DEPLOYMENT ─▶ expedition ─▶ (campfire) ─▶ resolution
       └ ABDICATE ──────────────────┐                  └ CONTINUE after turn 5, ABDICATE, or a fall
                                    ▼                                  │
                                 passing: campfire → chronicle → legacies → mantle ── BEGIN_NEXT_CYCLE ──▶ war_room (reign + 1)
```

Phases are `war_room`, `resolution`, `expedition`, `campfire` and `passing` (`PHASES` in
`src/game/core/state.js`). Every transition is an action handled by `dispatch(state, action)` in
`src/game/actions.js`; actions sent in the wrong phase return an error and change nothing.

## A reign

- **Five turns** (`TURNS_PER_CYCLE = 5`). Seasons cycle Spring, Summer, Autumn, Winter; turn 5 is
  Spring again, so the year advances by one when the season wraps (`endTurn`). Reign I starts in
  Spring 412 E.R. under the name you choose (default "Aurelian").
- **Each turn** you choose one order (A–E) or write a custom decree. The turn resolves, then you
  may deploy (march, skirmish or last stand), sit at a campfire if one is offered, and continue.
- **A reign ends** in one of three ways (`CYCLE_CAUSES`): **era** (Continue after turn 5),
  **fall** (the Sovereign falls in a last stand), or **abdication** (the Abdicate action, from the
  War Room or a Resolution). All three lead to the Passing; none is a game over.
- On turn 5, if the border is under **siege** and you did not ride out to the last stand, the
  walls hold without you: 12 casualties, the Marches fall to AFTERMATH, stability −5, Mara's
  respect −4, and a Chronicle entry says the Sovereign watched from the Citadel.

## Resources

`state.resources` (bounds in `RESOURCE_BOUNDS`, `src/game/core/state.js`):

| Key | Start | Range | Meaning and rules |
|---|---:|---|---|
| `treasury` | 1,400 | 0–99,999 | Pays order costs. Below 300 at the military step: readiness −3 ("garrisons went unpaid"). Below 150: "the treasury runs dry" event (stability −3, readiness −3). |
| `manpower` | 4,200 | 0–99,999 | Pays order costs; casualties come from the region, not from here. |
| `readiness` | 52 | 0–100 | How ready the army is. Raised by military orders, Trial wins, Mara's Oath. |
| `stability` | 61 | 0–100 | Faith in the Crown. Drives income. Below 40: unrest +3 each turn; above 70: unrest −2. |
| `unrest` | 22 | 0–100 | Anger in the streets (lower is better). Above 60: stability −2 per turn. At 65+: bread riots (once per reign). |
| `intel` | 15 | 0–100 | Cassian's reach. Tracked but not on the HUD (`HUD_KEYS` omits it). |

**Income** every turn (`passiveEconomy` in `src/game/sim/resolver.js`):
treasury `+max(60, 180 + 3×stability − 2×unrest)`, manpower `+max(40, 90 + 1.2×stability)`.

**Costs and underfunding.** An order's cost is paid at the `CALCULATE_COST` step. If you cannot
pay in full, the order still happens: its numeric effects scale by `max(0.4, affordable ratio)`,
structural effects (flags, region changes, Chronicle entries) only survive if the ratio is ≥ 0.5,
and the outcome adds "The order went out underfunded." (`scaleEffects`). The UI marks such orders
"Underfunded" before you choose.

## Relationships, memories and voices

Each character has five hidden numbers in `rel`: `trust`, `respect`, `affection` (−100…100) and
`resentment`, `fear` (0…100). The player never sees them; the UI shows a **tier word** from
`relationshipLabel` (`src/game/core/relationships.js`), checked in this order:

| Tier | Rule |
|---|---|
| Hostile | resentment ≥ 55 and resentment > trust |
| Close | trust ≥ 60 and affection ≥ 40 |
| Trusted | trust ≥ 55 |
| Fond | affection ≥ 40 |
| Respected | respect ≥ 45 |
| Wary | fear ≥ 50, or trust < −20, or resentment ≥ 30 |
| Cordial | trust ≥ 20 or affection ≥ 20 or respect ≥ 30 |
| Cautious | otherwise |

`TIERS` orders them for comparisons (`atLeast(rel, 'Trusted')`). `relationshipNotes(rel)` gives
phrases such as "relies on your word" or "carries a grievance" for the dossier.

**Memories** (`state.memories`) record what a character will not forget: `{ characterId, eventId,
description, sentiment (−1…1), emotionalWeight, cycle, turn, year, type }`. Inherited memories
(`type: 'inherited'`) are how heirs and descendants carry an opinion into the next reign.
**Voices** (`state.voices`) are quotes from ordinary people, shown on the Resolution screen.

Characters: `mara`, `vale`, `cassian`, `sparky` (active from the start), and `mika`, `nyra`
(status `unmet` until the march). `companion: true` marks who travels with you (Mara, Sparky).

## Factions and civilization memory

`state.factions` holds `iron_syndicate` (Chancellor Adrian Vex) and `frost_wargs` (Warg Queen
Skaela), each with:

- **attitude** (−100…100) → `attitudeLabel`: Allied ≥ 50, Warm ≥ 20, Guarded ≥ −10, Hostile ≥ −45,
  else Implacable. Starts Hostile (−20 and −35).
- **tension** (0…100) → `tensionLabel`: War footing ≥ 80, Escalating ≥ 60, Uneasy ≥ 35, else Calm.
  An active border or migration thread you ignore this turn adds +4 (Syndicate) / +3 (Wargs).
  At Syndicate tension ≥ 90 a border incident fires (3 casualties, readiness −4), once per reign.
- **memory** `{ liberator, conqueror, oathbreaker, peacemaker }` → `civilizationLabel`: the highest
  key if it is ≥ 10, else **Unwritten**. Labels: Liberator ("you freed people and left"),
  Conqueror ("you took and stayed"), Oathbreaker ("you swore and broke"), Peacemaker ("you ended
  wars by deal"). Civilization memory **never decays** and carries into every reign.

The Syndicate's turn-5 **border outcome** (`borderOutcome` in `src/game/content/crises.js`):
`siege` if tension ≥ 80 and the turn-4 skirmish was not won; `peace` if tension ≤ 40, or a winter
summit, a recalled lance, or a sworn and unbroken Accord; otherwise `armed`.

## World threads

`state.threads` (`src/game/sim/threads.js`): `IRON_SYNDICATE_BORDER_CRISIS`,
`FROST_WARG_MIGRATION`, `NORTHERN_REFUGEES` and the hidden, generational
`FIRST_ARCHITECTS_MYSTERY` ("A Broken Circle"). Each has `status` (active / dormant / resolved),
`visibility` (hidden / rumored / known; the UI shows only non-hidden threads), `urgency`
(0…100) and `stage`.

Threads your order addresses move by the order's effects. Active threads you ignore gain urgency
each turn (border +8, migration +6, refugees +5, mystery 0). At urgency ≥ 85 an ignored thread
**boils over** into a world event: a border raid or probe (worse if the Marches are not
FORTIFIED), an emptied northern village (the migration becomes known), or overflowing refugee
camps.

## Region state

The Southern Marches (`state.regions.southern_marches`) are **STABLE**, **FORTIFIED** or
**AFTERMATH**, with `casualties`, `damage` and `monuments`. Orders, duel defeats, sieges and
skirmishes change it. The state changes the art (civilian life / barricades and ward lines /
smoke and broken carts) and some march text. Monuments (the Treaty Stone, a cairn where a
Sovereign fell) persist across reigns.

## How a turn resolves

`resolveTurn(state, order)` in `src/game/sim/resolver.js` runs a fixed pipeline (`PIPELINE`):

1. **VALIDATE**: the order's effects (plus any seeded roll) go through `validateEffects`.
2. **CALCULATE_COST**: pay, or scale the effects for underfunding.
3. **UPDATE_ECONOMY**: income, then the order's economy effects.
4. **UPDATE_MILITARY**: unpaid garrisons, Mara's Oath readiness, then military effects.
5. **UPDATE_DIPLOMACY / INTELLIGENCE / CHARACTERS**: the matching effects.
6. **UPDATE_FACTIONS**: order effects, then tension drift for ignored factions.
7. **ADVANCE_WORLD_THREADS**: order effects, then passive urgency and boil-overs.
8. **DETERMINE_EVENTS**: threshold events (riots, border incident, an empty treasury).
9. **UPDATE_NARRATIVE_INTENSITY**: order effects; a quiet turn (no events, no big intensity
   jumps) settles intensity by −6 (or −10 when it is above 70).
10. **UPDATE_CHRONICLE**: entries, voices, and a `decisions` log record.
11. **SAVE / PRESENT_RESULT**: the controller autosaves (`before_resolution`, `after_resolution`)
    and the report becomes `state.lastResolution`, which the Resolution screen renders.

The report lists outcome lines, voices, events, resource deltas, relationship and faction shifts
(as words), the region before and after, new memories and new Chronicle entries.

## Custom decrees

"The player is never restricted to A–E" (Master Build §18). `parseOrder(text)`
(`src/game/sim/orderParser.js`) finds up to two **actions** in plain words, each
`{ category, target, covert, weight }` across the five categories (diplomacy, military,
clandestine, research, economic). `buildCustomOrder(crisis, interpretation, text)` blends the
current crisis's order of each category at the action's weight (costs too), adds a "Royal
Decree" Chronicle entry, and resolves it like any order. With the narrator on, Claude may read the
decree instead (`generators.orderInterpreter`); its output is normalised to the same action shape,
with weights capped, so it can never do more than the parser could. Text the parser cannot place
is refused with an explanation and nothing happens.

## Deployments and the march

After resolving a turn, `deploymentOffers(state)` (`src/game/content/expedition.js`) may offer:

| Kind | Beats | When |
|---|---|---|
| `march` ("Walk the Southern Marches") | road → checkpoint → wilds → ruin → champion → camp | turns 1–4, until done this reign |
| `skirmish` ("Ride to Greywater") | skirmish → camp | turn 4 |
| `last_stand` | last stand → camp | turn 5, only if the border outcome is `siege` (a loss is a **fall**) |

Each beat (`getBeat(state)`) has text that varies with region state and flags, an optional
speaker, and choices of three kinds: **talk** (stays on the beat; each can be taken once),
**advance** (moves on) and **duel** (starts a duel). The march meets Mika at the checkpoint
(walking her family through sets `mika_family`), the warg alpha in the wilds (mercy counts toward
Warg Truce), the broken-circle ruin (studying it sets `architect_studied`), and Nyra Kell at
Greywater Ford (sparing, releasing or recruiting her sets `nyra_fate`).

**Up to four duels per march**, as the Cycle doc asks ("each duel must teach, test, or tell"):

| Beat | Duel | Optional? | Teaches / tests / tells |
|---|---|---|---|
| Checkpoint | The Man in the Grey Coat (Blade-Adept, march stakes) | yes: ignore him, or with intel ≥ 35 let Cassian's watchers take him quietly | teaches the Blade-Adept's feints before the ford tests them |
| Wilds | The warg alpha Rimefang (Warg Alpha) | yes: leave the meat, or let Sparky stand | the patience check; mercy counts toward Warg Truce |
| Ruin | An Echo in a Crown (Fallen Champion), after studying the symbol | yes | tells: the Lattice remembers sovereigns |
| Greywater Ford | Nyra Kell or Captain Ostrava (Blade-Adept, champion stakes) | no; a defeat offers a rematch | tests the duelist check |

The checkpoint scout (`checkpointScout(exp)`: `caught`, `taken`, `escaped` or none) changes the
ford: a caught scout's map means the lance is not expecting you; Cassian's quiet arrest leaves it
nervous; an escaped scout warned them ("Our pathfinder said you'd come by moonrise").
Searching a caught scout gives intel +6 and Mika remembers watching the fight.

**Duels on the march** produce `duelOutcomeEffects`: a victory raises readiness and Mara's
respect and writes a memory; a defeat costs stability and records the loss; a retreat counts.
Champion and skirmish fights can cost lives (`casualtiesFor`: fewer when the Marches are
FORTIFIED); the fallen are named (`fallenList`) and read at the camp and in the Chronicle.
**After a defeat** the beat offers a rematch or a withdrawal: the Cycle doc's success test is
"lose the first duel, name why, win the rematch". You may **retreat** from a march at any main
beat before the camp; it is recorded ("The Sovereign Turned Back"), costs Mara's respect, and
champions hear of it.

When the march ends, a campfire may follow (if eligible), and the Resolution screen shows the
march summary for that turn (duels, the fallen, a retreat note).

## Duels

Real-time, deterministic, engine-owned (`src/game/duel/engine.js`). The foe telegraphs every
attack with a wind-up you can read: **red-gold = dodge**, **steel = parry or dodge**,
**flicker = feint, wait**. Stakes (`practice`, `march`, `champion`, `last_stand`) scale foe damage
and health. Losing is never the end except in a last stand. Full mechanics, tuning and the
fairness contract: [DUEL.md](DUEL.md).

## The Trial of Blades

From the War Room, any time before the order: spar with Sword-Master Ilvane (Blade-Adept),
Greymane (Warg Alpha) or the Lattice Echo (Fallen Champion). It does not end the turn. The first
fight each turn is "for stakes" (`trialKey`): a win gives readiness +2, Mara respect +2 and a
memory, and the reign's first trial win writes a Chronicle entry; a loss costs readiness −1.
Later fights that turn are practice only.

## The training yard

From the title screen, outside any reign: four short **drills**, one per read of the wind-up
(steel light, red-gold glow, the flicker, breaking a guard), each ending the moment its goal is
met, and **sparring** bouts against the Blade-Adept, the Warg Alpha and the Fallen Champion (pick
which Legacy it mirrors). Mara coaches. Nothing here touches a save, the Chronicle or any reign;
the yard remembers which drills you passed on this device. See [DUEL.md](DUEL.md#training-yard).

## NarrativeIntensity and campfires

`state.intensity` (0–100, starts 25, **never shown**) rises with dramatic effects
(`INTENSITY` in `src/game/sim/intensity.js`: minor conflict 8, major combat 18, revelation 12,
betrayal 15, death 20, major victory 14, major defeat 16, personal confrontation 10) and settles
on quiet turns.

A campfire is offered (`campfireEligibility`) only when **all** hold: intensity ≥ 55
(`CAMPFIRE_THRESHOLD`), a major situation has just resolved, there is no immediate danger, and
the cooldown (2 turns) is clear. After a march it opens directly; after a turn it appears as an
offer on the Resolution screen. The scene is chosen from what happened (Mara's father, the girl at
the checkpoint, the ruin, a lost duel, a hard choice at the ford).

Three modes: **enter** (the full scene; pick one of six responses: Honest, Deflect, Joke, Comfort,
Command, Ask, plus The Lattice with Architect's Mark), **short** (a brief moment) and **skip**.
Completing settles intensity by −22, −14 or −10. **Skipping only settles intensity; it never
costs anything** (a test enforces this). Sparky's beat after a campfire depends on how he feels.

## The Chronicle

`state.chronicle` is write-only: entries are added by effects (`{ type: 'chronicle', title,
text, kind, tags }`) and never edited or deleted. Kinds include decision, personal, duel,
discovery, loss, battle, era, passing, legacy, oath, campfire, event.

**Approving** an entry (`APPROVE_CHRONICLE`, this reign's entries only; campfire words stay
private) asks the Chronicler to record it in full: it gains a `detail` naming the season's order
and its witnesses, and counts toward **The Chronicler's Pen** (3 approvals in a reign). Approval
is the one change an entry can receive, and it only adds detail.

## The Passing

`beginPassing(state, cause)` (`src/game/cycle/passing.js`) writes the turning entry (a fall also
raises a cairn monument), then four steps advanced by `PASSING_NEXT`:

1. **The Last Fire**: farewells from whoever is still with you (`passingFarewells`), shaded by
   their tier.
2. **The Chronicle**: the reign read back in the world's words (`chronicleReadback`: each entry
   gets a voice such as "In Halden, the refugees' town, they say…"), plus each faction's verdict.
3. **What Survives You**: choose 0–2 earned Legacies (`PASSING_CHOOSE_LEGACIES`). This writes the
   reign's history entry (`cycleHistoryEntry`: sovereign, years, cause, highlights, keys,
   civilization labels) and moves to the mantle.
4. **The Mantle Passes**: `BEGIN_NEXT_CYCLE`.

## Legacies

Eight Legacies (`src/game/content/legacies.js`), each earned in play and each with a cost:
Mara's Oath, Aegis Mastery, Warg Truce, Architect's Mark, Vale's Notes, The Chronicler's Pen,
Sparky's Line, Oathbreaker's Shadow. At most **2** carry across (`MAX_LEGACIES`). Earn conditions,
effects and costs: [CONTENT.md#legacies](CONTENT.md#legacies). Where the effects apply:
`beginNextCycle` (starting relationships, faction attitudes, flags), the resolver (Mara's Oath
readiness), and the duel engine (Aegis ward, Warg hesitation, Oathbreaker damage, Mara's Oath
heal, the Fallen Champion mirroring a held Legacy).

## The Return

`beginNextCycle(state)`:

- **Time passes**: 38–42 years (seeded). A new regnal name (`incarnationName`; a repeated name
  takes the next ordinal).
- **People age.** Mara, Cassian and Vale retire past 68, 75 and 86; their heirs take the role
  ("General Mara Voss the Younger"; later generations are numbered: "… III") and inherit an
  opinion of the Crown as a memory quoting the strongest thing their parent remembered.
  Characters who stay keep 85% of their relationship values, heirs 50%. With Mara's Oath, Mara
  (or her heir) also gains trust +15 and respect +20. A new child waits at the
  checkpoint (`CHILD_NAMES`); the girl you met grew up and appears in the briefing. Sparky's
  descendant arrives: Fond with Sparky's Line, wary without. Nyra's fate decides who leads the
  Syndicate (released → Chancellor Nyra Kell; otherwise Chancellor Lys Vex).
- **Factions** drift halfway back toward their starting attitude; **civilization memory is kept
  in full**; tension shifts with the label you earned; Warg Truce and Oathbreaker's Shadow apply.
- **The world resets around the memory**: fresh resources (stability −5 after a fall, −3 after an
  abdication), counters, flags and threads, except the Broken Circle, which keeps its progress;
  monuments persist; intensity starts at 20.
- **The first briefing cites the previous reign** (`historyCallbacks`): the years since, Queen
  Skaela's words (if she spoke; this outranks everything else), the refugee policy, the checkpoint
  child, Nyra's fate, monuments, civilization labels, the symbol. This is the Cycle doc's memory
  test, and a test asserts it.

## The Warg Queen speaks

The World Bible wants Skaela's first words in Elvian to be a major reveal. They are earned by
mercy: if the Sovereign spared the wargs at least once this reign (`counters.wargMercy` from
sparing the alpha, leaving the meat, letting Sparky stand, Winter Relief, or the turn-2 camps),
choosing **The Northern Compact** on turn 5 brings the Queen to the signing (`SKAELA_SPEAKS` in
`crises.js`). She says *"You called us beasts because beasts were easier to kill"* and names the
heart under the ice. Effects: `skaela_spoke`, peacemaker memory, the Broken Circle thread becomes
known, a Chronicle entry ("The Warg Queen Speaks"), her voice, and intensity. She is foreshadowed
on the ridge when you spare the alpha; at the Passing the Frost Wargs' verdict cites her; in later
reigns the briefing quotes her and she watches the next march from the ridge.

## Determinism, saves and the optional narrator

- All game randomness uses the seeded RNG (`src/game/core/rng.js`) carried in `state.rngSeed`.
  The same state and the same action always give the same result.
- Saves: three manual slots plus an autosave, export/import, and a **dynasty record** above the
  slots so loading an old save never rolls back the Chronicle or civilization memory. See
  [SAVES_AND_AI.md](SAVES_AND_AI.md).
- The optional Claude narrator only adds words and small, capped, validated requests; the game is
  complete without it.

## Balance knobs

| Knob | Where |
|---|---|
| Starting resources, factions, characters, threads, intensity | `createNewGame`, `createFactions`, `createCharacters`, `createThreads` in `src/game/core/state.js` |
| Resource and relationship bounds | `RESOURCE_BOUNDS`, `REL_BOUNDS` (`state.js`) |
| Income, unpaid garrisons, unrest/stability drift | `passiveEconomy`, `passiveMilitary` (`src/game/sim/resolver.js`) |
| Underfunding scale | `resolveTurn` (`max(0.4, ratio)`), `scaleEffects` (`resolver.js`) |
| Threshold events (riots 65, border incident 90, treasury 150) | `thresholdEvents` (`resolver.js`) |
| Ignored-faction tension drift | `passiveFactions` (`resolver.js`) |
| Thread urgency gain, boil-over at 85 | `PASSIVE_URGENCY`, `BOIL_OVER`, `passiveThreadEffects` (`src/game/sim/threads.js`) |
| Intensity values, campfire threshold and cooldown | `INTENSITY`, `CAMPFIRE_THRESHOLD`, `CAMPFIRE_COOLDOWN_TURNS` (`src/game/sim/intensity.js`) |
| Campfire settle amounts and scene choice | `campfireCompletionEffects`, `sceneSpeaker` (`src/game/content/campfire.js`) |
| Relationship tier thresholds | `relationshipLabel` (`src/game/core/relationships.js`) |
| Attitude, tension and civilization thresholds | `attitudeLabel`, `tensionLabel`, `civilizationLabel` (`relationships.js`) |
| Effect magnitude caps (sim and AI) | `SIM_CAPS`, AI caps in `src/game/core/effects.js` |
| Order costs and effects | turn builders in `src/game/content/crises.js` |
| Border outcome thresholds | `borderOutcome` (`crises.js`) |
| Deployment availability, duel rewards, casualties | `deploymentOffers`, `duelOutcomeEffects`, `casualtiesFor` (`src/game/content/expedition.js`) |
| Trial rewards | `trialComplete` (`src/game/actions.js`) |
| Siege-without-you penalty | `endTurn` (`actions.js`) |
| Duel timing, damage, stamina, windows | `TUNING` (`src/game/duel/engine.js`), archetypes and `STAKES` (`src/game/duel/archetypes.js`) |
| Legacy earn checks | `LEGACIES[*].check` (`src/game/content/legacies.js`) |
| Return gap, retirement ages, heirs, faction drift | `beginNextCycle`, `RETIRE_AGE`, `nextCharacters`, `nextFactions` (`src/game/cycle/passing.js`) |

After changing a knob: `npm test` (the playthrough and duel fairness tests catch most breakage),
`npm run docs:content` if content changed, and `npm run e2e`.
