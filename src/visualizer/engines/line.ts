import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd } from "../engineTypes";
import { colorAt, resample, smoothPathThrough } from "../drawUtils";

const FAMILY = "line";
const FAMILY_LABEL = "Line Waves";

function wavePoints(ctx: SceneContext, segments: number, amplitude: number, midY: number) {
  const samples = resample(ctx.features.waveform, segments);
  const step = ctx.width / (segments - 1);
  return samples.map((v, i) => ({ x: i * step, y: midY + v * amplitude }));
}

function makePreset(
  id: string,
  name: string,
  description: string,
  build: (ctx: SceneContext) => DrawCmd[]
): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState: () => ({}), buildScene: build };
}

export function createLinePresets(): WaveformPreset[] {
  return [
    makePreset("line-neon", "Neon Line", "A single glowing line tracing the raw waveform.", (ctx) => {
      const midY = ctx.height * 0.5;
      const amp = ctx.height * 0.32 * (0.5 + ctx.features.level);
      const pts = wavePoints(ctx, 96, amp, midY);
      const path = smoothPathThrough(pts);
      const color = colorAt(ctx.palette, ctx.t * 0.3);
      return [
        { kind: "clear", color: rgbaBg(ctx) },
        { kind: "path", path, color, style: "stroke", strokeWidth: 5, blurSigma: 14 * ctx.reactivity.glowStrength },
        { kind: "path", path, color: "#ffffff", style: "stroke", strokeWidth: 2 },
      ];
    }),

    makePreset(
      "line-mirror",
      "Mirror Wave",
      "Waveform mirrored top and bottom with a filled glow band between.",
      (ctx) => {
        const midY = ctx.height * 0.5;
        const amp = ctx.height * 0.28 * (0.4 + ctx.features.level);
        const top = wavePoints(ctx, 80, -amp, midY);
        const bottom = wavePoints(ctx, 80, amp, midY).reverse();
        const fillPath = Skia.Path.Make();
        fillPath.moveTo(top[0].x, top[0].y);
        for (const p of top) fillPath.lineTo(p.x, p.y);
        for (const p of bottom) fillPath.lineTo(p.x, p.y);
        fillPath.close();
        const strokeTop = smoothPathThrough(top);
        const strokeBottom = smoothPathThrough(bottom);
        return [
          { kind: "clear", color: rgbaBg(ctx) },
          { kind: "path", path: fillPath, color: colorAt(ctx.palette, ctx.t * 0.2), opacity: 0.28 },
          { kind: "path", path: strokeTop, color: colorAt(ctx.palette, ctx.t * 0.2 + 1), style: "stroke", strokeWidth: 4, blurSigma: 10 },
          { kind: "path", path: strokeBottom, color: colorAt(ctx.palette, ctx.t * 0.2 + 2), style: "stroke", strokeWidth: 4, blurSigma: 10 },
        ];
      }
    ),

    makePreset("line-dotted", "Dotted Pulse", "The waveform rendered as a row of beat-sized dots.", (ctx) => {
      const midY = ctx.height * 0.5;
      const amp = ctx.height * 0.3;
      const segments = 48;
      const samples = resample(ctx.features.waveform, segments);
      const step = ctx.width / (segments - 1);
      const cmds: DrawCmd[] = [{ kind: "clear", color: rgbaBg(ctx) }];
      samples.forEach((v, i) => {
        const r = 3 + Math.abs(v) * 22 * (0.6 + ctx.features.onset);
        cmds.push({
          kind: "circle",
          cx: i * step,
          cy: midY + v * amp,
          r,
          color: colorAt(ctx.palette, i * 0.35 + ctx.t * 0.5),
          blurSigma: 6 * ctx.reactivity.glowStrength,
        });
      });
      return cmds;
    }),

    makePreset(
      "line-ribbon-fill",
      "Ribbon Fill",
      "Filled area under the wave, colored in a slow palette sweep.",
      (ctx) => {
        const baseY = ctx.height * 0.62;
        const amp = ctx.height * 0.4 * (0.5 + ctx.features.level);
        const segments = 64;
        const pts = wavePoints({ ...ctx }, segments, -amp, baseY);
        const path = Skia.Path.Make();
        path.moveTo(0, ctx.height);
        for (const p of pts) path.lineTo(p.x, p.y);
        path.lineTo(ctx.width, ctx.height);
        path.close();
        return [
          { kind: "clear", color: rgbaBg(ctx) },
          { kind: "path", path, color: colorAt(ctx.palette, ctx.t * 0.4), opacity: 0.85 },
          { kind: "path", path: smoothPathThrough(pts), color: "#ffffff", style: "stroke", strokeWidth: 3, opacity: 0.8 },
        ];
      }
    ),

    makePreset(
      "line-double-trace",
      "Double Trace",
      "Bass-weighted and treble-weighted traces overlapping in two colors.",
      (ctx) => {
        const midY = ctx.height * 0.5;
        const ampBass = ctx.height * 0.25 * (0.4 + ctx.features.bass);
        const ampTreble = ctx.height * 0.18 * (0.3 + ctx.features.treble);
        const bassPts = wavePoints(ctx, 72, ampBass, midY - 20);
        const treblePts = wavePoints(ctx, 72, ampTreble, midY + 20);
        return [
          { kind: "clear", color: rgbaBg(ctx) },
          {
            kind: "path",
            path: smoothPathThrough(bassPts),
            color: colorAt(ctx.palette, 0),
            style: "stroke",
            strokeWidth: 5,
            opacity: 0.85,
            blurSigma: 8,
          },
          {
            kind: "path",
            path: smoothPathThrough(treblePts),
            color: colorAt(ctx.palette, 2.2),
            style: "stroke",
            strokeWidth: 3,
            opacity: 0.75,
            blurSigma: 6,
          },
        ];
      }
    ),
  ];
}

function rgbaBg(ctx: SceneContext): string {
  const [r, g, b] = ctx.palette.background;
  return `rgba(${r}, ${g}, ${b}, 1)`;
}
