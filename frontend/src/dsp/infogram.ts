// The Infogram (Antoni 2016, MSSP 74:73–94, DOI 10.1016/j.ymssp.2015.04.034): a band-selection map
// like the kurtogram, but scored by the NEGENTROPY of the squared envelope (SE) and of the squared-
// envelope spectrum (SES) instead of kurtosis. Negentropy responds to REPETITIVE transients rather
// than to any single impulse, so it is robust where the kurtogram is fooled (a lone non-Gaussian
// spike, electrical noise). Computed over the same dyadic band grid as the kurtogram.
import { bandpass, hilbertEnvelope } from './envelope';
import { fft, nextPow2 } from './fft';
import { kurtosis } from './kurtogram';

/** Negentropy of a non-negative sequence: N(y) = ⟨(y/⟨y⟩)·ln(y/⟨y⟩)⟩. 0 for a flat sequence, large
 * for a peaky (impulsive/repetitive) one. */
export function negentropy(y: Float64Array | number[]): number {
  const n = y.length; if (!n) return 0;
  let mean = 0; for (let i = 0; i < n; i++) mean += y[i]; mean /= n;
  if (mean <= 0) return 0;
  let s = 0; for (let i = 0; i < n; i++) { const r = y[i] / mean; s += r * Math.log(r + 1e-12); }
  return Math.max(0, s / n);
}

/** Power of the squared-envelope spectrum: |DFT{SE − mean(SE)}|², single-sided, DC bin excluded. */
export function sesPower(se: Float64Array): Float64Array {
  const n = se.length, N = nextPow2(n);
  const re = new Float64Array(N), im = new Float64Array(N);
  let mean = 0; for (let i = 0; i < n; i++) mean += se[i]; mean /= n;
  for (let i = 0; i < n; i++) re[i] = se[i] - mean;
  fft(re, im);
  const half = N >> 1; const p = new Float64Array(Math.max(1, half - 1));
  for (let k = 1; k < half; k++) p[k - 1] = re[k] * re[k] + im[k] * im[k];
  return p;
}

export type GramMetric = 'kurt' | 'iE' | 'iSES' | 'iAVE';
export interface GramCell { level: number; band: number; f1: number; f2: number; kurt: number; iE: number; iSES: number; iAVE: number }
export interface GramGrid { cells: GramCell[][]; best: Record<GramMetric, GramCell> }

const METRICS: GramMetric[] = ['kurt', 'iE', 'iSES', 'iAVE'];

/** One pass over the dyadic band grid (levels 1..maxLevel, 2^level bands each): per cell, band-pass →
 * Hilbert envelope → kurtosis + SE-negentropy (I_E) + SES-negentropy (I_SES) + average (I_AVE). */
export function gramGrid(x: Float64Array, fs: number, maxLevel = 5): GramGrid {
  const nyq = fs / 2; const cells: GramCell[][] = [];
  const seed = (): GramCell => ({ level: 0, band: 0, f1: 0, f2: nyq, kurt: -Infinity, iE: -Infinity, iSES: -Infinity, iAVE: -Infinity });
  const best: Record<GramMetric, GramCell> = { kurt: seed(), iE: seed(), iSES: seed(), iAVE: seed() };
  for (let level = 1; level <= maxLevel; level++) {
    const nb = 2 ** level, bw = nyq / nb; const row: GramCell[] = [];
    for (let b = 0; b < nb; b++) {
      const f1 = b * bw, f2 = (b + 1) * bw, lo = Math.max(f1, 0.02 * fs);
      let cell: GramCell;
      if (lo >= f2) cell = { level, band: b, f1, f2, kurt: 0, iE: 0, iSES: 0, iAVE: 0 };
      else {
        const env = hilbertEnvelope(bandpass(x, fs, lo, f2));
        const se = new Float64Array(env.length); for (let i = 0; i < env.length; i++) se[i] = env[i] * env[i];
        const iE = negentropy(se), iSES = negentropy(sesPower(se));
        cell = { level, band: b, f1, f2, kurt: kurtosis(env), iE, iSES, iAVE: 0.5 * (iE + iSES) };
      }
      row.push(cell);
      for (const m of METRICS) if (cell[m] > best[m][m]) best[m] = cell;
    }
    cells.push(row);
  }
  return { cells, best };
}
