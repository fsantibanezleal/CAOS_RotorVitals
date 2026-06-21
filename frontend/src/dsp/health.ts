// Health indicators + remaining-useful-life (RUL) projection. A health indicator (HI) trend is fit
// post-degradation-onset with an exponential model and projected to a failure threshold with a band
// (similarity/threshold-crossing prognostics; cf. Lei et al. 2018, IMS/XJTU-SY run-to-failure studies).

export function rms(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

export interface HIPoint {
  t: number; // operating time (h)
  hi: number; // health indicator (e.g. RMS or kurtosis)
}

export interface RulResult {
  onset: number | null; // operating time of detected degradation onset
  threshold: number;
  failTime: number | null; // projected time HI crosses threshold
  rul: number | null; // remaining useful life at the last observation
  curve: { t: number; lo: number; mid: number; hi: number }[]; // forward projection fan
}

/** Detect degradation onset (sustained excursion above baseline+kσ), fit ln(HI)=ln a + b·t on the
 * post-onset points, project to the threshold, and return a forward fan from the residual spread. */
export function projectRUL(points: HIPoint[], threshold: number): RulResult {
  const n = points.length;
  const empty: RulResult = { onset: null, threshold, failTime: null, rul: null, curve: [] };
  if (n < 8) return empty;
  const base = points.slice(0, Math.max(4, Math.floor(n * 0.3)));
  const mean = base.reduce((a, p) => a + p.hi, 0) / base.length;
  const sd = Math.sqrt(base.reduce((a, p) => a + (p.hi - mean) ** 2, 0) / base.length) || 1e-9;
  let onsetIdx = -1;
  for (let i = 1; i < n - 1; i++) {
    if (points[i].hi > mean + 4 * sd && points[i + 1].hi > mean + 4 * sd) { onsetIdx = i; break; }
  }
  if (onsetIdx < 0) return { ...empty };
  const post = points.slice(onsetIdx).filter((p) => p.hi > 0);
  if (post.length < 4) return { ...empty, onset: points[onsetIdx].t };
  // log-linear regression
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of post) { const y = Math.log(p.hi); sx += p.t; sy += y; sxx += p.t * p.t; sxy += p.t * y; }
  const m = post.length;
  const b = (m * sxy - sx * sy) / (m * sxx - sx * sx);
  const lnA = (sy - b * sx) / m;
  // residual std on log scale → band
  let rss = 0;
  for (const p of post) { const pred = lnA + b * p.t; rss += (Math.log(p.hi) - pred) ** 2; }
  const resSd = Math.sqrt(rss / Math.max(1, m - 2));
  if (b <= 0) return { ...empty, onset: points[onsetIdx].t };
  const failTime = (Math.log(threshold) - lnA) / b;
  const tLast = points[n - 1].t;
  const rul = failTime > tLast ? failTime - tLast : 0;
  // forward fan from tLast to ~failTime*1.15
  const curve: RulResult['curve'] = [];
  const tEnd = Math.max(failTime * 1.15, tLast + 1);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = tLast + ((tEnd - tLast) * i) / steps;
    const ln = lnA + b * t;
    curve.push({ t, mid: Math.exp(ln), lo: Math.exp(ln - 2 * resSd), hi: Math.exp(ln + 2 * resSd) });
  }
  return { onset: points[onsetIdx].t, threshold, failTime, rul, curve };
}
