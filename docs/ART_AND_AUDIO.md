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
- **Components**: `.panel`, `.panel-parchment`, `.btn-royal`, `.btn-ghost`, `.order-card` (with
  `__key`, `__body`, `__title`, `__desc`, `__meta`, `--danger`, and `aria-pressed` for selected),
  `.chip` + `.chip--gold|ember|crimson|frost|iron|parchment`, `.meter`, `.gold-rule`.
- **Text and light**: `.text-gilded`, `.text-engraved`, `.text-glow-gold`, `.text-glow-ember`,
  `.glow-gold`, `.glow-ember`, `.glow-crimson`, `.vignette`, `.bg-war-room`, `.scroll-elvia`.
- **Motion**: `animate-fade-up`, `animate-fade-in`, `animate-slow-glow`, `animate-torch-flicker`,
  `animate-ember-drift`, `animate-seal-press`, `animate-banner-sway`. All are disabled under
  `prefers-reduced-motion` and `html[data-motion="reduced"]` (the in-game Settings toggle).
- `html[data-text-size]` scales all text (Settings → Text size).

## Art components

All exported from `src/ui/art/index.js`. Decorative art is `aria-hidden`; components that carry
meaning take a `label`.

| Component | Props | What it draws |
|---|---|---|
| `RegionScene` | `beat`, `regionState`, `timeOfDay`, `monuments`, `className`, `label`, `animated`, `vignette`, `fade` | The Southern Marches as a cinematic 400×220 SVG that crops around a focal point to fill any box |
| `WarRoomBackdrop` | `threats: { syndicate, wargs, refugees }` (0–100), `regionState`, `dim` (default true), `className` | A candle-lit war table seen at an angle, with a parchment map of Elvia |
| `CampfireScene` | `intensity` (0–1), `className` | The night camp on canvas: fire, embers, tents, figures, Sparky |
| `Portrait` | `id`, `size`, `mood`, `label`, `ring` (default true), `className` | Heraldic bust in a gold ring |
| `FactionCrest` | `id` (`iron_syndicate`, `frost_wargs`, `elvia`), `size`, `title` | Shield crest |
| `ArchitectSymbol` | `size`, `glow` (bool or 0–1), `animated`, `color`, `ticks` | The broken circle with a four-point star |
| `Sigil` | `name` (`diamond`, `star`, `crown`, `ward`, `ember`, `quill`, `sword`, …), `size`, `color`, `title` | Small inline glyphs |
| `GoldDivider` | `height`, `className` | Ornamental rule |
| `PanelCorners` | `size`, `inset`, `color`, `opacity` | Corner filigree for panels |

Also exported: `ensureFonts()` (adds the Google Fonts link once), `FONT_HREF`, `C`, `LIGHT`,
`MOOD_TINT`, `PORTRAIT_IDS`, and `normalizeBeat` / `normalizeRegionState` / `normalizeTimeOfDay`.
Shared helpers live in `src/ui/art/util.js` (seeded `mulberry32`, `useReducedMotion`,
`watchVisibility`, `useSvgPause`, ridge, forest and figure path builders).

## Region scenes

`RegionScene` (`src/ui/art/RegionScene.jsx`, with parts in `scene/parts.jsx` and beat layouts in
`scene/beats.jsx`):

- **Beats**: `road`, `checkpoint`, `wilds`, `ruin`, `champion`, `camp`. Aliases map game beat ids
  (`skirmish`, `last_stand` → champion; `campfire` → camp); unknown beats fall back to the road.
- **Region state changes the world** (Master Build §8): STABLE shows civilian life (carts,
  traders, farms); FORTIFIED adds soldiers, barricades, Aegis pylons and glowing ward lines;
  AFTERMATH shows smoke, scorch marks, broken carts and bandaged silhouettes.
- **Time of day**: `day`, `dusk`, `night` (with `evening`, `dawn`, `sunset` as aliases), each with
  its own light rig.
- **Monuments** passed in (the Treaty Stone, a Sovereign's cairn) appear in the scene.
- The scene crops around a per-beat focal point, so the keep, gate, walker or fire stays in frame
  on a portrait phone. Gentle SMIL animation (smoke, banners, embers) pauses offscreen and under
  reduced motion.

## Portraits

`Portrait` (`src/ui/art/Portrait.jsx`) ids: `mara`, `vale`, `cassian`, `sparky`, `mika`, `nyra`,
`vex`, `skaela`, `sovereign`, `chronicler` (an unknown id draws a hooded silhouette). One style
for all: lit from the upper right, a gold ring frame, readable from 40 to 96 px. `mood`
(`neutral`, `grim`, `warm`, `alarmed`) tints the light. Heirs use their family's portrait.

## Backdrops

- **War table** (`WarRoomBackdrop.jsx`): one flat SVG table world on a CSS 3D plane tilted away
  from the viewer (real perspective, no per-frame work). Upright figures and candles are
  billboards anchored to map points. Threat markers multiply with the thread urgencies: iron
  walkers in the south, blizzard and warg marks in the north, refugee lines on the northern road.
  The Marches outpost follows the region state. Only candle flicker and smoke animate (off under
  reduced motion).
- **Campfire** (`CampfireScene.jsx`): a 2D canvas redrawn with `requestAnimationFrame`: sky
  gradient and stars, hill silhouettes, warm ground light, tents and a banner, Mara and the
  Sovereign seated (rim-lit by the fire), Sparky curled by the logs, layered flame tongues, a halo,
  and ~46 rising embers. DPR capped at 2, resize-aware, paused offscreen or in a hidden tab, a
  single still frame under reduced motion.
- **Title** uses `RegionScene` (the camp at night) behind the menu; **Resolution** uses a dim
  `RegionScene`; the **Passing** uses the campfire for step I and gold-and-navy light with the
  Architect symbol for later steps.

## Duel rendering

`src/ui/duel/draw.js` draws the duel on a canvas each frame: the stone circle (pillars, two
torches, an etched floor with the broken-circle sigil), a backlight so the foe always reads, the
foe (an armoured humanoid rig for the Blade-Adept, a translucent gold crowned rig for the Fallen
Champion, a frost-wolf rig for the Warg Alpha) posed from the engine's state, the telegraph
overlay (arcs and chevrons by direction, colour by kind, a flicker for feints, a warm pulse for
heavies), the Sovereign's blade (guard, swing, dodge offset), the ward dome, and effects (sparks,
flashes, rings, the Arc beam, the Royal wave, screen shake). See [DUEL.md](DUEL.md).

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

- Heavy SVG components are `React.memo`'d; canvases cap DPR at 2 and stop when not visible.
- Everything honours reduced motion (OS setting or the in-game toggle).
- Decorative art is `aria-hidden`; portraits and crests that carry meaning get labels; the duel
  announces telegraphs in words through a live region.
- The production build is one main chunk of about 800 kB (≈ 250 kB gzipped) plus a 355 kB
  (≈ 80 kB gzipped) Anthropic SDK chunk that is only fetched when the narrator makes a call.

## How to extend

- **A new region or beat**: add a beat layout in `src/ui/art/scene/beats.jsx` (built from
  `scene/parts.jsx`), register it in `BEATS` and the alias map in `RegionScene.jsx`, and give it a
  focal point in `FOCUS`. Check all three region states and times of day.
- **A new portrait**: add a character function to `CHARACTERS` in `Portrait.jsx` following the
  existing ones (same light direction and frame), and a name in `NAMES`.
- **A new sound**: add a function to `SFX` (or a theme to `THEMES`) in `audio.js` using the
  helpers (`tone`, `noise`, `bell`, `pluck`, `taiko`, `droneLayer`, `choirLayer`, `windLayer`,
  `fireLayer`, `every`), and call `audio.sfx('name')`.
- Verify by eye: `npm run dev` and the dev scenarios (`/?scenario=…`), then `npm run e2e` and look
  at the screenshots.
