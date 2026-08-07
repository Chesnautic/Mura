/**
 * Mura's color system.
 *
 * Ported and extended from Kami's `palettes.py`: a handful of hand-picked
 * presets, hex <-> rgb helpers, a "build a custom palette by overriding
 * fields on a preset" helper, and a golden-angle random-palette generator
 * that spaces hues out so they never land close together and look muddy.
 *
 * Everything downstream (all 50 waveform engines, all 10 icon drops) reads
 * color exclusively through a `MuraPalette`, so full manual control and
 * "Randomize" are really the same code path -- one builds the palette by
 * hand, the other calls `randomPalette()`. Nothing is ever hardcoded to a
 * specific hex value inside a renderer.
 */

export type RGB = readonly [number, number, number];

export interface MuraPalette {
  /** Canvas clear color. */
  background: RGB;
  /** Ordered list of foreground colors every engine cycles/maps through.
   * Not fixed-length -- users can add/remove swatches in Color Studio. */
  colors: RGB[];
  /** Used for UI highlights, beat-flash rings, primary "hero" strokes. */
  accent: RGB;
  /** Used for bloom/glow tinting behind strokes. */
  glow: RGB;
}

export const DEFAULT_PALETTE_NAME = "mura";

export const PRESET_PALETTES: Record<string, MuraPalette> = {
  mura: {
    background: [14, 8, 24],
    colors: [
      [255, 45, 149],
      [123, 92, 255],
      [0, 224, 200],
      [255, 176, 32],
      [86, 208, 255],
    ],
    accent: [255, 45, 149],
    glow: [123, 92, 255],
  },
  chrome: {
    background: [8, 8, 18],
    colors: [
      [200, 230, 255],
      [255, 255, 255],
      [120, 200, 255],
      [255, 0, 170],
      [0, 255, 220],
    ],
    accent: [255, 0, 170],
    glow: [0, 255, 255],
  },
  candy: {
    background: [18, 4, 24],
    colors: [
      [255, 105, 180],
      [170, 255, 60],
      [255, 165, 0],
      [0, 220, 255],
      [255, 240, 80],
    ],
    accent: [255, 105, 180],
    glow: [170, 255, 60],
  },
  matrix: {
    background: [2, 8, 4],
    colors: [
      [60, 255, 120],
      [10, 200, 80],
      [200, 255, 220],
      [0, 100, 40],
      [140, 255, 180],
    ],
    accent: [60, 255, 120],
    glow: [10, 255, 90],
  },
  vapor: {
    background: [12, 6, 28],
    colors: [
      [255, 113, 206],
      [1, 205, 254],
      [5, 255, 161],
      [185, 103, 255],
      [255, 250, 180],
    ],
    accent: [1, 205, 254],
    glow: [255, 113, 206],
  },
  ember: {
    background: [16, 4, 4],
    colors: [
      [255, 94, 0],
      [255, 191, 0],
      [255, 0, 68],
      [255, 214, 153],
      [140, 0, 0],
    ],
    accent: [255, 94, 0],
    glow: [255, 0, 68],
  },
  petal: {
    background: [24, 10, 20],
    colors: [
      [255, 173, 216],
      [255, 214, 235],
      [199, 130, 255],
      [255, 255, 255],
      [255, 105, 165],
    ],
    accent: [255, 105, 165],
    glow: [199, 130, 255],
  },
};

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r || 0, g || 0, b || 0];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToRgba(rgb: RGB, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function lighten(rgb: RGB, amt: number): RGB {
  return rgb.map((c) => c + (255 - c) * amt) as unknown as RGB;
}

export function darken(rgb: RGB, amt: number): RGB {
  return rgb.map((c) => c * (1 - amt)) as unknown as RGB;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v; g = t; b = p; break;
    case 1:
      r = q; g = v; b = p; break;
    case 2:
      r = p; g = v; b = t; break;
    case 3:
      r = p; g = q; b = v; break;
    case 4:
      r = t; g = p; b = v; break;
    case 5:
      r = v; g = p; b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

/** Small seedable PRNG (mulberry32) so a given seed always reproduces the
 * same palette -- lets "Randomize" be shuffled but also shareable/undoable. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN_ANGLE = 0.6180339887498949;

/**
 * Generate a fresh, good-looking palette: a near-black tinted background
 * plus N vivid, well-separated foreground colors. Colors are spaced around
 * the hue wheel using the golden angle rather than pure uniform-random
 * hues, so consecutive picks never land close together (avoiding a
 * muddy/samey look) without the rigid feel of evenly-sliced hues.
 */
export function randomPalette(opts: { seed?: number; swatchCount?: number } = {}): MuraPalette {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const n = opts.swatchCount ?? 5;
  const rng = mulberry32(seed);
  const uniform = (lo: number, hi: number) => lo + rng() * (hi - lo);

  const bgHue = rng();
  const background = hsvToRgb(bgHue, uniform(0.35, 0.65), uniform(0.03, 0.09));

  const baseHue = rng();
  const colors: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const hue = (baseHue + i * GOLDEN_ANGLE + uniform(-0.04, 0.04) + 1) % 1;
    const sat = uniform(0.55, 0.95);
    const val = uniform(0.85, 1.0);
    colors.push(hsvToRgb(hue, sat, val));
  }

  const accent = colors[Math.floor(rng() * n)];
  const glowHue = (baseHue + uniform(0.4, 0.6)) % 1;
  const glow = hsvToRgb(glowHue, uniform(0.5, 0.9), 1.0);

  return { background, colors, accent, glow };
}

export function buildCustomPalette(
  base: string,
  overrides: Partial<{ background: string; accent: string; glow: string; colors: string[] }>
): MuraPalette {
  const preset = PRESET_PALETTES[base] ?? PRESET_PALETTES[DEFAULT_PALETTE_NAME];
  return {
    background: overrides.background ? hexToRgb(overrides.background) : preset.background,
    accent: overrides.accent ? hexToRgb(overrides.accent) : preset.accent,
    glow: overrides.glow ? hexToRgb(overrides.glow) : preset.glow,
    colors: overrides.colors?.length ? overrides.colors.map(hexToRgb) : preset.colors,
  };
}

export function paletteToHexFields(pal: MuraPalette) {
  return {
    background: rgbToHex(pal.background),
    accent: rgbToHex(pal.accent),
    glow: rgbToHex(pal.glow),
    colors: pal.colors.map(rgbToHex),
  };
}
