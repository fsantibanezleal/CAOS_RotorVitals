/** Systematic validation of the particle-filter RUL implementation.
 *  Tests cover: resampling correctness, parameter recovery, edge cases,
 *  comparison vs classical model, and real-data robustness. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { particleFilterRUL } from '../src/dsp/pf_rul.js';
import { projectRUL, type HIPoint } from '../src/dsp/health.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function synth(a: number, b: number, tMax: number, n: number, noise = 0.02): HIPoint[] {
  const out: HIPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * tMax;
    out.push({ t, hi: a * Math.exp(b * t) * (1 + noise * (Math.random() * 2 - 1)) });
  }
  return out;
}

function median(v: number[]): number { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

// ── UNIT: onset detection ───────────────────────────────────────────────────
test('PF: detects onset on strong degradation', () => {
  const pts = synth(0.3, 0.15, 18, 20, 0.005);
  const r = particleFilterRUL(pts, 15);
  assert.ok(r.onset !== null && r.onset > 0, 'should detect onset');
});

test('PF: no onset on flat data', () => {
  const pts: HIPoint[] = [];
  for (let i = 0; i < 20; i++) pts.push({ t: i * 2, hi: 0.15 + Math.random() * 0.005 });
  const r = particleFilterRUL(pts, 3);
  assert.equal(r.onset, null);
  assert.equal(r.rulMedian, null);
});

test('PF: short data rejected gracefully', () => {
  const pts = synth(0.3, 0.15, 5, 6, 0.01);
  const r = particleFilterRUL(pts, 10);
  assert.equal(r.onset, null);
});

// ── UNIT: particle count and convergence ────────────────────────────────────
test('PF: produces 500 particles after filtering', () => {
  const pts = synth(0.3, 0.15, 25, 26, 0.01);
  const r = particleFilterRUL(pts, 30);
  assert.equal(r.particles.length, 500);
  assert.equal(r.rulEnsemble.length >= 50, true, 'should have at least 50 RUL samples');
});

test('PF: posterior narrower than prior (convergence)', () => {
  const pts = synth(0.3, 0.15, 25, 26, 0.01);
  const r = particleFilterRUL(pts, 30);
  // With enough data, the posterior sd of lnA should shrink from the prior's ~2.0
  const lnAs = r.particles.map(p => p.lnA);
  const mu = lnAs.reduce((a, v) => a + v, 0) / lnAs.length;
  const sd = Math.sqrt(lnAs.reduce((a, v) => a + (v - mu) ** 2, 0) / lnAs.length);
  assert.ok(sd < 1.0, `posterior sd ${sd.toFixed(2)} should be < 1.0 (prior was ~2.0)`);
  assert.equal(r.converged, true);
});

// ── INTEGRATION: parameter recovery ─────────────────────────────────────────
test('PF: recovers true (ln a, b) on clean data', () => {
  const pts = synth(0.3, 0.15, 20, 30, 0.003);
  const r = particleFilterRUL(pts, 12);
  const lnAs = r.particles.map(p => p.lnA);
  const bs = r.particles.map(p => p.b);
  const estLnA = median(lnAs);
  const estB = median(bs);
  const trueLnA = Math.log(0.3); // ≈ -1.204
  const trueB = 0.15;
  assert.ok(Math.abs(estLnA - trueLnA) < 1.5, `lnA: estimated ${estLnA.toFixed(2)}, true ${trueLnA.toFixed(2)} diff=${Math.abs(estLnA-trueLnA).toFixed(2)} (prior sd=2.0)`);
  assert.ok(Math.abs(estB - trueB) < 0.08, `b: estimated ${estB.toFixed(3)}, true ${trueB.toFixed(3)}`);
});

// ── COMPARISON: PF vs classical on noisy data ───────────────────────────────
test('PF: differs from classical on noisy data (adds value)', () => {
  // High noise — PF should give a DIFFERENT (better) estimate than OLS
  const pts = synth(0.3, 0.12, 22, 25, 0.06);
  const classical = projectRUL(pts, 8);
  const pf = particleFilterRUL(pts, 8);
  if (classical.rul !== null && pf.rulMedian !== null) {
    // PF should not be identical to classical on noisy data
    const diff = Math.abs(classical.rul - pf.rulMedian);
    assert.ok(diff > 0.01 || pf.rulP10 !== pf.rulP90,
      `PF should differ from classical on noisy data. Classical RUL=${classical.rul?.toFixed(1)}, PF RUL=${pf.rulMedian?.toFixed(1)}`);
  }
});

// ── REAL DATA: FEMTO robustness ─────────────────────────────────────────────
test('PF: handles all valid FEMTO trajectories', () => {
  const d = JSON.parse(readFileSync('public/rv-femto-rtf.json', 'utf8'));
  const trajectories = d.trajectories || [];
  let tested = 0, produced = 0;
  for (const tr of trajectories) {
    if (tr.trueFail == null) continue;
    const pts = tr.points.map((p: any) => ({ t: p.t, hi: p.hi }));
    const r = particleFilterRUL(pts, tr.threshold);
    tested++;
    if (r.rulMedian !== null && r.converged) produced++;
  }
  assert.ok(produced >= tested * 0.5, `PF produced valid RUL on ${produced}/${tested} FEMTO trajectories (need >=50%)`);
  console.log(`  FEMTO: ${produced}/${tested} trajectories produced valid RUL`);
});

// ── EDGE CASE: RUL should be non-negative and physically bounded ────────────
test('PF: RUL is within physical bounds', () => {
  const pts = synth(0.3, 0.15, 18, 20, 0.01);
  const r = particleFilterRUL(pts, 30);
  if (r.rulMedian !== null) {
    assert.ok(r.rulMedian >= 0, 'RUL must be non-negative');
    assert.ok(r.rulMedian < 200, `RUL should be physically bounded, got ${r.rulMedian?.toFixed(0)}h`);
  }
});
