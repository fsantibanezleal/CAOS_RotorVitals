import { mulberry32, gaussian } from '../lib/prng';
import { type HIPoint } from '../dsp/health';
import { type FaultKind } from '../dsp/bearing';

// Synthetic run-to-failure health-indicator trend (the shape real bearing run-to-failure HIs show:
// a steady healthy baseline, a degradation onset, then exponential growth to failure, with
// measurement noise). Used to demonstrate the RUL projection honestly — labeled synthetic.
//
// The trend REACTS to the planted scenario: higher severity → earlier onset and faster growth →
// shorter remaining useful life; a healthy bearing shows no onset (no projection). The bearing/fault
// only re-seed the measurement noise so each case looks distinct.
export interface RunToFailure {
  id: string;
  label: string;
  points: HIPoint[];
  threshold: number;
  trueFail: number;
}

export function runToFailure(opts?: { seed?: number; fault?: FaultKind; severity?: number; baseline?: number; threshold?: number }): RunToFailure {
  const seed = opts?.seed ?? 7;
  const fault = opts?.fault ?? 'outer';
  const severity = Math.max(0, Math.min(1.5, opts?.severity ?? 1));
  const threshold = opts?.threshold ?? 7.0; // g RMS alarm
  const baseline = opts?.baseline ?? 0.85; // healthy RMS (g)
  const rng = mulberry32(seed);

  // healthy: flat baseline, no degradation onset → projectRUL returns no projection
  if (fault === 'healthy' || severity <= 1e-3) {
    const nH = 60; const points: HIPoint[] = [];
    for (let h = 0; h <= nH; h++) points.push({ t: h, hi: Math.max(0.01, baseline + 0.05 * baseline * gaussian(rng)) });
    return { id: 'rtf-healthy', label: 'Healthy — no degradation onset', points, threshold, trueFail: Infinity };
  }

  // severity drives onset and post-onset life: more severe → earlier onset, faster to failure
  const onset = Math.round(Math.max(8, 50 - 26 * severity));
  const trueFail = onset + Math.max(6, Math.round(20 / Math.max(0.3, severity)));
  const nHours = Math.round(onset + 0.82 * (trueFail - onset)); // observe to ~82% of post-onset life → RUL stays positive
  const k = Math.log(threshold / baseline) / (trueFail - onset);
  const points: HIPoint[] = [];
  for (let h = 0; h <= nHours; h++) {
    let hi = baseline;
    if (h > onset) hi = baseline * Math.exp(k * (h - onset));
    hi += 0.05 * baseline * gaussian(rng) + (h > onset ? 0.04 * hi * gaussian(rng) : 0);
    points.push({ t: h, hi: Math.max(0.01, hi) });
  }
  return { id: `rtf-${fault}`, label: 'Run-to-failure (synthetic, XJTU-SY-like)', points, threshold, trueFail };
}
