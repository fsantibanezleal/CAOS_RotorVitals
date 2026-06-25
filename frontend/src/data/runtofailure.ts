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

// ---- REAL run-to-failure: FEMTO/PRONOSTIA, XJTU-SY, IMS ------------------------------------------------------------
// Complete accelerated-life trajectories from three public benchmarks, each reduced offline to HI(t) = per-snapshot
// RMS of horizontal acceleration with a real first-passage trueFail at the dataset's g RMS alarm. Lets the RUL page run
// the SAME projectRUL on REAL bearing life, not only the synthetic trend. All three share one compact artifact shape
// (public/rv-{femto,xjtu,ims}-rtf.json, link-only redistribution); a missing file degrades to no trajectories.
export type RtfSet = 'femto' | 'xjtu' | 'ims';
export interface FemtoTraj {
  id: string; condition: string; rpm: number; loadN: number; lifeHours: number;
  threshold: number; trueFail: number | null; points: HIPoint[]; set?: RtfSet;
}
export const RTF_SETS: { set: RtfSet; file: string; label: string }[] = [
  { set: 'femto', file: 'rv-femto-rtf.json', label: 'FEMTO' },
  { set: 'xjtu', file: 'rv-xjtu-rtf.json', label: 'XJTU' },
  { set: 'ims', file: 'rv-ims-rtf.json', label: 'IMS' },
];
let _rtf: Promise<FemtoTraj[]> | null = null;
function loadOneRtf(file: string, set: RtfSet): Promise<FemtoTraj[]> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return fetch(`${base}${file}`)
    .then((r) => (r.ok ? r.json() : { trajectories: [] }))
    .then((d) => ((d.trajectories ?? []) as FemtoTraj[]).map((t) => ({ ...t, set })))
    .catch(() => []);
}
// Merge every dataset into one ordered list of REAL trajectories; the sidebar groups them by `set`.
export function loadRealRtf(): Promise<FemtoTraj[]> {
  return (_rtf ??= Promise.all(RTF_SETS.map((s) => loadOneRtf(s.file, s.set))).then((lists) => lists.flat()));
}
// Back-compat: FEMTO-only loader (kept for any caller that still wants a single set).
export function loadFemtoRtf(): Promise<FemtoTraj[]> { return loadOneRtf('rv-femto-rtf.json', 'femto'); }
export function femtoToRunToFailure(t: FemtoTraj): RunToFailure {
  const set = (t.set ?? 'femto').toUpperCase();
  return {
    id: `${t.set ?? 'femto'}-${t.id}`,
    label: `${set} real — ${t.id} (${t.condition}, ${t.rpm} rpm / ${t.loadN} N)`,
    points: t.points,
    threshold: t.threshold,
    trueFail: t.trueFail ?? Infinity,
  };
}
