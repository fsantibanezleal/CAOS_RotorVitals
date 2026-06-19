// Rolling-element bearing kinematic defect frequencies (Hz), given the shaft
// rotational frequency fr (Hz). Standard formulas (e.g. Randall & Antoni 2011).

export interface Bearing {
  id: string;
  label: string;
  n: number; // number of rolling elements
  d: number; // rolling-element (ball) diameter
  D: number; // pitch diameter
  contactDeg: number; // contact angle (degrees)
}

export interface DefectFreqs {
  ftf: number; // fundamental train (cage) frequency
  bpfo: number; // ball-pass frequency, outer race
  bpfi: number; // ball-pass frequency, inner race
  bsf: number; // ball-spin frequency
}

export function defectFreqs(b: Bearing, fr: number): DefectFreqs {
  const r = (b.d / b.D) * Math.cos((b.contactDeg * Math.PI) / 180);
  return {
    ftf: 0.5 * fr * (1 - r),
    bpfo: 0.5 * b.n * fr * (1 - r),
    bpfi: 0.5 * b.n * fr * (1 + r),
    bsf: (b.D / (2 * b.d)) * fr * (1 - r * r),
  };
}

export type FaultKind = 'healthy' | 'outer' | 'inner' | 'ball';

/** The characteristic frequency a given fault excites in the envelope spectrum. */
export function faultFreq(f: DefectFreqs, kind: FaultKind): number {
  switch (kind) {
    case 'outer':
      return f.bpfo;
    case 'inner':
      return f.bpfi;
    case 'ball':
      return 2 * f.bsf; // a ball defect strikes both races → 2×BSF is the dominant line
    default:
      return 0;
  }
}
