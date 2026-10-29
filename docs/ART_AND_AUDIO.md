# Art and audio

Everything you see and hear in OmniStrat is generated in code: SVG and canvas for art, the Web
Audio API for music and sound. There are no image, sound or font files in the repository; the
two typefaces (Cinzel and Cormorant Garamond) load from Google Fonts at runtime, with regal
fallbacks if that fails. No assets, names or likenesses come from other games.

**Contents:** [Visual direction](#visual-direction) · [Theme tokens](#theme-tokens-and-classes) ·
[Components](#art-components) · [Scenes](#region-scenes) · [Portraits](#portraits) · [Backdrops](#backdrops) ·
[Duel rendering](#duel-rendering) · [Audio](#audio) · [Performance and accessibility](#performance-and-accessibility) ·
[Extending](#how-to-extend)

## Visual direction

"Regal magitech" (Master Build §7, §35): stone, brass, deep navy, warm gold light, ember, arcane
geometry. **Not** cyberpunk: no neon, no cyan glow, no scanlines. "AAA-inspired presentation, not
AAA production scale": strong composition, layered depth (sky → far hills → midground →
foreground), one key light from the upper right (rim highlights sit on the right edge of forms),
restrained animation, and typographic hierarchy (Cinzel for display, Cormorant Garamond for
prose, a sans for UI). The broken-circle **Architect symbol** is the recurring motif.

## Theme tokens and classes

`src/styles/theme.css` (Tailwind CSS v4 `@theme`), imported by `src/index.css`.

- **Colour scales**: `navy-950…500`, `stone-*`, `parchment-50…500`, `ink-*`, `gold-200…800`,
  `ember-*`, `crimson-*`, `lattice-*` (pale arcane gold-white), `iron-*`, `brass-*`, `frost-*`,
  `acid-*` (Sparky's green, used sparingly), `moss-*`. Use them as Tailwind utilities
  (`bg-navy-900`, `text-gold-300`, `border-ember-400/50`). The same values are mirrored for the
  procedural art in `src/ui/art/palette.js` (`C`), with per-time-of-day lighting rigs (`LIGHT`)
  and portrait mood tints (`MOOD_TINT`).
- **Fonts**: `font-display` (Cinzel), `font-serif` (Cormorant Garamond), `font-body`.
- **Material language**: one premium material for the whole interface: lacquered navy steel in
  cast brass, polished gold for the primary action, a faint brushed grain (`--elvia-brush`, an
  inline SVG noise). Surfaces are ranked: `.panel` is the hero surface (near-black outer line,
  brass bevel lit from above, a brass hairline, gilded corner caps), one per screen; panels that
  are direct children of a `.grid`, and `.panel--quiet`, drop the caps. Inside sheets and panels
  use `.tablet` (raised lacquer card; `.tablet--stone` for dead or settled things), `.well`
  (recessed; `.well--lit` for earned or in effect, `.well--stone`), `.label-engraved` (small
  kickers), `.coin` (struck gold numerals), `.socket` (an icon in a brass socket) and `.pip` /
  `.pip--on` (diamond progress).
- **Components**: `.panel`, `.panel--quiet`, `.panel-parchment`, `.panel-tight`, `.btn-royal`
  (polished gold, engraved inner rim, a slow sheen on hover/focus), `.btn-ghost` (brass-edged),
  `.btn-danger`, `.btn-icon` (+ `__badge`, an engraved brass socket with an enamel badge),
  `.order-card` (with `__key`, `__body`, `__title`, `__desc`, `__meta`, `--danger`, `--quiet`
  for the lighter talk-row card, and `aria-pressed` for selected), `.chip` +
  `.chip--gold|ember|crimson|frost|iron|parchment`, `.meter` (a recessed channel with ticks),
  `.gold-rule` (with a set ember jewel), `.plaque` (+ `__label`, `__value`, `__delta--good|bad`:
  the top bar's resource tiles), `.chrome-bar` (opaque, on a brass rail with a 14 px fade under
  it), `.topbar-nav`, `.screen-veil`, and the controls `.switch` / `.switch__knob` (kit `Toggle`),
  `.seg` / `.seg__opt` (kit `Segmented`, the Dossier tabs), `.range-elvia` (set `--fill` inline)
  and `.field` (inputs and selects).
- **Text and light**: `.text-gilded`, `.text-engraved`, `.text-glow-gold`, `.text-glow-ember`,
  `.glow-gold`, `.glow-ember`, `.glow-crimson`, `.vignette`, `.bg-war-room`, `.scroll-elvia`,
  `.drop-cap` (a boxless gilt Cinzel initial two lines deep with an engraved shadow).
- **Motion**: `animate-fade-up`, `animate-fade-in`, `animate-slow-glow`, `animate-torch-flicker`,
  `animate-ember-drift`, `animate-seal-press`, `animate-banner-sway`, and `.arch-breathe` (the
  Architect symbol's breath: the individual CSS `scale` property, so callers' translate and
  opacity classes still apply). All are disabled under `prefers-reduced-motion` and
  `html[data-motion="reduced"]` (the in-game Settings toggle).
- `html[data-text-size]` scales all text (Settings → Text size).

## Art components

All exported from `src/ui/art/index.js`. Decorative art is `aria-hidden`; components that carry
meaning take a `label`.

| Component | Props | What it draws |
|---|---|---|
| `RegionScene` | `beat`, `regionState`, `timeOfDay`, `season`, `monuments`, `className`, `style`, `label`, `animated`, `card`, `vignette`, `fade` | The Southern Marches as a matte-painted 400×220 SVG that crops around a focal point to fill any box |
| `WarRoomBackdrop` | `threats: { syndicate, wargs, refugees }` (0–100), `regionState`, `dim` (default true), `className` | A candle-lit war table seen at an angle, with a parchment map of Elvia and the room around it |
| `CampfireScene` | `intensity` (0–1), `fireX` / `fireY` (fractions of the box, or a `[portrait, wide]` pair; `fireY` defaults to 0.82), `band`, `moon` (`[x, y]` fractions, a `[portrait, wide]` pair, or `false`), `zoom`, `variant` (`'camp'` or `'last'`), `scrim` (a node), `className`, `style` | The night camp on canvas: moonlit sky and mountains, tents, the Sovereign, Mara and Sparky by a real fire |
| `Portrait` | `id`, `size`, `mood`, `label`, `ring` (default true), `className`, `style` | Painted bust in an engraved gold ring |
| `FactionCrest` | `id` (`iron_syndicate`, `frost_wargs`, `elvia`), `size`, `title` | Shield crest with a cast rim, designed for 56–64 px |
| `ArchitectSymbol` | `size`, `glow` (bool or 0–1), `animated`, `color` (default gold-300 `#f0dc95`), `ticks` | The broken circle with a four-point star on a navy field |
| `Sigil` | `name` (`diamond`, `star`, `crown`, `ward`, `ember`, `quill`, `sword`, …), `size`, `color`, `title` | Small inline glyphs |
| `GoldDivider` | `height`, `className` | Ornamental rule |
| `PanelCorners` | `size`, `inset`, `color`, `opacity` | Corner filigree for panels |

`ArchitectSymbol` keeps a navy inner field with a tight gold light at the star and its glow
outside the ring; `animated` applies the `.arch-breathe` CSS scale (not SMIL). Crests have heavy
cast rims; the Iron Syndicate is a polished brass gear around an ember-lit iron field with a steel
hammer, and the Dossier shows crests at 88 px from `sm` up.

The **app icon** (home screen, install dialogs) is the same broken circle and star, drawn in
`scripts/pwa/icon.mjs` with signed distance fields and written as PNG at dev-serve and build time
(192, 512, a full-bleed maskable 512, and a 180 px apple-touch-icon). No image files are
committed; change the icon by editing that file.

Also exported: `ensureFonts()` (adds the Google Fonts link once), `FONT_HREF`, `C`, `LIGHT`,
`MOOD_TINT`, `PORTRAIT_IDS`, and `normalizeBeat` / `normalizeRegionState` / `normalizeTimeOfDay`.
Shared helpers live in `src/ui/art/util.js` (seeded `mulberry32`, `useReducedMotion`,
`watchVisibility`, `useSvgPause`, ridge, forest and figure path builders).

`src/ui/art/Atmosphere.jsx` (imported directly, not through `index.js`) holds the atmosphere
shared by the title and the War Room:

- `LightRays({ rays, strength, spread, originX, seed, color, className, style })`: a few soft,
  feathered shafts in a narrow downward cone, fading before the bottom edge. A static SVG with a
  baked `feGaussianBlur`; never animated, no blend modes.
- `Motes({ count, color, shaft, seed, opacity, rise, className })`: dust drifting in warm light
  on one small canvas at DPR 1, stepped at most 30 times a second, paused offscreen or in a hidden
  tab, one still frame under reduced motion, never stepped at 0×0. Keep its positioned parent as
  small as the effect needs.

Screen-level ornaments that are not procedural art live with their screens:
`src/ui/screens/warroom/ornate.jsx` (`Medallion`, an engraved letter coin; `Filigree`;
`TitleRule`, the full-width rule under page titles), `src/ui/screens/warroom/tones.js`
(`CATEGORY_TONE` / `categoryTone`, a theme-token accent per order category;
`shortCategoryName`; `dropCapClass(text)`, which gives an opening paragraph of 150 characters or
more the `.drop-cap`), and `src/ui/screens/passing/Manuscript.jsx` (`Manuscript`, `Headpiece`:
the illuminated page under the Passing's Chronicle and the Resolution's new entries).

## Region scenes

`RegionScene` (`src/ui/art/RegionScene.jsx`) is a layered matte painting built from the modules
in `src/ui/art/scene/`:

| File | Holds |
|---|---|
| `atmos.jsx` | `SkyDome` (horizon glow, sun bloom or a masked crescent moon behind the cloud bank, stars, cloud banks of soft puffs lit from the sun or moon, cirrus and stratus), `Range` (opaque snow-capped mountains with shadowed west faces), `Land` (graded depth layers with haze and rim light), `GodRays`, `FogBand`, `Mist`, `Grass`, `Birds`, `Bloom` |
| `tone.js` | `tone(L, tod)`: the extended per-time-of-day colours, every one mixed from the palette and `LIGHT` (no new hues); `dayRig` (day frames: slate rock with navy shadow faces, aerial haze toward sky blue); `normalizeSeason` / `seasonal` |
| `flora.js` | Firs, groves and boulders, each batched into a few paths |
| `parts.jsx` | Set pieces: Keep, Village, Gatehouse, Depot, Monolith, StandingStone, Lantern, Pylon, Banner, Tent, Cart, Crowd, Smoke, Snowfall and more |
| `actors.jsx` | `Wolf` / `WolfPack` (a timber wolf drawn with spline outlines: dark saddle, grey-blue coat, frost ruff, jointed legs), `Walker` / `WalkerBeam` (the Iron Syndicate walker: armoured cockpit, boiler and stacks, pistons, running lamps, exhaust), `RoyalParty`, `refugeePath` / `mulePath`, `CheckpointGate` (gate, guard hut, lantern-lit desk), `WardLanterns` |
| `beats.jsx` | The six compositions, each built sky → ranges → fog → far land → mid land → focal set piece → near land → foreground → light → grade |
| `frame.js` | Framing maths (`FOCUS`, `CARD_FOCUS`, `cropBox`), tested in `frame.test.js` |

- **Beats**: `road`, `checkpoint`, `wilds`, `ruin`, `champion`, `camp`. Aliases map game beat ids
  (`skirmish`, `last_stand` → champion; `campfire` → camp); unknown beats fall back to the road.
  The champion beat is Greywater Ford: the walker stands in the river with its legs below a water
  line, and the depot burns in AFTERMATH or at night.
- **Region state changes the world** (Master Build §8): STABLE shows civilian life (carts,
  traders, farms); FORTIFIED adds soldiers, barricades, Aegis pylons and ward lanterns;
  AFTERMATH shows smoke, scorch marks, broken carts and bandaged silhouettes.
- **Time of day**: `day`, `dusk`, `night` (with `evening`, `dawn`, `sunset` as aliases), each with
  its own light rig. Distance comes from aerial haze, never transparency. At dusk each cloud is lit
  on its belly from its own clipped silhouette.
- **Season** (optional): `'winter'`, `'autumn'` (or `'fall'`), `'spring'`, `'summer'`, or any
  string starting with one (`'Winter 412 E.R.'`). Winter lays snow on the land and cools the
  light, autumn turns it ochre, spring greens it a little; none (or summer) is the rig as
  authored. No screen passes it yet.
- **Monuments** passed in (the Treaty Stone, a Sovereign's cairn) appear in the scene.
- **Framing**: the scene crops around a per-beat focal point. In a box narrower than 400:220 it
  zooms to 86% and puts the focal point at 42% of the height, so hero titles over the lower half
  do not cover it, and it may show up to 26 units past the painting's bottom into the fade. A
  short, wide, unlabelled box (aspect above 2.05, or `card` set) is a **card**: it zooms to about
  290 units wide with the focal point 60% across; on the road it frames the keep, where the
  palisade and pylons (FORTIFIED) or the burnt wagon and smoke (AFTERMATH) show the state. An
  unmeasured or 0×0 box shows the full frame.
- **Motion**: SMIL only (smoke, banners, embers, birds, snow), paused offscreen with `useSvgPause`.
  A labelled scene (the march hero) animates by default; an unlabelled, decorative one (backdrops,
  cards) renders still unless `animated` is passed, and a still decorative scene drops birds and
  fine snow. Reduced motion always wins.

## Portraits

`Portrait` (`src/ui/art/Portrait.jsx`) ids: `mara`, `vale`, `cassian`, `sparky`, `mika`, `nyra`,
`vex`, `skaela`, `sovereign`, `chronicler` (an unknown id draws a hooded silhouette with ember
eyes). Heirs use their family's portrait. They are painted SVG busts in one light rig: key light
from the upper right, a cool rim on the right edge, and a warm ember bounce on the shadow-side
cheek and jaw.

- **Frame** (`Portrait.jsx`, now only the frame and dispatcher): a deep radial backdrop with a
  faction-tinted glow, a feathered backlight behind the head, out-of-focus motes, the mood tint,
  a vignette, and a bevelled, engraved gold ring. Level of detail by size: **64 px and up** get
  the full jewel ring (knurl, three studs, specular glint, keystone gem); **below 64 px** a thin
  band with the art zoomed about 1.12× further onto the head; **34 px and below** a tight head crop
  (about 1.42×) with no backdrop motes. `ring={false}` draws a one-pixel brass hairline. The svg is
  `display:block` unless `className` carries a display utility (such as `hidden sm:block`).
- **Characters** live in `src/ui/art/portrait/`: `geometry.js` (pure head and shoulder paths, the
  mood expression table, seeded hair strands and the `locks()` generator for tapered hair and fur
  clumps), `kit.jsx` (gradients, lit fills, banded `Metal`, the one soft filter, `Hair`, `Rim`,
  `Bounce`, `ClothShade`), `face.jsx` (`Face`, `Ear`, `Neck`), `people.jsx` (Mara, Vale, Cassian,
  Mika, Nyra, Vex) and `others.jsx` (Sparky, Skaela, Sovereign, Chronicler, Unknown). A character
  returns `{ bg, glow, under?, art, zoom?, focus?, halo? }`: `zoom` (default 1.12) brings the bust
  closer, `focus` is the head's y and `halo` the backlight strength.
- **Faces** are built in value planes (form shadow, core shadow, reflected light, highlights) with
  eyes, catchlights and two-tone lips. `Face` takes a recipe (eye shape `almond|wide|narrow|hooded`,
  brow raise and slope, nose width and bridge, lip, smirk, crow's feet, …); each human has one
  asymmetry.
- **Mood** (`neutral`, `grim`, `warm`, `alarmed`) tints the backdrop only, never the skin; the
  face carries it: grim knits the brows with a frown crease, warm adds smile lids, alarmed raises
  the inner brows, lines the forehead and opens the mouth.
- **Filter budget**: one blur filter per portrait, used only by a human face's skin planes;
  everything else (backlight, motes, cloth, rims, sheen, neck) is feathered with gradients.

## Backdrops

- **War table** (`WarRoomBackdrop.jsx`): one flat SVG table world on a CSS 3D plane tilted away
  from the viewer (real perspective, no per-frame work). Upright figures and candles are
  billboards anchored to map points. Threat markers multiply with the thread urgencies: iron
  walkers in the south, blizzard and warg marks in the north, refugee lines on the northern road.
  The Marches outpost follows the region state. Only candle flicker and smoke animate on the table
  (off under reduced motion). In front of the plane, in screen space, sits the room: a static
  window shaft from the upper right and a warm lamp pool on the chart (plain alpha layers, no
  blend modes, no breathing), two out-of-focus standards of Elvia hanging close to the lens (depth
  of field baked into the SVG with `feGaussianBlur`; no sway), candle bokeh at the near edge, and
  `Motes` in the beam (18 on a phone, 30 wide).
- **Campfire** (`CampfireScene.jsx`): a painted night camp on canvas: a starry sky with a
  milky-way band, a haloed moon and moonlit cloud, mountains, pine treelines and mist; tents (one
  lantern-lit), a cart, a weapon rack, a woodpile and the Elvian banner; a real fire (log crib,
  coal bed, layered flame tongues, embers, thin cool smoke). The Sovereign, General Mara Voss and
  Sparky are near-black shapes rim-lit only on the side facing the fire; Sparky is a curled drake
  with a warm rim and one acid-green eye (the only green in the scene) who breathes every 3.6 s.
  - Everything still is painted **once per resize** into two stacked canvases: a cold, moonlit
    pass and a warm, fire-lit pass (long cast shadows, radially masked). The flicker is a Web
    Animations opacity loop on the warm canvas, so it runs on the compositor. Only the fire box
    (pit, flames, front stones, Sparky) and the air above it (smoke and embers, DPR 1) redraw, at
    most 30 times a second. The moon is its own small canvas drawn above `scrim`, so it stays
    luminous over any text scrim, and the fire is never dimmed by one.
  - `band` anchors the fire group in a clear bottom band of `clamp(220px, 30dvh, 280px)` (30dvh
    when the screen is under 600 px tall); the campfire screen reserves the same height in CSS.
    Otherwise `fireX` / `fireY` place it. `variant="last"` is the Passing's last fire: a struck
    camp dusted with frost, the Sovereign alone across an empty log, a low red-gold fire, longer
    smoke and a furled banner.
  - DPR capped at 2; layers rebuilt on resize (height-only changes such as a phone's URL bar are
    debounced); paused offscreen or in a hidden tab; one still frame under reduced motion; nothing
    is built or stepped at 0×0. The camp fades in over 350 ms once built.
- **Title**: the living `StageBackdrop` ruin at night under one static gradient grade (no camera
  drift), then the emblem with five static `LightRays` in a narrow cone (masked out before the
  title), a breathing bloom (opacity only), a faint halo ring and 15 `Motes` on a canvas the size
  of the emblem glow; an engraved gold title with a `Filigree`.
- **Resolution**: the fixed backdrop is one static gradient (key light and vignette baked in).
  The header is a hero view of the Marches at dusk (a still `RegionScene`; the beat follows the
  order's category: military the checkpoint, clandestine the wilds, research the ruin, anything
  else or a custom decree the road), masked into the page at its foot.
- **The Passing** (`screens/passing/Backdrop.jsx`): step I is the last fire (`variant="last"`).
  On `lg` screens it is the backdrop, its fire under the empty lower half of the left column (the
  anchor follows the layout); on phones it burns in its own 248 px strip (300 px from `sm`) inside
  the step, between the words and the farewells. Later steps use gold-and-navy light with the
  Architect symbol; the Chronicle is set on an illuminated `Manuscript` page.

## Duel rendering

`src/ui/duel/render/` draws the duel on a canvas. `createDuelRenderer({ config, archetypeId,
reduced, intro = true, quality = null })` returns `resize`, `events` (engine fx → visuals, and a
hitstop hint), `frame(ctx, duel, now, { guarding, hold })`, `swipe`, `dprCap` (the canvas
resolution the current quality tier allows), `tier`, `introShowing(now)` and `seekIntro(now,
elapsedMs)` (for the duel lab).

- **Stages** (`stages.js`): every fight has a place, chosen from the march beat by `stageFor`:

  | Stage | Where | Light and air |
  |---|---|---|
  | `circle` | The torch-lit circle (War Room trials) | Citadel wall, arches, banners, braziers; embers and motes |
  | `yard` | The training yard | Morning light shafts, weapon racks, sand; dust |
  | `checkpoint` | Greywater checkpoint | Dusk sky, gate towers, palisade, the road's puddles; smoke and dust |
  | `wilds` | The frontier wilds | Moon, snow peaks, three depths of snowy pines; falling snow |
  | `ruin` | The broken circle | Standing stones, the great stone's symbol glowing gold; lattice threads, rising motes, mist |
  | `ford` | Greywater Ford | The river and its reflections, a walker with a sweeping searchlight, the burning depot, Aegis pylons; mist and embers |
  | `ford_winter` | The winter skirmish | The ford at dusk with ice floes; snow |
  | `siege` | The last stand | Burning walls and breaches, debris; heavy embers and ash |

  Each stage paints its static scenery once per resize into an offscreen canvas (with a little
  parallax), animates its lights every frame, and sets the light that falls on the foe (key
  colour and side, rim, shadow tint, backlight). The big soft fire halos (`LIGHTS`) are baked into
  that backdrop too.
- **Post pass** (`post.js`), on a frame budget; nothing reads the frame back:
  - *Baked once per resize* into the backdrop: the stage's soft-light colour grade (`GRADE`: hi/lo
    tints, reflection strength, ripple, vignette, ground pool per stage), a film vignette and a
    pool of shade on the ground around the foe. When the camera is at rest the backdrop is copied
    1:1.
  - *Foe layer*: the foe is drawn into an offscreen canvas covering only its own box (at the
    tier's `layer` × DPR), lit from a cached light map (occlusion toward the feet, key) plus live
    light from sparks and flashes (`fxLights()` in `fx.js`, budgeted to 0.42 total alpha so the
    foe never washes out) and a short hit flash, then composited once.
  - *Rim*: cut from the foe's own silhouette in `rimColor(light)`, the stage's key colour capped at
    about 70% luminance. *Reflection*: one flipped, squashed copy of the layer's foot in a few
    ripple bands, in wet or frozen ground. *Ghosts*: the spectral echo's violet afterimages.
    There is no bloom buffer; the finishing blow's warm flash is an effect (`fx.js`).
  - **Adaptive quality** (`TIERS`): tier 0 = foe layer 0.8, rim, four ripple bands in water,
    ghosts, full particles, DPR 2; tier 1 = 0.7, two ripple bands, no ghosts, 60% particles, DPR
    1.5; tier 2 = 0.6, no rim, one band, 35% particles, DPR 1.25. After 20 settling frames the renderer takes the median of every 24
    frames; above 24 ms it steps down one tier (two above 60 ms). Tiers only step **down**, never
    back up. `DuelScreen` resizes the canvas to `r.dprCap`. Only the look changes: the engine's
    fixed timestep is never touched.
- **Cinema** (`index.js`): the fight opens with a push-in, navy letterbox bars (the same height
  top and bottom) sliding away, and the foe's name on a gold rule in the sky band (about 2.1 s;
  it starts on the first frame not called with `hold`, so it waits behind the "Read the wind-up"
  card). The finishing blow slows only the renderer's visual clock (0.3× for 650 ms, then easing
  back; the engine has already finished), with a warm flash blooming from the foe and slow shafts
  of light turning behind it. A loss drains, cools and darkens the colour.
- **Foes** (`foes.js`): `lookFor(config, archetypeId)` picks who you are fighting, not just how
  they fight: the Syndicate duelist (visored helm, sabre and parrying dagger), Nyra Kell (walker
  pilot, brass flight goggles, a shock-blade with an amber edge), the Ostrava officers (peaked
  cap, cape; Corvin's crimson crest, Sable's high gold-edged collar), the man in the grey coat (a
  deep warm-shadowed hood and a scarf), Sword-Master Ilvane (silver hair, rapier, long coat-tails
  and a queue), General Drae (great helm, plume, greatsword, cape), the Echo in a Crown, and the
  Frost Wargs (Rimefang, Greymane, Old Rime; shaggy hackles, glowing eyes, breath in the cold).
  Human figures are painted with shared helpers (`seg` tapered limbs with knee and elbow bends,
  `fist`, `boot`, `face`, `drawSkirt` for a coat skirt that flares in two-tone folds); shade
  gradients are cached per context and light, and fur strands are batched. Limbs use two-bone IK.
  The Echo (`look.spectral`) is translucent pale gold and moon-violet with lagging afterimages and
  a hem that dissolves into motes; `drawFoeFocal` draws its crown, eyes and blade edge at full
  strength. Poses come from the engine: guard side, anticipation, the strike and its
  follow-through, recovery, the feint's exposed opening, stagger, defeat. A hit blinks the foe's
  silhouette (never a white-out) and knocks it back.
- **Telegraph** (`telegraph.js`): a crescent on the side the blow comes from (an arc overhead,
  rings closing for a thrust), marching chevrons for its path, dashed and flickering for a feint, a
  warm pulse at the frame's edge for a heavy. Painted as tapered brush strokes in the warning
  colour (`TELE`: steel iron-200, red-gold ember-300/400, flicker lavender) over a navy
  under-stroke, with no additive glow, so they read on sunset sand and snow alike.
- **The Sovereign** (`player.js`): an engraved vambrace with a warm magitech thread and the
  Architect's circle on a brass boss, a plated fist, a brass crossguard with an ember stone and a
  bevelled blade whose fuller brightens as the Arc Pulse charges; a cached sprite with live light
  over it. It rises across the body to guard, swings along your strike with a crescent trail, and
  the Shield Ward rises as a dome of lattice light. On phones the vambrace fades into the dark
  under the controls.
- **Effects** (`fx.js`): sparks with gravity, slash marks, impact star frames (`impact`), tumbling
  steel `chips`, `dust` kicked up on dodges, shockwave rings (brass or ember over a navy
  under-stroke, at most one thick and one thin per event), the Arc beam, the Royal wave, flashes,
  vignettes, dodge streaks, the hurt flare, the finishing `bloom`, and your swipe trails. Impact
  speed lines stay within 0.3 of the screen radius.

The same stages double as page backdrops through `StageBackdrop` (the title screen's ruin, the
training yard). Every canvas guards against a zero-size layout: painters step their loops by the
layout scale, so `layout()` never returns a scale of zero and resize handlers skip collapsed
elements.

Reduced motion keeps every frame readable but still: no particles drifting, no shake, no
hitstop, no camera slide. See [DUEL.md](DUEL.md).

## Audio

`src/ui/audio/audio.js`: a procedural Web Audio engine. Safe to import anywhere (in node every
call is a no-op).

```js
import { audio, haptic } from './audio/audio.js';
audio.unlock();               // create/resume the AudioContext (call from a user gesture)
audio.setMuted(bool); audio.isMuted();
audio.setVolume(0..1); audio.getVolume();
audio.ambient(theme);         // 'title'|'war_room'|'march'|'duel'|'campfire'|'passing'|null — crossfades
audio.sfx(name);              // unknown names are a silent no-op
haptic(pattern);              // navigator.vibrate, respects localStorage 'elvia.haptics' === 'off'
```

- **Mix**: sources → music and sfx buses (+ a shared hall reverb) → compressor → master gain.
  Fades in over 2.6 s and out over 2.2 s; up to 14 simultaneous sfx voices; identical cues within
  30 ms are throttled. The context suspends while muted or while the tab is hidden.
- **Themes** (synthesised, seeded so they do not repeat mechanically): `title` (low drones, a choir
  pad moving through chords, plucked notes and a high bell), `war_room` (low string drones, Dorian
  plucks, distant bells), `march` (wind, a low drone and a walking taiko pulse), `duel` (tense
  close-interval drones and drum patterns), `campfire` (a fire layer with crackles over a soft
  drone), `passing` (a deep drone, choir and slow bells).
- **Cues**: `click`, `confirm`, `order`, `turn`, `chronicle`, `symbol`, `strike`, `hit`, `parry`,
  `perfect_parry`, `dodge`, `heavy_warn`, `telegraph`, `poise_break`, `arc_pulse`,
  `royal_command`, `ward`, `victory`, `defeat`, `hurt`, `fire`, `page`, `legacy`, `passing`,
  `error`. (A metallic clang for parries with a bright shimmer for perfect ones, a brass swell for
  Royal Command, a rising lattice shimmer for Arc Pulse, a page-flip, a quill and bell for the
  Chronicle.)
- **Who calls it**: `GameProvider` sets the ambient theme per phase and plays a cue per action
  (`ACTION_SFX`); the DuelScreen plays the engine's `sfx` events and sets the `duel` theme.
- **Settings**: mute and volume persist in localStorage (`elvia.audio`); haptics can be turned off.

## Performance and accessibility

- Heavy SVG components are `React.memo`'d; canvases cap DPR at 2 (motes and campfire air at 1,
  the duel at its quality tier's cap) and stop when not visible.
- **Rules for anything over an animated backdrop**: no `mix-blend-mode`, no `backdrop-filter`, no
  CSS `filter` and no full-viewport inset `box-shadow` on or over animated layers. Bake blur into
  SVG filters on static groups, and animate only `opacity` or `transform` on small layers.
  `.btn-ghost`, `.chrome-bar` and the sheet scrim (navy-950 at 80%) have no backdrop-filter; the
  War Room and Resolution sticky HUDs are opaque. Decorative `RegionScene`s render still.
- **Measured frame rates** (Chrome, phone viewport, 4× CPU throttle) after the graphics pass:

  | Screen | fps |
  |---|---:|
  | Title | 59 |
  | War Room | 60 |
  | Resolution | 60 |
  | March | 59–60 |
  | Campfire | 58 |
  | The Passing, last fire | 55 |
  | Live duel | 15–25 (8 before the pass) |

  The duel is the one heavy screen; its adaptive quality tiers step down on slow devices and never
  step back up within a duel.
- Everything honours reduced motion (OS setting or the in-game toggle).
- Decorative art is `aria-hidden`; portraits and crests that carry meaning get labels; the duel
  announces telegraphs in words through a live region.
- The production build is one main chunk of about 1.1 MB (≈ 350 kB gzipped) plus a 355 kB
  (≈ 80 kB gzipped) Anthropic SDK chunk that is only fetched when the narrator makes a call.

## How to extend

- **A new region or beat**: add a beat layout in `src/ui/art/scene/beats.jsx` (built from
  `scene/atmos.jsx`, `parts.jsx`, `actors.jsx` and `flora.js`, colours only from `tone.js`),
  register it in `BEATS` and the alias map in `RegionScene.jsx`, and give it a focal point in
  `FOCUS` (`scene/frame.js`). Check all three region states, times of day, a phone hero and a card.
- **A new portrait**: write a character in `src/ui/art/portrait/people.jsx` or `others.jsx` with
  the shared kit and `Face` (same light rig), returning `{ bg, glow, art, … }`; register it in
  `CHARACTERS` and `NAMES` in `Portrait.jsx`. Check it at 26, 40, 64 and 96 px.
- **A new sound**: add a function to `SFX` (or a theme to `THEMES`) in `audio.js` using the
  helpers (`tone`, `noise`, `bell`, `pluck`, `taiko`, `droneLayer`, `choirLayer`, `windLayer`,
  `fireLayer`, `every`), and call `audio.sfx('name')`.
- Verify by eye: `npm run dev` and the dev scenarios (`/?scenario=…`), then `npm run e2e` and look
  at the screenshots.
