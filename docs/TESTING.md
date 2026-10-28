# Testing and verification

How OmniStrat is tested, how to run each layer, and how to extend the tests when you change
something. The rule of thumb: game rules are proven with fast deterministic unit tests, whole
reigns with a scripted playthrough, the UI with a Playwright sweep and playthrough, and the look
with screenshots that a human (or an AI that can see images) actually looks at.

**Contents:** [Quick reference](#quick-reference) · [Unit and integration tests](#unit-and-integration-tests-vitest) ·
[Dev scenarios](#dev-scenarios) · [End-to-end gate](#end-to-end-gate-npm-run-e2e) ·
[Screenshot review](#screenshot-review) · [Extending the tests](#extending-the-tests) ·
[Troubleshooting](#troubleshooting)

## Quick reference

```bash
npm test                              # all vitest suites (~1 s)
npx vitest run src/game/duel          # one folder
npx vitest run -t "Royal Command"     # tests whose name matches
npm run test:watch                    # watch mode
npm run build                         # production build must succeed
npm run lint                          # eslint: errors fail, warnings are OK
npm run e2e                           # Playwright sweep + playthrough, phone and desktop
npm run e2e -- --sweep                # only the scenario sweep
npm run e2e -- --play                 # only the UI playthrough
npm run e2e -- --pwa                  # only the installable/offline build check
```

A change is done when all of these pass and you have looked at the e2e screenshots. In Claude
Code, the project skill `verify-elvia` (`.claude/skills/verify-elvia/SKILL.md`) runs this loop.

## Unit and integration tests (vitest)

Tests sit next to the code (`*.test.js`). They are pure Node: no DOM, no network. AI tests use a
fake `fetch`, and save tests use an in-memory storage. 132 tests across 7 files:

| File | Tests | What it proves |
|---|---:|---|
| `src/game/playthrough.test.js` | 6 | A full reign through the real controller: lose the first champion duel with a weak bot, get named misreads, win the rematch, run a Trial of Blades, approve Chronicle entries, issue a custom decree, take the turn-4 skirmish, go through all four Passing steps, choose Legacies, start reign II, and check its first briefing cites Mika, Nyra and the elapsed years. Also: same inputs give the same world; a lost last stand ends the reign as a fall (cairn monument), never a game over; abdication is remembered differently; skipping a campfire never punishes; a march summary shows only on its own turn, even after a reload. |
| `src/game/duel/engine.test.js` | 49 | Duel engine determinism and purity (same seed + inputs → identical state; `stepDuel` never mutates; variable `dt` is sub-stepped). The oracle bot beats every archetype and legacy variant within 120 s; a dodge-only oracle also wins; an idle player loses. Misread detection (`parried_heavy`, `panic_parry`, `wrong_dodge`, `greedy_strike`, `late_guard`, …). Telegraph shape. Royal Command once only, Arc Pulse only when charged, retreat only when allowed. Legacy effects in combat. **Fairness:** every (move, direction) pattern of every archetype has a zero-damage answer. |
| `src/game/save/saveSystem.test.js` | 13 | Slots round-trip exactly; 3 manual slots + autosave are independent; corrupt slots are reported, not thrown; quota errors free the disposable AI cache; migrations backfill older saves and reject newer ones; bare GameState import; **dynasty meta**: loading an older reign-1 save does not roll back civilization memory or the Chronicle; commit is idempotent per cycle; only the same dynasty merges; export/import carries the dynasty. |
| `src/game/ai/generators.test.js` | 31 | The narrator never blocks the game: authored fallbacks when AI is off, there is no key, the budget is spent, the reply is a refusal, or the SDK throws. Repair before retry, exactly one retry, `max_tokens` salvage, auth errors stop calls. Cache and in-flight dedupe, session budget, LRU cap. **AI proposals never bypass the simulation:** out-of-bounds proposals are rejected or clamped; cached proposals are re-validated. Custom-order interpretation falls back to the rule parser. Every generator returns validated output. |
| `src/game/ai/schemas.test.js` | 10 | Wire schemas cover every generator and fit the structured-outputs subset; validate/repair truncates, clamps and coerces; tolerant JSON parsing (fenced, prose-wrapped, trailing commas, truncated). |
| `src/game/ai/client.test.js` | 6 | The request built for the default model (structured output, server-side refusal fallbacks, effort), feature gating per model, the beta header, SDK error classification by class (never by message text), refusal and fallback handling. |
| `src/game/dev/scenarios.test.js` | 17 | Every dev scenario reaches its phase through real actions, passes `validateStateShape`, and `getView` does not throw. Beats and offers are where the UI previews expect them. |

### Bots

`src/game/duel/bots.js` drives duels without a human:

- `createOracleBot({ mode })` reads the engine's telegraph and answers perfectly (`'parry'` or
  `'dodge'` mode). It is the "a skilled player can always win" check.
- `createGuardSpamBot()` holds guard and strikes blindly, losing in a way that produces misreads
  (the playthrough uses it to lose the first champion duel on purpose).
- `simulateDuel(config, bot, { maxMs })` runs a duel to completion at the fixed timestep and
  returns `{ duel }`; pass it to `getDuelResult(duel)` for the `DuelResult` the controller wants.

The scenarios and playthrough test use these bots, so a duel result in a test is always a real
engine result, never a hand-made object.

## Dev scenarios

`src/game/dev/scenarios.js` builds named game states **by dispatching real actions** from a fixed
seed (20261024, sovereign "Aurelian"). Each one is a real state in a known spot:

| Scenario | Phase | Where |
|---|---|---|
| `war_room_t1` | war_room | First briefing of reign I |
| `resolution_t1` | resolution | After order E on turn 1; march offered |
| `march_road`, `march_checkpoint`, `march_wilds`, `march_ruin`, `march_champion` | expedition | Each march beat |
| `duel_pending` | expedition | Champion duel about to start (Blade-Adept config pending) |
| `champion_defeated` | expedition | Lost to the champion; rematch offered |
| `campfire` | campfire | A campfire scene opened |
| `war_room_t3` | war_room | Turn 3, "The Line Is Crossed" |
| `resolution_t4_skirmish` | resolution | Turn 4; skirmish deployment offered |
| `passing_campfire`, `passing_chronicle`, `passing_legacies` | passing | The Passing steps I–III |
| `cycle2_war_room` | war_room | Reign II's first briefing (cites reign I) |

Use them in the browser (dev server only): `http://localhost:5173/?scenario=war_room_t3`. In dev,
`window.__elvia.state` exposes the live state read-only, and `/?seed=<n>` makes "Begin a new
reign" reproducible. Scenario code is loaded only through a dynamic import guarded by
`import.meta.env.DEV`, so production builds don't include it.

## End-to-end gate (`npm run e2e`)

`scripts/e2e.mjs` starts a Vite dev server in-process and drives the real app in headless
Chromium at two sizes: **phone** (390×844, touch, DPR 2) and **desktop** (1280×800). Reduced
motion is on, so screenshots are stable.

1. **Sweep.** For every dev scenario on both viewports: load it, wait for the game screen,
   take a full-page screenshot, then audit it. It fails on any console error or page error
   (unreachable Google Fonts are ignored), anything other than exactly one `<h1>`, horizontal
   scroll, text pushed past the right edge (hidden by an overflow clip), a visible control with no
   accessible name, or a phone button smaller than 44×44 px. On three rich states it also opens
   the Chronicle, Council (every tab), Saves and Settings overlays, audits them, and checks that
   Escape closes them.
2. **Playthrough.** A whole reign through the UI from the title screen. It clicks buttons by
   their accessible names and plays duels with real keyboard input. Then it saves, quits to the
   title, reloads the page and continues, checking the world remembered everything; then it goes
   through the Passing into reign II and checks that the first briefing cites reign I. The steps
   live in `scripts/e2e-play.mjs`.
3. **Installable build.** A production build with `BASE_PATH=/elvia-pwa/` (built in a child
   process, because the in-process dev server sets `NODE_ENV=development`), served by
   `vite preview`. It checks the manifest and every icon load as PNGs under the base path, that
   the service worker activates and controls the page, then **shuts the server down** and checks
   the game still loads and starts a new reign offline. Screenshots: `play/NN-pwa-offline-*.png`.

Output goes to `e2e-artifacts/` (git-ignored): `sweep/<viewport>-<scenario>.png`,
`play/NN-<viewport>-<step>.png`, and `report.json` (the audit results and every failure). Exit
code 0 means everything passed.

Playwright: the script imports a local `playwright` package if one is installed, otherwise a
global one (`npm root -g`). On a new machine run `npm i -D playwright && npx playwright install
chromium`, or install it globally. In the Claude Code cloud sandbox Chromium and Playwright are
preinstalled: don't run `playwright install` there.

## Screenshot review

A green run with an ugly or broken screen is still a failed run. Open the PNGs and check:

- The regal magitech look: stone, brass, navy, gold light, ember. No neon, cyan glow or scanlines.
- One clear focal point per screen, with the primary action within thumb reach on phones.
- Readable text (body ≥ 15 px on phones); names, costs and warnings are never clipped.
- No raw relationship numbers, and the hidden NarrativeIntensity never shown.
- Region states read at a glance in the march art (STABLE / FORTIFIED / AFTERMATH).
- On desktop the layout uses the width (two columns where sensible), with no stretched mobile column.

AI assistants that can read images (Claude, GPT-4-class models, Gemini) can do this review
from the PNGs.

## Extending the tests

| You changed… | Add or update |
|---|---|
| A game rule, order, effect, legacy | A vitest test next to the module (or extend `playthrough.test.js` when it spans phases). Assert outcomes via `dispatch`/`getView`, not internals. |
| Added a phase, beat or major UI state | A scenario in `src/game/dev/scenarios.js` (built with `run`/`choose`/`duel` helpers, never by hand-editing state) plus its expected phase in `scenarios.test.js`. The e2e sweep then covers it automatically. |
| Duel tuning or a new archetype | `engine.test.js`: the oracle must still win, idle must lose, and the fairness suite must find a zero-damage answer for every pattern. |
| GameState shape | `src/game/save/migrate.js` migration + version bump + a migration test in `saveSystem.test.js`. |
| A narrator generator | `schemas.test.js` (schema + repair) and `generators.test.js` (fallback, AI path, proposals validated). |
| A UI flow | Update `scripts/e2e-play.mjs` if button names or steps changed. Keep button labels descriptive and stable; the playthrough finds them with `getByRole('button', { name })`. |

Determinism is a test-wide assumption: never call `Math.random()` or `Date.now()` in
`src/game/**` (outside `save/` and `ai/`), or the determinism tests and scenarios will drift.

## Troubleshooting

- **e2e can't find Playwright:** install it locally (`npm i -D playwright`) or globally; then
  `npx playwright install chromium`.
- **e2e fails with "scenario did not render":** open `/?scenario=<name>` in `npm run dev` and
  look at the browser console; usually a screen threw on an unexpected view shape.
- **A tap-target failure on a decorative element:** decorative SVG should be `aria-hidden`; real
  small buttons need `min-h-11 min-w-11` (44 px).
- **Flaky screenshot diffs:** the gate runs with reduced motion. Animations must respect
  `prefers-reduced-motion` and `html[data-motion="reduced"]`.
