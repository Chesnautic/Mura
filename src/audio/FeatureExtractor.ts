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

  private recentLevels: number[] = [];
  private recentLevelsMax = 43; // ~1s of history at ~23fps analysis windows
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

    const bassRaw = bandEnergy(20, 250) * 14;
    const midRaw = bandEnergy(250, 4000) * 22;
    const trebleRaw = bandEnergy(4000, Math.min(16000, nyquist)) * 34;

    const spectrum = binSpectrum(mags, this.spectrumLen);

    // --- envelope smoothing (fast attack, slower release) ---
    const smooth = (prev: number, next: number, attack: number, release: number) =>
      next > prev ? prev + (next - prev) * attack : prev + (next - prev) * release;

    this.levelEnv = smooth(this.levelEnv, level, 0.7, 0.25);
    this.bassEnv = smooth(this.bassEnv, bassRaw, 0.75, 0.2);
    this.midEnv = smooth(this.midEnv, midRaw, 0.7, 0.25);
    this.trebleEnv = smooth(this.trebleEnv, trebleRaw, 0.7, 0.3);

    // --- onset/beat detection: energy rising sharply above its own recent average ---
    const energyNow = this.levelEnv + this.bassEnv * 0.6;
    const avgRecent =
      this.recentLevels.length > 0
        ? this.recentLevels.reduce((a, b) => a + b, 0) / this.recentLevels.length
        : energyNow;
    const rawOnset = Math.max(0, energyNow - avgRecent * 1.15 - 0.02) * 3.5;
    this.onsetEnv = smooth(this.onsetEnv, rawOnset, 0.9, 0.35);

    this.recentLevels.push(energyNow);
    if (this.recentLevels.length > this.recentLevelsMax) this.recentLevels.shift();

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
    out.push(count > 0 ? (sum / count) * 30 : 0);
  }
  return out;
}
