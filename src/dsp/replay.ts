// Degradation replay: precomputed life snapshots over the run-to-failure severity ramp. Each frame
// is one synthesized acquisition at an increasing fault severity; we keep its squared-envelope
// spectrum (clipped to the SES view range) so a life-position scrubber can show the defect comb
// emerge and grow. Deterministic (fixed per-frame seed), so replay is reproducible.
import { synth } from './signal';
import { envelopeSpectrum } from './envelope';
import { rms } from './health';
import { type FaultKind, type Bearing } from './bearing';

export interface LifeSnapshot { lifeFrac: number; sev: number; rms: number; sesData: [number[], number[]] }

export function buildLifeSnapshots(spec: {
  bearing: Bearing; fault: FaultKind; severityEnd: number; rpm: number; snrDb: number; sesXmax: number; n?: number; band?: [number, number];
}): LifeSnapshot[] {
  const fs = 12000, n = spec.n ?? 24;
  const band = spec.band ?? [2200, 4600];
  const sevEnd = spec.fault === 'healthy' ? 0 : Math.max(0.25, spec.severityEnd);
  const out: LifeSnapshot[] = [];
  for (let i = 0; i < n; i++) {
    const frac = i / (n - 1);
    const sev = Math.max(0, (frac - 6 / 26) / (1 - 6 / 26)) * sevEnd; // onset after ~23% of life
    const sig = synth({ fs, dur: 0.5, rpm: spec.rpm, bearing: spec.bearing, fault: spec.fault, severity: sev, resonance: 3400, zeta: 0.04, snrDb: spec.snrDb, seed: 300 + i });
    const ses = envelopeSpectrum(sig.x, fs, band);
    const xs: number[] = [], ys: number[] = [];
    for (let k = 0; k < ses.freq.length; k++) { if (ses.freq[k] > spec.sesXmax) break; xs.push(ses.freq[k]); ys.push(ses.mag[k]); }
    out.push({ lifeFrac: frac, sev, rms: rms(sig.x), sesData: [xs, ys] });
  }
  return out;
}

/** Linear interpolation of a health-indicator trend (sorted by t) at an arbitrary time. */
export function interpHI(points: { t: number; hi: number }[], t: number): number {
  if (!points.length) return 0;
  if (t <= points[0].t) return points[0].hi;
  if (t >= points[points.length - 1].t) return points[points.length - 1].hi;
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) { const a = points[i - 1], b = points[i]; const u = (t - a.t) / (b.t - a.t || 1); return a.hi + (b.hi - a.hi) * u; }
  }
  return points[points.length - 1].hi;
}
