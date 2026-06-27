// Cross-validation harness: reads JSON test data from stdin, runs PF and GP, writes results to stdout.
import { particleFilterRUL } from '../src/dsp/pf_rul.js';
import { gpRUL } from '../src/dsp/gp_rul.js';
import { type HIPoint } from '../src/dsp/health.js';

const chunks: Buffer[] = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const d = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const pts: HIPoint[] = d.t.map((t: number, i: number) => ({ t, hi: d.hi[i] }));
  const pf = particleFilterRUL(pts, d.threshold);
  const gp = gpRUL(pts, d.threshold);
  process.stdout.write(JSON.stringify({
    pf_rul: pf.rulMedian, pf_p10: pf.rulP10, pf_p90: pf.rulP90,
    gp_rul: gp.rulMedian, gp_onset: gp.onset,
  }));
});
