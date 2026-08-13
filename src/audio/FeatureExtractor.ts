import { fft, nextPow2, applyHannWindow } from "./fft";
import type { AudioFeatures } from "./types";

export interface FeatureExtractorOptions {
  sampleRate: number;
  waveformLen?: number;
  spectrumLen?: number;
  /** FFT window size; auto-derived from the first chunk if omitted. */
  fftSize?: number;
}

/**
 * Stateful, streaming audio-feature extractor. Feed it successive mono PCM
 * chunks (Float32, -1..1) via `push()`; it returns one `AudioFeatures`
 * frame per call, smoothed against its own recent history so bars/rings/etc
 * don't flicker frame-to-frame.
 *
 * The same instance is used for both: (a) live playback, fed by
 * expo-audio's sample listener in real time, and (b) offline export
 * analysis, fed sequentially from a fully-decoded PCM buffer as fast as the
 * CPU can go. Because it's a pure function of "chunk in, features out" plus
 * its own rolling history, both call sites produce numerically consistent
 * results -- what you previewed is what gets exported.
 */
export class FeatureExtractor {
  private sampleRate: number;
  private waveformLen: number;
  private spectrumLen: number;
  private fftSize: number;

  private levelEnv = 0;
  private bassEnv = 0;
  private midEnv = 0;
  private trebleEnv = 0;
  private onsetEnv = 0;

  // Timestamped (not count-based) so the rolling window covers the same
  // real-time duration regardless of how often push() is called -- see the
  // comment above `smooth` for why that consistency matters.
  private recentLevels: { v: number; t: number }[] = [];
  private recentWindowSec = 1.0;
  private lastOnsetEnergy = 0;
  private dropCooldown = 0;
  private elapsed = 0;

  constructor(opts: FeatureExtractorOptions) {
    this.sampleRate = opts.sampleRate;
    this.waveformLen = opts.waveformLen ?? 128;
    this.spectrumLen = opts.spectrumLen ?? 32;
    this.fftSize = opts.fftSize ?? 1024;
  }

  reset(): void {
    this.levelEnv = this.bassEnv = this.midEnv = this.trebleEnv = this.onsetEnv = 0;
    this.recentLevels = [];
    this.lastOnsetEnergy = 0;
    this.dropCooldown = 0;
    this.elapsed = 0;
  }

  /** @param chunk mono PCM samples, -1..1. @param dt seconds this chunk spans. */
  push(chunk: Float32Array, dt: number): AudioFeatures {
    this.elapsed += dt;

    // --- loudness (RMS) ---
    let sumSq = 0;
    for (let i = 0; i < chunk.length; i++) sumSq += chunk[i] * chunk[i];
    const rms = Math.sqrt(sumSq / Math.max(1, chunk.length));
    const level = Math.min(2, rms * 3.2);

    // --- waveform (downsampled min/max envelope so transients survive) ---
    const waveform = downsampleMinMaxAlternating(chunk, this.waveformLen);

    // --- spectrum via FFT on a Hann-windowed, zero-padded copy ---
    const n = nextPow2(Math.min(this.fftSize, Math.max(64, chunk.length)));
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    const copyLen = Math.min(chunk.length, n);
    for (let i = 0; i < copyLen; i++) real[i] = chunk[i];
    applyHannWindow(real);
    fft(real, imag);

    const nyquist = this.sampleRate / 2;
    const usableBins = n / 2;
    const mags = new Float32Array(usableBins);
    for (let i = 0; i < usableBins; i++) {
      mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
    }

    const bandEnergy = (loHz: number, hiHz: number) => {
      const loBin = Math.max(0, Math.floor((loHz / nyquist) * usableBins));
      const hiBin = Math.min(usableBins - 1, Math.ceil((hiHz / nyquist) * usableBins));
      let sum = 0;
      let count = 0;
      for (let i = loBin; i <= hiBin; i++) {
        sum += mags[i];
        count++;
      }
      return count > 0 ? sum / count : 0;
    };

    // Clamped the same way `level` already is a few lines down -- unclamped,
    // a loud/bassy passage can push these arbitrarily high, which visuals
    // that multiply both a shape's position *and* its size by the raw value
    // (e.g. Orbit Dots) turn into dots the size of the whole canvas flung
    // off-screen -- reported as the preset "breaking."
    const bassRaw = Math.min(2, bandEnergy(20, 250) * 14);
    const midRaw = Math.min(2, bandEnergy(250, 4000) * 22);
    const trebleRaw = Math.min(2, bandEnergy(4000, Math.min(16000, nyquist)) * 34);

    const spectrum = binSpectrum(mags, this.spectrumLen);

    // --- envelope smoothing (fast attack, slower release) ---
    // Time-constant based (not a flat per-call coefficient) so the *real*
    // responsiveness stays the same no matter how often push() gets called.
    // This matters a lot here: the live desktop preview calls push() at
    // roughly the display's rAF rate (~60/s), while offline export analysis
    // (OfflineAnalyzer.ts) deliberately calls it once per exported video
    // frame (30/s, tied to the export fps) to keep renders deterministic. A
    // flat coefficient like `prev + (next-prev)*0.9` decays twice as fast in
    // real time at 60 calls/sec as it does at 30 -- so the exact same song
    // produced a snappier, evenly-spread onset envelope live and a
    // slower-decaying, plateau-ing one on export, which is what made icon
    // drops spawn in even trickles live but clumped "waves" in the exported
    // video (see buildFallingIconsScene's onset/isDrop-driven spawn bursts
    // in iconDrops/fallingIconsEngine.ts). Reconstructed from the original
    // flat coefficients at a 1/30s reference so exports render identically
    // to before; every other call rate now matches that same real-time feel.
    const smooth = (prev: number, next: number, attackTau: number, releaseTau: number) => {
      const tau = next > prev ? attackTau : releaseTau;
      const alpha = 1 - Math.exp(-dt / Math.max(1e-4, tau));
      return prev + (next - prev) * alpha;
    };

    this.levelEnv = smooth(this.levelEnv, level, 0.0277, 0.1159);
    this.bassEnv = smooth(this.bassEnv, bassRaw, 0.024, 0.1494);
    this.midEnv = smooth(this.midEnv, midRaw, 0.0277, 0.1159);
    this.trebleEnv = smooth(this.trebleEnv, trebleRaw, 0.0277, 0.0935);

    // --- onset/beat detection: energy rising sharply above its own recent average ---
    const energyNow = this.levelEnv + this.bassEnv * 0.6;
    const avgRecent =
      this.recentLevels.length > 0
        ? this.recentLevels.reduce((a, b) => a + b.v, 0) / this.recentLevels.length
        : energyNow;
    const rawOnset = Math.max(0, energyNow - avgRecent * 1.15 - 0.02) * 3.5;
    this.onsetEnv = smooth(this.onsetEnv, rawOnset, 0.0145, 0.0774);

    this.recentLevels.push({ v: energyNow, t: this.elapsed });
    while (this.recentLevels.length > 0 && this.elapsed - this.recentLevels[0].t > this.recentWindowSec) {
      this.recentLevels.shift();
    }

    // --- drop detection: a big jump over a longer rolling baseline, rate-limited ---
    let isDrop = false;
    this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    if (this.dropCooldown === 0 && energyNow > avgRecent * 1.6 + 0.05 && avgRecent > 0.02) {
      isDrop = true;
      this.dropCooldown = 0.8;
    }
    this.lastOnsetEnergy = energyNow;

    return {
      level: this.levelEnv,
      bass: this.bassEnv,
      mid: this.midEnv,
      treble: this.trebleEnv,
      onset: this.onsetEnv,
      isDrop,
      waveform,
      spectrum,
      t: this.elapsed,
    };
  }
}

function downsampleMinMaxAlternating(chunk: Float32Array, targetLen: number): number[] {
  if (chunk.length === 0) return new Array(targetLen).fill(0);
  if (chunk.length <= targetLen) {
    const out = new Array(targetLen).fill(0);
    for (let i = 0; i < chunk.length; i++) out[i] = chunk[i];
    return out;
  }
  const out: number[] = [];
  const bucket = chunk.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let v = chunk[start];
    if (i % 2 === 0) {
      let max = -Infinity;
      for (let j = start; j < end; j++) if (chunk[j] > max) max = chunk[j];
      v = max;
    } else {
      let min = Infinity;
      for (let j = start; j < end; j++) if (chunk[j] < min) min = chunk[j];
      v = min;
    }
    out.push(v);
  }
  return out;
}

function binSpectrum(mags: Float32Array, targetLen: number): number[] {
  // Log-ish spacing so low bins (which carry most musical energy) get more
  // representation than a linear split would give them.
  const out: number[] = [];
  const usable = mags.length;
  for (let i = 0; i < targetLen; i++) {
    const t0 = i / targetLen;
    const t1 = (i + 1) / targetLen;
    const lo = Math.floor(Math.pow(t0, 2) * usable);
    const hi = Math.max(lo + 1, Math.floor(Math.pow(t1, 2) * usable));
    let sum = 0;
    let count = 0;
    for (let b = lo; b < hi && b < usable; b++) {
      sum += mags[b];
      count++;
    }
    // Clamped for the same reason bass/mid/treble are above -- keeps
    // spectrum-driven presets (Orbit Dots, Radial Burst, Sunflower Radial,
    // Spiral Radial) from blowing up on loud peaks.
    out.push(count > 0 ? Math.min(1.6, (sum / count) * 30) : 0);
  }
  return out;
}
