// Explainable diagnosis. For each candidate fault we measure the *prominence* of its kinematic line
// and harmonics in the envelope spectrum, each harmonic peak relative to its local baseline (median of
// the surrounding bins), averaged over the first harmonics. The competing faults act as negative
// controls: a real fault stands far above the others; pure noise lifts all three about equally.
import { type Spectrum } from './envelope';
import { type DefectFreqs, type FaultKind } from './bearing';

export interface FaultScore {
  kind: FaultKind;
  freq: number;
  score: number; // average harmonic prominence (peak / local-median); ~1–3 for noise, ≫ for a line
}

export interface Diagnosis {
  scores: FaultScore[];
  top: FaultKind;
  confidence: number;
}

const ABS_GATE = 4.5; // top prominence must clear this to be a fault at all
const REL_GATE = 1.7; // and must beat the next-best fault (negative control) by this ratio

function lineProminence(spec: Spectrum, f0: number, nHarm = 5): number {
  if (f0 <= 0) return 0;
  const { freq, mag, df } = spec;
  const fmax = freq[freq.length - 1];
  const tol = Math.max(2 * df, 0.015 * f0);
  const W = Math.max(12 * df, 0.12 * f0); // local-baseline half-width
  let total = 0;
  let used = 0;
  for (let k = 1; k <= nHarm; k++) {
    const fk = k * f0;
    if (fk + W > fmax) break;
    const cLo = Math.max(0, Math.floor((fk - tol) / df));
    const cHi = Math.min(mag.length - 1, Math.ceil((fk + tol) / df));
    let peak = 0;
    for (let i = cLo; i <= cHi; i++) peak = Math.max(peak, mag[i]);
    const bLo = Math.max(0, Math.floor((fk - W) / df));
    const bHi = Math.min(mag.length - 1, Math.ceil((fk + W) / df));
    const around: number[] = [];
    for (let i = bLo; i <= bHi; i++) if (i < cLo || i > cHi) around.push(mag[i]);
    around.sort((a, b) => a - b);
    const med = around[Math.floor(around.length / 2)] || 1e-12;
    total += peak / med;
    used++;
  }
  return used ? total / used : 0;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function diagnose(env: Spectrum, f: DefectFreqs, nHarm = 5): Diagnosis {
  const scores: FaultScore[] = [
    { kind: 'outer', freq: f.bpfo },
    { kind: 'inner', freq: f.bpfi },
    { kind: 'ball', freq: 2 * f.bsf },
  ]
    .map((c) => ({ kind: c.kind as FaultKind, freq: c.freq, score: lineProminence(env, c.freq, nHarm) }))
    .sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1]?.score || 1e-9;
  const sep = clamp01(1 - second / top.score);
  const abs = clamp01((top.score - ABS_GATE) / ABS_GATE);
  const isHealthy = top.score < ABS_GATE || top.score / second < REL_GATE;

  return {
    scores,
    top: isHealthy ? 'healthy' : top.kind,
    confidence: isHealthy ? clamp01(1 - Math.max(sep, abs)) : clamp01(0.5 * sep + 0.5 * abs),
  };
}
