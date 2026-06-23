// ISO broadband velocity-severity decision layer + shared per-life health features.
import { synth } from './signal';
import { magSpectrum, envelopeSpectrum } from './envelope';
import { rms } from './health';
import { kurtosis } from './kurtogram';
import { defectFreqs, faultFreq, type FaultKind, type Bearing } from './bearing';

const G0 = 9.80665; // m/s² per g

// ISO 10816-1 / ISO 2372 Class I (machines ≤ 15 kW) velocity-RMS zone boundaries (mm/s RMS).
// The CWRU-class rig behind the synthetic signal is ~1.5 kW (sub-15 kW), so Class I is the correct
// scale; ISO 20816-3 (Group 1/2) applies to the ≥15 kW mining machines the suite ultimately targets.
export const ISO_CLASS_I = { ab: 0.71, bc: 1.8, cd: 4.5 };

export interface IsoBounds { ab: number; bc: number; cd: number }
// Selectable severity scales (A/B, B/C-ALERT, C/D-DANGER velocity-RMS boundaries in mm/s). The A/B/C/D framework is
// identical across them; only the numeric limits move with machine class / power / mounting.
export const ISO_CLASSES: Record<string, { label: string; bounds: IsoBounds }> = {
  classI: { label: 'ISO 10816-1 Class I (≤15 kW)', bounds: { ab: 0.71, bc: 1.8, cd: 4.5 } },
  group2: { label: 'ISO 20816-3 Group 2 (15–300 kW, rigid)', bounds: { ab: 1.4, bc: 2.8, cd: 4.5 } },
  group1: { label: 'ISO 20816-3 Group 1 (>300 kW, rigid)', bounds: { ab: 2.3, bc: 4.5, cd: 7.1 } },
};

/** Broadband velocity RMS (mm/s) over [fLo,fHi] from an acceleration signal in g, by Parseval on the
 * single-sided amplitude spectrum: aₖ[m/s²] = magₖ[g]·g₀; vₖ = aₖ/(2πfₖ); RMS = √(½·Σ vₖ²). */
export function velocityRmsMmps(accel_g: Float64Array, fs: number, fLo = 10, fHi = 1000): number {
  const sp = magSpectrum(accel_g, fs);
  let s = 0;
  for (let i = 1; i < sp.freq.length; i++) {
    const f = sp.freq[i]; if (f < fLo || f > fHi) continue;
    const v = (sp.mag[i] * G0) / (2 * Math.PI * f); // peak velocity (m/s)
    s += 0.5 * v * v;                                // mean-square contribution of this bin
  }
  return Math.sqrt(s) * 1000; // m/s → mm/s
}

export interface LifeFeat { t: number; sev: number; vrms: number; rms: number; kurt: number; sesAmp: number }

/** One synth frame per life fraction over the run-to-failure severity ramp (same shape the 3D
 * waterfall uses): per-row broadband velocity RMS (the ISO screen) plus time/frequency health
 * features (RMS, envelope kurtosis, defect-line envelope amplitude) for the feature-space view. */
export function lifeFeatures(spec: {
  bearing: Bearing; fault: FaultKind; severityEnd: number; rpm: number; snrDb: number; lifeH: number; rows?: number; band?: [number, number];
}): LifeFeat[] {
  const fs = 12000, rows = spec.rows ?? 40;
  const band = spec.band ?? [2200, 4600];
  const fr = spec.rpm / 60;
  const fdef = faultFreq(defectFreqs(spec.bearing, fr), spec.fault);
  const sevEnd = spec.fault === 'healthy' ? 0 : Math.max(0.25, spec.severityEnd);
  // The synthetic acceleration units are arbitrary, and broadband velocity is dominated by the shaft
  // line, so calibrate the as-new (severity 0) reading to mid Zone A (≈0.45 mm/s). This is an
  // illustrative mapping onto the ISO scale (labeled in the UI); the trend SHAPE and zone behaviour
  // is the point — and it honestly shows how little a bearing fault moves the broadband velocity.
  const refSig = synth({ fs, dur: 0.5, rpm: spec.rpm, bearing: spec.bearing, fault: 'healthy', severity: 0, resonance: 3400, zeta: 0.04, snrDb: spec.snrDb, seed: 399 });
  const cal = 0.45 / Math.max(1e-9, velocityRmsMmps(refSig.x, fs));
  const out: LifeFeat[] = [];
  for (let r = 0; r < rows; r++) {
    const frac = r / (rows - 1);
    const sev = Math.max(0, (frac - 6 / 26) / (1 - 6 / 26)) * sevEnd; // onset after ~23% of life
    const sig = synth({ fs, dur: 0.5, rpm: spec.rpm, bearing: spec.bearing, fault: spec.fault, severity: sev, resonance: 3400, zeta: 0.04, snrDb: spec.snrDb, seed: 400 + r });
    let sesAmp = 0;
    if (fdef > 0) { const ses = envelopeSpectrum(sig.x, fs, band); const i = Math.min(ses.mag.length - 1, Math.round((fdef / (fs / 2)) * (ses.freq.length - 1))); sesAmp = ses.mag[i]; }
    out.push({ t: frac * spec.lifeH, sev, vrms: velocityRmsMmps(sig.x, fs) * cal, rms: rms(sig.x), kurt: kurtosis(sig.x), sesAmp });
  }
  return out;
}
