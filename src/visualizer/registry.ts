import type { WaveformPreset } from "./engineTypes";
import { createLinePresets } from "./engines/line";
import { createBarsPresets } from "./engines/bars";
import { createRadialPresets } from "./engines/radial";
import { createParticlesPresets } from "./engines/particles";
import { createRibbonPresets } from "./engines/ribbon";
import { createTunnelPresets } from "./engines/tunnel";
import { createKaleidoscopePresets } from "./engines/kaleidoscope";
import { createScopePresets } from "./engines/scope";
import { createGlitchPresets } from "./engines/glitch";
import { createGeometricPresets } from "./engines/geometric";

/**
 * The full waveform library: 10 rendering engines x 5 presets each = 50
 * distinct waveform types, matching Kami's own "shared render code, many
 * named presets" structure (its 30 patterns organized into 4 packs) just
 * scaled up and generalized -- see each engines/*.ts file for one family.
 */
export const WAVEFORM_PRESETS: WaveformPreset[] = [
  ...createLinePresets(),
  ...createBarsPresets(),
  ...createRadialPresets(),
  ...createParticlesPresets(),
  ...createRibbonPresets(),
  ...createTunnelPresets(),
  ...createKaleidoscopePresets(),
  ...createScopePresets(),
  ...createGlitchPresets(),
  ...createGeometricPresets(),
];

export interface WaveformFamily {
  id: string;
  label: string;
  presets: WaveformPreset[];
}

export const WAVEFORM_FAMILIES: WaveformFamily[] = Object.values(
  WAVEFORM_PRESETS.reduce<Record<string, WaveformFamily>>((acc, p) => {
    if (!acc[p.family]) acc[p.family] = { id: p.family, label: p.familyLabel, presets: [] };
    acc[p.family].presets.push(p);
    return acc;
  }, {})
);

const PRESET_BY_ID = new Map(WAVEFORM_PRESETS.map((p) => [p.id, p]));

export function getWaveformPreset(id: string): WaveformPreset {
  return PRESET_BY_ID.get(id) ?? WAVEFORM_PRESETS[0];
}

export const DEFAULT_WAVEFORM_ID = WAVEFORM_PRESETS[0].id;

export const WAVEFORM_PRESET_COUNT = WAVEFORM_PRESETS.length;
