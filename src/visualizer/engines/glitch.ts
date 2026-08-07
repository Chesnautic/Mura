import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, resample, clamp } from "../drawUtils";

const FAMILY = "glitch";
const FAMILY_LABEL = "Glitch & VHS";

function bg(ctx: SceneContext): DrawCmd {
  return { kind: "clear", color: rgb(ctx.palette.background) };
}

function preset(
  id: string,
  name: string,
  description: string,
  createState: () => EngineState,
  build: (ctx: SceneContext, state: EngineState) => DrawCmd[]
): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState, buildScene: build };
}

export function createGlitchPresets(): WaveformPreset[] {
  return [
    preset(
      "glitch-rgb-split",
      "RGB Split Bars",
      "Bars drawn three times in R/G/B, offset for a chromatic-aberration glitch.",
      () => ({}),
      (ctx) => {
        const n = 24;
        const spectrum = resample(ctx.features.spectrum, n);
        const gap = ctx.width * 0.01;
        const barW = (ctx.width - gap * (n - 1)) / n;
        const offset = 3 + (ctx.features.onset + ctx.reactivity.chaos) * 10;
        const cmds: DrawCmd[] = [bg(ctx)];
        const channels: { dx: number; color: string }[] = [
          { dx: -offset, color: "rgba(255,0,80,0.75)" },
          { dx: 0, color: "rgba(0,255,180,0.75)" },
          { dx: offset, color: "rgba(60,120,255,0.75)" },
        ];
        spectrum.forEach((v, i) => {
          const h = Math.max(4, v * ctx.height * 0.55);
          for (const ch of channels) {
            cmds.push({
              kind: "rect",
              x: i * (barW + gap) + ch.dx,
              y: ctx.height - h,
              w: barW,
              h,
              color: ch.color,
            });
          }
        });
        return cmds;
      }
    ),

    preset(
      "glitch-scanline-tear",
      "Scanline Tear",
      "Horizontal slices of the waveform datamosh-shift sideways on the beat.",
      () => ({ shifts: [] as number[], seeded: false }),
      (ctx, state) => {
        const rows = 24;
        if (!state.seeded || state.shifts.length !== rows) {
          state.shifts = new Array(rows).fill(0);
          state.seeded = true;
        }
        const shifts: number[] = state.shifts;
        if (ctx.features.onset > 0.35 || ctx.features.isDrop) {
          for (let i = 0; i < rows; i++) {
            if (ctx.rng() < 0.35) shifts[i] = (ctx.rng() - 0.5) * ctx.width * 0.5 * ctx.reactivity.chaos;
          }
        }
        for (let i = 0; i < rows; i++) shifts[i] *= 0.85; // decay back toward 0

        const n = 90;
        const samples = resample(ctx.features.waveform, n);
        const rowH = ctx.height / rows;
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let r = 0; r < rows; r++) {
          const path = Skia.Path.Make();
          const yBase = r * rowH + rowH / 2;
          for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * ctx.width + shifts[r];
            const y = yBase + samples[i] * rowH * 1.6;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          cmds.push({ kind: "path", path, color: colorAt(ctx.palette, r * 0.3 + ctx.t * 0.2), style: "stroke", strokeWidth: 2, opacity: 0.85 });
        }
        return cmds;
      }
    ),

    preset(
      "glitch-plasma-noise",
      "Plasma Noise Field",
      "A blocky, flickering noise field colored by the spectrum.",
      () => ({}),
      (ctx) => {
        const cols = 20;
        const rows = 12;
        const spectrum = resample(ctx.features.spectrum, cols);
        const cellW = ctx.width / cols;
        const cellH = ctx.height / rows;
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let x = 0; x < cols; x++) {
          for (let y = 0; y < rows; y++) {
            const n = Math.sin(x * 0.6 + ctx.t * 2) * Math.cos(y * 0.7 - ctx.t * 1.7);
            const energy = clamp(spectrum[x] * (0.5 + 0.5 * n) + ctx.features.treble * 0.3, 0, 1.6);
            if (energy < 0.12) continue;
            cmds.push({
              kind: "rect",
              x: x * cellW,
              y: y * cellH,
              w: cellW - 1,
              h: cellH - 1,
              color: colorAt(ctx.palette, x * 0.3 + y * 0.15),
              opacity: clamp(energy, 0, 1),
            });
          }
        }
        return cmds;
      }
    ),

    preset(
      "glitch-static-burst",
      "Static Burst",
      "A screen of speckled static that flares on every drop and dissolves.",
      () => ({ intensity: 0 }),
      (ctx, state) => {
        state.intensity = ctx.features.isDrop ? 1 : Math.max(0, state.intensity - ctx.dt * 1.4);
        const cmds: DrawCmd[] = [bg(ctx)];
        const count = Math.round(120 * ctx.reactivity.particleDensity * (0.15 + state.intensity));
        for (let i = 0; i < count; i++) {
          const x = ctx.rng() * ctx.width;
          const y = ctx.rng() * ctx.height;
          const size = 1 + ctx.rng() * 3;
          cmds.push({
            kind: "rect",
            x,
            y,
            w: size,
            h: size,
            color: ctx.rng() > 0.5 ? "#ffffff" : colorAt(ctx.palette, ctx.rng() * 5),
            opacity: 0.4 + ctx.rng() * 0.6,
          });
        }
        return cmds;
      }
    ),

    preset(
      "glitch-pixel-sort",
      "Pixel Sort Streak",
      "Vertical color streaks stretch downward with the bass, like a tracking error.",
      () => ({}),
      (ctx) => {
        const cols = 40;
        const colW = ctx.width / cols;
        const spectrum = resample(ctx.features.spectrum, cols);
        const cmds: DrawCmd[] = [bg(ctx)];
        spectrum.forEach((v, i) => {
          const streakH = ctx.height * clamp(v * 0.8 + ctx.features.bass * 0.6, 0, 1.4);
          cmds.push({
            kind: "rect",
            x: i * colW,
            y: 0,
            w: colW - 1,
            h: streakH,
            color: colorAt(ctx.palette, i * 0.2 + ctx.t * 0.3),
            opacity: 0.5 + v * 0.4,
          });
        });
        return cmds;
      }
    ),
  ];
}
