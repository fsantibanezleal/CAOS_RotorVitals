// Particle-filter RUL prognostics — proper Bayesian state estimation over the exponential
// degradation model HI(t) = a·exp(b·t). Unlike the classical OLS fit, the PF maintains a full
// posterior distribution over (ln a, b, σ_obs) that is updated sequentially as each new HI
// observation arrives. This buys:
//   - calibrated uncertainty that grows/shrinks with data density,
//   - robustness to noise (the filter tracks the state, not the raw HI),
//   - a genuine posterior RUL distribution from the particle ensemble.
//
// Algorithm: regularised auxiliary SIR with kernel-density jitter (Musso, Oudjane & Le Gland 2001)
// and a wide uninformed prior (NOT seeded from OLS — the filter must earn its estimate from data).
//
// References:
//   Arulampalam, Maskell, Gordon & Clapp (2002), IEEE TSP 50(2):174–188
//   Musso, Oudjane & Le Gland (2001), "Improving regularised particle filters", pp. 247–271
//   An, Kim & Choi (2013), RESS 120:50–62
//   Orchard & Vachtsevanos (2009), T I Measurement & Control 31(3-4):221–246
import { type HIPoint } from './health';

// ── types ───────────────────────────────────────────────────────────────────
export interface Particle { lnA: number; b: number; sigmaObs: number; w: number }
export interface PfRulResult {
  onset: number | null;
  rulMedian: number | null;
  rulP10: number | null;
  rulP90: number | null;
  failTimeMedian: number | null;
  particles: Particle[];
  rulEnsemble: number[];
  converged: boolean;
}

const N = 500;                 // particles
const MIN_POST_ONSET = 6;     // minimum post-onset observations needed
const ESS_THRESHOLD = 0.60;   // resample when ESS/N drops below this

// ── kernel-density regularisation (Musso et al. 2001) ──────────────────────
function kernelRegularise(p: Particle[]): void {
  const n = p.length;
  // Silverman bandwidth for each dimension (using weighted samples)
  const wSum = p.reduce((a, v) => a + v.w, 0) || 1;
  const mean = [0, 0, 0];
  for (const x of p) { mean[0] += x.lnA * x.w / wSum; mean[1] += x.b * x.w / wSum; mean[2] += x.sigmaObs * x.w / wSum; }
  let varL = 0, varB = 0, varS = 0;
  for (const x of p) {
    varL += x.w / wSum * (x.lnA - mean[0]) ** 2;
    varB += x.w / wSum * (x.b - mean[1]) ** 2;
    varS += x.w / wSum * (x.sigmaObs - mean[2]) ** 2;
  }
  // Silverman: h = 1.06 * σ * N^(-1/5), then shrink by 0.5 (regularisation, not full kernel)
  const hL = Math.sqrt(Math.max(1e-9, varL)) * 1.06 * Math.pow(n, -0.2) * 0.5;
  const hB = Math.sqrt(Math.max(1e-16, varB)) * 1.06 * Math.pow(n, -0.2) * 0.5;
  const hS = Math.sqrt(Math.max(1e-12, varS)) * 1.06 * Math.pow(n, -0.2) * 0.5;
  for (const x of p) {
    x.lnA += randn() * hL;
    x.b = Math.max(1e-12, x.b + randn() * hB);
    x.sigmaObs = Math.max(1e-6, x.sigmaObs + randn() * hS);
  }
}

// ── systematic resampling ───────────────────────────────────────────────────
function resample(p: Particle[]): void {
  const n = p.length;
  const ws = p.map(x => x.w);
  const sum = ws.reduce((a, v) => a + v, 0) || 1;
  for (let i = 0; i < n; i++) ws[i] /= sum;
  const invN = 1 / n;
  const u0 = Math.random() * invN;
  const out: Particle[] = new Array(n);
  let c = ws[0], j = 0;
  for (let i = 0; i < n; i++) {
    const u = u0 + i * invN;
    while (u > c && j < n - 1) { j++; c += ws[j]; }
    const src = p[j];
    out[i] = { lnA: src.lnA, b: src.b, sigmaObs: src.sigmaObs, w: invN };
  }
  p.length = 0; p.push(...out);
}

// ── Box-Muller ──────────────────────────────────────────────────────────────
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── log-likelihood ──────────────────────────────────────────────────────────
function loglik(obs: number, lnA: number, b: number, sigma: number, t: number): number {
  const pred = lnA + b * t;
  const err = Math.log(Math.max(1e-9, obs)) - pred;
  return -0.5 * (err / sigma) ** 2 - Math.log(sigma);
}

// ── onset detection (statistical, same as classical — robust to noise) ─────
function detectOnset(points: HIPoint[]): number | null {
  const n = points.length;
  if (n < 10) return null;
  const baseN = Math.max(5, Math.floor(n * 0.25));
  const base = points.slice(0, baseN);
  const mu0 = base.reduce((a, p) => a + p.hi, 0) / base.length;
  const sd0 = Math.sqrt(base.reduce((a, p) => a + (p.hi - mu0) ** 2, 0) / base.length) || 1e-9;
  // Adaptive threshold: 3.5σ instead of 4σ to handle real noisy data
  const thr = mu0 + 3.5 * sd0;
  for (let i = 1; i < n - 2; i++) {
    if (points[i].hi > thr && points[i + 1].hi > thr && points[i + 2].hi > thr) {
      return i;
    }
  }
  return null;
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export function particleFilterRUL(points: HIPoint[], threshold: number): PfRulResult {
  const n = points.length;
  const nope: PfRulResult = {
    onset: null, rulMedian: null, rulP10: null, rulP90: null,
    failTimeMedian: null, particles: [], rulEnsemble: [], converged: false,
  };
  if (n < 10) return nope;

  // 1. onset
  const onsetIdx = detectOnset(points);
  if (onsetIdx === null) return nope;

  // 2. post-onset data
  const post: { t: number; hi: number }[] = [];
  const tOnset = points[onsetIdx].t;
  for (const p of points) {
    if (p.t >= tOnset && p.hi > 0) post.push({ t: p.t, hi: p.hi });
  }
  if (post.length < MIN_POST_ONSET) return { ...nope, onset: tOnset };

  // 3. estimate signal amplitude from the FIRST post-onset points (closest to true lnA)
  const logHis = post.map(p => Math.log(Math.max(1e-9, p.hi)));
  const firstK = Math.min(4, post.length);
  const firstLnHi = logHis.slice(0, firstK).reduce((a, v) => a + v, 0) / firstK;

  // 4. initialise particles from a WIDE uninformed prior (NOT from OLS)
  //    lnA ~ N(baseline_lnHI, 2.0²)  — wide enough to cover the uncertainty
  //    b   ~ Gamma-like (LogNormal): median ~ 0.05/h, 95% CI [0.001, 0.5]
  //    σ   ~ LogNormal: median 0.15, wide
  const particles: Particle[] = [];
  for (let i = 0; i < N; i++) {
    const lnA = firstLnHi + randn() * 2.0;
    const b = Math.exp(Math.log(0.05) + randn() * 1.0);
    const sigmaObs = Math.exp(Math.log(0.15) + randn() * 0.6);
    particles.push({ lnA, b: Math.max(1e-12, b), sigmaObs: Math.max(1e-6, sigmaObs), w: 1 / N });
  }
  kernelRegularise(particles);

  // 5. sequential importance resampling — process ALL post-onset observations
  for (const obs of post) {
    const t = obs.t;
    // compute log-weights (in log space for stability, then exponentiate)
    const logWs: number[] = [];
    let maxLw = -Infinity;
    for (const part of particles) {
      const lw = loglik(obs.hi, part.lnA, part.b, part.sigmaObs, t);
      logWs.push(lw);
      if (lw > maxLw) maxLw = lw;
    }
    // exponentiate with offset for numerical stability
    let wSum = 0;
    for (let i = 0; i < N; i++) {
      particles[i].w = Math.exp(logWs[i] - maxLw);
      wSum += particles[i].w;
    }
    if (wSum < 1e-60) {
      // total collapse — reinitialise from prior
      for (let i = 0; i < N; i++) {
        particles[i].lnA = firstLnHi + randn() * 2.0;
        particles[i].b = Math.max(1e-12, Math.exp(Math.log(0.05) + randn() * 1.0));
        particles[i].sigmaObs = Math.max(1e-6, Math.exp(Math.log(0.15) + randn() * 0.6));
        particles[i].w = 1 / N;
      }
      kernelRegularise(particles);
      continue;
    }
    // normalise
    for (const part of particles) part.w /= wSum;
    // effective sample size
    const ess = 1 / particles.reduce((a, p) => a + p.w * p.w, 0);
    if (ess < N * ESS_THRESHOLD) {
      resample(particles);
      kernelRegularise(particles);
      for (const part of particles) part.w = 1 / N;
    }
  }

  // 6. RUL ensemble projection from the filtered posterior
  const tLast = post[post.length - 1].t;
  const rulEnsemble: number[] = [];
  for (const part of particles) {
    const ft = (Math.log(threshold) - part.lnA) / part.b;
    const rul = Math.max(0, ft - tLast);
    if (Number.isFinite(rul) && rul < 1e6) rulEnsemble.push(rul);
  }
  if (rulEnsemble.length < 50) return { ...nope, onset: tOnset };

  rulEnsemble.sort((a, b) => a - b);
  const K = rulEnsemble.length;
  const pct = (q: number) => rulEnsemble[Math.max(0, Math.min(K - 1, Math.floor(q * (K - 1))))] ?? null;

  // check convergence: if the posterior is still as wide as the prior, it hasn't converged
  const lnAs = particles.map(p => p.lnA);
  const lnASd = Math.sqrt(lnAs.reduce((a, v) => a + (v - lnAs.reduce((s, x) => s + x, 0) / N) ** 2, 0) / N);
  const converged = lnASd < 1.5; // prior has sd ~ 2.0

  return {
    onset: tOnset,
    rulMedian: pct(0.5),
    rulP10: pct(0.1),
    rulP90: pct(0.9),
    failTimeMedian: tLast + (pct(0.5) ?? 0),
    particles: particles.map(p => ({ lnA: p.lnA, b: p.b, sigmaObs: p.sigmaObs, w: p.w })),
    rulEnsemble,
    converged,
  };
}
