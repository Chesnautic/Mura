import { Skia } from "@shopify/react-native-skia";
import type { WaveformPreset, SceneContext, DrawCmd } from "../engineTypes";
import { colorAt, rgb, polarPoint, resample } from "../drawUtils";

const FAMILY = "kaleidoscope";
const FAMILY_LABEL = "Kaleidoscope";

function bg(ctx: SceneContext): DrawCmd {
  return { kind: "clear", color: rgb(ctx.palette.background) };
}

function preset(id: string, name: string, description: string, build: (ctx: SceneContext) => DrawCmd[]): WaveformPreset {
  return { id, name, family: FAMILY, familyLabel: FAMILY_LABEL, description, createState: () => ({}), buildScene: build };
}

/** Draws one motif, then repeats it `folds` times around the center. */
function repeatAroundCenter(
  cx: number,
  cy: number,
  folds: number,
  drawMotif: (angleOffset: number) => DrawCmd[]
): DrawCmd[] {
  const cmds: DrawCmd[] = [];
  for (let f = 0; f < folds; f++) {
    cmds.push(...drawMotif((f / folds) * Math.PI * 2));
  }
  return cmds;
}

export function createKaleidoscopePresets(): WaveformPreset[] {
  return [
    preset("kaleido-mandala", "Mandala Bloom", "A blob motif mirrored into a flower-like mandala.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const folds = 8;
      const spectrum = resample(ctx.features.spectrum, 6);
      const cmds: DrawCmd[] = [bg(ctx)];
      cmds.push(
        ...repeatAroundCenter(cx, cy, folds, (offset) => {
          const path = Skia.Path.Make();
          const baseR = Math.min(ctx.width, ctx.height) * 0.08;
          const pts = spectrum.map((v, i) => {
            const angle = offset + (i / spectrum.length) * (Math.PI * 2) / folds;
            const r = baseR + v * Math.min(ctx.width, ctx.height) * 0.3;
            return polarPoint(cx, cy, r, angle + ctx.t * 0.15);
          });
          path.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
            path.quadTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
          }
          path.close();
          return [{ kind: "path", path, color: colorAt(ctx.palette, offset), opacity: 0.55, blurSigma: 4 }];
        })
      );
      return cmds;
    }),

    preset("kaleido-fractal-fan", "Fractal Fan", "N-fold mirrored triangular fan segments, colored by spectrum.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const folds = 10;
      const spectrum = resample(ctx.features.spectrum, folds);
      const maxR = Math.min(ctx.width, ctx.height) * 0.48;
      const cmds: DrawCmd[] = [bg(ctx)];
      spectrum.forEach((v, i) => {
        const a0 = (i / folds) * Math.PI * 2 + ctx.t * 0.2;
        const a1 = ((i + 0.85) / folds) * Math.PI * 2 + ctx.t * 0.2;
        const r = maxR * (0.15 + v);
        const p0 = polarPoint(cx, cy, r, a0);
        const p1 = polarPoint(cx, cy, r, a1);
        const path = Skia.Path.Make();
        path.moveTo(cx, cy);
        path.lineTo(p0.x, p0.y);
        path.lineTo(p1.x, p1.y);
        path.close();
        cmds.push({ kind: "path", path, color: colorAt(ctx.palette, i * 0.4), opacity: 0.8 });
      });
      return cmds;
    }),

    preset("kaleido-crystal", "Crystal Shard", "Sharp N-fold mirrored shards that spike with the treble.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const folds = 12;
      const cmds: DrawCmd[] = [bg(ctx)];
      cmds.push(
        ...repeatAroundCenter(cx, cy, folds, (offset) => {
          const len = Math.min(ctx.width, ctx.height) * (0.1 + ctx.features.treble * 0.4);
          const tip = polarPoint(cx, cy, len, offset);
          const baseWidthAngle = 0.05;
          const b1 = polarPoint(cx, cy, len * 0.15, offset - baseWidthAngle);
          const b2 = polarPoint(cx, cy, len * 0.15, offset + baseWidthAngle);
          const path = Skia.Path.Make();
          path.moveTo(b1.x, b1.y);
          path.lineTo(tip.x, tip.y);
          path.lineTo(b2.x, b2.y);
          path.close();
          return [
            {
              kind: "path" as const,
              path,
              color: colorAt(ctx.palette, offset * 1.5),
              style: "stroke" as const,
              strokeWidth: 2,
              opacity: 0.9,
              blurSigma: 3,
            },
          ];
        })
      );
      return cmds;
    }),

    preset("kaleido-star", "Star Kaleidoscope", "Rotating N-fold mirrored star shapes.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const folds = 6;
      const cmds: DrawCmd[] = [bg(ctx)];
      cmds.push(
        ...repeatAroundCenter(cx, cy, folds, (offset) => {
          const rot = offset + ctx.t * 0.4;
          const outerR = Math.min(ctx.width, ctx.height) * (0.06 + ctx.features.level * 0.16);
          const innerR = outerR * 0.45;
          const points = 5;
          const path = Skia.Path.Make();
          for (let i = 0; i <= points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = rot + (i / (points * 2)) * Math.PI * 2;
            const p = polarPoint(cx + Math.cos(offset) * outerR * 2, cy + Math.sin(offset) * outerR * 2, r, angle);
            if (i === 0) path.moveTo(p.x, p.y);
            else path.lineTo(p.x, p.y);
          }
          path.close();
          return [{ kind: "path" as const, path, color: colorAt(ctx.palette, offset * 2), opacity: 0.85, blurSigma: 4 }];
        })
      );
      return cmds;
    }),

    preset("kaleido-petal", "Petal Symmetry", "Soft rounded petal blobs mirrored into a dense flower.", (ctx) => {
      const cx = ctx.width / 2;
      const cy = ctx.height / 2;
      const folds = 14;
      const cmds: DrawCmd[] = [bg(ctx)];
      cmds.push(
        ...repeatAroundCenter(cx, cy, folds, (offset) => {
          const len = Math.min(ctx.width, ctx.height) * (0.1 + ctx.features.bass * 0.22 + ctx.features.mid * 0.1);
          const tip = polarPoint(cx, cy, len, offset);
          const mid1 = polarPoint(cx, cy, len * 0.6, offset - 0.12);
          const mid2 = polarPoint(cx, cy, len * 0.6, offset + 0.12);
          const path = Skia.Path.Make();
          path.moveTo(cx, cy);
          path.quadTo(mid1.x, mid1.y, tip.x, tip.y);
          path.quadTo(mid2.x, mid2.y, cx, cy);
          path.close();
          return [{ kind: "path" as const, path, color: colorAt(ctx.palette, offset * 1.2), opacity: 0.5, blurSigma: 5 }];
        })
      );
      cmds.push({ kind: "circle", cx, cy, r: Math.min(ctx.width, ctx.height) * 0.05, color: "#ffffff", opacity: 0.9, blurSigma: 8 });
      return cmds;
    }),
  ];
}
