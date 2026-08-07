import type { WaveformPreset, SceneContext, DrawCmd } from "../engineTypes";
import { colorAt, resample, rgb } from "../drawUtils";

const FAMILY = "bars";
const FAMILY_LABEL = "Equalizer Bars";

function bg(ctx: SceneContext): DrawCmd {
  return { kind: "clear", color: rgb(ctx.palette.background) };
}

function preset(id: string, name: string, description: string, build: (ctx: SceneContext) => DrawCmd[]): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState: () => ({}), buildScene: build };
}

export function createBarsPresets(): WaveformPreset[] {
  return [
    preset("bars-classic", "Classic EQ Bars", "The timeless mirrored spectrum bar visualizer.", (ctx) => {
      const n = 28;
      const spectrum = resample(ctx.features.spectrum, n);
      const gap = ctx.width * 0.008;
      const barW = (ctx.width - gap * (n - 1)) / n;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const h = Math.max(4, Math.min(ctx.height * 0.9, v * ctx.height * 0.55));
        const x = i * (barW + gap);
        cmds.push({
          kind: "rect",
          x,
          y: ctx.height - h,
          w: barW,
          h,
          rx: barW * 0.3,
          color: colorAt(ctx.palette, i / n * ctx.palette.colors.length),
          blurSigma: 3 * ctx.reactivity.glowStrength,
        });
      });
      return cmds;
    }),

    preset("bars-mirrored", "Mirrored Bars", "Bars extend both up and down from a center line.", (ctx) => {
      const n = 24;
      const spectrum = resample(ctx.features.spectrum, n);
      const gap = ctx.width * 0.01;
      const barW = (ctx.width - gap * (n - 1)) / n;
      const midY = ctx.height * 0.5;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const h = Math.max(3, Math.min(ctx.height * 0.42, v * ctx.height * 0.32));
        const x = i * (barW + gap);
        cmds.push({
          kind: "rect",
          x,
          y: midY - h,
          w: barW,
          h: h * 2,
          rx: barW * 0.4,
          color: colorAt(ctx.palette, i / n * ctx.palette.colors.length + ctx.t * 0.15),
          opacity: 0.92,
          blurSigma: 4,
        });
      });
      return cmds;
    }),

    preset("bars-stepped", "Stepped Blocks", "Chunky retro pixel-block bars, quantized into steps.", (ctx) => {
      const n = 18;
      const steps = 8;
      const spectrum = resample(ctx.features.spectrum, n);
      const gap = ctx.width * 0.012;
      const barW = (ctx.width - gap * (n - 1)) / n;
      const stepH = (ctx.height * 0.85) / steps;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const activeSteps = Math.min(steps, Math.round(v * steps * 1.3));
        for (let s = 0; s < activeSteps; s++) {
          cmds.push({
            kind: "rect",
            x: i * (barW + gap),
            y: ctx.height - (s + 1) * stepH + stepH * 0.12,
            w: barW,
            h: stepH * 0.76,
            rx: 2,
            color: colorAt(ctx.palette, s / steps + i * 0.05),
          });
        }
      });
      return cmds;
    }),

    preset("bars-skyline", "Gradient Skyline", "Rounded glowing bars with a per-bar palette gradient.", (ctx) => {
      const n = 32;
      const spectrum = resample(ctx.features.spectrum, n);
      const gap = ctx.width * 0.006;
      const barW = (ctx.width - gap * (n - 1)) / n;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const h = Math.max(6, Math.min(ctx.height * 0.95, v * ctx.height * 0.7));
        const x = i * (barW + gap);
        const layers = 3;
        for (let l = 0; l < layers; l++) {
          const lh = h * (1 - l * 0.22);
          cmds.push({
            kind: "rect",
            x,
            y: ctx.height - lh,
            w: barW,
            h: lh,
            rx: barW * 0.5,
            color: colorAt(ctx.palette, i / n * ctx.palette.colors.length + l * 0.6),
            opacity: 1 - l * 0.28,
            blurSigma: l === 0 ? 10 * ctx.reactivity.glowStrength : 0,
          });
        }
      });
      return cmds;
    }),

    preset("bars-dual", "Dual Interleaved Bars", "Bass-colored and treble-colored bars interleaved.", (ctx) => {
      const n = 20;
      const spectrum = resample(ctx.features.spectrum, n);
      const gap = ctx.width * 0.01;
      const barW = (ctx.width - gap * (n - 1)) / n / 1.6;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const baseX = i * (barW * 1.6 + gap);
        const hBass = Math.max(4, ctx.features.bass * ctx.height * 0.5 * (0.5 + v));
        const hTreble = Math.max(4, ctx.features.treble * ctx.height * 0.5 * (0.5 + v));
        cmds.push({
          kind: "rect",
          x: baseX,
          y: ctx.height - hBass,
          w: barW,
          h: hBass,
          rx: 4,
          color: colorAt(ctx.palette, 0.2),
          opacity: 0.9,
        });
        cmds.push({
          kind: "rect",
          x: baseX + barW * 1.1,
          y: ctx.height - hTreble,
          w: barW,
          h: hTreble,
          rx: 4,
          color: colorAt(ctx.palette, 2.6),
          opacity: 0.9,
        });
      });
      return cmds;
    }),
  ];
}
