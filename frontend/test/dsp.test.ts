import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fft, nextPow2 } from '../src/dsp/fft.ts';
import { defectFreqs } from '../src/dsp/bearing.ts';
import { magSpectrum, envelopeSpectrum } from '../src/dsp/envelope.ts';
import { synth } from '../src/dsp/signal.ts';
import { diagnose } from '../src/dsp/diagnose.ts';
import { bearingById } from '../src/data/bearings.ts';

test('FFT recovers a pure tone at the right bin', () => {
  const N = 1024;
  const fs = 1000;
  const f0 = 50;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = Math.sin((2 * Math.PI * f0 * i) / fs);
  fft(re, im);
  let peak = 0;
  let bin = 0;
  for (let i = 0; i < N / 2; i++) {
    const m = Math.hypot(re[i], im[i]);
    if (m > peak) {
      peak = m;
      bin = i;
    }
  }
  assert.equal(Math.round((bin * fs) / N), f0);
});

test('nextPow2', () => {
  assert.equal(nextPow2(1000), 1024);
  assert.equal(nextPow2(1024), 1024);
});

test('CWRU 6205 defect-frequency multipliers match published values', () => {
  const fr = 1772 / 60;
  const f = defectFreqs(bearingById('skf6205'), fr);
  // published CWRU multipliers (× fr): BPFO 3.5848, BPFI 5.4152, BSF 2.3568, FTF 0.3983
  assert.ok(Math.abs(f.bpfo / fr - 3.5848) < 2e-3);
  assert.ok(Math.abs(f.bpfi / fr - 5.4152) < 2e-3);
  assert.ok(Math.abs(f.bsf / fr - 2.3568) < 2e-3);
  assert.ok(Math.abs(f.ftf / fr - 0.3983) < 2e-3);
});

test('magSpectrum returns a peak at the dominant component', () => {
  const fs = 2000;
  const n = 2000;
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin((2 * Math.PI * 120 * i) / fs);
  const s = magSpectrum(x, fs);
  let peakF = 0;
  let peak = 0;
  for (let i = 0; i < s.mag.length; i++)
    if (s.mag[i] > peak) {
      peak = s.mag[i];
      peakF = s.freq[i];
    }
  assert.ok(Math.abs(peakF - 120) < 3);
});

for (const fault of ['outer', 'inner', 'ball'] as const) {
  test(`pipeline recovers a planted ${fault}-race fault`, () => {
    const bearing = bearingById('skf6205');
    const sig = synth({
      fs: 12000, dur: 1, rpm: 1772, bearing, fault, severity: 1.0,
      resonance: 3400, zeta: 0.04, snrDb: 2, seed: 7,
    });
    const env = envelopeSpectrum(sig.x, sig.fs, [2200, 4600]);
    const dx = diagnose(env, defectFreqs(bearing, 1772 / 60));
    assert.equal(dx.top, fault);
  });
}

test('a healthy signal is not called a fault', () => {
  const bearing = bearingById('skf6205');
  const sig = synth({
    fs: 12000, dur: 1, rpm: 1772, bearing, fault: 'healthy', severity: 0,
    resonance: 3400, zeta: 0.04, snrDb: 8, seed: 1,
  });
  const env = envelopeSpectrum(sig.x, sig.fs, [2200, 4600]);
  const dx = diagnose(env, defectFreqs(bearing, 1772 / 60));
  assert.equal(dx.top, 'healthy');
});

// ---- T5: the condition-based-maintenance decision engine ----
import { recommend, isoZoneOf } from '../src/dsp/recommend.ts';
import type { Diagnosis } from '../src/dsp/diagnose.ts';
import type { RulResult } from '../src/dsp/health.ts';

const noRul: RulResult = { onset: null, threshold: 1, failTime: null, rul: null, curve: [] };
const diag = (top: Diagnosis['top'], score: number, conf = 0.9): Diagnosis => ({
  top, confidence: conf,
  scores: [{ kind: top, freq: 100, score }, { kind: 'inner', freq: 90, score: 1.2 }, { kind: 'ball', freq: 80, score: 1.1 }],
});

test('ISO 20816 zone boundaries (Class I)', () => {
  assert.equal(isoZoneOf(0.5), 'A');
  assert.equal(isoZoneOf(1.0), 'B');
  assert.equal(isoZoneOf(3.0), 'C');
  assert.equal(isoZoneOf(6.0), 'D');
});

test('healthy + calm → OK, no fault', () => {
  const r = recommend({ diag: diag('healthy', 1.2), velocityRms: 0.4, rul: noRul, lifeH: 60, lang: 'en' });
  assert.equal(r.priority, 'ok');
  assert.equal(r.faultState, 'healthy');
  assert.equal(r.disagreement, false);
});

test('severe fault + Zone D + short RUL → TRIP', () => {
  const rul: RulResult = { ...noRul, failTime: 61, rul: 1 };   // 1 h of 60 → frac 0.017 → alarm
  const r = recommend({ diag: diag('outer', 11, 0.97), velocityRms: 6.0, rul, lifeH: 60, lang: 'en' });
  assert.equal(r.isoZone, 'D');
  assert.equal(r.faultState, 'severe');
  assert.equal(r.priority, 'trip');
});

test('developed fault but Zone A → PLAN + honest disagreement surfaced', () => {
  const r = recommend({ diag: diag('inner', 7, 0.9), velocityRms: 0.5, rul: noRul, lifeH: 60, lang: 'en' });
  assert.equal(r.isoZone, 'A');
  assert.equal(r.faultState, 'developed');
  assert.equal(r.priority, 'plan');       // driven by the envelope, not the calm broadband ISO
  assert.equal(r.disagreement, true);
  assert.ok(r.factors.find((f) => f.key === 'iso')?.note, 'the ISO factor must carry the disagreement note');
});

test('finite mid RUL escalates to PLAN even with a mild fault', () => {
  const rul: RulResult = { ...noRul, failTime: 70, rul: 6 };   // 6 h of 60 → frac 0.10 → plan
  const r = recommend({ diag: diag('outer', 4, 0.8), velocityRms: 0.5, rul, lifeH: 60, lang: 'en' });
  assert.equal(r.priority, 'plan');
  assert.equal(r.rulHours, 6);
});
