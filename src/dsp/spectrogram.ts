import { fft } from './fft';

// STFT magnitude spectrogram (dB). The analytical time-frequency view: see when impulsive energy
// appears and in which band, and confirm stationarity of the fault content.
export interface Spectrogram {
  times: Float64Array; // s (column centers)
  freqs: Float64Array; // Hz (row centers)
  cols: Float64Array[]; // cols[t][f] in dB
  half: number;
}

export function spectrogram(x: Float64Array, fs: number, nperseg = 512, overlap = 0.75): Spectrogram {
  const N = nperseg; // power of two
  const hop = Math.max(1, Math.floor(N * (1 - overlap)));
  const half = N >> 1;
  const win = new Float64Array(N);
  let wsum = 0;
  for (let i = 0; i < N; i++) { win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); wsum += win[i]; }
  const cols: Float64Array[] = [];
  const times: number[] = [];
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let s = 0; s + N <= x.length; s += hop) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const col = new Float64Array(half);
    for (let f = 0; f < half; f++) col[f] = 20 * Math.log10((2 * Math.hypot(re[f], im[f])) / wsum + 1e-9);
    cols.push(col);
    times.push((s + N / 2) / fs);
  }
  const freqs = new Float64Array(half);
  for (let f = 0; f < half; f++) freqs[f] = (f * fs) / N;
  return { times: Float64Array.from(times), freqs, cols, half };
}
