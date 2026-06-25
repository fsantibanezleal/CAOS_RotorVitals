import { type Spectrum } from '../dsp/envelope';
import { type DefectFreqs } from '../dsp/bearing';

interface Row { family: string; color: string; k: number; expected: number; found: number; errPct: number; amp: number; matched: boolean }

function nearestPeak(spec: Spectrum, target: number, tol: number): { f: number; amp: number } {
  const { freq, mag, df } = spec;
  const lo = Math.max(0, Math.floor((target - tol) / df));
  const hi = Math.min(mag.length - 1, Math.ceil((target + tol) / df));
  let bi = lo, bv = -1;
  for (let i = lo; i <= hi; i++) if (mag[i] > bv) { bv = mag[i]; bi = i; }
  return { f: freq[bi], amp: bv };
}

function floor(spec: Spectrum): number {
  const m = Float64Array.from(spec.mag).sort();
  return m[Math.floor(m.length / 2)] || 1e-9;
}

/** Matched defect-frequency peak registry: for each family (BPFO/BPFI/2·BSF/FTF) and harmonic, the
 * expected vs found peak, % error and amplitude, flagged matched when within tolerance and prominent. */
export function PeakTable({ ses, f, lang }: { ses: Spectrum; f: DefectFreqs; lang: 'en' | 'es' }) {
  const base = floor(ses);
  const fams: { name: string; color: string; freq: number }[] = [
    { name: 'BPFO', color: '#f59f00', freq: f.bpfo },
    { name: 'BPFI', color: '#f06595', freq: f.bpfi },
    { name: '2·BSF', color: '#7c5cff', freq: 2 * f.bsf },
    { name: 'FTF', color: '#3fb1c8', freq: f.ftf },
  ];
  const rows: Row[] = [];
  for (const fam of fams) {
    if (!(fam.freq > 0)) continue; // skip ≤0 AND NaN (unknown geometry, e.g. FEMTO/IMS) — NaN<=0 is false, would crash
    for (let k = 1; k <= 4; k++) {
      const expected = fam.freq * k;
      const tol = Math.max(2 * ses.df, 0.02 * fam.freq);
      const { f: found, amp } = nearestPeak(ses, expected, tol);
      const errPct = (Math.abs(found - expected) / expected) * 100;
      rows.push({ family: fam.name, color: fam.color, k, expected, found, errPct, amp, matched: errPct < 2.5 && amp > 4 * base });
    }
  }
  const L = lang === 'es'
    ? { t: 'Picos emparejados (SES)', fam: 'Familia', exp: 'Esperado', fnd: 'Hallado', err: 'err', amp: 'amp', m: '✓' }
    : { t: 'Matched peaks (SES)', fam: 'Family', exp: 'Expected', fnd: 'Found', err: 'err', amp: 'amp', m: '✓' };
  return (
    <div className="peaktable">
      <div className="rv-plot-t">{L.t}</div>
      <table className="cmp-table peaktable-t">
        <thead><tr><th style={{ textAlign: 'left' }}>{L.fam}</th><th>k</th><th>{L.exp}</th><th>{L.fnd}</th><th>{L.err}</th><th>{L.amp}</th><th>{L.m}</th></tr></thead>
        <tbody>
          {rows.filter((r) => r.k <= 3 || r.matched).map((r, i) => (
            <tr key={i} className={r.matched ? 'matched' : ''}>
              <td style={{ textAlign: 'left', color: r.color }}>{r.family}</td><td>{r.k}</td>
              <td className="mono">{r.expected.toFixed(1)}</td><td className="mono">{r.found.toFixed(1)}</td>
              <td className="mono">{r.errPct.toFixed(1)}%</td><td className="mono">{r.amp.toExponential(1)}</td>
              <td>{r.matched ? '✓' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
