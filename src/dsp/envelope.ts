// Envelope (amplitude-demodulation) analysis — the core of bearing diagnostics:
// band-pass around the structural resonance, take the Hilbert envelope, then its spectrum.
import { fft, ifft, nextPow2 } from './fft';

export interface Spectrum {
  freq: Float64Array;
  mag: Float64Array;
  df: number;
}

/** FFT-domain brick-wall band-pass [f1,f2] Hz on a real signal sampled at fs. */
export function bandpass(x: Float64Array, fs: number, f1: number, f2: number): Float64Array {
  const n = x.length;
  const N = nextPow2(n);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  re.set(x);
  fft(re, im);
  for (let i = 0; i < N; i++) {
    const f = (i <= N / 2 ? i : i - N) * (fs / N);
    const af = Math.abs(f);
    if (af < f1 || af > f2) {
      re[i] = 0;
      im[i] = 0;
    }
  }
  ifft(re, im);
  return re.slice(0, n);
}

/** Hilbert-transform amplitude envelope of a real signal. */
export function hilbertEnvelope(x: Float64Array): Float64Array {
  const n = x.length;
  const N = nextPow2(n);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  re.set(x);
  fft(re, im);
  // analytic-signal multiplier: keep DC & Nyquist, double positive freqs, zero negatives
  const h = new Float64Array(N);
  h[0] = 1;
  if (N % 2 === 0) {
    h[N / 2] = 1;
    for (let i = 1; i < N / 2; i++) h[i] = 2;
  } else {
    for (let i = 1; i < (N + 1) / 2; i++) h[i] = 2;
  }
  for (let i = 0; i < N; i++) {
    re[i] *= h[i];
    im[i] *= h[i];
  }
  ifft(re, im);
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.hypot(re[i], im[i]);
  return env;
}

/** Single-sided amplitude spectrum of a real signal (mean-removed, Hann-windowed). */
export function magSpectrum(x: Float64Array, fs: number): Spectrum {
  const n = x.length;
  const N = nextPow2(n);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let winSum = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = (x[i] - mean) * w;
    winSum += w;
  }
  fft(re, im);
  const half = N >> 1;
  const freq = new Float64Array(half);
  const mag = new Float64Array(half);
  const df = fs / N;
  for (let i = 0; i < half; i++) {
    freq[i] = i * df;
    mag[i] = (Math.hypot(re[i], im[i]) * 2) / winSum;
  }
  return { freq, mag, df };
}

/** Full envelope-spectrum pipeline: band-pass → Hilbert envelope → spectrum. */
export function envelopeSpectrum(x: Float64Array, fs: number, band: [number, number]): Spectrum {
  const bp = bandpass(x, fs, band[0], band[1]);
  const env = hilbertEnvelope(bp);
  return magSpectrum(env, fs);
}
