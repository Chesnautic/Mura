/**
 * The per-frame audio feature vector every waveform engine and icon-drop
 * layer reads from. Analogous to the `feat` dict Kami's patterns.py
 * renderers all take as an argument -- one shared shape, computed once per
 * frame/window, consumed by every visual.
 */
export interface AudioFeatures {
  /** Overall loudness, smoothed, roughly 0..1 (can exceed 1 briefly on peaks). */
  level: number;
  /** Low-frequency band energy (~20-250Hz), 0..1+. */
  bass: number;
  /** Mid-frequency band energy (~250-4000Hz), 0..1+. */
  mid: number;
  /** High-frequency band energy (~4000-16000Hz), 0..1+. */
  treble: number;
  /** Transient/beat strength this frame, 0..1+, spikes on percussive hits. */
  onset: number;
  /** True for the few frames right after a big, sudden loudness jump (a "drop"). */
  isDrop: boolean;
  /** Raw-ish waveform samples for this window, resampled to a fixed length,
   * range roughly -1..1. Used by oscilloscope/line/ribbon engines that draw
   * the literal wave shape rather than just aggregate bands. */
  waveform: number[];
  /** Coarse frequency-bin magnitudes (fixed length), 0..1+, low->high.
   * Used by bar/radial/spectrum-style engines. */
  spectrum: number[];
  /** Seconds since analysis started (or since export render began). */
  t: number;
}

export function silentFeatures(waveformLen = 128, spectrumLen = 32, t = 0): AudioFeatures {
  return {
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    onset: 0,
    isDrop: false,
    waveform: new Array(waveformLen).fill(0),
    spectrum: new Array(spectrumLen).fill(0),
    t,
  };
}

/** Global reactivity knobs -- ported from Kami's controls.py. Every engine
 * and the icon-drop layer read gains/density/etc. through these rather than
 * exposing each internal parameter one-by-one, so a handful of sliders in
 * the app control the whole visual's intensity consistently. */
export interface ReactivityControls {
  chaos: number; // 0..1 overall intensity: shorter cycles, more particles, more glitch
  bassGain: number;
  midGain: number;
  trebleGain: number;
  onsetGain: number;
  glowStrength: number;
  particleDensity: number;
  switchSpeed: number;
  /**
   * 0..1. Almost every waveform engine drives its primary motion (line
   * amplitude, bar height, ring radius, etc.) off `features.level` --
   * overall loudness. At 0, `level` is untouched (the visual reacts evenly
   * to everything: vocals, hi-hats, bass, all blended together). Turning
   * this up blends `level` toward a bass+onset-driven "pulse" instead, so
   * the whole visual increasingly snaps to kicks/bass hits specifically
   * rather than smearing across the overall mix. This is the knob for
   * "make it lock onto the beat/bass" rather than "react to the song in
   * general."
   */
  beatFocus: number;
}

export const DEFAULT_REACTIVITY: ReactivityControls = {
  chaos: 0.65,
  bassGain: 1.0,
  midGain: 1.0,
  trebleGain: 1.0,
  onsetGain: 1.0,
  glowStrength: 1.0,
  particleDensity: 1.0,
  switchSpeed: 1.0,
  beatFocus: 0.35,
};

export function applyReactivity(f: AudioFeatures, c: ReactivityControls): AudioFeatures {
  const bass = f.bass * c.bassGain;
  const mid = f.mid * c.midGain;
  const treble = f.treble * c.trebleGain;
  const onset = f.onset * c.onsetGain;

  // The bass+onset "pulse": a signal that stays near zero between kicks and
  // spikes hard right on them, as opposed to `level`'s smoother overall-
  // loudness curve. Blending `level` toward this by `beatFocus` is what
  // makes the whole visual "single in" on the beat.
  const bassPulse = Math.min(2, bass * 0.8 + onset * 0.7);
  const focus = Math.max(0, Math.min(1, c.beatFocus));
  const level = f.level * (1 - focus) + bassPulse * focus;

  return { ...f, level, bass, mid, treble, onset };
}
