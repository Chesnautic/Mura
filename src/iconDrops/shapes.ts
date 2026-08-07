import { Skia, FillType, type SkPath } from "@shopify/react-native-skia";

/**
 * Every shape builder returns a fresh SkPath normalized to a 100x100 box
 * (roughly centered on 50,50) -- callers scale + translate + rotate when
 * placing an instance (see FallingIconsLayer.tsx). Keeping shapes in their
 * own normalized space means the physics layer never needs to know
 * anything about how a given icon is actually drawn.
 */

function poly(points: [number, number][]): SkPath {
  const path = Skia.Path.Make();
  const pts = points.map(([x, y]) => Skia.Point(x, y));
  path.addPoly(pts, true);
  return path;
}

/** A plus/crucifix-style cross -- two overlapping bars, nonzero winding
 * unions them into one clean silhouette. */
export function buildCrossPath(): SkPath {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(38, 4, 24, 92)); // vertical bar
  path.addRect(Skia.XYWHRect(10, 28, 80, 24)); // horizontal bar
  return path;
}

/** Mura's own falling-flower motif -- a small "Murakami pillow"-style
 * multi-petal bloom, distinct from the app icon (fewer petals, simpler,
 * legible at tiny falling-particle sizes) but clearly the same family. */
export function buildFlowerPath(): SkPath {
  const path = Skia.Path.Make();
  const cx = 50;
  const cy = 50;
  const petalCount = 6;
  const petalLen = 34;
  const petalW = 20;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = Math.sin(angle);
    const py = -Math.cos(angle);
    const tipX = cx + dx * petalLen;
    const tipY = cy + dy * petalLen;
    const baseX = cx + dx * 10;
    const baseY = cy + dy * 10;
    const c1x = baseX + px * petalW * 0.5;
    const c1y = baseY + py * petalW * 0.5;
    const c2x = baseX - px * petalW * 0.5;
    const c2y = baseY - py * petalW * 0.5;
    path.moveTo(baseX, baseY);
    path.cubicTo(c1x, c1y, tipX + px * petalW * 0.15, tipY + py * petalW * 0.15, tipX, tipY);
    path.cubicTo(tipX - px * petalW * 0.15, tipY - py * petalW * 0.15, c2x, c2y, baseX, baseY);
    path.close();
  }
  path.addCircle(cx, cy, 11);
  return path;
}

/** A chunky block "E" -- four overlapping rects union into the glyph. */
export function buildLetterEPath(): SkPath {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(18, 8, 18, 84)); // spine
  path.addRect(Skia.XYWHRect(18, 8, 66, 18)); // top arm
  path.addRect(Skia.XYWHRect(18, 41, 56, 18)); // middle arm (slightly shorter)
  path.addRect(Skia.XYWHRect(18, 74, 66, 18)); // bottom arm
  return path;
}

/** Classic 5-point star. */
export function buildStarPath(): SkPath {
  const cx = 50;
  const cy = 52;
  const outerR = 46;
  const innerR = 18;
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return poly(points);
}

/** Standard two-lobe cubic-bezier heart. */
export function buildHeartPath(): SkPath {
  const path = Skia.Path.Make();
  path.moveTo(50, 88);
  path.cubicTo(-10, 48, 18, 4, 50, 30);
  path.cubicTo(82, 4, 110, 48, 50, 88);
  path.close();
  return path;
}

/** A rotated-square diamond. */
export function buildDiamondPath(): SkPath {
  return poly([
    [50, 4],
    [92, 50],
    [50, 96],
    [8, 50],
  ]);
}

/** A single filled eighth note: tilted oval notehead + stem + flag. */
export function buildMusicNotePath(): SkPath {
  const path = Skia.Path.Make();
  path.addOval(Skia.XYWHRect(10, 62, 34, 26));
  path.addRect(Skia.XYWHRect(38, 14, 9, 66));
  path.moveTo(47, 14);
  path.cubicTo(70, 20, 82, 34, 78, 52);
  path.cubicTo(74, 38, 60, 30, 47, 34);
  path.close();
  return path;
}

/** A jagged lightning bolt. */
export function buildLightningBoltPath(): SkPath {
  return poly([
    [58, 2],
    [24, 54],
    [46, 54],
    [38, 98],
    [80, 40],
    [56, 40],
  ]);
}

/** A 4-point sparkle/spark -- concave-sided star, same family as the app icon's accent sparkles. */
export function buildSparkCirclePath(): SkPath {
  const path = Skia.Path.Make();
  const cx = 50;
  const cy = 50;
  const outerR = 48;
  const innerR = 14;
  path.moveTo(cx, cy - outerR);
  path.quadTo(cx, cy, cx + outerR, cy);
  path.quadTo(cx, cy, cx, cy + outerR);
  path.quadTo(cx, cy, cx - outerR, cy);
  path.quadTo(cx, cy, cx, cy - outerR);
  path.close();
  // small center circle keeps it readable as a "spark" rather than a blob at tiny sizes
  path.addCircle(cx, cy, innerR * 0.35);
  return path;
}

/** A simple round smiley face -- face circle with eyes/mouth cut out via
 * even-odd fill, so the whole thing renders as one solid color with real
 * holes (no separate paint needed for the features). */
export function buildSmileyFacePath(): SkPath {
  const path = Skia.Path.Make();
  path.addCircle(50, 50, 46);
  path.addCircle(34, 40, 7);
  path.addCircle(66, 40, 7);
  path.moveTo(26, 58);
  path.cubicTo(34, 78, 66, 78, 74, 58);
  path.cubicTo(66, 66, 34, 66, 26, 58);
  path.close();
  path.setFillType(FillType.EvenOdd);
  return path;
}

export type IconShapeId =
  | "cross"
  | "flower"
  | "letter_e"
  | "star"
  | "heart"
  | "diamond"
  | "music_note"
  | "lightning_bolt"
  | "spark"
  | "smiley";

export const SHAPE_BUILDERS: Record<IconShapeId, () => SkPath> = {
  cross: buildCrossPath,
  flower: buildFlowerPath,
  letter_e: buildLetterEPath,
  star: buildStarPath,
  heart: buildHeartPath,
  diamond: buildDiamondPath,
  music_note: buildMusicNotePath,
  lightning_bolt: buildLightningBoltPath,
  spark: buildSparkCirclePath,
  smiley: buildSmileyFacePath,
};
