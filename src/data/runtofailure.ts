import { mulberry32, gaussian } from '../lib/prng';
import { type HIPoint } from '../dsp/health';

// Synthetic run-to-failure health-indicator trend (the shape real bearing run-to-failure HIs show:
// a steady healthy baseline, a degradation onset, then exponential growth to failure, with
// measurement noise). Used to demonstrate the RUL projection honestly — labeled synthetic.
export interface RunToFailure {
  id: string;
  label: string;
  points: HIPoint[];
  threshold: number;
  trueFail: number;
}

export function runToFailure(opts?: { seed?: number; nHours?: number; onset?: number; threshold?: number }): RunToFailure {
  const seed = opts?.seed ?? 7;
  const nHours = opts?.nHours ?? 60;
  const onset = opts?.onset ?? 38;
  const threshold = opts?.threshold ?? 7.0; // g RMS alarm
  const rng = mulberry32(seed);
  const baseline = 0.85; // healthy RMS (g)
  const trueFail = 56;
  const points: HIPoint[] = [];
  for (let h = 0; h <= nHours; h++) {
    let hi = baseline;
    if (h > onset) {
      // exponential growth from onset toward failure
      const k = Math.log(threshold / baseline) / (trueFail - onset);
      hi = baseline * Math.exp(k * (h - onset));
    }
    hi += 0.05 * baseline * gaussian(rng) + (h > onset ? 0.04 * hi * gaussian(rng) : 0);
    points.push({ t: h, hi: Math.max(0.01, hi) });
  }
  return { id: 'rtf-xjtu-like', label: 'Run-to-failure (synthetic, XJTU-SY-like)', points, threshold, trueFail };
}
