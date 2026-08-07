import { create } from "zustand";
import { DEFAULT_WAVEFORM_ID } from "../visualizer/registry";
import {
  DEFAULT_PALETTE_NAME,
  PRESET_PALETTES,
  randomPalette,
  type MuraPalette,
} from "../theme/palettes";
import { DEFAULT_REACTIVITY, type ReactivityControls } from "../audio/types";
import {
  DEFAULT_FALLING_ICONS_CONFIG,
  type FallingIconsConfig,
} from "../iconDrops/fallingIconsEngine";
import { DEFAULT_ACTIVE_ICON_DROPS } from "../iconDrops/registry";
import type { IconShapeId } from "../iconDrops/shapes";

export interface AudioSource {
  uri: string;
  name: string;
  durationSec?: number;
  /** Real on-disk path, only set on the desktop app -- `uri` there is a
   * blob: URL (fine for the `<audio>` element playback, useless to a real
   * ffmpeg process); this is what analysis/export use instead. See
   * HomeScreen.tsx's pickAudio() and desktopBridge.ts. */
  desktopPath?: string;
}

export interface ExportState {
  isExporting: boolean;
  progress: number; // 0..1
  stage: string;
  lastResultUri?: string;
  lastError?: string;
}

interface MuraState {
  waveformId: string;
  palette: MuraPalette;
  reactivity: ReactivityControls;
  iconDropConfig: FallingIconsConfig;
  audioSource: AudioSource | null;
  exportState: ExportState;

  setWaveformId: (id: string) => void;
  randomizeWaveform: (allIds: string[]) => void;

  setPalette: (palette: MuraPalette) => void;
  applyPresetPalette: (name: string) => void;
  randomizePalette: () => void;
  setSwatchColor: (index: number, hex: string) => void;
  addSwatch: (hex: string) => void;
  removeSwatch: (index: number) => void;
  setBackgroundColor: (hex: string) => void;
  setAccentColor: (hex: string) => void;
  setGlowColor: (hex: string) => void;

  setReactivity: (patch: Partial<ReactivityControls>) => void;
  resetReactivity: () => void;

  setActiveIconDrops: (ids: IconShapeId[]) => void;
  toggleIconDrop: (id: IconShapeId) => void;
  setIconDropConfig: (patch: Partial<FallingIconsConfig>) => void;

  setAudioSource: (source: AudioSource | null) => void;

  setExportState: (patch: Partial<ExportState>) => void;
}

function hexToTuple(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

export const useMuraStore = create<MuraState>((set, get) => ({
  waveformId: DEFAULT_WAVEFORM_ID,
  palette: PRESET_PALETTES[DEFAULT_PALETTE_NAME],
  reactivity: { ...DEFAULT_REACTIVITY },
  iconDropConfig: { ...DEFAULT_FALLING_ICONS_CONFIG, activeShapeIds: [...DEFAULT_ACTIVE_ICON_DROPS] },
  audioSource: null,
  exportState: { isExporting: false, progress: 0, stage: "" },

  setWaveformId: (id) => set({ waveformId: id }),
  randomizeWaveform: (allIds) => {
    const current = get().waveformId;
    const choices = allIds.filter((id) => id !== current);
    const pick = choices[Math.floor(Math.random() * choices.length)] ?? current;
    set({ waveformId: pick });
  },

  setPalette: (palette) => set({ palette }),
  applyPresetPalette: (name) => set({ palette: PRESET_PALETTES[name] ?? get().palette }),
  randomizePalette: () => set({ palette: randomPalette({ swatchCount: get().palette.colors.length || 5 }) }),
  setSwatchColor: (index, hex) =>
    set((s) => {
      const colors = [...s.palette.colors];
      colors[index] = hexToTuple(hex);
      return { palette: { ...s.palette, colors } };
    }),
  addSwatch: (hex) =>
    set((s) => ({ palette: { ...s.palette, colors: [...s.palette.colors, hexToTuple(hex)] } })),
  removeSwatch: (index) =>
    set((s) => {
      if (s.palette.colors.length <= 1) return s;
      const colors = s.palette.colors.filter((_, i) => i !== index);
      return { palette: { ...s.palette, colors } };
    }),
  setBackgroundColor: (hex) => set((s) => ({ palette: { ...s.palette, background: hexToTuple(hex) } })),
  setAccentColor: (hex) => set((s) => ({ palette: { ...s.palette, accent: hexToTuple(hex) } })),
  setGlowColor: (hex) => set((s) => ({ palette: { ...s.palette, glow: hexToTuple(hex) } })),

  setReactivity: (patch) => set((s) => ({ reactivity: { ...s.reactivity, ...patch } })),
  resetReactivity: () => set({ reactivity: { ...DEFAULT_REACTIVITY } }),

  setActiveIconDrops: (ids) => set((s) => ({ iconDropConfig: { ...s.iconDropConfig, activeShapeIds: ids } })),
  toggleIconDrop: (id) =>
    set((s) => {
      const active = s.iconDropConfig.activeShapeIds;
      const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
      return { iconDropConfig: { ...s.iconDropConfig, activeShapeIds: next } };
    }),
  setIconDropConfig: (patch) => set((s) => ({ iconDropConfig: { ...s.iconDropConfig, ...patch } })),

  setAudioSource: (source) => set({ audioSource: source }),

  setExportState: (patch) => set((s) => ({ exportState: { ...s.exportState, ...patch } })),
}));
