# The Greywater Front (first-person mode)

A first-person shooter mission set in the same world as the strategy game: the Sovereign walks
the frontier road in person, breaks a Syndicate picket, takes back the Greywater checkpoint,
wades the ford under a walker's searchlight, and brings the walker "Patience" down in the burning
depot. It ends with the pilot's surrender and a choice.

It is a separate mode. The strategy game (War Room, march, duels, campfires, the Passing) is
unchanged and nothing in the mission writes to a reign's `GameState` yet.

- **Open it:** the title screen's "The Greywater Front" button, or any URL with `?fps`.
- **Split:** like the duel, a pure simulation (`src/game/fps/`) and a renderer plus screen
  (`src/ui/fps/`). The simulation knows nothing about three.js; the renderer changes nothing in
  the game.
- **Dependency:** [three.js](https://threejs.org) (MIT), loaded only when the mission is opened
  (its own lazy chunk).
- **Assets:** photo-scanned CC0 textures, three models and a night-sky HDRI from Poly Haven live
  in `public/fps/` (about 11 MB, fetched when the mission loads; credits in
  `public/fps/CREDITS.md`). They are optional: every surface also has a procedural version baked
  in code, which is what you see if a file fails to load. Sound is all synthesised.

## How it plays

| Thing | What it is |
|---|---|
| **Lattice Carbine** | Automatic coil-rifle. 30-round cell, damage falls off past 30 m. With no reserve left it slowly draws one magazine back from the Lattice, so you are never stuck without a weapon. |
| **Sunlance** | One bright line per trigger pull. High damage, pierces two enemies, long zoom. |
| **Shield Ward** (hold) | Soaks what comes from the front while it is up. It drains while raised and returns when lowered. You cannot fire through it. |
| **Arc Pulse** | Staggers and hurts everyone within about 9 m, damages the walker's knees, and unmakes bolts in the air. 11 s cooldown. |
| **Blade** | A quick cut for anything within arm's reach. |
| **Health** | Returns after a few quiet seconds (to half on Veteran). Field draughts restore 50. |
| **Falling** | Never the end: you rise at the last checkpoint. The walker fight has one mid-way. |

Enemies, all of which announce every attack before it lands:

- **Riflemen** fight from cover: crouch out of sight, stand, aim (a visible beat), fire a
  three-round burst of bolts that travel. Moving sideways or breaking sight beats them.
- **Shock-troopers** run you down with a blade: a wind-up you can back away from, ward or shoot.
- **Heavies** spin up for most of a second, then walk a stream of fire toward where you were.
  The glowing pack on the back is the weak point; the breastplate turns frontal shots.
- **The walker "Patience"** fires telegraphed shell salvos (a ring marks each landing point),
  stomps when you are close (jump it), and past 72% health sweeps a lance of light (get behind
  stone, or ward). Break both knees and it kneels: its hull and lamp take double damage and more.
  Fuel casks in the yard hurt it badly.

Difficulty (`story`, `soldier`, `veteran`) scales enemy damage and aim, never their tells.

### Controls

| | Keyboard and mouse | Touch | Gamepad |
|---|---|---|---|
| Move | W A S D | left thumb: floating stick | left stick |
| Look | mouse | drag anywhere on the right | right stick |
| Fire / aim | left / right button | Fire (hold and drag to aim) / Aim | RT / LT |
| Sprint / crouch / jump | Shift / C (or hold Ctrl) / Space | push the stick fully forward / Duck / Jump | L3 / d-pad down / A |
| Reload / swap | R / 1, 2, X or wheel | Load / Swap | X / Y |
| Shield Ward (hold) | F | Ward | LB |
| Arc Pulse / blade | Q / V or middle button | Pulse / Blade | RB / R3 |
| Use | E | Use (appears when needed) | B |
| Pause | Esc or P | pause button | Start |

Sensitivity and inverted look are in the pause menu; difficulty and graphics quality on the
briefing. Settings and the best time are kept in `localStorage` under `elvia.fps.v1`.

## Simulation (`src/game/fps/`)

Deterministic and DOM-free, like the rest of `src/game`: fixed 60 Hz steps from an accumulator,
every random draw from `core/rng.js`. Unlike the duel engine it **mutates its state in place**
(dozens of bodies and bolts at 60 Hz); callers keep one state object.

| File | What is in it |
|---|---|
| `level.js` | The mission as data: `groundY(x, z)` terrain, `surfaceAt`, solids (axis-aligned boxes with a kind the renderer draws), gates, trees, lamps, fires, banners, enemies, cover points, pickups, the bot route. `buildLevel()` builds once and freezes. `steerThroughGates` routes anything that walks through the palisade openings. |
| `physics.js` | `moveCircle` (cylinder against boxes with step-up), `floorAt`, `rayBox`, `raySolids`, `rayGround`, `losClear`, `raySphere`, `rayCylinder`. |
| `combat.js` | Tuning tables (`PLAYER`, `WEAPONS`, `ENEMY`, `DIFFICULTY`), hit zones (`rayEnemies`), `damageEnemy`, `hurtPlayer` (with the ward), `explode`, `alertGroup`, `deployGroup`, `emit`. |
| `ai.js` | Rifleman, trooper, heavy and walker behaviour. The fairness rules are at the top of the file. |
| `sim.js` | `createFps(config)`, `stepFps(state, input, dtMs)`, `respawn`, `resolveSurrender`, `getHud`, `getResult`, `getEye`; the player, weapons, projectiles, pickups, checkpoints and the mission script (`STAGES`). |
| `lore.js` | Mission brief, the council's linkstone lines (`RADIO`), the five dispatches, the Chronicle line. All authored. |
| `bots.js` | `createBot('oracle' | 'recruit' | 'idle')`: bots that play through the same inputs a person has. Tests only. |

```js
const state = createFps({ seed: 412, difficulty: 'soldier' }); // also: stage, god (dev)
stepFps(state, {
  moveX, moveZ,          // −1..1, +moveZ is forward
  yaw, pitch,            // radians; yaw 0 looks toward −z, pitch > 0 looks up
  fire, ads, ward, sprint, crouch,            // held
  jump, reload, swap, weapon, pulse, melee, interact, // presses: act once per call
}, dtMs);
for (const ev of state.events) { /* only this call's events */ }
```

Stages: `advance → picket → checkpoint → gate → ford → depot → surrender → done`.
`createFps({ stage })` starts at any of them with the earlier ones already won.

Events the UI consumes include `shot`, `enemy_hit`, `enemy_down`, `enemy_aim`, `enemy_fire`,
`enemy_windup`, `enemy_strike`, `heavy_spin`, `impact`, `explosion`, `player_hit`, `ward_block`,
`pulse`, `melee`, `step`, `jump`, `land`, `reload_start`, `reload_end`, `swap`, `pickup`,
`dispatch`, `radio`, `objective`, `checkpoint`, `gate`, `deploy`, `alert`, `walker_engage`,
`walker_aim`, `walker_fire`, `walker_stomp_wind`, `walker_stomp`, `walker_charge`, `walker_beam`,
`walker_leg`, `walker_kneel`, `walker_stand`, `walker_down`, `surrender`, `dead`, `respawn`, `won`.

### Changing the mission

- **Tuning:** the tables in `combat.js`. Run `npx vitest run src/game/fps` afterwards: bots must
  still finish on every difficulty and an idle player must still lose.
- **Layout:** `buildLevel()` in `level.js`. Add solids with `add(kind, x, z, w, d, h)`; a new
  `kind` needs a case in `addSolid` in `src/ui/fps/engine/world.js`. The level tests fail if an
  enemy, pickup, cover point or route node ends up inside a solid.
- **Story:** `lore.js`, and the triggers in `stepScript` in `sim.js`.

## Renderer (`src/ui/fps/engine/`)

| File | What it draws |
|---|---|
| `assets.js` | `loadScans(quality, renderer, onProgress)`: the Poly Haven textures (`ground`, `road`, `stone`, `ashlar`, `wood`, `bark`, `plate`, `slate`, `rock`), models (fuel drum, boulders, ferns) and HDRI. Low quality loads 512 px textures only; medium and high load 1024 px textures, the models and the HDRI. Anything missing is skipped. |
| `textures.js` | Tileable noise baked at load into albedo, normal and roughness/metalness maps: stone, ashlar, road, ground, wood, bark, canvas, plate, brass, gunmetal, slate, rock, needles, cloth, char, water. `pbr(set, opts)` makes a material. |
| `sky.js` | Shader sky dome (moon, stars, cloud, the depot's glow), the moon as key light with a shadow that follows the camera, a prefiltered environment map, fog. |
| `world.js` | Terrain mesh from `groundY` with painted vertex colours, the river shader, every solid merged per material, instanced pines and grass, lamps, banners, pickups, the gate, winch and fuel casks. |
| `actors.js` | Soldiers posed from simulation state (walk, crouch, aim, fire, wind-up, stagger, fall, surrender) and the walker: two inverse-kinematic legs that step, searchlight with a spot light and a cone of lit dust, gun, knee lights. |
| `viewmodel.js` | The carbine and Sunlance with gauntlets, in their own scene and depth: sway, bob, recoil, reload, aim, sprint, swap, the Shield Ward lattice, the blade. |
| `fx.js` | Pooled particles (fire, smoke, sparks, dust, splashes, mist), tracers and bolts, scorch decals, blast flashes, ground rings for shell markers and the Arc Pulse, transient lights. |
| `post.js` | HDR composer: world, then weapon, then bloom, then one pass for ACES tone mapping, grade, vignette, grain and the hurt, low-health and ward overlays. |
| `merge.js` | `bake(group, keep)`: collapse static meshes under a bone or a gun into one mesh per material. |
| `index.js` | `createFpsRenderer({ canvas, quality, reducedMotion })` → `{ load(onProgress), frame(state, events, dt, view), resize, dispose, stats }`. Quality tiers `low`, `medium`, `high` (`QUALITY`); `guessQuality()` picks low on phones. A fixed pool of point lights is handed to the nearest sources each frame. Resolution steps down on its own if frames run slow. |

Rules that matter when changing shaders: clamp the base of every `pow` away from zero and never
pass a reversed `smoothstep`; one invalid pixel spreads through the bloom and blacks out the frame.
Guard against a zero-size canvas (the renderer keeps its last size).

## Screen (`src/ui/fps/`)

- `FpsScreen.jsx`: canvas, loop and menus. Modes: `brief`, `playing`, `paused`, `paper`
  (reading a dispatch), `dead`, `surrender`, `result`. The root carries `data-fps-mode`.
- `input.js`: keyboard and mouse (pointer lock), touch (floating stick, drag-look, buttons) and
  gamepad, folded into the simulation's input record.
- `Hud.jsx`: HUD and `TouchControls`. The crosshair, hit marker, hurt arc and stick are moved by
  the loop through refs; the rest re-renders about twelve times a second.
- `sfx.js`: synthesised sound on the main audio engine's context, volume and mute. Music is the
  `march` theme, `duel` while a fight is on, `passing` on the result.

URL parameters with `?fps`: `stage=`, `quality=`, `difficulty=`, `autostart=1`, `showfps=1`, and
in dev builds `god=1`. In dev builds `window.__elviaFps` is the running game (state, renderer,
input); the e2e check reads it.

### Dev lab

`/?lab=fps` (dev only, `src/ui/dev/FpsLab.jsx`) renders one still or live view without the HUD:
`x`, `z`, `y`, `yaw`, `pitch` (degrees) place the camera; `stage`, `t` (seconds to simulate
first), `bot`, `warm` (seconds of effects before the still), `live=1`, `quality`, `weapon=0`,
`ads=1`, `fire=1`, `ward=1`, `hide=water,grass,trees,terrain,static`, `bench=N`.

## Tests

- `src/game/fps/fps.test.js` (25 tests): level sanity, movement and collision, weapons, ward,
  pulse, fuel, pickups, checkpoints, determinism, every attack announced, a jump clears the
  stomp, idle loses, and bots finish the mission on Story, Soldier and Veteran.
- `npm run e2e -- --fps`: the real screen in headless Chromium with software WebGL: opened from
  the title, walk, fire, swap, pause, leave; the surrender and result; the phone touch layout
  (every control named, at least 44 px, on screen, and Fire fires).

## Known limits

- Surfaces, rocks and fuel drums are photo-scanned; soldiers, the walker, the weapons, buildings
  and pines are still built in code. It looks far better than the first version but it is not a
  current console shooter.
- Frame rate was only measured with a software renderer here. On real hardware, use
  `?fps&showfps=1` and the quality setting.
- The mission's result is not written into a reign yet.
- One mission, two weapons, four enemy types. No aim assist on touch or gamepad.
- Soldiers are built from primitives and posed in code: readable, not lifelike.

## Where to take it

- **More real assets:** scanned trees are 500 MB to 1 GB each on Poly Haven, so pines need
  low-poly models from elsewhere (Quaternius, Kenney: CC0). Rigged, animated soldiers (for
  example from Mixamo, whose licence allows use in games) would be the largest remaining gain.
- **Engine pieces:** `three-mesh-bvh` (fast ray casts), `@dimforge/rapier3d-compat` (physics),
  `postprocessing` or `realism-effects` (ambient occlusion, reflections), `three-nebula`
  (particles), `troika-three-text` (in-world text).
- **Packaging:** Capacitor wraps the same build as an Android or iOS app.
- **Tie it to the reign:** dispatch the result as a controller action so a reign's turn-4 "Ride
  to Greywater" can be fought in first person and remembered by the Chronicle.
