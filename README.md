# Mura — a waveform-obsessed music visualizer

Mura is Kami's sibling: same idea (turn a song into a generative,
audio-reactive visual), same original-flower-mascot spirit, but pushed much
deeper on waveforms specifically. Where Kami is a Windows/Mac desktop app
with 30 scene-based patterns across 4 packs, Mura has **50 distinct waveform
types across 10 rendering engines**, **10 falling icon-drop overlays**
(crosses, Murakami-pillow-style flowers, letter E's, and more), **full
manual + randomized color control**, a **Beat focus** control that can make
the whole visual lock onto bass hits instead of the overall mix, and
**export to MP4 (visualizer + audio) or standalone MP3**.

Mura runs two ways from one codebase:

- **Desktop app (recommended)** — a real installable app for Windows/Mac/
  Linux, built with Electron. This is the primary way to run Mura and the
  only one where export (MP4/MP3) genuinely works, since it runs a real
  ffmpeg binary in the background instead of a mobile native module.
- **Mobile preview (Expo Go)** — the same app running on your phone via the
  free Expo Go app, no paid developer account needed. Everything works
  except export, which needs a native build Expo Go can't provide (see
  "Mobile preview" below).

This README covers both, plus how everything's wired together underneath.

## Desktop app (recommended)

### Run it locally

```bash
npm install
npm run build:web
npm run electron:start
```

That builds the app (`build:web`, i.e. `expo export --platform web`) and
then launches it in a real desktop window (`electron:start`). For active
development with hot reload instead of a static build, run these in two
terminals:

```bash
npm run web            # terminal 1: Metro's dev server
npm run electron:dev    # terminal 2: opens the Electron window against it
```

### Build an installer

```bash
npm run dist:mac     # -> dist-electron/*.dmg (Intel + Apple Silicon)
npm run dist:win     # -> dist-electron/*.exe (NSIS installer)
npm run dist:linux   # -> dist-electron/*.AppImage
```

Each of these only produces an installer for the OS you run it on (that's
an Electron/native-tooling constraint, not a Mura one) — you can't build a
`.exe` from a Mac or a `.dmg` from Windows locally. That's what the GitHub
Actions workflow below is for.

### Get installers for all three platforms without building anything locally

This repo includes `.github/workflows/build-desktop.yml`, which builds
Windows, macOS, and Linux installers in parallel on GitHub's own runners.
Push a version tag to trigger a real release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions builds all three, then attaches them to a new GitHub Release
on this repo automatically — anyone can then download the right installer
for their OS straight from the Releases page. You can also trigger a
one-off test build any time from the Actions tab ("Run workflow" button)
without pushing a tag; that uploads the installers as workflow artifacts
instead of a release.

### About the "unknown publisher" warnings

These installers aren't code-signed (that costs money — an Apple Developer
Program membership or a Windows code-signing certificate, both ongoing
yearly costs). Unsigned is completely normal for a personal/open-source
desktop app distributed via GitHub, and it costs nothing:

- **Windows**: SmartScreen will say "Windows protected your PC." Click
  "More info" → "Run anyway." One-time per install.
- **Mac**: Gatekeeper will say the app "cannot be opened because it is from
  an unidentified developer." Right-click the app → "Open" → "Open" (only
  needed the first time). Note there's no Windows-style annual fee
  equivalent that removes this on Mac short of the $99/year Apple Developer
  Program — for a personal project, right-click-Open is the normal path.

This is the whole reason desktop is worth it over the mobile App Store
route: no $99/year, no app review, no code-signing service required to get
a real, fully-working build (export included) onto your own machine or
shared with anyone else who wants it.

### Why export actually works here (and didn't on mobile)

Mobile export ran through `ffmpeg-kit-react-native`, a native module Expo Go
can't load — real export there needs a prebuilt/dev-client build (see
"Mobile preview" below). The desktop app instead runs real `ffmpeg`/
`ffprobe` binaries (via the `ffmpeg-static`/`ffprobe-static` packages) as a
child process of Electron's main process — the exact same binaries a
terminal `ffmpeg` command would use, just bundled into the app so nothing
needs to be separately installed. The renderer (the visualizer UI) never
touches the filesystem or spawns processes directly, per Electron's own
security guidance; it talks to the main process over `window.muraDesktop`
(exposed by `electron/preload.js`), which `src/export/desktopBridge.ts`
wraps in a typed interface. See "Desktop bridge architecture" below for the
full data flow.

## Mobile preview (Expo Go)

```bash
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone (same WiFi network as
your computer; use `npx expo start --tunnel` if your network blocks local
connections). Everything except **Export** runs straight in Expo Go:
picking a song, all 50 live waveform visualizers, all 10 icon-drop rain
effects, full color studio with randomize, reactivity tuning, playback.

This project is pinned to **Expo SDK 54** specifically because the public
Expo Go app (App Store/Play Store) lags behind Expo's own SDK releases —
pinning here means Expo Go you already have installed just works, no extra
setup. Every package in `package.json` is pinned to the exact versions
Expo bundles for SDK 54 (from `expo`'s own `bundledNativeModules.json`) to
avoid version-mismatch install errors if you ever bump `expo` itself.

Mobile export needs a prebuilt/dev-client build instead of Expo Go:

```bash
npx expo prebuild
npx expo run:ios     # or: npx expo run:android
```

This requires either a Mac + Xcode (free, but device installs re-sign
every 7 days) or an Apple Developer Program membership ($99/yr, for a
durable TestFlight/ad-hoc build) on iOS; Android has no equivalent cost.
This is exactly the friction the desktop app sidesteps entirely.

## What's here, feature by feature

**50 waveforms, 10 families of 5** (`src/visualizer/engines/*.ts`,
aggregated in `src/visualizer/registry.ts`): Line Waves, Equalizer Bars,
Radial & Circular, Particles, Flowing Ribbons, Tunnels, Kaleidoscope,
Scopes & Meters, Glitch & VHS, Geometric. Every preset is a small, named
configuration of one shared engine per family (e.g. all 5 "Line Waves"
presets share one drawing engine, differing in mirroring/fill/dotting/
color-mapping) — this mirrors how Kami's own 30 patterns share
`render_utils.py`/`palettes.py` rather than each being written from
scratch. The Waveforms picker has a Prev/Next bar that steps through all 50
in order and auto-scrolls to the active one, so you don't have to hunt
through the grid by hand.

**10 falling icon drops** (`src/iconDrops/`): crosses, Murakami-pillow-style
flowers, letter E's, stars, hearts, diamonds, music notes, lightning bolts,
sparks, and smileys. Pick any combination in the Icon Drops screen; a
shared physics engine (`fallingIconsEngine.ts`) handles gravity, sway,
rotation, spawn rate, and beat-triggered bursts for whichever shapes are
active.

**Color system** (`src/theme/palettes.ts`): background, accent, glow, plus
an open-ended list of gradient swatches (add/remove freely) — every color
in every engine is read through this one palette object, never hardcoded.
"Randomize colors" ports Kami's own `random_palette()` almost verbatim: hues
spaced with the golden angle so they never land muddy-close together, a
dim tinted background, vivid 85–100% saturation foreground swatches.

**Reactivity** (`src/screens/ReactivityScreen.tsx`, `src/audio/types.ts`):
per-band gains (bass/mid/treble/beat-hits), chaos, glow, particle density,
switch speed — and **Beat focus**, the main knob for "make it react to the
bass/beat specifically" rather than the overall mix. At 0 the visual's main
pulse tracks overall loudness (vocals, hi-hats, everything blended); turned
up, it blends toward a bass+onset-driven signal so the whole visual
increasingly snaps to kicks/beats instead. There's a one-tap "Bass punch"
preset. Every setting here applies identically live and in export.

**Export** (`src/export/`): MP4 (visualizer + your song's audio, muxed) or
a clean standalone MP3 transcode. Fully working on desktop; needs a native
build on mobile (see above).

**App icon** (`tools/generate_icon.py`): a from-scratch, code-drawn flower
mascot in the same loose "collectible pillow" pop-art family as Kami's
smiling flower, but deliberately its own thing — a different palette,
denser 12-petal layout with mismatched pointed/rounded petals, and a
waveform-bar "face" instead of a plain smiley, tying the mark directly to
what the app does. Re-run it any time with `python3 tools/generate_icon.py`
(needs `pip install pillow numpy`) to regenerate `assets/*.png`.

## Architecture: one scene description, two renderers

The core idea threading through every waveform and every icon drop is a
tiny renderer-agnostic type, `DrawCmd` (`src/visualizer/engineTypes.ts`):
circles, paths, rects, lines, each with a color/opacity/optional glow. Every
engine's `buildScene(ctx, state)` is a **pure function** — audio features +
palette + reactivity + time in, an array of `DrawCmd` out.

That one array is consumed two different ways:

- **Live preview** (`VisualizerCanvas.tsx`): a `requestAnimationFrame` loop
  builds the commands every frame and hands them to `<SceneLayer>`, a
  declarative Skia component that maps each `DrawCmd` to a `<Path>`/
  `<Circle>`/`<Rect>`/`<Line>`.
- **Export** (`export/frameCapture.ts`): the exact same `buildScene()` call,
  driven by a precomputed feature timeline instead of live audio, rendered
  offscreen via Skia's `drawAsImage()` and encoded to PNG.

Same function, same commands, two consumers — so what you preview is
genuinely what gets exported, not just something close to it. This holds
across platforms too: `@shopify/react-native-skia` renders natively on iOS/
Android and via CanvasKit (Skia compiled to WebAssembly) on desktop/web, but
`buildScene()` itself never touches a renderer-specific API directly, so
the same 50 engines produce the same output everywhere.

Stateful engines (particle bursts, trail history, rotation accumulators)
take a second `state` argument that's created once per active preset and
mutated in place every frame — the same pattern Kami's own `render_*()`
functions use with their trailing `state` dict argument.

## Desktop bridge architecture

The desktop app's renderer process runs with Node integration disabled
(Electron's own recommended security posture) — it can't touch the real
filesystem or spawn processes. Everything that needs to is split across a
small bridge:

- **`electron/main.js`** — the Electron main process. Runs a tiny local
  static HTTP server for the pre-bundled web app (needed because the Expo
  web export's absolute asset paths like `/_expo/static/js/...` resolve to
  the OS filesystem root under a raw `file://` load, not the app folder),
  spawns the real `ffmpeg`/`ffprobe` binaries via `child_process`, and owns
  all real temp-file I/O.
- **`electron/preload.js`** — exposes a narrow `window.muraDesktop` API via
  `contextBridge`, the only thing the sandboxed renderer can call.
- **`src/export/desktopBridge.ts`** — the renderer-side typed wrapper around
  `window.muraDesktop`; `isDesktopAvailable()` is how the rest of the app
  detects "am I running in the desktop app" vs. Expo Go/native/plain-browser.
- **`src/export/ffmpegRunner.web.ts`** — Metro automatically substitutes
  this for `ffmpegRunner.ts` (the mobile/native ffmpeg-kit implementation)
  whenever bundling for the web platform, which is how the desktop app
  runs. It forwards `runFfmpeg`/`runFfprobe` to the bridge.
- **`frameCapture.ts` / `OfflineAnalyzer.ts` / `videoExporter.ts` /
  `audioExporter.ts`** — each has a small platform branch: native uses
  `expo-file-system` directly (real paths on-device); desktop routes frame
  bytes, PCM decode results, and final output files through the bridge,
  since `expo-file-system`'s web implementation is an inert stub (there's
  no general filesystem access from a browser renderer otherwise).

The picked audio file follows the same split: `HomeScreen.tsx`'s `pickAudio`
keeps the browser `blob:` URL for the `<audio>` element (playback), and
additionally stages the file's real bytes into a real temp file via the
bridge (`audioSource.desktopPath`) for anything that needs a real path
(analysis, ffmpeg's `-i`).

## Audio pipeline

`src/audio/FeatureExtractor.ts` is a small streaming DSP core (own
dependency-free radix-2 FFT in `fft.ts`) that turns raw PCM chunks into
`{level, bass, mid, treble, onset, isDrop, waveform, spectrum}` — the one
feature vector every engine reads, after `applyReactivity()`
(`src/audio/types.ts`) applies your gain/Beat-focus settings on top. It's
used two ways:

- **Live**: `useLiveAudioFeatures.ts` wires it to `expo-audio`'s
  `useAudioSampleListener` (which has a solid, standard Web Audio API-backed
  implementation on desktop). There's also a fallback for mobile, where
  real-time delivery is less consistent across devices: if no real sample
  has arrived recently, the visual runs on a simulated 120bpm pulse instead
  of freezing — the same trick Kami's own desktop GUI uses — and switches
  back the instant real samples resume.
- **Offline / export** (`OfflineAnalyzer.ts`): decodes the *entire* file to
  raw PCM via ffmpeg up front and runs the same extractor across the whole
  buffer at a fixed frame rate, producing a complete timeline before a
  single frame is rendered. This is a direct parallel to Kami's own
  `audio_analysis.py`, which reads the whole WAV via numpy before
  `render.py` draws anything — it's what makes export's timing independent
  of how fast the machine can actually render frames.

## Project layout

```
src/
  audio/           FFT, feature extraction, live + offline analysis
  theme/           color palettes, hex helpers, the randomizer
  visualizer/
    engines/       the 10 waveform-family renderers (5 presets each)
    registry.ts    flattens all engines into the 50-item preset list
    engineTypes.ts DrawCmd / SceneContext / WaveformPreset contracts
    sceneRenderer  declarative <SceneLayer> + shared drawing helpers
    VisualizerCanvas.tsx   live in-app canvas (the rAF loop)
  iconDrops/       10 shapes, physics engine, picker metadata
  export/          ffmpeg wrapper, frame capture, video/audio exporters,
                    desktopBridge.ts (typed window.muraDesktop wrapper)
  state/store.ts   zustand store (single source of truth for all screens)
  screens/         Home, Waveforms, IconDrops, Colors, Reactivity, Export
  navigation/      the stack navigator
electron/
  main.js          Electron main process: static server, ffmpeg/ffprobe
                    spawning, temp-file I/O, IPC handlers
  preload.js       contextBridge -> window.muraDesktop
.github/workflows/
  build-desktop.yml   builds Win/Mac/Linux installers, attaches to Releases
tools/
  generate_icon.py the app icon generator (Python + Pillow)
```

## Extending it

**Add a 51st waveform**: pick the closest-matching engine in
`src/visualizer/engines/`, add one more entry to that file's returned array
(reuse the shared drawing helpers in `drawUtils.ts`), done — it shows up
automatically in the picker and in export, no registry edits needed. To add
an entirely new *family*, copy the shape of any existing engine file
(`family` id/label + `createXPresets()`), then add it to the spread list in
`registry.ts`.

**Add an 11th icon drop**: add a shape builder to `iconDrops/shapes.ts`
(returns an `SkPath` in a normalized 100x100 box), register it in
`SHAPE_BUILDERS` and `ICON_DROP_TYPES`.

## Known limitations

- Mobile export requires a prebuilt/dev-client build, not Expo Go (see
  "Mobile preview" above) — desktop export has no such limitation.
- Opening the web build in a plain browser tab (`npx expo start --web`,
  no Electron) shows the same "needs the desktop app" message as Expo Go
  for export, since there's no `window.muraDesktop` bridge or real ffmpeg
  binary available outside the packaged app.
- `useAudioSampleListener` reliability on mobile varies by platform/OS
  version; the simulated-pulse fallback keeps the live preview animating
  either way. Desktop's Web Audio API-backed implementation is more
  consistent.
- The live preview re-renders its Skia scene via React state every
  animation frame rather than fully worklet-driven shared values — simpler
  to reason about and verify correctness of, at some cost versus a
  fully UI-thread-driven animation loop. If profiling shows this is a
  bottleneck, `VisualizerCanvas.tsx` is the one place to optimize.
- Desktop installers are unsigned (see "About the 'unknown publisher'
  warnings" above) — expected and free to work around, not a bug.
