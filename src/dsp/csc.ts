import { fft, nextPow2 } from './fft';

// Cyclic Modulation Spectrum (CMS) — a fast, web-feasible approximation of the cyclic spectral
// coherence (Antoni). |STFT|² per carrier band is Fourier-analyzed over time → energy at a cyclic
// frequency α. Bearing faults appear as VERTICAL α-ridge families at BPFO/BPFI/2·BSF/FTF (+ harmonics),
// independent of the carrier band — the cleanest "is this cyclostationary at the fault period?" view.
// (This is the CMS estimator, not full Fast-SC; labeled as such. Integrating over carriers ≈ the SES.)
export interface CscMap {
  alpha: Float64Array; // cyclic frequency (Hz)
  carriers: Float64Array; // carrier frequency (Hz)
  cols: Float64Array[]; // cols[alphaIdx][carrierIdx] — coherence (0..1-ish), x=α, y=carrier
}

export function cyclicModulationSpectrum(x: Float64Array, fs: number, nperseg = 128, hop = 8, alphaMax = 800): CscMap {
  const N = nperseg;
  const half = N >> 1;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  // STFT power: sgram[frame][carrier] = |STFT|²
  const re = new Float64Array(N), im = new Float64Array(N);
  const frames: Float64Array[] = [];
  for (let s = 0; s + N <= x.length; s += hop) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const p = new Float64Array(half);
    for (let f = 0; f < half; f++) p[f] = re[f] * re[f] + im[f] * im[f];
    frames.push(p);
  }
  const nf = frames.length;
  const frameRate = fs / hop;
  const Na = nextPow2(nf);
  const nAlphaAll = Na >> 1;
  const nAlpha = Math.min(nAlphaAll, Math.max(1, Math.round((alphaMax / (frameRate / 2)) * nAlphaAll)));
  // per carrier: FFT the power series over time → cyclic spectrum
  const cyc: Float64Array[] = []; // cyc[carrier][alpha]
  const rr = new Float64Array(Na), ii = new Float64Array(Na);
  for (let c = 0; c < half; c++) {
    let mean = 0; for (let t = 0; t < nf; t++) mean += frames[t][c]; mean /= nf;
    rr.fill(0); ii.fill(0);
    for (let t = 0; t < nf; t++) rr[t] = frames[t][c] - mean;
    fft(rr, ii);
    const row = new Float64Array(nAlpha);
    const denom = mean || 1e-12;
    for (let a = 0; a < nAlpha; a++) row[a] = Math.hypot(rr[a], ii[a]) / (nf * denom); // coherence-like normalization
    cyc.push(row);
  }
  // transpose → cols[alpha][carrier]
  const alpha = new Float64Array(nAlpha);
  for (let a = 0; a < nAlpha; a++) alpha[a] = (a * frameRate) / Na;
  const carriers = new Float64Array(half);
  for (let c = 0; c < half; c++) carriers[c] = (c * fs) / N;
  const cols: Float64Array[] = [];
  for (let a = 0; a < nAlpha; a++) { const col = new Float64Array(half); for (let c = 0; c < half; c++) col[c] = cyc[c][a]; cols.push(col); }
  return { alpha, carriers, cols };
}
