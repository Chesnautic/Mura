/**
 * Minimal iterative radix-2 Cooley-Tukey FFT, pure JS, no dependencies.
 * Input length must be a power of two -- callers zero-pad or window to fit.
 * This is intentionally small: Kami's desktop version could lean on
 * numpy/scipy, but a phone-side visualizer only needs a few hundred bins at
 * most per analysis window, so a compact hand-rolled FFT keeps Mura
 * dependency-free for its core DSP.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n !== imag.length) throw new Error("fft: real/imag length mismatch");
  if (n & (n - 1)) throw new Error("fft: length must be a power of two");

  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curWr = 1;
      let curWi = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = real[i + k];
        const uIm = imag[i + k];
        const vRe = real[i + k + len / 2] * curWr - imag[i + k + len / 2] * curWi;
        const vIm = real[i + k + len / 2] * curWi + imag[i + k + len / 2] * curWr;
        real[i + k] = uRe + vRe;
        imag[i + k] = uIm + vIm;
        real[i + k + len / 2] = uRe - vRe;
        imag[i + k + len / 2] = uIm - vIm;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr;
        curWi = nextWi;
      }
    }
  }
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Hann window, applied in-place, reduces spectral leakage. */
export function applyHannWindow(samples: Float32Array): void {
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    samples[i] *= 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
}
