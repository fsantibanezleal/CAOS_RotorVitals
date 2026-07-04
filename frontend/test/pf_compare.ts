import { readFileSync } from 'fs';
import { projectRUL } from '../src/dsp/health.js';
import { particleFilterRUL } from '../src/dsp/pf_rul.js';

const d = JSON.parse(readFileSync('public/rv-femto-rtf.json', 'utf8'));
const trajectories = d.trajectories || [];
console.log('TRAJECTORY          | CLASSIC onset  RUL     failT   | PF onset     RUL     failT   | trueFail');
console.log('-'.repeat(100));
for (const tr of trajectories) {
  if (tr.trueFail == null) continue;
  const pts = tr.points.map((p: any) => ({ t: p.t, hi: p.hi }));
  const c = projectRUL(pts, tr.threshold);
  const p = particleFilterRUL(pts, tr.threshold);
  const cRul = c.rul?.toFixed(1) ?? ', ';
  const pRul = p.rulMedian?.toFixed(1) ?? ', ';
  const cOnset = c.onset?.toFixed(1) ?? ', ';
  const pOnset = p.onset?.toFixed(1) ?? ', ';
  const cFail = c.failTime?.toFixed(1) ?? ', ';
  const pFail = p.failTimeMedian?.toFixed(1) ?? ', ';
  console.log(`${tr.id.padEnd(20)} | ${cOnset.padStart(6)} ${cRul.padStart(7)} ${cFail.padStart(8)} | ${pOnset.padStart(6)} ${pRul.padStart(7)} ${pFail.padStart(8)} | ${tr.trueFail.toFixed(1)}`);
}
