import { Skia, type SkPath } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd, EngineState } from "../engineTypes";
import { colorAt, rgb, resample } from "../drawUtils";

const FAMILY = "ribbon";
const FAMILY_LABEL = "Flowing Ribbons";

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

function ribbonPath(points: { x: number; y: number; w: number }[]): SkPath {
  const path = Skia.Path.Make();
  if (points.length < 2) return path;
  const top = points.map((p) => ({ x: p.x, y: p.y - p.w / 2 }));
  const bottom = points.map((p) => ({ x: p.x, y: p.y + p.w / 2 })).reverse();
  path.moveTo(top[0].x, top[0].y);
  for (const p of top) path.lineTo(p.x, p.y);
  for (const p of bottom) path.lineTo(p.x, p.y);
  path.close();
  return path;
}

export function createRibbonPresets(): WaveformPreset[] {
  return [
    preset(
      "ribbon-flow-trail",
      "Flow Trail",
      "A ribbon traces the waveform's recent center-of-motion, fading out.",
      () => ({ history: [] as { x: number; y: number }[] }),
      (ctx, state) => {
        const history: { x: number; y: number }[] = state.history;
        const cy = ctx.height / 2 + (ctx.features.waveform[0] ?? 0) * ctx.height * 0.25;
        history.push({ x: ctx.width * 0.5, y: cy });
        const maxLen = 60;
        if (history.length > maxLen) history.shift();
        const points = history.map((p, i) => ({
          x: ctx.width - (history.length - 1 - i) * (ctx.width / maxLen),
          y: p.y,
          w: 6 + ctx.features.level * 30 * (i / history.length),
        }));
        return [
          bg(ctx),
          {
            kind: "path",
            path: ribbonPath(points),
            color: colorAt(ctx.palette, ctx.t * 0.4),
            opacity: 0.85,
            blurSigma: 8 * ctx.reactivity.glowStrength,
          },
        ];
      }
    ),

    preset(
      "ribbon-silk",
      "Silk Wave",
      "A smooth undulating ribbon band whose width breathes with loudness.",
      () => ({}),
      (ctx) => {
        const n = 48;
        const spectrum = resample(ctx.features.waveform, n);
        const midY = ctx.height * 0.5;
        const points = spectrum.map((v, i) => ({
          x: (i / (n - 1)) * ctx.width,
          y: midY + v * ctx.height * 0.2,
          w: (14 + ctx.features.level * 60) * (0.6 + 0.4 * Math.sin((i / n) * Math.PI)),
        }));
        return [
          bg(ctx),
          { kind: "path", path: ribbonPath(points), color: colorAt(ctx.palette, ctx.t * 0.25), opacity: 0.8, blurSigma: 6 },
          {
            kind: "path",
            path: ribbonPath(points.map((p) => ({ ...p, w: p.w * 0.35 }))),
            color: "#ffffff",
            opacity: 0.35,
          },
        ];
      }
    ),

    preset(
      "ribbon-double-helix",
      "Double Helix",
      "Two ribbons weave around a center axis, phase-shifted by bass vs treble.",
      () => ({}),
      (ctx) => {
        const n = 60;
        const midY = ctx.height * 0.5;
        const amp = ctx.height * 0.22;
        const a = Array.from({ length: n }, (_, i) => {
          const t = (i / (n - 1)) * Math.PI * 4 + ctx.t * 2;
          return {
            x: (i / (n - 1)) * ctx.width,
            y: midY + Math.sin(t) * amp * (0.4 + ctx.features.bass),
            w: 8 + ctx.features.bass * 20,
          };
        });
        const b = Array.from({ length: n }, (_, i) => {
          const t = (i / (n - 1)) * Math.PI * 4 + ctx.t * 2 + Math.PI;
          return {
            x: (i / (n - 1)) * ctx.width,
            y: midY + Math.sin(t) * amp * (0.4 + ctx.features.treble),
            w: 6 + ctx.features.treble * 16,
          };
        });
        return [
          bg(ctx),
          { kind: "path", path: ribbonPath(a), color: colorAt(ctx.palette, 0.5), opacity: 0.85, blurSigma: 6 },
          { kind: "path", path: ribbonPath(b), color: colorAt(ctx.palette, 3), opacity: 0.85, blurSigma: 6 },
        ];
      }
    ),

    preset(
      "ribbon-comet",
      "Comet Streak",
      "A bright point with a fading ribbon tail, kicked by onsets.",
      () => ({ x: 0, y: 0, vx: 140, vy: 60, history: [] as { x: number; y: number }[] }),
      (ctx, state) => {
        state.x += state.vx * ctx.dt;
        state.y += state.vy * ctx.dt;
        if (state.x < 0 || state.x > ctx.width) state.vx *= -1;
        if (state.y < 0 || state.y > ctx.height) state.vy *= -1;
        if (ctx.features.onset > 0.5) {
          const boost = 1 + ctx.features.onset;
          state.vx *= boost > 1.6 ? 1.05 : 1;
          state.vy *= boost > 1.6 ? 1.05 : 1;
        }
        state.x = Math.max(0, Math.min(ctx.width, state.x));
        state.y = Math.max(0, Math.min(ctx.height, state.y));
        const history: { x: number; y: number }[] = state.history;
        history.push({ x: state.x, y: state.y });
        if (history.length > 26) history.shift();
        const points = history.map((p, i) => ({ x: p.x, y: p.y, w: (i / history.length) * 18 + 2 }));
        return [
          bg(ctx),
          { kind: "path", path: ribbonPath(points), color: colorAt(ctx.palette, ctx.t * 0.6), opacity: 0.8, blurSigma: 6 },
          {
            kind: "circle",
            cx: state.x,
            cy: state.y,
            r: 10 + ctx.features.onset * 10,
            color: "#ffffff",
            blurSigma: 14 * ctx.reactivity.glowStrength,
          },
        ];
      }
    ),

    preset(
      "ribbon-braided",
      "Braided Threads",
      "Three thin ribbons of different palette colors weave together.",
      () => ({}),
      (ctx) => {
        const n = 50;
        const midY = ctx.height * 0.5;
        const amp = ctx.height * 0.16 * (0.5 + ctx.features.level);
        const cmds: DrawCmd[] = [bg(ctx)];
        for (let strand = 0; strand < 3; strand++) {
          const phase = (strand / 3) * Math.PI * 2;
          const points = Array.from({ length: n }, (_, i) => {
            const t = (i / (n - 1)) * Math.PI * 3 + ctx.t * 1.6 + phase;
            return {
              x: (i / (n - 1)) * ctx.width,
              y: midY + Math.sin(t) * amp,
              w: 5 + ctx.features.mid * 10,
            };
          });
          cmds.push({
            kind: "path",
            path: ribbonPath(points),
            color: colorAt(ctx.palette, strand * 1.7),
            opacity: 0.75,
            blurSigma: 4,
          });
        }
        return cmds;
      }
    ),
  ];
}
