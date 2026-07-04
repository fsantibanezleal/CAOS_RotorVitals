// Prognostic-performance evaluation: the α-λ accuracy plot and the calibration/reliability diagram
// (Saxena, Celaya, Saha, Saha & Goebel, "Metrics for Offline Evaluation of Prognostic Performance",
// Int. J. Prognostics and Health Management, 2010). The α-λ plot asks: does the predicted RUL fall
// within an ±α cone of the true RUL as end-of-life approaches? The calibration diagram asks: does a
// nominal p% credible interval actually contain the true RUL p% of the time across many run-to-failure
// trajectories? A band that sits below the diagonal is over-confident (too tight), the honest test.
import { type HIPoint } from './health';
import { runToFailure } from '../data/runtofailure';
import { type FaultKind } from './bearing';

export interface DegFit { onset: number; onsetIdx: number; b: number; lnA: number; resSd: number; failTime: number }

/** Detect degradation onset (sustained 4σ excursion) and fit ln(HI)=lnA+b·t on the post-onset points. */
export function fitDegradation(points: HIPoint[], threshold: number): DegFit | null {
  const n = points.length; if (n < 6) return null;
  const base = points.slice(0, Math.max(4, Math.floor(n * 0.3)));
  const mean = base.reduce((a, p) => a + p.hi, 0) / base.length;
  const sd = Math.sqrt(base.reduce((a, p) => a + (p.hi - mean) ** 2, 0) / base.length) || 1e-9;
  let onsetIdx = -1;
  for (let i = 1; i < n - 1; i++) if (points[i].hi > mean + 4 * sd && points[i + 1].hi > mean + 4 * sd) { onsetIdx = i; break; }
  if (onsetIdx < 0) return null;
  const post = points.slice(onsetIdx).filter((p) => p.hi > 0);
  if (post.length < 3) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of post) { const y = Math.log(p.hi); sx += p.t; sy += y; sxx += p.t * p.t; sxy += p.t * y; }
  const m = post.length, b = (m * sxy - sx * sy) / (m * sxx - sx * sx), lnA = (sy - b * sx) / m;
  if (!(b > 0)) return null;
  let rss = 0; for (const p of post) rss += (Math.log(p.hi) - (lnA + b * p.t)) ** 2;
  const resSd = Math.sqrt(rss / Math.max(1, m - 2));
  return { onset: points[onsetIdx].t, onsetIdx, b, lnA, resSd, failTime: (Math.log(threshold) - lnA) / b };
}

export interface AlphaLambda { ts: number[]; predRUL: number[]; trueRUL: number[]; coneLo: number[]; coneHi: number[]; alpha: number; inCone: boolean[] }

/** Predicted RUL at successive update times (re-fit on data truncated to each "now") vs the true RUL,
 * with an ±α cone. As more degradation data arrives the prediction should converge into the cone. */
export function alphaLambda(rtf: { points: HIPoint[]; threshold: number; trueFail: number }, alpha = 0.2): AlphaLambda {
  const out: AlphaLambda = { ts: [], predRUL: [], trueRUL: [], coneLo: [], coneHi: [], alpha, inCone: [] };
  const { points, threshold, trueFail } = rtf;
  for (let i = 8; i < points.length; i++) {
    const t = points[i].t, tr = trueFail - t; if (tr <= 0) break;
    const fit = fitDegradation(points.slice(0, i + 1), threshold);
    const pr = fit && fit.failTime > t ? fit.failTime - t : 0;
    out.ts.push(t); out.trueRUL.push(tr); out.predRUL.push(pr);
    out.coneLo.push(tr * (1 - alpha)); out.coneHi.push(tr * (1 + alpha));
    out.inCone.push(pr >= tr * (1 - alpha) && pr <= tr * (1 + alpha));
  }
  return out;
}

const Z: Record<number, number> = { 0.5: 0.674, 0.8: 1.282, 0.9: 1.645, 0.95: 1.960 };
const LEVELS = [0.5, 0.8, 0.9, 0.95];

export interface Calibration { nominal: number[]; empirical: number[]; n: number }

/** Across an ensemble of synthetic run-to-failure trajectories (varied seeds), the fraction whose true
 * RUL falls inside the nominal p% credible interval of the log-linear forecast, the reliability curve. */
export function calibration(spec: { fault: FaultKind; severity: number }, K = 60): Calibration {
  const hit: Record<number, number> = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let valid = 0;
  for (let k = 0; k < K; k++) {
    const rtf = runToFailure({ seed: 1000 + k * 7, fault: spec.fault, severity: spec.severity });
    if (!isFinite(rtf.trueFail)) continue;
    const fit = fitDegradation(rtf.points, rtf.threshold); if (!fit) continue;
    const now = rtf.points[rtf.points.length - 1].t, trueRUL = rtf.trueFail - now; if (trueRUL <= 0) continue;
    valid++;
    const tmid = (Math.log(rtf.threshold) - fit.lnA) / fit.b;
    for (const l of LEVELS) {
      const half = (Z[l] * fit.resSd) / fit.b;
      const rlo = Math.max(0, tmid - half - now), rhi = tmid + half - now;
      if (trueRUL >= rlo && trueRUL <= rhi) hit[l]++;
    }
  }
  return { nominal: LEVELS, empirical: LEVELS.map((l) => (valid ? hit[l] / valid : 0)), n: valid };
}
