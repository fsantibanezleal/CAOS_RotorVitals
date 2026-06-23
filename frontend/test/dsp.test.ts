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

// ---- T6: bring-your-own-data signal parsing ----
import { parseSignal } from '../src/dsp/parseSignal.ts';

test('parseSignal: single-column numbers', () => {
  const txt = Array.from({ length: 2100 }, (_, i) => String(Math.sin(i))).join('\n');
  const p = parseSignal(txt);
  assert.ok(p.ok);
  assert.equal(p.n, 2100);
});

test('parseSignal: time,accel CSV takes the last column + skips a header', () => {
  const lines = ['t,accel'];
  for (let i = 0; i < 2100; i++) lines.push(`${i / 12000},${Math.cos(i) * 2}`);
  const p = parseSignal(lines.join('\n'));
  assert.ok(p.ok);
  assert.equal(p.n, 2100);
  assert.equal(p.skipped, 1);             // the header row
  assert.ok(Math.abs(p.x![0] - Math.cos(0) * 2) < 1e-9);   // last column (accel), not the time column
});

test('parseSignal: too short is rejected', () => {
  const p = parseSignal('1\n2\n3');
  assert.equal(p.ok, false);
  assert.match(p.reason ?? '', /≥ 2048/);
});

test('parseSignal: flatline is rejected', () => {
  const p = parseSignal(Array.from({ length: 2100 }, () => '5').join('\n'));
  assert.equal(p.ok, false);
  assert.match(p.reason ?? '', /flat/);
});

// ---- T9: Fast Spectral Correlation (Fast-SC) + Carter-Knapp-Nuttall significance + EES ----
import { fastSpectralCoherence, cohThreshold, overlapCorrectedK } from '../src/dsp/csc.ts';

// a REALISTIC bearing-fault model: impacts at rate alpha0 (with small random jitter → cyclostationary) each
// ringing a damped broadband resonance — what the App's synth() produces, and what AR prewhitening preserves
// (unlike a pure-sine carrier, which is deterministic and correctly removed).
function bearingTestSig(alpha0: number, fc = 3400, zeta = 0.04, n = 12000, fs = 12000, noise = 0.08, seed = 7) {
  let s = seed >>> 0; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const x = new Float64Array(n);
  const period = fs / alpha0, wn = 2 * Math.PI * fc, wd = wn * Math.sqrt(1 - zeta * zeta);
  const ring = Math.min(n, Math.round(4 / (zeta * fc) * fs));
  for (let k = 0; k * period < n + period; k++) {
    const t0 = Math.round(k * period + rng() * 0.02 * period);   // <1% jitter → second-order cyclostationary
    const amp = 1 + 0.3 * rng();
    for (let i = Math.max(0, t0); i < Math.min(n, t0 + ring); i++) { const tt = (i - t0) / fs; x[i] += amp * Math.exp(-zeta * wn * tt) * Math.sin(wd * tt); }
  }
  for (let i = 0; i < n; i++) x[i] += noise * rng();
  return x;
}
function eesPeakHz(r: ReturnType<typeof fastSpectralCoherence>) { let best = -1, ba = 0; for (let a = 1; a < r.alpha.length; a++) { if (r.alpha[a] > 5 && r.ees[a] > best) { best = r.ees[a]; ba = r.alpha[a]; } } return ba; }

test('cohThreshold: exact Carter-Knapp-Nuttall null formula', () => {
  assert.ok(Math.abs(cohThreshold(110, 0.05) - (1 - Math.pow(0.05, 1 / 109))) < 1e-12);
  assert.ok(cohThreshold(110, 0.05) > 0 && cohThreshold(110, 0.05) < 0.1);   // ~0.027
});

test('overlapCorrectedK reduces the raw frame count (75% Hann overlap → K_eff < K)', () => {
  const N = 256, hop = 16;
  const w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const Keff = overlapCorrectedK(735, hop, N, w);
  assert.ok(Keff < 735 && Keff > 50, `K_eff=${Keff}`);   // overlap correction active
});

test('Fast-SC: planted bearing fault → EES peak at the cyclic (defect) frequency', () => {
  for (const a0 of [103.4, 139.2, 156.1]) {
    const r = fastSpectralCoherence(bearingTestSig(a0), 12000);
    const pk = eesPeakHz(r);
    assert.ok(Math.abs(pk - a0) < 5, `defect α=${a0} → EES peak ${pk.toFixed(1)} Hz`);
  }
});

test('Fast-SC: coherence is bounded [0,1], K_eff<K, α resolved finely', () => {
  const r = fastSpectralCoherence(bearingTestSig(103.4), 12000);
  let mx = 0; for (const c of r.cols) for (const v of c) if (v > mx) mx = v;
  assert.ok(mx <= 1.0001, `max |γ|=${mx}`);
  assert.ok(r.Keff < r.K && r.Keff >= 2);
  assert.ok(r.alpha[1] > 0 && r.alpha[1] < 2, `Δα=${r.alpha[1]}`);     // fine ~0.7 Hz
  assert.equal(r.cols[0].every((v) => v === 0), true);                  // α=0 zeroed (PSD, not CS)
});

test('Fast-SC: white-noise false-alarm rate is near the nominal p (overlap-corrected K_eff is sane)', () => {
  let s = 99 >>> 0; const n = 12000; const x = new Float64Array(n);
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = (s / 4294967296 - 0.5) * Math.sqrt(12); }
  const r = fastSpectralCoherence(x, 12000, 256, 16, 380, 0.05);
  let above = 0, tot = 0;
  for (let a = 1; a < r.alpha.length; a++) for (let f = 0; f < r.carriers.length; f++) { tot++; if (r.cols[a][f] ** 2 > r.gamma2Thr) above++; }
  const far = above / tot;
  assert.ok(far > 0.02 && far < 0.08, `white-noise FAR=${(100 * far).toFixed(1)}% (nominal 5%)`);  // calibrated ~4-5%
});

// ---- T10: IESFOgram (Mauricio 2020) targeted/blind band selector ----
import { gramGrid } from '../src/dsp/infogram.ts';

function sesAt(x: Float64Array, fs: number, f1: number, f2: number, fdef: ReturnType<typeof defectFreqs>) {
  const env = envelopeSpectrum(x, fs, [Math.max(f1, 0.02 * fs), f2]);
  return diagnose(env, fdef);    // reuse the diagnosis prominence on the band's SES
}
function spiked(x: Float64Array) {
  const y = Float64Array.from(x);
  let p = 0; for (let i = 0; i < y.length; i++) p += y[i] * y[i]; const rms = Math.sqrt(p / y.length) || 1;
  for (const fp of [0.13, 0.37, 0.61, 0.84]) y[Math.floor(fp * y.length)] += 8 * rms;
  return y;
}

test('IESFOgram targeted: selects a band whose SES shows the BPFO comb (outer fault)', () => {
  const bearing = bearingById('skf6205'), fr = 1772 / 60, f = defectFreqs(bearing, fr);
  const sig = synth({ fs: 12000, dur: 1, rpm: 1772, bearing, fault: 'outer', severity: 1, resonance: 3400, zeta: 0.04, snrDb: 2, seed: 202 });
  const g = gramGrid(sig.x, 12000, 5, { targetAlpha: f.bpfo, fr });
  const cell = g.best.iesfo;
  assert.ok(cell.f2 > 2400 && cell.f1 < 4400, `IESFO band [${cell.f1.toFixed(0)},${cell.f2.toFixed(0)}] overlaps the 3.4 kHz resonance`);
  const dx = sesAt(sig.x, 12000, cell.f1, cell.f2, f);
  assert.equal(dx.top, 'outer');                                  // the selected band's SES diagnoses outer
});

test('IESFOgram targeted: spike-robust — best band UNCHANGED while the kurtogram jumps', () => {
  const bearing = bearingById('skf6205'), fr = 1772 / 60, f = defectFreqs(bearing, fr);
  const sig = synth({ fs: 12000, dur: 1, rpm: 1772, bearing, fault: 'outer', severity: 1, resonance: 3400, zeta: 0.04, snrDb: 3, seed: 202 });
  const clean = gramGrid(sig.x, 12000, 5, { targetAlpha: f.bpfo, fr });
  const dirty = gramGrid(spiked(sig.x), 12000, 5, { targetAlpha: f.bpfo, fr });
  // targeted IESFO best cell identical (a non-fault spike enters neither the comb peak nor its median baseline)
  assert.equal(dirty.best.iesfo.level, clean.best.iesfo.level);
  assert.equal(dirty.best.iesfo.band, clean.best.iesfo.band);
  // the kurtogram best cell moves to the spike band (it is fooled by the lone impulse)
  const kgMoved = dirty.best.kurt.level !== clean.best.kurt.level || dirty.best.kurt.band !== clean.best.kurt.band;
  assert.ok(kgMoved, 'kurtogram best cell should jump under the injected spike');
});

test('IESFOgram blind: rejects the shaft order on an imbalanced healthy signal', () => {
  const bearing = bearingById('skf6205'), fr = 1772 / 60;
  const sig = synth({ fs: 12000, dur: 1, rpm: 1772, bearing, fault: 'healthy', severity: 0, resonance: 3400, zeta: 0.04, snrDb: 6, seed: 50 });
  const g = gramGrid(sig.x, 12000, 5, { fr, blind: true });
  const a0 = g.best.iesfoBlind.iesfoBlindAlpha;
  for (let m = 1; m <= 3; m++) assert.ok(Math.abs(a0 - m * fr) > 0.5, `blind α0*=${a0.toFixed(1)} should not be the shaft order ${(m * fr).toFixed(1)}`);
});

test('IESFOgram backward-compat: gramGrid(x,fs,5) unchanged + IESFO fields zero', () => {
  const sig = synth({ fs: 12000, dur: 1, rpm: 1772, bearing: bearingById('skf6205'), fault: 'inner', severity: 1, resonance: 3400, zeta: 0.04, snrDb: 2, seed: 7 });
  const g = gramGrid(sig.x, 12000, 5);                            // no opts
  assert.ok(g.best.kurt.kurt > 0 && isFinite(g.best.iSES.iSES));  // kurtogram/infogram still work
  assert.equal(g.best.iesfo.iesfo, -Infinity === g.best.iesfo.iesfo ? g.best.iesfo.iesfo : 0);  // no target → 0 (seed never beaten)
  assert.equal(g.cells[0][0].iesfo, 0);                          // per-cell IESFO is 0 with no target
  assert.equal(g.cells[0][0].iesfoBlind, 0);
});
