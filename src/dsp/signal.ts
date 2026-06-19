// Synthetic bearing-vibration generator. Physically-grounded model (McFadden & Smith 1984;
// Randall & Antoni 2011): a quasi-periodic impulse train at the fault frequency, each impulse
// exciting a damped structural resonance, with slip jitter and amplitude modulation, over shaft
// harmonics + Gaussian noise. Fully deterministic from `seed` — the validation set, reproducible.
import { mulberry32, gaussian } from '../lib/prng';
import { type Bearing, defectFreqs, faultFreq, type FaultKind } from './bearing';

export interface SignalSpec {
  fs: number; // sampling rate (Hz)
  dur: number; // duration (s)
  rpm: number; // shaft speed
  bearing: Bearing;
  fault: FaultKind;
  severity: number; // impulse amplitude (0..~1.5)
  resonance: number; // excited structural resonance (Hz)
  zeta: number; // damping ratio of that resonance
  snrDb: number; // signal-to-noise ratio (dB)
  seed: number;
}

export interface Signal {
  t: Float64Array;
  x: Float64Array;
  fs: number;
}

export function synth(spec: SignalSpec): Signal {
  const { fs, dur, rpm, bearing, fault, severity, resonance, zeta, snrDb, seed } = spec;
  const n = Math.round(fs * dur);
  const fr = rpm / 60;
  const x = new Float64Array(n);
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = i / fs;
  const rng = mulberry32(seed);

  // shaft fundamental + harmonics (always present)
  for (let i = 0; i < n; i++) {
    x[i] += 0.5 * Math.sin(2 * Math.PI * fr * t[i]) + 0.2 * Math.sin(2 * Math.PI * 2 * fr * t[i]);
  }

  if (fault !== 'healthy' && severity > 0) {
    const f = defectFreqs(bearing, fr);
    const fdef = faultFreq(f, fault);
    const wn = 2 * Math.PI * resonance;
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const decay = zeta * wn;
    const period = 1 / fdef;
    // inner-race defect → AM at shaft freq; ball defect → AM at cage freq (FTF); outer → none
    const modFreq = fault === 'inner' ? fr : fault === 'ball' ? f.ftf : 0;
    const burst = Math.ceil((5 / decay) * fs); // truncate at ~5 time constants
    // Accumulate impulse times with small PER-INTERVAL slip jitter (~0.5% of one period), so the
    // periodicity is preserved (mild smearing) rather than destroyed by cumulative drift.
    let tau = 0;
    while (tau < dur) {
      const mod = modFreq > 0 ? 0.5 + 0.5 * Math.cos(2 * Math.PI * modFreq * tau) : 1;
      const amp = severity * (0.8 + 0.4 * rng()) * mod;
      const start = Math.floor(tau * fs);
      const len = Math.min(n - start, burst);
      for (let j = 0; j < len; j++) {
        const dt = j / fs;
        x[start + j] += amp * Math.exp(-decay * dt) * Math.sin(wd * dt);
      }
      tau += period * (1 + 0.005 * gaussian(rng));
    }
  }

  // additive Gaussian noise to hit the target SNR
  let power = 0;
  for (let i = 0; i < n; i++) power += x[i] * x[i];
  power /= n;
  const noiseStd = Math.sqrt(power / Math.pow(10, snrDb / 10));
  for (let i = 0; i < n; i++) x[i] += noiseStd * gaussian(rng);

  return { t, x, fs };
}
