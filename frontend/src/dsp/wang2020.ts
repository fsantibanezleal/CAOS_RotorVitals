/** Wang et al. (2020), Adaptive RUL via exponential+linear model + Fréchet distance.
 *
 * Reference: Wang, B., Lei, Y., Li, N. & Li, N. (2020). A Hybrid Prognostics Approach for
 * Estimating Remaining Useful Life of Rolling Element Bearings. IEEE Trans. Reliability 69(1),
 * 401–412. DOI: 10.1109/TR.2018.2882682
 *
 * This module implements the online (browser) portion:
 *   1. Discrete Fréchet distance between the current partial trajectory and a pre-built
 *      reference library of full run-to-failure curves
 *   2. Best-match selection
 *   3. Adaptive RUL = t_fail(best_ref) − t_now, updated on each new observation
 */

import { type HIPoint } from './health';

// ── Discrete Fréchet distance ────────────────────────────────────────────────

/**
 * Discrete Fréchet distance between two 2-D curves.
 * Each curve is an array of [t_normalised, hi_normalised] pairs.
 * O(n*m) with memoisation.
 */
function discreteFrechet(P: number[][], Q: number[][]): number {
  const n = P.length, m = Q.length;
  if (n < 1 || m < 1) return Infinity;
  const ca = new Array(n);
  for (let i = 0; i < n; i++) { ca[i] = new Float64Array(m).fill(-1); }

  function d(i: number, j: number): number {
    const dt = P[i][0] - Q[j][0], dh = P[i][1] - Q[j][1];
    return Math.sqrt(dt * dt + dh * dh);
  }

  function c(i: number, j: number): number {
    if (ca[i][j] > -1) return ca[i][j];
    const dist = d(i, j);
    if (i === 0 && j === 0) {
      ca[i][j] = dist;
    } else if (i > 0 && j === 0) {
      ca[i][j] = Math.max(c(i - 1, 0), dist);
    } else if (i === 0 && j > 0) {
      ca[i][j] = Math.max(c(0, j - 1), dist);
    } else if (i > 0 && j > 0) {
      ca[i][j] = Math.max(
        Math.min(c(i - 1, j), c(i - 1, j - 1), c(i, j - 1)),
        dist,
      );
    } else {
      ca[i][j] = Infinity;
    }
    return ca[i][j];
  }

  return c(n - 1, m - 1);
}

// ── Reference library ────────────────────────────────────────────────────────

export interface Wang2020Ref {
  trajectory: number[][];  // normalised [[t, hi], ...] for Fréchet matching
  t_fail: number | null;   // failure time (raw hours)
  phi: number;
  beta: number;
  alpha_exp: number;
  t0: number;              // t[0] for time scaling
  t_scale: number;         // t[-1] - t[0] for time scaling
  t_max: number;           // raw t_max for denormalisation
  hi_max: number;          // raw hi_max for denormalisation
}

export interface Wang2020Result {
  onset: number | null;
  threshold: number;
  failTime: number | null;
  rul: number | null;
  curve: { t: number; lo: number; mid: number; hi: number }[];
  bestRef: Wang2020Ref | null;
  frechetDist: number;
}

// ── Exponential + linear model ───────────────────────────────────────────────

/**
 * Evaluate h(t) = φ + β·(t−t0) + α·exp((t−t0)/t_scale).
 */
function evalExpLinear(t: number, ref: Wang2020Ref): number {
  const tNorm = (t - ref.t0) / ref.t_scale;
  const expVal = tNorm < 700 ? Math.exp(tNorm) : Infinity;
  return ref.phi + ref.beta * (t - ref.t0) + ref.alpha_exp * expVal;
}

// ── Onset detection (same as projectRUL) ─────────────────────────────────────

function detectOnset(points: HIPoint[]): number | null {
  const n = points.length;
  if (n < 8) return null;
  const nBase = Math.max(4, Math.floor(n * 0.3));
  const base = points.slice(0, nBase);
  const mean = base.reduce((a, p) => a + p.hi, 0) / base.length;
  const sd = Math.sqrt(base.reduce((a, p) => a + (p.hi - mean) ** 2, 0) / base.length) || 1e-9;
  for (let i = nBase; i < n - 1; i++) {
    if (points[i].hi > mean + 4 * sd && points[i + 1].hi > mean + 4 * sd) {
      return points[i].t;
    }
  }
  return null;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Wang et al. (2020) adaptive RUL estimation.
 *
 * Given a partial HI trajectory and a pre-built reference library of full
 * run-to-failure curves, finds the best-matching reference via discrete Fréchet
 * distance and estimates RUL from its failure time.
 */
export function wang2020RUL(
  points: HIPoint[],
  threshold: number,
  refs: Wang2020Ref[],
): Wang2020Result {
  const empty: Wang2020Result = {
    onset: null, threshold, failTime: null, rul: null, curve: [],
    bestRef: null, frechetDist: Infinity,
  };

  if (!refs || refs.length === 0 || points.length < 4) return empty;

  const onset = detectOnset(points);
  if (onset === null) return { ...empty, onset: null };

  // Normalise the partial trajectory
  const postOnset = points.filter(p => p.t >= onset);
  if (postOnset.length < 3) return { ...empty, onset };

  const tVals = postOnset.map(p => p.t);
  const hiVals = postOnset.map(p => p.hi);
  const t0 = tVals[0];
  const tLast = tVals[tVals.length - 1];
  const tSpan = Math.max(1, tLast - t0);
  const hiMax = Math.max(...hiVals) || 1e-9;

  const P: number[][] = tVals.map((t, i) => [(t - t0) / tSpan, hiVals[i] / hiMax]);

  // Match against reference library
  let bestRef: Wang2020Ref | null = null;
  let bestDist = Infinity;
  for (const ref of refs) {
    const d = discreteFrechet(P, ref.trajectory);
    if (d < bestDist) { bestDist = d; bestRef = ref; }
  }

  if (!bestRef || bestRef.t_fail == null || !isFinite(bestRef.t_fail)) {
    return { ...empty, onset, frechetDist: bestDist, bestRef };
  }

  const tFail = bestRef.t_fail;
  const rul = Math.max(0, tFail - tLast);

  // Forward curve from tLast to tFail using the matched reference's model params
  const tEnd = Math.max(tFail * 1.15, tLast + 1);
  const steps = 40;
  const curve: Wang2020Result['curve'] = [];
  for (let i = 0; i <= steps; i++) {
    const t = tLast + ((tEnd - tLast) * i) / steps;
    const mid = evalExpLinear(t, bestRef);
    curve.push({ t, lo: mid, mid, hi: mid });
  }

  return { onset, threshold, failTime: tFail, rul, curve, bestRef, frechetDist: bestDist };
}
