import { readFileSync } from 'fs';
import { particleFilterRUL } from '../src/dsp/pf_rul.js';

const d = JSON.parse(readFileSync('public/rv-femto-rtf.json', 'utf8'));
const trajectories = d.trajectories || [];
for (const tr of trajectories) {
  if (tr.trueFail == null) continue;
  const pts = tr.points.map((p: any) => ({ t: p.t, hi: p.hi }));
  const r = particleFilterRUL(pts, tr.threshold);
  console.log(`${tr.id}: onset=${r.onset?.toFixed(1)} rul=${r.rulMedian?.toFixed(1)} failT=${r.failTimeMedian?.toFixed(1)} trueFail=${tr.trueFail?.toFixed(1)} particles=${r.particles?.length} ensemble=${r.rulEnsemble?.length}`);
}
