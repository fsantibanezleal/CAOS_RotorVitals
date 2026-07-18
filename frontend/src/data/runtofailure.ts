import { mulberry32, gaussian } from '../lib/prng';
import { type HIPoint } from '../dsp/health';
import { type FaultKind } from '../dsp/bearing';

// Synthetic run-to-failure health-indicator trend (the shape real bearing run-to-failure HIs show:
// a steady healthy baseline, a degradation onset, then exponential growth to failure, with
// measurement noise). Used to demonstrate the RUL projection honestly, labeled synthetic.
//
// The trend reacts to the planted scenario: higher severity → earlier onset and faster growth →
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
    return { id: 'rtf-healthy', label: 'Healthy, no degradation onset', points, threshold, trueFail: Infinity };
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

// ---- real run-to-failure: FEMTO/PRONOSTIA, XJTU-SY, IMS ------------------------------------------------------------
// Complete accelerated-life trajectories from three public benchmarks, each reduced offline to HI(t) = per-snapshot
// RMS of horizontal acceleration with a real first-passage trueFail at the dataset's g RMS alarm. Lets the RUL page run
// the same projectRUL on real bearing life, not only the synthetic trend. All three share one compact artifact shape
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
// Merge every dataset into one ordered list of real trajectories; the sidebar groups them by `set`.
export function loadRealRtf(): Promise<FemtoTraj[]> {
  return (_rtf ??= Promise.all(RTF_SETS.map((s) => loadOneRtf(s.file, s.set))).then((lists) => lists.flat()));
}
// Back-compat: FEMTO-only loader (kept for any caller that still wants a single set).
export function loadFemtoRtf(): Promise<FemtoTraj[]> { return loadOneRtf('rv-femto-rtf.json', 'femto'); }

// ---- real raw life-snapshots (the run-to-failure frames) ----------------------------------------------------------
// Each selectable trajectory carries ~8 raw vibration windows sampled along its life (healthy → failure). These let
// the full signal suite + the real degradation waterfall + the feature-space trajectory run on measured data in the
// RUL mode, not only the HI curve. Artifacts: public/rv-{femto,xjtu,ims}-frames.json (link-only). Keyed by `set:id`
// to match the trajectory selector. XJTU carries real fault-frequency orders; FEMTO/IMS have no published geometry.
export interface LifeFrame { t: number; frac: number; rms: number; raw: number[] }
export interface FrameSet { fs: number; win: number; frames: LifeFrame[]; faultOrders?: { bpfo: number; bpfi: number; bsf: number; ftf: number } }
// XJTU-SY bearing LDK UER204 fault orders (× shaft rate); FEMTO/IMS publish no geometry → no order markers.
const XJTU_ORDERS = { bpfo: 3.072, bpfi: 4.928, bsf: 2.022, ftf: 0.384 };
let _frames: Promise<Record<string, FrameSet>> | null = null;
function loadOneFrames(file: string, set: RtfSet, orders?: FrameSet['faultOrders']): Promise<Record<string, FrameSet>> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return fetch(`${base}${file}`)
    .then((r) => (r.ok ? r.json() : { frames: {} }))
    .then((d) => {
      const fs = d.fs as number, win = (d.win as number) ?? 2048;
      const out: Record<string, FrameSet> = {};
      for (const [id, frames] of Object.entries((d.frames ?? {}) as Record<string, LifeFrame[]>)) out[`${set}:${id}`] = { fs, win, frames, faultOrders: orders };
      return out;
    })
    .catch(() => ({}));
}
// Merge every dataset's frames into one map keyed by `set:id` (the same key the trajectory selector uses).
export function loadRealFrames(): Promise<Record<string, FrameSet>> {
  return (_frames ??= Promise.all([
    loadOneFrames('rv-femto-frames.json', 'femto'),
    loadOneFrames('rv-xjtu-frames.json', 'xjtu', XJTU_ORDERS),
    loadOneFrames('rv-ims-frames.json', 'ims'),
  ]).then((maps) => Object.assign({}, ...maps)));
}
export function femtoToRunToFailure(t: FemtoTraj): RunToFailure {
  const set = (t.set ?? 'femto').toUpperCase();
  return {
    id: `${t.set ?? 'femto'}-${t.id}`,
    label: `${set} real, ${t.id} (${t.condition}, ${t.rpm} rpm / ${t.loadN} N)`,
    points: t.points,
    threshold: t.threshold,
    trueFail: t.trueFail ?? Infinity,
  };
}
