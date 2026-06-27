// Particle-filter RUL prognostics — Bayesian state estimation over the exponential degradation model.
// Each particle carries a pair (ln a, b) of the log-linear HI growth HI(t)=a·exp(b·t). As new HI
// observations arrive, particles are reweighted by likelihood and resampled (systematic resampling).
// The projected RUL distribution is the ensemble of per-particle first-passage times to the threshold.
//
// References:
//   An, Kim & Choi (2013), "Practical options for selecting data-driven or physics-based prognostics
//     algorithms", Reliability Eng. & System Safety 120:50–62. DOI 10.1016/j.ress.2012.09.011
//   Orchard & Vachtsevanos (2009), "A particle-filtering approach for on-line fault diagnosis and
//     failure prognosis", Trans. Inst. Measurement and Control 31(3–4):221–246.
//   Arulampalam, Maskell, Gordon & Clapp (2002), "A tutorial on particle filters for online
//     nonlinear/non-Gaussian Bayesian tracking", IEEE Trans. Signal Processing 50(2):174–188.
import { type HIPoint } from './health';

export interface Particle { lnA: number; b: number; w: number } // log-weight of a (to keep w>0 by construction), then normalised
export interface PfRulResult {
  onset: number | null;
  failTimeMedian: number | null;
  rulMedian: number | null;
  rulP10: number | null;
  rulP90: number | null;
  particles: { lnA: number; b: number; w: number }[];   // final posterior
  rulEnsemble: number[];                                   // all projected RULs (for histogram/violin)
}

const N = 500;            // particle count
const RESIDUAL_SD = 0.2; // log-space observation std (tuned; could be adaptive)

/** Systematic resampling (O(N), low variance). Mutates particles in-place. */
function resample(particles: Particle[]): void {
  const ws = particles.map(p => p.w); const sum = ws.reduce((a, v) => a + v, 0) || 1;
  ws.forEach((_, i) => ws[i] /= sum);
  const invN = 1 / N;
  const u0 = Math.random() * invN;
  const out: Particle[] = [];
  let c = ws[0], j = 0;
  for (let i = 0; i < N; i++) {
    const u = u0 + i * invN;
    while (u > c && j < N - 1) { j++; c += ws[j]; }
    out.push({ lnA: particles[j].lnA, b: particles[j].b, w: invN });
  }
  particles.length = 0; particles.push(...out);
}

/** Jitter resampled particles by a small Gaussian (regularisation to avoid sample impoverishment). */
function jitter(p: Particle[]): void {
  const sLnA = 0.04, sB = 0.002;
  for (const x of p) {
    x.lnA += randn() * sLnA;
    x.b = Math.max(1e-9, x.b + randn() * sB);
  }
}

/** Box-Muller normal. */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function loglik(obs: number, lnA: number, b: number, t: number): number {
  const pred = lnA + b * t;
  const err = Math.log(Math.max(1e-9, obs)) - pred;
  return -0.5 * (err / RESIDUAL_SD) ** 2;
}

/**
 * Particle-filter RUL projection. Accepts a run-to-failure HI trend (same format as projectRUL),
 * runs a sequential-importance-resampling (SIR) filter over the post-onset points, and returns
 * the posterior RUL distribution.
 *
 * The state is (ln a, b) of the exponential model; particles are initialised from the OLS fit
 * (the classical model) with spread to cover parameter uncertainty. The ensemble of per-particle
 * first-passage times gives the full RUL distribution — median, 10th/90th percentiles, and
 * the raw particle cloud for visualisation.
 */
export function particleFilterRUL(points: HIPoint[], threshold: number): PfRulResult {
  const empty: PfRulResult = { onset: null, failTimeMedian: null, rulMedian: null, rulP10: null, rulP90: null, particles: [], rulEnsemble: [] };
  const n = points.length; if (n < 8) return empty;

  // 1. onset detection (same rule as the classical model)
  const base = points.slice(0, Math.max(4, Math.floor(n * 0.3)));
  const mean0 = base.reduce((a, p) => a + p.hi, 0) / base.length;
  const sd0 = Math.sqrt(base.reduce((a, p) => a + (p.hi - mean0) ** 2, 0) / base.length) || 1e-9;
  let onsetIdx = -1;
  for (let i = 1; i < n - 1; i++) {
    if (points[i].hi > mean0 + 4 * sd0 && points[i + 1].hi > mean0 + 4 * sd0) { onsetIdx = i; break; }
  }
  if (onsetIdx < 0) return { ...empty };

  // 2. OLS fit on post-onset for the seed
  const post = points.slice(onsetIdx).filter(p => p.hi > 0);
  if (post.length < 4) return { onset: points[onsetIdx].t, failTimeMedian: null, rulMedian: null, rulP10: null, rulP90: null, particles: [], rulEnsemble: [] };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of post) { const y = Math.log(p.hi); sx += p.t; sy += y; sxx += p.t * p.t; sxy += p.t * y; }
  const m = post.length, bOls = (m * sxy - sx * sy) / (m * sxx - sx * sx), lnAOls = (sy - bOls * sx) / m;
  if (bOls <= 0) return { onset: points[onsetIdx].t, failTimeMedian: null, rulMedian: null, rulP10: null, rulP90: null, particles: [], rulEnsemble: [] };

  // 3. initialise particles around the OLS estimate
  const particles: Particle[] = [];
  for (let i = 0; i < N; i++) {
    particles.push({ lnA: lnAOls + randn() * 0.5, b: Math.max(1e-9, bOls + randn() * 0.03), w: 1 / N });
  }
  jitter(particles);

  // 4. sequential importance resampling over the post-onset observations
  for (const p of post) {
    const t = p.t;
    // update weights by likelihood
    let wSum = 0;
    for (const part of particles) {
      part.w = Math.exp(loglik(p.hi, part.lnA, part.b, t));
      wSum += part.w;
    }
    // normalise + resample when effective sample size drops
    if (wSum < 1e-30) { for (const part of particles) part.w = 1 / N; }
    else { for (const part of particles) part.w /= wSum; }
    const ess = 1 / particles.reduce((a, p) => a + p.w * p.w, 0);
    if (ess < N * 0.5) { resample(particles); jitter(particles); }
  }

  // 5. project RUL ensemble
  const tLast = points[n - 1].t;
  const rulEnsemble: number[] = [];
  for (const part of particles) {
    const ft = (Math.log(threshold) - part.lnA) / part.b;
    const rul = Math.max(0, ft - tLast);
    if (Number.isFinite(rul)) rulEnsemble.push(rul);
  }
  rulEnsemble.sort((a, b) => a - b);
  const K = rulEnsemble.length || 1;
  const pct = (q: number) => rulEnsemble[Math.max(0, Math.min(K - 1, Math.floor(q * (K - 1))))] ?? null;

  return {
    onset: points[onsetIdx].t,
    failTimeMedian: tLast + (pct(0.5) ?? 0),
    rulMedian: pct(0.5),
    rulP10: pct(0.1),
    rulP90: pct(0.9),
    particles: particles.map(p => ({ lnA: p.lnA, b: p.b, w: p.w })),
    rulEnsemble,
  };
}
