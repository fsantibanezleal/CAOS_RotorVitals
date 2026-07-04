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

// The IESFOgram (Mauricio, Smith, Randall, Antoni & Gryllias 2020, MSSP 144:106891) scores each band not by a
// GENERAL impulsiveness/repetitiveness (kurtogram/infogram) but by how strongly its squared-envelope spectrum (SES)
// shows the harmonic comb of the TARGETED bearing-fault frequency (BPFO/BPFI/2·BSF). So it ignores impulsive content
// NOT at the fault period, a non-fault spike makes the kurtogram jump but leaves the targeted IESFOgram unmoved.
// HONEST substitutions (documented in Methodology): the paper optimises a targeted Improved-Envelope-Spectrum
// feature (a fault-harmonic-to-background ratio of the cyclic spectral COHERENCE integrated over each band of a
// filterbank tree); this build computes the analogous fault-comb prominence on the plain per-band SES (NOT the
// Fast-SC/CSCoh map), via a spike-robust median-normalised comb at comb granularity, over the pragmatic dyadic
// gramGrid paving rather than the paper's constant-relative-bandwidth filterbank.
export type GramMetric = 'kurt' | 'iE' | 'iSES' | 'iAVE' | 'iesfo' | 'iesfoBlind';
export interface GramCell {
  level: number; band: number; f1: number; f2: number;
  kurt: number; iE: number; iSES: number; iAVE: number;
  iesfo: number;            // targeted comb prominence at opts.targetAlpha (0 if no target)
  iesfoBlind: number;       // best comb prominence over the bounded shaft-order sweep (0 if blind off)
  iesfoBlindAlpha: number;  // winning fundamental α0* of the blind sweep (0 if blind off)
}
export interface GramGrid { cells: GramCell[][]; best: Record<GramMetric, GramCell> }
export interface GramOpts { targetAlpha?: number; fr?: number; nHarm?: number; blind?: boolean }

const METRICS: GramMetric[] = ['kurt', 'iE', 'iSES', 'iAVE', 'iesfo', 'iesfoBlind'];

/** Median-normalised harmonic-comb prominence of the SES power array p at fundamental f0. p[j] ↔ α=(j+1)·dAlpha
 * (DC dropped, matching sesPower). Mirrors diagnose.ts::lineProminence on p (no per-cell Spectrum allocation):
 * tol = max(2·dAlpha, 0.015·f0), W = max(12·dAlpha, 0.12·f0); peak/local-median averaged over K harmonics. */
function combProminence(p: Float64Array, dAlpha: number, f0: number, K = 5): number {
  if (f0 <= 0 || dAlpha <= 0) return 0;
  const M = p.length, aMax = M * dAlpha;
  const idx = (a: number) => Math.round(a / dAlpha) - 1;     // α → p index (inverse of (j+1)·dAlpha)
  const tol = Math.max(2 * dAlpha, 0.015 * f0);
  const W = Math.max(12 * dAlpha, 0.12 * f0);
  let total = 0, used = 0;
  for (let k = 1; k <= K; k++) {
    const fk = k * f0;
    if (fk + W > aMax) break;
    const cLo = Math.max(0, idx(fk - tol)), cHi = Math.min(M - 1, idx(fk + tol));
    let peak = 0; for (let i = cLo; i <= cHi; i++) if (p[i] > peak) peak = p[i];
    const bLo = Math.max(0, idx(fk - W)), bHi = Math.min(M - 1, idx(fk + W));
    const around: number[] = [];
    for (let i = bLo; i <= bHi; i++) if (i < cLo || i > cHi) around.push(p[i]);
    around.sort((a, b) => a - b);
    const med = around[around.length >> 1] || 1e-12;
    // p is the SES POWER; sqrt(peak/med) = peak_mag/median_mag → the per-harmonic comb prominence on the SES
    // AMPLITUDE scale, i.e. the same scale as the diagnosis line-prominence (~1 noise, ≫1 a clear comb). This is the
    // intended feature (amplitude SES is what a comb is read on); the sqrt is taken per harmonic before averaging.
    total += Math.sqrt(peak / med); used++;
  }
  return used ? total / used : 0;
}

/** Blind variant: the strongest self-consistent SES comb over a bounded shaft-order sweep, candidates
 * fr·{1.5 … 12 step 0.05} (excludes the shaft 1× and the cage <1.5×; bearing faults are non-integer shaft orders
 * well above 1×). Cheap (~210 candidates). Returns {value, alpha}. */
function blindProminence(p: Float64Array, dAlpha: number, fr: number, K = 5): { value: number; alpha: number } {
  if (fr <= 0) return { value: 0, alpha: 0 };
  let best = 0, bestA = 0;
  for (let o = 1.5; o <= 12 + 1e-9; o += 0.05) {
    const a0 = o * fr;
    const v = combProminence(p, dAlpha, a0, K);
    if (v > best) { best = v; bestA = a0; }
  }
  return { value: best, alpha: bestA };
}

/** One pass over the dyadic band grid (levels 1..maxLevel, 2^level bands each): per cell, band-pass → Hilbert
 * envelope → kurtosis + SE-negentropy (I_E) + SES-negentropy (I_SES) + average (I_AVE), plus (T10) the targeted
 * IESFO comb prominence at opts.targetAlpha and an optional blind shaft-order sweep. With opts={} the IESFO work
 * is two 0-assignments → the kurtogram/infogram path is unchanged. */
export function gramGrid(x: Float64Array, fs: number, maxLevel = 5, opts: GramOpts = {}): GramGrid {
  const nyq = fs / 2; const cells: GramCell[][] = [];
  const K = opts.nHarm ?? 5;
  const doBlind = !!(opts.blind && opts.fr);          // gate: no fr / blind=false ⇒ no sweep, cost unchanged
  const seed = (): GramCell => ({ level: 0, band: 0, f1: 0, f2: nyq,
    kurt: -Infinity, iE: -Infinity, iSES: -Infinity, iAVE: -Infinity, iesfo: -Infinity, iesfoBlind: -Infinity, iesfoBlindAlpha: 0 });
  const best: Record<GramMetric, GramCell> = {
    kurt: seed(), iE: seed(), iSES: seed(), iAVE: seed(), iesfo: seed(), iesfoBlind: seed() };
  for (let level = 1; level <= maxLevel; level++) {
    const nb = 2 ** level, bw = nyq / nb; const row: GramCell[] = [];
    for (let b = 0; b < nb; b++) {
      const f1 = b * bw, f2 = (b + 1) * bw, lo = Math.max(f1, 0.02 * fs);
      let cell: GramCell;
      if (lo >= f2) cell = { level, band: b, f1, f2, kurt: 0, iE: 0, iSES: 0, iAVE: 0, iesfo: 0, iesfoBlind: 0, iesfoBlindAlpha: 0 };
      else {
        const env = hilbertEnvelope(bandpass(x, fs, lo, f2));
        const se = new Float64Array(env.length); for (let i = 0; i < env.length; i++) se[i] = env[i] * env[i];
        const p = sesPower(se);                          // computed ONCE, shared by iSES + IESFO
        const dAlpha = fs / nextPow2(se.length);
        const iE = negentropy(se), iSES = negentropy(p);
        const iesfo = opts.targetAlpha ? combProminence(p, dAlpha, opts.targetAlpha, K) : 0;
        let iesfoBlind = 0, iesfoBlindAlpha = 0;
        if (doBlind) { const r = blindProminence(p, dAlpha, opts.fr!, K); iesfoBlind = r.value; iesfoBlindAlpha = r.alpha; }
        cell = { level, band: b, f1, f2, kurt: kurtosis(env), iE, iSES, iAVE: 0.5 * (iE + iSES), iesfo, iesfoBlind, iesfoBlindAlpha };
      }
      row.push(cell);
      for (const m of METRICS) if (cell[m] > best[m][m]) best[m] = cell;
    }
    cells.push(row);
  }
  return { cells, best };
}
