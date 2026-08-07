import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd } from "../engineTypes";
import { colorAt, resample, rgb, polarPoint } from "../drawUtils";

const FAMILY = "radial";
const FAMILY_LABEL = "Radial & Circular";

function bg(ctx: SceneContext): DrawCmd {
  return { kind: "clear", color: rgb(ctx.palette.background) };
}

function preset(id: string, name: string, description: string, build: (ctx: SceneContext) => DrawCmd[]): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState: () => ({}), buildScene: build };
}

export function createRadialPresets(): WaveformPreset[] {
  return [
    preset("radial-burst", "Radial Burst", "Spokes radiating from center, one per frequency bin.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const baseR = Math.min(ctx.width, ctx.height) * 0.16;
      const n = 48;
      const spectrum = resample(ctx.features.spectrum, n);
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const len = baseR + v * Math.min(ctx.width, ctx.height) * 0.32;
        const inner = polarPoint(cx, cy, baseR, angle);
        const outer = polarPoint(cx, cy, len, angle);
        cmds.push({
          kind: "line",
          x1: inner.x,
          y1: inner.y,
          x2: outer.x,
          y2: outer.y,
          color: colorAt(ctx.palette, (i / n) * ctx.palette.colors.length),
          strokeWidth: 5,
          blurSigma: 4 * ctx.reactivity.glowStrength,
        });
      });
      return cmds;
    }),

    preset("radial-ring-pulse", "Ring Pulse", "A concentric ring that swells with bass and onset.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const r = Math.min(ctx.width, ctx.height) * (0.18 + ctx.features.bass * 0.22 + ctx.features.onset * 0.08);
      const cmds: DrawCmd[] = [bg(ctx)];
      for (let ring = 0; ring < 3; ring++) {
        cmds.push({
          kind: "circle",
          cx,
          cy,
          r: r - ring * 22,
          color: colorAt(ctx.palette, ring * 1.3 + ctx.t * 0.2),
          style: "stroke",
          strokeWidth: 6 - ring,
          opacity: 1 - ring * 0.25,
          blurSigma: (10 + ring * 4) * ctx.reactivity.glowStrength,
        });
      }
      return cmds;
    }),

    preset("radial-sunflower", "Sunflower Radial", "Rounded petal-tipped spokes -- Mura's flower motif as a spectrum.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const baseR = Math.min(ctx.width, ctx.height) * 0.14;
      const n = 16;
      const spectrum = resample(ctx.features.spectrum, n);
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const angle = (i / n) * Math.PI * 2 + ctx.t * 0.1;
        const len = baseR + v * Math.min(ctx.width, ctx.height) * 0.28;
        const tip = polarPoint(cx, cy, baseR + len, angle);
        const petalR = 10 + v * 26;
        cmds.push({
          kind: "line",
          x1: cx + baseR * Math.cos(angle),
          y1: cy + baseR * Math.sin(angle),
          x2: tip.x,
          y2: tip.y,
          color: colorAt(ctx.palette, i / n * ctx.palette.colors.length),
          strokeWidth: 3,
          opacity: 0.7,
        });
        cmds.push({
          kind: "circle",
          cx: tip.x,
          cy: tip.y,
          r: petalR,
          color: colorAt(ctx.palette, i / n * ctx.palette.colors.length),
          blurSigma: 6 * ctx.reactivity.glowStrength,
        });
      });
      cmds.push({ kind: "circle", cx, cy, r: baseR * 0.8, color: colorAt(ctx.palette, ctx.t * 0.3), blurSigma: 12 });
      return cmds;
    }),

    preset("radial-orbit-dots", "Orbit Dots", "Dots orbiting the center at a spectrum-modulated radius.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const n = 40;
      const spectrum = resample(ctx.features.spectrum, n);
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const angle = (i / n) * Math.PI * 2 + ctx.t * 0.6;
        const r = Math.min(ctx.width, ctx.height) * (0.15 + v * 0.32);
        const p = polarPoint(cx, cy, r, angle);
        cmds.push({
          kind: "circle",
          cx: p.x,
          cy: p.y,
          r: 4 + v * 14,
          color: colorAt(ctx.palette, (i / n) * ctx.palette.colors.length + ctx.t * 0.2),
          blurSigma: 5 * ctx.reactivity.glowStrength,
        });
      });
      return cmds;
    }),

    preset("radial-spiral", "Spiral Radial", "Spokes arranged along an expanding spiral rather than a circle.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const n = 64;
      const spectrum = resample(ctx.features.spectrum, n);
      const path = Skia.Path.Make();
      let started = false;
      spectrum.forEach((v, i) => {
        const t = i / n;
        const angle = t * Math.PI * 8 + ctx.t * 0.5;
        const r = 20 + t * Math.min(ctx.width, ctx.height) * 0.42 + v * 40;
        const p = polarPoint(cx, cy, r, angle);
        if (!started) {
          path.moveTo(p.x, p.y);
          started = true;
        } else {
          path.lineTo(p.x, p.y);
        }
      });
      return [
        bg(ctx),
        { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.4), style: "stroke", strokeWidth: 4, blurSigma: 8 * ctx.reactivity.glowStrength },
      ];
    }),
  ];
}
