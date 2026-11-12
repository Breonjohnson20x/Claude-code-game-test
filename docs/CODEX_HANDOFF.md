# Handoff: continuing the first-person mission in another coding agent

Written for an AI coding agent (Codex or any other) picking this repository up cold. Read
`AGENTS.md` first (the rules), then this file, then `docs/FPS.md` (how the mission is built).
`docs/HANDOFF.md` covers the strategy game, which is finished and should not need changes.

## Where things stand

- **Repository:** `Breonjohnson20x/Claude-code-game-test`. `main` is the default branch and holds
  everything described here.
- **Live build:** https://breonjohnson20x.github.io/Claude-code-game-test/ (the mission:
  add `?fps`). `.github/workflows/pages.yml` deploys on pushes to
  `claude/build-strategy-game-OnF1b` and `main`; the `github-pages` environment only accepts
  the branch it is configured for, so a deploy from the other one fails harmlessly.
- **The mission works end to end:** briefing → road → picket → checkpoint and gate → ford →
  walker boss → the pilot's surrender → result. Mouse and keyboard, touch, gamepad.
- **Checks that pass on `main`:** `npm test` (193 tests), `npm run lint` (0 errors),
  `npm run build`, `npm run e2e` (strategy game sweep and playthroughs, the first-person step,
  the offline build).
- **Never measured on real hardware.** Every check ran in headless Chromium with a software
  renderer (a few frames per second). Frame rate and touch feel on a real phone are unknown;
  the owner reported the first touch build as buggy, a round of fixes followed (see
  "Touch controls" below), and that round has not been confirmed by the owner yet.

## Commands

```bash
npm install
npm run dev                 # http://localhost:5173/?fps   (mission)   /?lab=fps   (art lab, dev only)
npm test                    # must stay green; src/game/fps/fps.test.js is the mission's
npm run lint && npm run build
npm run e2e -- --fps        # the mission in headless Chromium (software WebGL), about 3 minutes
npm run e2e                 # everything, about 25 minutes
node scripts/fps-shot.mjs shots "yard=lab=fps&stage=checkpoint&x=0&z=-61&quality=high"
```

`scripts/fps-shot.mjs` is how to *see* a change: it starts its own dev server, opens the lab
or the real screen, waits for it, and writes a PNG. Look at the PNG before calling visual work
done. Lab parameters are listed in `docs/FPS.md` ("Dev lab"). Useful views:

| What | Query |
|---|---|
| Start of the road | `lab=fps&quality=high` |
| A rifleman behind a wall | `lab=fps&stage=picket&x=-7&z=-27.2&yaw=20&pitch=-8&weapon=0&quality=high` |
| Checkpoint yard mid-fight | `lab=fps&stage=checkpoint&bot=recruit&t=7&god=1&quality=high` |
| A shock-trooper up close | `lab=fps&stage=ford&bot=idle&x=1&z=-139&warm=0.2&quality=high` |
| The walker | `lab=fps&stage=depot&x=4&z=-162&yaw=8&pitch=4&quality=high` |
| The real screen with HUD | `fps&autostart=1&quality=low` (add `&stage=depot&god=1`) |
| Phone layout | same, with `SIZE=phone` in the environment |

Do not edit source files while `npm run e2e` is running against the same checkout: the dev
server reloads and the run fails. Copy the tree and run it there.

## Rules that are easy to break

- `src/game/fps/**` is pure and deterministic: no `Math.random`, `Date.now`, DOM or three.js.
  A test greps for them. The renderer never changes game state.
- Assets must be CC0 (or the owner's own), listed in `public/fps/CREDITS.md`, and optional at run
  time: if a file fails to load, the procedural version must still appear (`AGENTS.md` rule 8).
- In shaders, clamp the base of every `pow` away from zero, never pass a reversed `smoothstep`,
  and never feed a `Vector3` to `Color.multiply`: one invalid pixel spreads through the bloom
  and blacks out the whole frame. This happened twice.
- A canvas can measure 0×0 while screens swap. The renderer keeps its last size; keep that guard.
- Look: regal magitech. Stone, brass, deep navy, warm gold light, ember. No neon, no cyan.
- Commits: Conventional Commits. Update `docs/FPS.md` in the same change as the code it describes.

## Next task: real character models

The largest remaining visual gap. Soldiers and the pilot are built from capsules and boxes in
`src/ui/fps/engine/actors.js` (`buildSoldier`, `poseSoldier`) and posed in code from simulation
state. The walker is also procedural but reads acceptably; leave it for later.

### What the renderer needs from a character

`poseSoldier(rig, e, state, time, dt)` reads these from each enemy `e` every frame. A skinned
model has to express the same things, because they are the game's tells:

| Simulation state | What must be visible |
|---|---|
| `e.speed`, `e.yaw` | idle, walk or run, facing `yaw` (forward is −z at yaw 0) |
| `e.crouch` (riflemen in `cover`) | crouched low enough to hide behind a 1.15 m wall |
| `e.state === 'aim'` then `'burst'` | weapon raised: this is the warning before bolts fly |
| `e.state === 'windup'` → `'recover'` (trooper) | blade raised for 0.46 s, then the cut |
| `e.state === 'spinup'` → `'fire'` (heavy) | braced, weapon level; the back pack glows |
| `e.state === 'stagger'` | reeling |
| `e.hp <= 0` | falls and stays down; `e.surrendered` kneels with hands up instead |
| `state.t - e.hitT < 160` | a flinch |

Hit zones in `src/game/fps/combat.js` (`rayEnemies`) assume a body cylinder of radius about
0.38 m and height 1.78 m (0.66× when crouched), a head sphere at 92% of the height, and for the
heavy a pack sphere 0.5 m behind the spine. Scale and pose the model to match, or headshots
will not line up with what the player sees.

### How to do it

1. **Get a model.** It must be CC0, rigged, and have at least idle, walk, run and death clips.
   - Reachable and verified CC0: `RobotExpressive.glb` in the three.js repository
     (`examples/models/gltf/RobotExpressive/`, model by Tomás Laulhé / Quaternius, CC0 1.0,
     464 kB, clips: Idle, Walking, Running, Death, Punch, Jump, and more). It is a stylised
     robot: good for proving the pipeline, wrong for the final look.
   - Better fits, to be downloaded by the owner or with network access to them: Quaternius
     "Ultimate Modular Men", "Animated Men" or "Knight" packs (CC0, quaternius.com), Kenney
     "Animated Characters" (CC0, kenney.nl).
   - Not allowed by the current rule without the owner saying so: Mixamo characters and
     three.js's `Soldier.glb` (Adobe's licence allows use in games but they are not CC0), and
     anything CC-BY unless the owner accepts attribution.
2. **Put it in `public/fps/models/<name>/`**, add it to `MODELS` in
   `src/ui/fps/engine/assets.js` and to `public/fps/CREDITS.md`. `loadScans` currently bakes
   each mesh to the origin and discards the skeleton: skinned models need their own loading
   path that keeps `gltf.scene` and `gltf.animations`.
3. **Instance it per enemy** with `SkeletonUtils.clone(gltf.scene)`
   (`three/addons/utils/SkeletonUtils.js`) and one `THREE.AnimationMixer` each.
4. **Drive it from state** in a `poseSkinned(rig, e, state, dt)` beside `poseSoldier`:
   cross-fade clips by `e.state` and `e.speed`; where no clip exists (aim, crouch, wind-up),
   rotate bones after `mixer.update` (spine and upper arms for aim; hips and knees for crouch).
   Keep the root at `(e.x, e.y, e.z)` with `rotation.y = e.yaw` (add π if the model faces +z).
5. **Keep the procedural rig as the fallback** when the model did not load, and on the `low`
   quality tier if skinning costs too much on phones.
6. **Attach the weapon** (the existing rifle, cannon or shock-blade meshes from `buildSoldier`)
   to the right-hand bone, and tint materials toward Syndicate greys with an ember sash and an
   amber visor so the three enemy types stay distinguishable at a glance.
7. **Verify:** `npm test`; `npm run e2e -- --fps`; screenshots of each enemy type idle, aiming,
   crouched, winding up, staggered and dead, at `quality=high` and `quality=low`.

## Other work, in rough order of value

1. **Measure on a real phone and a real GPU** (`?fps&showfps=1`). Software rendering here says
   nothing. If the phone is slow: fewer soldiers drawn at once, smaller draw distance, cheaper
   bloom (`post.js`), fewer triangles in `world.js` (pines are the bulk).
2. **Touch feel**, once the owner has tried the fixed build: sensitivity default, button
   placement, whether an auto-fire option is wanted.
3. **Low-poly CC0 pines** to replace the procedural cones (Poly Haven's scanned trees are 0.5 to
   1 GB each and unusable).
4. **Tie the result to a reign:** a controller action so a reign's turn-4 "Ride to Greywater"
   can be fought in first person and written into the Chronicle.
5. **More mission:** a second weapon tier, Frost Warg enemies, a daytime level.

## Touch controls: what was wrong and what was changed

Recorded because it has not been confirmed on a device.

- Presses on on-screen buttons were also handled as the movement stick or a look drag (the
  wrapper's native `pointerdown` listener ran before React's `stopPropagation`). `input.js`
  now ignores presses whose target is inside a `<button>`.
- Sprinting (stick fully forward) blocked firing. In `sim.js` the trigger now wins over
  sprinting.
- Added: look acceleration, a stick dead zone, aim slowdown near enemies (`setAssist`, computed
  in `FpsScreen.jsx`), blocked browser gestures, Pause on press, larger buttons, and no shadow
  pass on the `low` tier.

## Map of the mission's code

```
src/game/fps/         level.js · physics.js · combat.js · ai.js · sim.js · lore.js · bots.js · fps.test.js
src/ui/fps/           FpsScreen.jsx · Hud.jsx · input.js · sfx.js
src/ui/fps/engine/    index.js · assets.js · textures.js · sky.js · world.js · actors.js · viewmodel.js · fx.js · post.js · merge.js
src/ui/dev/FpsLab.jsx the art lab
public/fps/           scanned textures, models, HDRI, CREDITS.md
scripts/e2e.mjs       the gate (fps step near the bottom) · scripts/fps-shot.mjs screenshots
```

## Settings outside the repository

- GitHub Pages is on, source "GitHub Actions".
- The owner's Claude cloud environments: "Default Cloud Environment" allows
  `api.polyhaven.com` and `dl.polyhaven.org` (added to download the scanned assets); a spare
  environment named "Claude-code-game-test" has the same hosts and is unused. Neither matters
  to another agent.
