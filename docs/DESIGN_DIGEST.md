# Design digest

A condensed, paraphrased digest of OmniStrat's three source design documents, followed by a
**compliance matrix** that says, requirement by requirement, what the browser vertical slice
implements and where. The original PDFs are the owner's and are not in this public repository;
section numbers (for example "Master Build §17") let you map back to them.

The three sources:

- **Master Build Prompt**: "OmniStrategy: Empire of Elvia, Master Build Prompt, Unreal Engine
  Vertical Slice". The slice's loop, cast, systems, milestones M0–M12 and Definition of Done.
- **Narrative & Living-World Bible**: the world, the long campaign, its characters, and its
  philosophy.
- **Cycle System Design Doc** v1.0 (Oct 2026, by Breon Johnson): the reign/death/return loop,
  Legacies, world memory, and real-time duels.

**Contents:** [Vision](#vision) · [World and cast](#the-world-and-cast) · [The slice](#the-vertical-slice-master-build) ·
[The Cycle](#the-cycle-cycle-doc) · [Duels](#duels-cycle-doc-6-and-10) · [Compliance matrix](#compliance-matrix) ·
[Deviations](#deliberate-deviations) · [Open questions](#open-design-questions)

## Vision

- **The question.** The campaign starts as "How do I make Elvia powerful?" and becomes "What
  should power be used for?" (Bible, opening). Every civilization is somebody's home; every army
  contains people; every villain believes something.
- **Three layers** (Master Build §1, Bible §1): **the Crown** (grand strategy), **the World**
  (being there in person) and **the People** (characters who remember). The Campfire connects
  them emotionally. Pillar: *"I can stand inside the civilization I am building."*
- **You are the God-King** (Cycle doc §1). Inspired by a bloodline loop and one-on-one duels in
  published mobile games, but flipped: you don't climb the castle to kill the God-King, you are
  the God-King. Pillars: death is a turn; memory is power; one blade proves the crown; the cycle
  creates.
- **Pacing** (Bible §12): crisis → victory → quiet character moment → discovery → political
  problem → comedy → personal loss → major war → hope. Quiet moments make explosions matter.
- **Final commandment** (Bible §20): never ask only "what happens next?", ask "who does this
  matter to?"

## The world and cast

- **Elvia** is an emerging magitech superpower: stone, advanced materials, military engineering,
  arcane geometry, warm magical energy. Not cyberpunk (Master Build §7, §35).
- **The Lattice** (Bible §10, Cycle doc §5): the hidden layer beneath magic and reality,
  connecting matter, consciousness, space, energy and information. The Sovereign is written into
  it; when the body dies the pattern is held "the way a loom holds a thread" and woven again a
  generation or two later.
- **The First Architects** (Master Build §6, Bible §11): the broken circle around a small star,
  found in ruins, Warg caves and beyond; it predates every known civilization. Do not explain it.
- **The Iron Syndicate** (Bible §3): a civilization traumatised by a magical catastrophe that
  destroyed its cities; its doctrine is that human destiny must not depend on forces humanity
  cannot control, so Elvia's coexistence of magic and technology threatens its foundations.
  **Chancellor Adrian Vex** is calm, educated, never threatens needlessly, and is sometimes
  uncomfortably right. **General Corvin Drae** is an extremist who wants the war Vex won't
  declare. **Lieutenant Nyra Kell** is a young walker pilot who may be killed, captured, rescued,
  released or recruited, and may become a commander or a reformer: *random people can become
  important.*
- **The Frost Wargs** (Bible §4) seem monstrous but are protecting the **Winter Heart**, an
  ancient engine under the ice. **Warg Queen Skaela** is massive, scarred and ancient; the first
  time she speaks Elvian is meant to be a major reveal ("You called us beasts because beasts were
  easier to kill").
- **The Council** (Master Build §4, Bible §2): **General Mara Voss** (disciplined, protective, dry
  humour; her father died defending a border town; she confronts but never betrays), **Dr. Elias
  Vale** ("magic is physics that refuses to explain itself"; reckless about discovery),
  **Director Cassian Rey** (information as power; morally ambiguous, often correct), and
  **Sparky**, a young acid drake: loyal, mischievous, brave for others, distracted by food,
  "absolute loyalty without ambition", never only comic relief.
- **Ordinary Elvians** (Bible §5): **Toma and Lena**, café owners whose café grows with history,
  and **Mika**, a refugee child whose future is not guaranteed to be great.
- **The long campaign** (Bible §2, §6–9, out of scope for the slice): Altair ("Subject Zero"), the
  Solari and their Herald, alien civilizations (Veyari, Kharaxi, Orion Freehold), the Void, the
  Shepherd, Prime Entropy, and the **Builder ending** (HUNGER becomes CREATE).
- **Civilization memory** (Bible §15, Cycle doc §4): civilizations remember Elvia. The Cycle doc
  fixes the public vocabulary to four labels: Liberator, Conqueror, Oathbreaker, Peacemaker.

## The vertical slice (Master Build)

- **The loop** (§2): War Room crisis → choose A–E or a custom order → deterministic resolution →
  world changes → Mara recommends deployment → leave the War Room → the Southern Marches → see
  consequences → civilians and soldiers → a persistent minor NPC → a companion → an optional
  location → a meaningful fight → lore → a personal decision that modifies the campaign →
  resolve the conflict → return → intensity crosses the campfire threshold → enter, shorten or
  skip the campfire → dialogue references real events → relationships and memories change →
  War Room → next situation → save → exit → reload → consequences intact.
- **Turn 1** (§3): the Syndicate's walkers and depots on the southern border ("routine defensive
  readiness"); refugees from the north reporting warg migrations, abandoned villages, lights
  under the ice, old banners, shapes in blizzards; Cassian suspects someone is exploiting both.
- **Systems** (§13–§29): companions; belief-driven dialogue (not good/bad/sarcastic);
  persistent CharacterMemory (`id, characterId, eventId, turn, type, description,
  emotionalWeight, sentiment, permanent, tags`); five hidden relationship values shown as words;
  the War Room (crisis, HUD of five resources, factions, characters, five orders by category plus
  a custom order); a rule-based custom-order parser that works without AI; the application owns
  truth and narrative systems only request changes; a fixed 13-step turn pipeline; world threads;
  hidden NarrativeIntensity 0–100; campfires as earned cooldowns with four trigger conditions;
  Enter/Short/Skip with no penalty for skipping; robust saves (3+ slots, autosave before and after
  resolution and after campfires); a Chronicle of meaningful events only; an LLM seam of
  generators with validate → repair → retry once → fallback; and cost control.
- **Region and states** (§7–§8): one region (Southern Marches / Crownlands Frontier) with an
  outpost, a checkpoint, a settlement, a military road, wilderness, a ruin, a Syndicate encounter
  zone and a campfire site, shown in three states: STABLE, FORTIFIED, AFTERMATH.
- **Kit** (§9–§12): a primary attack, a defensive ability, a magitech ability (Arc Pulse) and a
  command ability (Royal Command); Syndicate infantry, heavies and an optional walker.
- **Process** (§30, §38–§41): small focused commits; inspect → define → implement → compile →
  test → verify persistence → regression → polish → commit → report; never claim "working"
  without evidence; milestones M0–M12.
- **Scope firewall** (§33): no Altair storyline, Solari, Titans, galactic travel, full army
  simulation, crafting, multiplayer, housing, procedural galaxy, thousands of NPCs, large skill
  trees or advanced economy.
- **Visual target** (§35): AAA-inspired presentation, not AAA production scale. "One polished road
  can sell the fantasy better than a giant empty continent."
- **Definition of Done** (§42): a new player can launch, understand, choose, leave the War Room,
  control the Sovereign, explore without guidance, meet three memorable characters, see a
  decision in the world, fight satisfyingly, discover lore, make a personal choice, see NPCs
  react, resolve the conflict, experience an appropriate campfire, return to strategy, save, quit,
  reload, and see that the game remembers. 30–60 minutes direct, 60–90 exploratory.
- **Success metrics** (§43): testers say "I want to see what happens next", "I liked Mara",
  "Sparky is hilarious", "I didn't expect that choice to change the world", "Who made that
  symbol?", "Can I go north?". Failure is testers talking mainly about menus, bugs or empty
  environments.

## The Cycle (Cycle doc)

- **A cycle is one reign** (§2), ended by a fall in battle, an era milestone, or voluntary
  abdication ("rare, powerful, and remembered differently from a fall"). Reign → Turning →
  Passing → Return.
- **Persists**: the full Chronicle; civilization memory (moves only through new recorded actions,
  never through waiting); relationships (companions age, retire, have children who inherit an
  opinion); 1–2 chosen Legacies. **Resets**: expeditions, tactical state, the duel build.
- **Legacies** (§3): Mara's Oath, Aegis Mastery, Warg Truce, Architect's Mark, Vale's Notes, The
  Chronicler's Pen, Sparky's Line, Oathbreaker's Shadow. Each must be earned, and each "opens a
  door and closes another".
- **World memory** (§4): people tell your story back to you; stone remembers (monuments);
  former enemies become school lessons; faction standing carries. Every callback must trace to a
  Chronicle entry.
- **The march** (§7): Checkpoint → Wilds → Ruin → Champion, 3–5 duels, no filler fights; retreat
  allowed between duels, recorded, commented on by champions.
- **Integration map** (§8): Chronicle write-only; memory read and evolve; relationship tiers
  persist and drift; generational threads survive a Passing; intensity rises at the Passing and
  champion duels and falls in early rebuilding; cycle data is meta-progression above save slots;
  the Passing is a campfire variant. **The Passing in 4 steps**: final campfire; the Chronicle
  read back in the world's words; choose 1–2 Legacies; the mantle passes and the first briefing
  cites your history.
- **Prototype plan** (§10): "Now: systems + text in the browser demo; later: the same rules port
  to Unreal." The Trial of Blades: one arena, one enemy family in three variants, three input
  methods, the full kit, campaign wiring, two doors in (the War Room trial and the turn-4
  skirmish). **Success test**: a first-time player loses the first duel, can name why, wins the
  rematch, and reads a Chronicle entry that makes them want one more cycle. **Memory test**: the
  second incarnation's first briefing must cite the first.

## Duels (Cycle doc §6 and §10)

*The Sovereign is controlled, not selected.* Real-time direct control, no menus. Read the
wind-up; move and respond; strike on your timing; spend Arc Pulse, Royal Command and Shield Ward
in the moment. Every attack must be answerable by movement or timing, and after a loss you should
be able to name what you misread. Archetypes: Syndicate Blade-Adept (feints, speed; the duelist
check), Warg Alpha (brutal telegraphed heavies; the patience check), Fallen Champion
(cycle-scaled mirror using one of your Legacies; the story check). Defeat is never game over:
"the Sovereign withdraws, wounded, noted, remembered."

## Compliance matrix

Status: **Done** (implemented and tested), **Partial**, **Not yet**, **Deviates** (implemented
differently on purpose; see below).

### Master Build Prompt

| Requirement | Status | Where / note |
|---|---|---|
| §2 The full slice loop, including save → quit → reload | Done | Controller `src/game/actions.js`; proven by `src/game/playthrough.test.js` and the e2e playthrough (`scripts/e2e-play.mjs`) |
| §3 Turn 1 crisis as written | Done | `turn1` in `src/game/content/crises.js` |
| §4 Mara, Vale, Cassian, Sparky with their personalities | Done | Characters in `src/game/core/state.js`; voice in crises, march, campfire |
| §5 Mika, persistent minor NPC, with the suggested memories | Done | Checkpoint beat (`expedition.js`): `PLAYER_HELPED_FAMILY`, `PLAYER_IGNORED_FAMILY`, `PLAYER_ORDERED_REFUGEES_REMOVED`, `PLAYER_PERSONALLY_INTERVENED`; reign II callbacks |
| §6 The broken-circle symbol in an optional ruin, unexplained | Done | Ruin beat; flag `FIRST_ARCHITECT_SYMBOL_DISCOVERED`; Chronicle "Unknown Symbol Discovered" |
| §7 One region with outpost, checkpoint, road, wilds, ruin, Syndicate zone, campfire site | Done | March beats; the settlement appears in scenes and text rather than as its own beat |
| §8 STABLE / FORTIFIED / AFTERMATH visible states | Done | `regions.southern_marches.state`; `RegionScene` art; beat text variants |
| §9 Third-person movement (walk, sprint, jump, interact) | Deviates | Browser slice: authored march beats instead of free movement |
| §10 Kit: attack, defence, Arc Pulse, Royal Command | Done | Duel engine; Royal Command is a rally (Cycle doc §6) rather than an ally buff |
| §12 Syndicate infantry, heavy, walker | Deviates | Duel archetypes (Blade-Adept, Warg Alpha, Fallen Champion) per the Cycle doc; walkers appear in art and story |
| §13 Companions (Mara, Sparky) with reactions and persistence | Partial | Companions in text, campfires and duel lines (Royal Command answers); no follow AI |
| §14 Belief-driven dialogue with conditions and consequences | Done | Talk choices and campfire responses (Honest, Deflect, Joke, Comfort, Command, Ask, The Lattice) |
| §15 CharacterMemory with the listed fields | Done | `state.memories`; `memory` effect |
| §16 Five hidden relationship values shown as words | Done | `relationshipLabel`; the UI never shows numbers |
| §17 War Room panels: crisis, HUD, factions, characters, orders A–E, custom order | Done | `WarRoomScreen`; factions and characters in the Council dossier |
| §18 Custom orders with a rule-based parser and no AI dependency | Done | `src/game/sim/orderParser.js`; optional Claude interpretation |
| §19 The simulation owns truth; narrative only requests | Done | `src/game/core/effects.js`; `source: 'ai'` caps |
| §20 The 13-step turn pipeline, in order | Done | `PIPELINE` in `src/game/sim/resolver.js` |
| §21 World threads with the listed fields, advancing only when relevant | Done | `src/game/sim/threads.js` |
| §22 NarrativeIntensity 0–100, hidden, rises and settles | Done | `src/game/sim/intensity.js` |
| §23 Campfire trigger conditions; first campfire after the Marches climax | Done | `campfireEligibility`; offered at the end of the march |
| §24 First campfire reflects what happened | Done | Scene choice by events (`sceneSpeaker`): father, Mika, ruin, lost duel, hard choice |
| §25 Enter / Short / Skip, skipping never punishes | Done | Tested |
| §26 Saves: 3+ slots, autosave before and after resolution and after campfires | Done | `src/game/save/*`; extra autosaves on the march and at each reign |
| §27 Chronicle of meaningful events | Done | Write-only, with approvals |
| §28 LLM seam: generators, validate → repair → retry once → fallback | Done | `src/game/ai/*` (Claude via the Anthropic SDK, optional) |
| §29 Cost control | Done | Session budget, cache, three call sites |
| §30 Small, focused commits | Done | Conventional Commits on the branch |
| §32 No paid assets | Done | All art and audio procedural |
| §33 Scope firewall respected | Done | None of the excluded systems exist |
| §35 AAA-inspired presentation | Done (browser) | Procedural scenes, typographic hierarchy, motion; reviewed via screenshots |
| §37 Controller, keyboard/mouse, subtitles, text size, remapping | Partial | Keyboard and mouse everywhere; gamepad in duels only; duel captions always on (no toggle); text size setting; no remapping yet |
| §42 Definition of Done | Partial | Everything except free third-person exploration, which the browser slice replaces with the march (see deviations); playtime has not been measured with real players yet |
| §43 Success metrics | Not yet | Needs outside playtesters |

### Narrative & Living-World Bible

| Requirement | Status | Where / note |
|---|---|---|
| Characters change with gameplay; memories cited years later | Done | Memories, inherited memories, reign II callbacks |
| Nyra Kell: killed, captured, released or recruited, with a future | Done | Champion aftermath (`nyra_fate`); reign II leader or memoirist |
| Chancellor Vex, General Drae | Done | Crisis text across turns 1–5 |
| Toma and Lena | Done | Voices of the realm |
| Frost Wargs as more than monsters; the Winter Heart | Partial | Mercy choices, Warg Truce, Vale's heartbeat under the ice; Skaela does not speak yet |
| Civilization memory | Done | Four labels per faction (Cycle doc vocabulary) |
| Procedural character seeds | Partial | Named fallen soldiers, heirs, new checkpoint children; no promotion system |
| Death obeys cause and consequence | Partial | Nyra can die; the Sovereign can fall; soldiers die by name |
| Legacy across decades: aging, monuments, school lessons | Done | The Return (`beginNextCycle`) |
| Altair, Solari, aliens, the Void, Prime Entropy, the Builder ending | Not yet | Out of scope for the slice |

### Cycle System Design Doc

| Requirement | Status | Where / note |
|---|---|---|
| §2 Three ways a cycle ends | Done | Era, fall (lost last stand), abdication |
| §2 What persists and what resets | Done | `beginNextCycle`; dynasty meta |
| §3 Eight Legacies, earned first, max 2, each with a cost | Done | `src/game/content/legacies.js` |
| §4 People retell your story; stone remembers; enemies become lessons; standing carries | Done | Briefing callbacks, inherited memories, monuments, academy lines, civilization memory |
| §4 Every callback traces to a Chronicle entry | Partial | Callbacks use history keys derived from the same events that write Chronicle entries; not enforced by lookup |
| §5 The Lattice fiction, the mystery kept open | Done | Return text, Architect's Mark vision, the ruin |
| §6 Real-time duels, readable telegraphs, fairness | Done | `src/game/duel/*`, fairness test suite |
| §6 Inputs for touch, mouse, keyboard | Done | DuelScreen; keyboard mapping resolved as below |
| §6 Combo + poise, Arc Pulse, Royal Command, Shield Ward | Done | Engine |
| §6 Three archetypes | Done | Blade-Adept, Warg Alpha, Fallen Champion (mirrors a Legacy, scales by reign) |
| §6 Defeat is never game over | Done | Except the last stand, which is a fall that leads to the Passing |
| §7 The march: checkpoint, wilds, ruin, champion | Done | Plus the road and the camp |
| §7 3–5 duels per march | Partial | Two duels (warg alpha, champion) plus a rematch; other beats are choices |
| §7 Retreat allowed, recorded, commented on | Done | `EXPEDITION_RETREAT`; champion text |
| §8 Integration map, including saves above slots | Done | Dynasty meta (`src/game/save/dynasty.js`) |
| §8 The Passing in four steps | Done | `src/game/cycle/passing.js`, `PassingScreen` |
| §10 Trial of Blades and the turn-4 skirmish as the two doors | Done | War Room trial; skirmish deployment |
| §10 Success test (lose, name why, win the rematch) | Done (automated) | Playthrough test and e2e; needs human playtests |
| Next actions §3: reign II's first briefing cites reign I | Done | `historyCallbacks`; asserted in tests and e2e |

## Deliberate deviations

1. **Browser first, not Unreal.** The Master Build targets an Unreal 3D slice; the Cycle doc
   says to prove systems in the browser first and port the same rules later. This repo is that
   browser prototype, so third-person movement and combat against infantry are replaced by
   authored march beats and real-time duels.
2. **Royal Command** follows the Cycle doc (a once-per-duel rally: heal, damage window, companion
   line) rather than the Master Build's "empower nearby allied NPCs".
3. **Keyboard mapping.** The Cycle doc lists "Arrow keys / WASD" for strikes and "A / D" for
   dodges, which conflict. Resolved as: arrow keys strike (W also strikes up), A / D dodge,
   Space or S guards, E is Arc Pulse, R is Royal Command, Shift is Shield Ward.
4. **Warg Truce wording.** The Cycle doc says the wargs "start Cordial instead of Wary", which are
   relationship words. Factions use attitude words, so the effect is "begin the next reign Warm
   toward Elvia".
5. **Campfire responses** use six belief-style tones (plus The Lattice) instead of the Master
   Build's example list (listen, ask about the dead, defend, promise change, joke, leave), in the
   same spirit.
6. **Autosaves** happen more often than required (also on the march and at each new reign).

## Open design questions

- How many reigns should a campaign have, and what changes in reign III+ beyond callbacks
  (new arcs, new regions, "Can I go north?")?
- Should Skaela's first words in Elvian be a reign-II event (with Warg Truce) or a northern march?
- Should the march grow to 3–5 duels as the Cycle doc suggests, and which beats should get them?
- How strictly should "every callback traces to a Chronicle entry" be enforced in code?
- Gamepad navigation for menus, subtitle toggles and input remapping (Master Build §37).
