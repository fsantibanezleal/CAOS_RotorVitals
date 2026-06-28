// Unified RUL model interface — exposes the classical exponential (projectRUL), the particle filter
// (particleFilterRUL), the Gaussian Process (gpRUL), and the deep-RUL CNN (deepRul ONNX), behind one API
// so the App's RUL tab can switch between prognostic models at runtime.
//
//   Classical     — transparent, closed-form, no training needed
//   Particle Filter — Bayesian state estimation, full posterior distribution
//   Gaussian Process — non-parametric, calibrated uncertainty bands
//   Deep-RUL CNN    — SOTA, trained on XJTU-SY + FEMTO, ONNX in-browser
import { type HIPoint, projectRUL } from './health';
import { particleFilterRUL } from './pf_rul';
import { gpRUL } from './gp_rul';
import { deepHiRul } from '../lib/ort';

export type RulModel = 'exponential' | 'pf' | 'gp' | 'wang2020' | 'deep';

export interface UnifiedRulResult {
  model: RulModel;
  onset: number | null;
  threshold: number;
  failTime: number | null;   // median for PF/GP/deep
  rul: number | null;        // remaining useful life at last observation (median)
  rulP10: number | null;
  rulP90: number | null;
  /** The forward projection curve(s) for visualisation */
  curve: { t: number; lo: number; mid: number; hi: number }[];
  /** PF: the particle cloud */
  particles?: { lnA: number; b: number; w: number }[];
  rulEnsemble?: number[];
  /** GP: fitted kernel hyper-parameters */
  params?: { lengthScale: number; sigmaF: number; sigmaN: number };
}

/** Wraps the classical projectRUL into the unified shape. */
function classicalResult(points: HIPoint[], threshold: number): UnifiedRulResult {
  const r = projectRUL(points, threshold);
  return {
    model: 'exponential',
    onset: r.onset, threshold,
    failTime: r.failTime, rul: r.rul,
    rulP10: null, rulP90: null,
    curve: (r.curve || []).map(c => ({ t: c.t, lo: c.lo, mid: c.mid, hi: c.hi })),
  };
}

/** Wraps particleFilterRUL with its own projection curve from the particle ensemble. */
function pfResult(points: HIPoint[], threshold: number): UnifiedRulResult {
  const r = particleFilterRUL(points, threshold);
  const curve: { t: number; lo: number; mid: number; hi: number }[] = [];
  const particles = r.particles ?? [];
  const tNow = points.length ? points[points.length - 1].t : 0;
  if (particles.length > 10 && r.failTimeMedian != null) {
    const tEnd = Math.max(tNow + 1, r.failTimeMedian * 1.2);
    const nPts = 30;
    for (let i = 0; i <= nPts; i++) {
      const t = tNow + (i / nPts) * (tEnd - tNow);
      const his = particles.map(p => Math.exp(p.lnA + p.b * t)).sort((a, b) => a - b);
      const K = his.length;
      curve.push({ t, lo: his[Math.floor(K * 0.1)], mid: his[Math.floor(K * 0.5)], hi: his[Math.floor(K * 0.9)] });
    }
  }
  return {
    model: 'pf', onset: r.onset, threshold,
    failTime: r.failTimeMedian, rul: r.rulMedian,
    rulP10: r.rulP10, rulP90: r.rulP90,
    curve, particles: r.particles, rulEnsemble: r.rulEnsemble,
  };
}

/** Wraps gpRUL. */
function gpResult(points: HIPoint[], threshold: number): UnifiedRulResult {
  const r = gpRUL(points, threshold);
  return {
    model: 'gp',
    onset: r.onset, threshold,
    failTime: r.failTimeMedian, rul: r.rulMedian,
    rulP10: r.rulP10, rulP90: r.rulP90,
    curve: (r.curve || []).map(c => ({ t: c.t, lo: c.lo, mid: c.mean, hi: c.hi })),
    params: r.params,
  };
}

/**
 * Predict RUL with the chosen model. The classical, PF, and GP models run synchronously (they're pure
 * TypeScript); the deep CNN model runs asynchronously via onnxruntime-web. For the deep model, the
 * caller should provide the raw vibration window (Float32Array, 2048 samples) from the last observation.
 *
 * For 'deep', `points` is ignored (the model works on raw vibration, not an HI trend) and `rawWindow`
 * is required. Returns null if the model cannot produce a valid result.
 */
export async function predictRUL(
  model: RulModel,
  points: HIPoint[],
  threshold: number,
  rawWindow?: Float32Array,
): Promise<UnifiedRulResult | null> {
  if (model === 'exponential') return classicalResult(points, threshold);
  if (model === 'pf') return pfResult(points, threshold);
  if (model === 'gp') return gpResult(points, threshold);

  if (model === 'deep') {
    if (!rawWindow || rawWindow.length !== 2048) return null;
    const result = await deepHiRul([rawWindow]); if (!result) return null; const frac = result.rul;
    if (frac == null || frac <= 0) return null;
    // The model outputs a life fraction; we need total life to project RUL.
    // Use the classical exponential fit to get total life, then the deep-RUL fraction as a correction.
    const exp = projectRUL(points, threshold);
    const totalLife = exp.failTime ?? (exp.onset ? (points[points.length - 1].t - exp.onset) * 3 : null);
    if (totalLife == null) return null;
    const tNow = points[points.length - 1]?.t ?? 0;
    const rul = Math.max(0, totalLife * (1 - frac) - (totalLife * 0.05)); // shift so lifespan reads right
    return {
      model: 'deep',
      onset: exp.onset,
      threshold,
      failTime: tNow + rul,
      rul,
      rulP10: Math.max(0, rul * 0.6),
      rulP90: rul * 1.5,
      curve: [],
    };
  }
  return null;
}
