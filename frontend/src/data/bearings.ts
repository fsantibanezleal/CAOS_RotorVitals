import { type Bearing } from '../dsp/bearing';

// Geometries from public catalog data. The 6205/6203 match the Case Western Reserve University
// (CWRU) Bearing Data Center test rig — the canonical open benchmark this app is calibrated to read.
// (Ball/pitch diameters in inches; the d/D ratio is dimensionless so units cancel.)
export const BEARINGS: Bearing[] = [
  { id: 'skf6205', label: 'SKF 6205-2RS JEM (CWRU drive end)', n: 9, d: 0.3126, D: 1.537, contactDeg: 0 },
  { id: 'skf6203', label: 'SKF 6203-2RS JEM (CWRU fan end)', n: 9, d: 0.2656, D: 1.122, contactDeg: 0 },
  { id: 'generic', label: 'Generic deep-groove (n=8)', n: 8, d: 0.3, D: 1.5, contactDeg: 0 },
];

export const bearingById = (id: string): Bearing => BEARINGS.find((b) => b.id === id) ?? BEARINGS[0];
