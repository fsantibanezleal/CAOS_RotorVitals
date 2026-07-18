// Order map, a synthetic speed sweep (run-up) of the ENVELOPE spectrum. For each RPM we synthesize a
// stationary frame, band-pass around the structural resonance, take the Hilbert envelope, and its
// spectrum: the defect frequency (BPFO/BPFI/2·BSF) is a clean line there, and because it is fixed by
// kinematics it scales linearly with shaft speed, a ray in (rpm, Hz). Because we control every frame's
// speed exactly, order tracking is analytic: resampling each column onto order = f/(rpm/60) straightens
// the defect line to a constant order, separating speed-dependent fault lines from any fixed line.
// Labeled synthetic. (Raw-spectrum shaft orders / structural resonance are not shown here, the
// envelope band-pass removes them; this view is the bearing-defect order map.)
import { synth } from './signal';
import { envelopeSpectrum } from './envelope';
import { defectFreqs, type FaultKind, type Bearing } from './bearing';

export interface CampbellSpec {
  bearing: Bearing; fault: FaultKind; severity: number; snrDb: number; seed: number;
  rpmMin?: number; rpmMax?: number; rows?: number; fmaxHz?: number; cols?: number;
  ordMax?: number; band?: [number, number]; fs?: number; frameDur?: number;
}
export interface OrderMult { mult: number; color: string; label: string }
export interface CampbellMap {
  rpms: Float64Array;       // x axis (rpm)
  freqsHz: Float64Array;    // y axis (Hz), Hz mode
  colsHz: Float64Array[];   // colsHz[rpmIdx][hzIdx] dB
  orders: Float64Array;     // y axis (order ×), order mode
  colsOrd: Float64Array[];  // colsOrd[rpmIdx][ordIdx] dB
  fmaxHz: number; ordMax: number; rpmMin: number; rpmMax: number;
  orderMults: OrderMult[];  // defect fundamental + 2nd harmonic of the active fault
}

const C = { outer: '#f59f00', inner: '#f06595', ball: '#7c5cff' };

export function buildCampbell(spec: CampbellSpec): CampbellMap {
  const fs = spec.fs ?? 12000;
  const rpmMin = spec.rpmMin ?? 600, rpmMax = spec.rpmMax ?? 3600;
  const rows = spec.rows ?? 48, cols = spec.cols ?? 160;
  const fmaxHz = spec.fmaxHz ?? 600, ordMax = spec.ordMax ?? 10;
  const band = spec.band ?? [2200, 4600];
  const frameDur = spec.frameDur ?? 0.25;

  const rpms = new Float64Array(rows);
  for (let r = 0; r < rows; r++) rpms[r] = rpmMin + (rpmMax - rpmMin) * (r / (rows - 1));
  const freqsHz = new Float64Array(cols);
  for (let c = 0; c < cols; c++) freqsHz[c] = (c / (cols - 1)) * fmaxHz;
  const orders = new Float64Array(cols);
  for (let c = 0; c < cols; c++) orders[c] = (c / (cols - 1)) * ordMax;

  const colsHz: Float64Array[] = [];
  const colsOrd: Float64Array[] = [];
  for (let r = 0; r < rows; r++) {
    const sig = synth({ fs, dur: frameDur, rpm: rpms[r], bearing: spec.bearing, fault: spec.fault, severity: spec.fault === 'healthy' ? 0 : spec.severity, resonance: 3400, zeta: 0.04, snrDb: spec.snrDb, seed: spec.seed + r });
    const sp = envelopeSpectrum(sig.x, fs, band);
    const nf = sp.mag.length;
    const idx = (hz: number) => Math.min(nf - 1, Math.max(0, Math.round((hz / (fs / 2)) * (sp.freq.length - 1))));
    const colH = new Float64Array(cols);
    for (let c = 0; c < cols; c++) colH[c] = 20 * Math.log10(Math.max(sp.mag[idx(freqsHz[c])], 1e-12));
    colsHz.push(colH);
    const frHz = rpms[r] / 60;
    const colO = new Float64Array(cols);
    for (let c = 0; c < cols; c++) colO[c] = 20 * Math.log10(Math.max(sp.mag[idx(orders[c] * frHz)], 1e-12));
    colsOrd.push(colO);
  }

  // defect fundamental order (value at fr=1 Hz) + its 2nd harmonic, the lines that carry envelope energy
  const dm = defectFreqs(spec.bearing, 1);
  const orderMults: OrderMult[] = [];
  if (spec.fault === 'outer') { orderMults.push({ mult: dm.bpfo, color: C.outer, label: `BPFO ${dm.bpfo.toFixed(2)}X` }, { mult: 2 * dm.bpfo, color: C.outer, label: `2·BPFO` }); }
  else if (spec.fault === 'inner') { orderMults.push({ mult: dm.bpfi, color: C.inner, label: `BPFI ${dm.bpfi.toFixed(2)}X` }, { mult: 2 * dm.bpfi, color: C.inner, label: `2·BPFI` }); }
  else if (spec.fault === 'ball') { orderMults.push({ mult: 2 * dm.bsf, color: C.ball, label: `2·BSF ${(2 * dm.bsf).toFixed(2)}X` }, { mult: 4 * dm.bsf, color: C.ball, label: `4·BSF` }); }

  return { rpms, freqsHz, colsHz, orders, colsOrd, fmaxHz, ordMax, rpmMin, rpmMax, orderMults };
}
