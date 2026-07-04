import { fft, ifft, nextPow2 } from './fft';

// Real cepstrum: IFFT( log|FFT(x)| ). Peaks at a quefrency τ reveal a family of uniformly-spaced
// spectral components (harmonics/sidebands), e.g. gear-mesh sideband families or bearing harmonic
// trains collapse to a single rahmonic, complementary to the spectrum (Randall & Antoni 2011).
export interface Cepstrum {
  quef: Float64Array; // quefrency (s)
  amp: Float64Array;
}

export function realCepstrum(x: Float64Array, fs: number): Cepstrum {
  const n = x.length;
  const N = nextPow2(n);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = (x[i] - mean) * w;
  }
  fft(re, im);
  for (let i = 0; i < N; i++) {
    re[i] = Math.log(Math.hypot(re[i], im[i]) + 1e-12);
    im[i] = 0;
  }
  ifft(re, im);
  const half = N >> 1;
  const quef = new Float64Array(half);
  const amp = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    quef[i] = i / fs;
    amp[i] = Math.abs(re[i]);
  }
  return { quef, amp };
}
