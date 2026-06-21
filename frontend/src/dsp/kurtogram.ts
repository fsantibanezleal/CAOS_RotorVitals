// Spectral kurtosis & a (pragmatic) fast kurtogram — the demodulation-band selector that solves
// envelope analysis's hardest problem: where to band-pass. (Antoni & Randall 2006; Antoni 2007.)
import { bandpass, hilbertEnvelope } from './envelope';

/** Excess kurtosis of an array (0 for Gaussian). Impulsive content → large positive kurtosis. */
export function kurtosis(x: Float64Array): number {
  const n = x.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += x[i];
  m /= n;
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i] - m;
    const d2 = d * d;
    m2 += d2;
    m4 += d2 * d2;
  }
  m2 /= n;
  m4 /= n;
  return m2 > 0 ? m4 / (m2 * m2) - 3 : 0;
}

export interface KurtogramCell {
  level: number;
  band: number; // band index within the level
  f1: number;
  f2: number;
  kurt: number;
}

export interface Kurtogram {
  levels: number; // number of decomposition levels (rows)
  cells: KurtogramCell[][]; // [level][band]
  best: KurtogramCell;
  maxKurt: number;
}

/** Pragmatic kurtogram: for each dyadic level k, split [0, fs/2] into 2^k bands; for each band,
 * band-pass → Hilbert envelope → excess kurtosis. The maximal-kurtosis band is the optimal
 * demodulation band that feeds the squared-envelope spectrum. */
export function kurtogram(x: Float64Array, fs: number, maxLevel = 5): Kurtogram {
  const nyq = fs / 2;
  const cells: KurtogramCell[][] = [];
  let best: KurtogramCell = { level: 0, band: 0, f1: 0, f2: nyq, kurt: -Infinity };
  for (let level = 1; level <= maxLevel; level++) {
    const nb = 2 ** level;
    const bw = nyq / nb;
    const row: KurtogramCell[] = [];
    for (let b = 0; b < nb; b++) {
      const f1 = b * bw;
      const f2 = (b + 1) * bw;
      // skip the lowest band (deterministic shaft content) and DC
      const lo = Math.max(f1, 0.02 * fs);
      if (lo >= f2) {
        row.push({ level, band: b, f1, f2, kurt: 0 });
        continue;
      }
      const bp = bandpass(x, fs, lo, f2);
      const env = hilbertEnvelope(bp);
      const k = kurtosis(env);
      const cell: KurtogramCell = { level, band: b, f1, f2, kurt: k };
      row.push(cell);
      if (k > best.kurt) best = cell;
    }
    cells.push(row);
  }
  return { levels: maxLevel, cells, best, maxKurt: best.kurt };
}

/** Spectral kurtosis SK(f) via STFT: excess kurtosis of |STFT| across time frames, per frequency bin.
 * A complementary view to the kurtogram — shows which frequencies carry the impulsive content. */
export function spectralKurtosis(x: Float64Array, fs: number, nperseg = 256): { freq: Float64Array; sk: Float64Array } {
  // lightweight magnitude STFT via the same FFT
  // (kept small/live: nperseg power of two, 50% overlap)
  const win = new Float64Array(nperseg);
  for (let i = 0; i < nperseg; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nperseg - 1));
  const hop = nperseg >> 1;
  const frames: Float64Array[] = [];
  // reuse a local real FFT through envelope's machinery would be heavy; do a direct DFT-by-FFT per frame
  // via dynamic import-free path: use a small FFT here.
  const re = new Float64Array(nperseg);
  const im = new Float64Array(nperseg);
  const half = nperseg >> 1;
  const mags: number[][] = Array.from({ length: half }, () => []);
  // simple radix-2 fft inline (nperseg is power of two)
  function fftLocal(r: Float64Array, m: Float64Array) {
    const n = r.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { const t = r[i]; r[i] = r[j]; r[j] = t; const u = m[i]; m[i] = m[j]; m[j] = u; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len >> 1; k++) {
          const a = i + k, bIdx = a + (len >> 1);
          const vr = r[bIdx] * cr - m[bIdx] * ci, vi = r[bIdx] * ci + m[bIdx] * cr;
          r[bIdx] = r[a] - vr; m[bIdx] = m[a] - vi; r[a] += vr; m[a] += vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  for (let start = 0; start + nperseg <= x.length; start += hop) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < nperseg; i++) re[i] = x[start + i] * win[i];
    fftLocal(re, im);
    for (let f = 0; f < half; f++) mags[f].push(Math.hypot(re[f], im[f]));
    frames.push(re.slice(0, half));
  }
  const freq = new Float64Array(half);
  const sk = new Float64Array(half);
  for (let f = 0; f < half; f++) {
    freq[f] = (f * fs) / nperseg;
    sk[f] = kurtosis(Float64Array.from(mags[f]));
  }
  return { freq, sk };
}
