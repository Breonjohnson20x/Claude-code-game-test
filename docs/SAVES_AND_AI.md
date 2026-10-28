# Saves and the optional Claude narrator

Two subsystems that touch the outside world: persistence (`src/game/save/*`) and the optional
narrator (`src/game/ai/*`). Both sit at the edge of the pure game layer and are the only parts of
`src/game/**` allowed to touch storage or the network.

**Contents:** [Saves](#part-1-saves) · [Slots and autosave](#slots-and-autosave) · [Format](#on-disk-format) ·
[Validation and migration](#validation-and-migration) · [The dynasty record](#the-dynasty-record) ·
[Export and import](#export-and-import) · [Narrator](#part-2-the-optional-claude-narrator) · [Client](#the-client) ·
[Generators](#generators) · [Proposals](#proposals-never-bypass-the-simulation) · [Cost control](#cost-control) ·
[Privacy and security](#privacy-and-security) · [Extending](#how-to-extend)

## Part 1: Saves

> "Saves hold a reign. The meta record holds the dynasty. Loading an old save replays choices; it
> does not un-remember the world." (Cycle doc §8)

`createSaveSystem({ storage, now })` (`src/game/save/saveSystem.js`) returns the API the UI uses
(through `GameProvider`):

| Method | Does |
|---|---|
| `listSlots()` | `[{ slot, summary | null, savedAt?, reason?, corrupt?, error? }]` for `auto`, 1, 2, 3. Never throws. |
| `save(slot, state)` | Write a manual slot. Throws `SaveError` on failure. |
| `autosave(state, reason)` | Write the auto slot. Never throws; returns false and records `getLastError()`. |
| `load(slot)` | Read, migrate, validate, and merge the dynasty record into the state. Throws `SaveError`. |
| `remove(slot)` / `hasAnySave()` | Housekeeping. |
| `loadMeta(dynastyIdOrState)` / `commitDynasty(state)` | Read / merge the dynasty record. |
| `exportSave(slot)` / `importSave(slot, json)` | JSON round trip, carrying the dynasty. |
| `getLastError()` | The last failure, for a toast. |

`SaveError.code` is one of `invalid_slot`, `empty`, `corrupt`, `invalid`, `newer`, `quota`,
`storage`, `serialize`.

### Slots and autosave

Three manual slots (`MANUAL_SLOTS = [1, 2, 3]`) plus `auto`. The controller asks for autosaves
through `dispatch(...).io` and the provider performs them (`AUTOSAVE_REASONS`):

| Reason | When |
|---|---|
| `before_resolution` | the state just before an order resolves (`io.autosaveBefore`) |
| `after_resolution` | after an order resolves, after an abdication, and when a reign enters the Passing |
| `after_campfire` | after a campfire |
| `expedition` | entering a march, after a duel or a retreat, when the march ends |
| `cycle_start` | a new game, and every new reign |

The title screen's **Continue** loads the most recent valid slot.

### On-disk format

Storage is `window.localStorage` when usable, otherwise an in-memory map (tests, node, private
browsing that throws). The adapter is `src/game/save/storage.js`.

| Key | Holds |
|---|---|
| `elvia.save.v1.auto`, `elvia.save.v1.slot1`…`slot3` | a save record |
| `elvia.dynasty.v1` | pointer `{ formatVersion, current: dynastyId }` |
| `elvia.dynasty.v1.<dynastyId>` | the dynasty meta record |
| `elvia.aicache.v1` | the narrator's response cache (disposable) |
| `elvia.settings.v1`, `elvia.audio`, `elvia.haptics` | UI settings (written by `src/ui/**`) |

A save record is `{ formatVersion: 1, savedAt, reason?, summary, state }`, where `state` is the
whole GameState (plain JSON) and `summary` is what the slot picker shows (sovereign, label such
as "Cycle 1 · Turn 4 · Winter 412 E.R."). When storage is full, the save system deletes the AI
cache and retries before failing with a `quota` error.

### Validation and migration

`validateStateShape(state, { strict })` checks the essentials (version, phase, cycle, sovereign,
the object and array keys) and lists every problem. Corrupt or invalid slots are reported in
`listSlots()` and refused by `load()` with a clear message; they never crash the game.

`migrateState(state)` (`src/game/save/migrate.js`) brings an older save up to `STATE_VERSION`
(`MIGRATIONS[n]` upgrades version n to n+1; none are needed yet at version 1), then
`backfillState` fills any key the current `createNewGame()` defines but the save lacks, without
overwriting existing values. Saves from a **newer** build are refused (`newer`).

**When you change GameState:** bump `STATE_VERSION` in `src/game/core/state.js`, add
`MIGRATIONS[oldVersion] = (s) => ({ ...s, yourChange })`, and add a test in
`src/game/save/saveSystem.test.js`. Never rename an id that saves contain (characters, threads,
flags, Legacies, Chronicle ids) without migrating it.

### The dynasty record

`src/game/save/dynasty.js` keeps a meta record per dynasty (`campaignId`) **above** the slots:

```js
{ formatVersion, dynastyId, cyclesCompleted, committedCycles[], chronicle[],
  civilization: { [factionId]: { liberator, conqueror, oathbreaker, peacemaker } },
  cycles: [{ cycle, sovereign, startYear, endYear, cause, legacies, highlights }],
  legaciesTaken[], updatedAt }
```

It is committed when you choose Legacies and when a new reign begins (`io.commitDynasty`). Every
merge is **monotonic**: the Chronicle is a union of entries, civilization memory takes the
per-key maximum, and cycle summaries are first-commit-wins. On `load()`, the meta is merged into
the loaded state (`mergeMetaIntoState`). So if you load a save from reign I after reaching reign
II, the world still remembers reign II's Chronicle and how the factions came to see you. Only a
record with the same `dynastyId` is ever merged. Tests cover each rule.

### Export and import

`exportSave(slot)` returns the record plus that dynasty's meta as JSON. `importSave(slot, json)`
accepts that format (or a bare GameState), validates and migrates it, writes the slot, and merges
the dynasty meta into storage, so a dynasty can travel between browsers.

## Part 2: The optional Claude narrator

The game is complete with zero AI (Master Build §18, §28). With a key in **Settings → Claude
narrator**, Claude adds words at three moments: reading a **custom decree**, extra **campfire**
voices after you answer, and the **Chronicle read-back** at the Passing ("as the scribes tell
it"). Claude never decides outcomes. It may only *request* a few small effects, which the
simulation validates and caps like anything else.

### The client

`src/game/ai/client.js` wraps the official SDK, `@anthropic-ai/sdk` (1.3.0), in the browser
(`dangerouslyAllowBrowser: true`, since the key is the player's own):

- **Model**: the player's choice in Settings (`MODEL_OPTIONS` in `src/ui/game/settings.js`: Claude
  Opus 5.5 `claude-opus-5-5` (default, `DEFAULT_MODEL`), Claude Sonnet 5.5 `claude-sonnet-5-5`,
  Claude Haiku 5.5 `claude-haiku-5-5`).
- **Request** (`buildMessageParams`): `max_tokens` 1500 (2000 for the Chronicle), a system prompt
  and one user message, and `output_config: { effort: 'low', format: { type: 'json_schema', schema
  } }` (**structured outputs**; effort is omitted for older models that reject it). No
  temperature/top_p/top_k.
- **Server-side refusal fallbacks are enabled**: for models that support it
  (`supportsServerFallback`), requests go through `client.beta.messages.create` with
  `betas: ['server-side-fallback-2026-07-01']` and `fallbacks: 'default'`, so a refused request can
  be answered by a fallback model instead of failing. The response's refusal and fallback switch
  points are read and recorded.
- **Request options**: 20 s timeout, 1 SDK retry (`REQUEST_OPTIONS`).
- **Errors** are classified by SDK error class, never by message text (`classifyError`): auth,
  permission, rate limit, timeout, connection, server, bad request. An auth error marks the key as
  rejected and stops further calls until the key changes.

### Generators

`createGenerators({ getSettings })` (`src/game/ai/generators.js`) returns one function per
generator (`GENERATOR_NAMES`): `narrative`, `campfire`, `dialogue`, `diplomacy`, `character`,
`event`, `chronicle`, `orderInterpreter`. The UI currently calls three:

| Generator | Called by | Context | Output |
|---|---|---|---|
| `orderInterpreter` | War Room custom decree | `{ state, crisis, text }`, fallback `parseOrder(text)` | `{ actions: [{ category, target, covert, weight }], summary, understood }` |
| `campfire` | Campfire, after a response | `{ state, participants: ['mara', 'sparky'], topic, mood }`, fallback `null` | `{ lines: string[], proposals? }` |
| `chronicle` | The Passing, step II | `{ state, entries, cause }`, fallback `null` | `{ paragraphs: string[] }` |

Every call is `await generators.<name>(context, fallback)` →
`{ ok, output, source: 'ai'|'cache'|'fallback', proposals, rejected, error?, detail? }`.

The pipeline: build a **compact context** (`buildCompactContext` in `prompts.js`: a few words per
resource and relationship, never the whole state and never hidden lore) → look in the cache →
call Claude → parse (tolerant JSON, salvaging output cut off by `max_tokens`) → validate against
the schema (`schemas.js`) → **repair** (truncate, trim arrays, clamp numbers, coerce types, map
free-text targets to the parser's vocabulary) → retry once if irreparable → otherwise the authored
fallback. A refusal goes straight to the fallback without reading content or retrying. The UI
never blocks on any of this: authored text is always on screen, and AI text appears when ready,
labelled "Narrated by Claude".

For custom decrees, AI weights are normalised so a decree can never buy more total effort than
the rule-based parser allows (`ORDER_EFFORT_TOTALS`: 1 action 1.0, 2 actions 1.2, 3 actions 1.35).

### Proposals never bypass the simulation

Outputs may include up to 3 `proposals` (`MAX_PROPOSALS`). Generators run them through
`validateEffects(proposals, state, { source: 'ai' })`: only `resource, relationship, faction,
memory, intensity, voice` are allowed, with tight caps (treasury/manpower ±150, other resources
±4, relationships ±5, factions ±5, intensity ±5, memory weight ≤ 4). The UI applies the valid ones
with `APPLY_AI_EFFECTS`, which validates them again against the current state. Cached proposals
are re-validated too.

### Cost control

- **Budget**: at most `aiBudget` calls per session (default 25, `DEFAULT_AI_BUDGET`); the retry
  counts. When spent, generators fall back silently and Settings shows the status.
- **Cache**: responses are cached by a hash of the compact context, model and `PROMPT_VERSION`
  (`contextHash` in `cache.js`), in localStorage (`elvia.aicache.v1`), capped at about 100 entries
  with least-recently-used eviction. Identical requests in flight are de-duplicated.
- **Only at meaningful moments**: three call sites, never per frame or per turn automatically.
- `subscribeAiStatus` / `getAiStatus` (`status.js`) expose what Settings shows: calls used, cache
  hits, the last source (ai / cache / fallback), the last error kind, and whether the key was
  rejected. An auth error blocks calls for that key; permission and not-found errors block that
  key and model pair; both clear when the key or model changes.

### Privacy and security

The key is typed into Settings, stored only in this browser's localStorage
(`elvia.settings.v1`), and sent only to Anthropic's API by the SDK. It is never logged, saved in
game saves, exported, or committed. This is fine for personal use. For a **public deployment**,
do not ship a browser key: put a small server proxy in front of the API that holds the key and
enforces limits, and point the client at it.

Hosted builds: localStorage belongs to the whole origin. On GitHub Pages every project site of
the same owner shares `https://<owner>.github.io`, so any other page published there could read
the key. Host the game on its own origin (a custom domain, or a dedicated Netlify/Vercel/
Cloudflare site) if that matters to you. The service worker never caches API traffic; it only
caches the game's own files and the Google Fonts.

## How to extend

**A new generator.** Add an output spec in `src/game/ai/schemas.js` (`OUTPUT_SPECS`, so it gets a
wire JSON schema and repair rules), a prompt in `prompts.js` (system + user + compact context),
an authored fallback, and tests in `schemas.test.js` and `generators.test.js` (fallback path, AI
path, proposals validated). Call it from the UI only at a meaningful moment, never blocking.

**Swap the model or provider.** Change the default in `client.js` / the Settings options. To use
another provider, replace `createSdkClient` behind the same interface; keep the validation
boundary (schemas, repair, `validateEffects` with `source: 'ai'`) exactly as it is, because that
boundary is what keeps the simulation in charge.

**A new save field.** See [Validation and migration](#validation-and-migration).
