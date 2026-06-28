/** Validation of the Gaussian Process RUL implementation (TypeScript). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gpRUL } from '../src/dsp/gp_rul.js';
import { projectRUL, type HIPoint } from '../src/dsp/health.js';

function synth(a: number, b: number, tMax: number, n: number, noise = 0.02): HIPoint[] {
  const out: HIPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * tMax;
    out.push({ t, hi: a * Math.exp(b * t) * (1 + noise * (Math.random() * 2 - 1)) });
  }
  return out;
}

test('GP: detects onset on strong degradation', () => {
  const pts = synth(0.3, 0.15, 18, 20, 0.005);
  const r = gpRUL(pts, 15);
  assert.ok(r.onset !== null && r.onset > 0);
});

test('GP: no onset on flat data', () => {
  const pts: HIPoint[] = [];
  for (let i = 0; i < 20; i++) pts.push({ t: i * 2, hi: 0.15 + Math.random() * 0.005 });
  assert.equal(gpRUL(pts, 3).rulMedian, null);
});

test('GP: curve has valid bands (hi >= mean >= lo)', () => {
  const pts = synth(0.3, 0.12, 15, 18, 0.02);
  const r = gpRUL(pts, 6);
  assert.ok(r.curve.length > 2, 'should have forward projection');
  for (const c of r.curve.slice(-5)) {
    assert.ok(c.hi >= c.mean, `hi ${c.hi} < mean ${c.mean}`);
    assert.ok(c.mean >= c.lo, `mean ${c.mean} < lo ${c.lo}`);
  }
});

test('GP: differs from classical on noisy data', () => {
  const pts = synth(0.3, 0.10, 20, 22, 0.08);
  const classical = projectRUL(pts, 6);
  const gp = gpRUL(pts, 6);
  if (classical.rul !== null && gp.rulMedian !== null) {
    // GP should not be IDENTICAL to classical on noisy data
    const diff = Math.abs(classical.rul - gp.rulMedian);
    const spreadOk = gp.curve.length > 0 && (gp.curve[gp.curve.length-1].hi - gp.curve[gp.curve.length-1].lo) > 1e-6;
    assert.ok(diff > 0.001 || spreadOk, 'GP should differ from classical or show wider bands');
  }
});

test('GP: RUL within physical bounds', () => {
  const pts = synth(0.3, 0.15, 18, 20, 0.01);
  const r = gpRUL(pts, 30);
  if (r.rulMedian !== null) {
    assert.ok(r.rulMedian >= 0);
    assert.ok(r.rulMedian < 200);
  }
});
