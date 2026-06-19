import { type SignalSpec } from '../dsp/signal';
import { bearingById } from './bearings';
import { type FaultKind } from '../dsp/bearing';

// Pre-defined demo scenarios. Parameters mirror the CWRU 12 kHz drive-end rig (≈1772 rpm at 1 hp,
// resonance band a few kHz). Deterministic seeds → reproducible "validation set"; the same engine
// that reads them is shown to recover the fault frequency that generated them (self-validating).
export interface Scenario {
  id: string;
  fault: FaultKind;
  spec: SignalSpec;
}

const base = (fault: FaultKind, severity: number, snrDb: number, seed: number): SignalSpec => ({
  fs: 12000,
  dur: 1,
  rpm: 1772,
  bearing: bearingById('skf6205'),
  fault,
  severity,
  resonance: 3400,
  zeta: 0.04,
  snrDb,
  seed,
});

export const SCENARIOS: Scenario[] = [
  { id: 'healthy', fault: 'healthy', spec: base('healthy', 0, 8, 101) },
  { id: 'outer', fault: 'outer', spec: base('outer', 1.0, 2, 202) },
  { id: 'inner', fault: 'inner', spec: base('inner', 0.9, 0, 303) },
  { id: 'ball', fault: 'ball', spec: base('ball', 0.8, -2, 404) },
];

// Default analysis band-pass around the excited resonance (Hz).
export const DEFAULT_BAND: [number, number] = [2200, 4600];
