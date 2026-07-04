import { fft, nextPow2 } from './fft';

// ============================================================================================================
// Fast Spectral Correlation (Fast-SC), T9. A TRUE phase-retaining cyclic spectral coherence, the upgrade over
// the magnitude-only CMS below. Validated numerically against ground-truth planted-AM signals (peaks land at the
// planted α to <1 Hz) and on the App's own synth() signals (outer→BPFO, inner→BPFI, ball→2·BSF ridges + harmonics;
// healthy → no ridge). References: Antoni, Xin & Hamzaoui (2017) MSSP 92:248-277 (Fast-SC); Carter, Knapp & Nuttall
// (1973) (the magnitude-squared-coherence null distribution); Antoni (2007) + the AR-prewhitening preprocessing.
//
// Pipeline: (1) AR prewhiten (remove deterministic shaft/gear lines, without it the cross-spectrum leaks them,
// which the magnitude-only CMS was immune to); (2) complex Hann STFT (N=256, hop=16 → frame rate Fr=750 Hz, so the
// cyclic Nyquist Fr/2=375 Hz covers BPFO/BPFI/2·BSF/FTF + first harmonics with NO bin-lag de-aliasing); (3) per
// carrier-bin pair (p, q=p−m) average the complex cross-spectrum over frames and FFT it over the frame index → the
// cyclic frequency α (fine, Δα=Fr/Na≈0.7 Hz); bin-lag m=round(α/Δf) gives the cross-carrier phase the CMS dropped;
// (4) normalize to the cyclic coherence |γ|∈[0,1]; (5) the exact Carter-Knapp-Nuttall significance threshold on
// |γ|² with the overlap-corrected K_eff from the window autocorrelation; (6) the EES marginal = ⟨|γ|⟩ over carriers.
export interface FastScMap {
  alpha: Float64Array;       // cyclic frequency (Hz), fine grid Δα = Fr/Na
  carriers: Float64Array;    // carrier frequency (Hz)
  cols: Float64Array[];      // cols[alphaIdx][carrierIdx] = |γ| ∈ [0,1]
  ees: Float64Array;         // EES(α) = mean_f |γ|
  K: number;                 // raw STFT frame count
  Keff: number;              // overlap-corrected independent averages
  gamma2Thr: number;         // CKN |γ|² threshold at level p (per-pixel heatmap mask)
  gammaThr: number;          // sqrt(gamma2Thr) → the maskBelow value on the |γ| heatmap
  eesFloor: number;          // (1−p) significance floor for the EES (a carrier-MEAN, far below the per-pixel thr)
  alphaMaxHz: number;        // the cyclic-frequency ceiling actually resolved (≈ Fr/2)
}

/** AR prewhitening (Levinson-Durbin, order P): the AR inverse filter removes the predictable (deterministic shaft
 * & gear lines, colored background) part, leaving the random fault modulation, the standard preprocessing before
 * cyclostationary analysis (otherwise the phase-retaining cross-spectrum reports deterministic tones as fake
 * α-ridges). Returns the whitened innovation. */
export function arPrewhiten(x: Float64Array, P = 64): Float64Array {
  const n = x.length;
  const r = new Float64Array(P + 1);
  for (let k = 0; k <= P; k++) { let s = 0; for (let i = 0; i < n - k; i++) s += x[i] * x[i + k]; r[k] = s / n; }
  if (r[0] <= 0) return x.slice();
  const a = new Float64Array(P + 1); a[0] = 1; let e = r[0];
  for (let m = 1; m <= P; m++) {
    let k = 0; for (let j = 1; j < m; j++) k += a[j] * r[m - j];
    k = -(r[m] + k) / e;
    const ap = a.slice();
    for (let j = 1; j < m; j++) a[j] = ap[j] + k * ap[m - j];
    a[m] = k; e *= (1 - k * k); if (e <= 0) break;
  }
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j <= P && j <= i; j++) s += a[j] * x[i - j]; y[i] = s; }
  return y;
}

/** Exact Carter-Knapp-Nuttall MSC null: under H0 (no cyclostationarity), |γ̂|² ~ Beta(1, Keff−1), so the
 * false-alarm-p threshold on |γ|² is 1 − p^{1/(Keff−1)}. */
export function cohThreshold(Keff: number, p = 0.05): number {
  const k = Math.max(2, Keff);
  return 1 - Math.pow(p, 1 / (k - 1));
}

/** Overlap-corrected number of independent averages, from the ACTUAL window autocorrelation (Welch/Nuttall): the
 * raw frame count K divided by 1 + 2 Σ_m (1 − mR/N) ρ²(mR), ρ = normalized window autocorrelation at lag mR. */
export function overlapCorrectedK(Kraw: number, hop: number, N: number, w: Float64Array): number {
  let s2 = 0; for (let n = 0; n < N; n++) s2 += w[n] * w[n];
  let denom = 1;
  // variance of the mean of K correlated segments = (1/K)[1 + 2 Σ_m (1 − m/K) ρ²(mR)]; the segments are mR samples
  // apart so the inter-segment correlation is the window autocorrelation ρ(mR), zero once mR ≥ N (no overlap). The
  // Bartlett taper is (1 − m/K) over the SEGMENT index m (not m·hop/N over the sample lag, that was the FAR bug).
  for (let m = 1; m * hop < N; m++) {
    let c = 0; for (let n = 0; n + m * hop < N; n++) c += w[n] * w[n + m * hop];
    denom += 2 * (1 - m / Kraw) * (c * c) / (s2 * s2);
  }
  return Math.max(2, Kraw / denom);
}

export function fastSpectralCoherence(
  x0: Float64Array, fs: number,
  nperseg = 256, hop = 16, alphaMax = 380, p = 0.05, prewhiten = true,
): FastScMap {
  const N = nperseg, half = N >> 1;
  const x = prewhiten ? arPrewhiten(x0, 64) : x0;

  // L2-normalized Hann window
  const win = new Float64Array(N);
  let wss = 0;
  for (let i = 0; i < N; i++) { const v = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); win[i] = v; wss += v * v; }
  const wn = 1 / Math.sqrt(wss);
  for (let i = 0; i < N; i++) win[i] *= wn;

  // complex STFT (keep phase, the change vs CMS)
  const re = new Float64Array(N), im = new Float64Array(N);
  const Sre: Float64Array[] = [], Sim: Float64Array[] = [];
  for (let s = 0; s + N <= x.length; s += hop) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const fr = new Float64Array(half), fi = new Float64Array(half);
    for (let f = 0; f < half; f++) { fr[f] = re[f]; fi[f] = im[f]; }
    Sre.push(fr); Sim.push(fi);
  }
  const K = Sre.length;
  const Na = nextPow2(Math.max(2, K));
  const Df = fs / N;          // carrier-bin width
  const Fr = fs / hop;        // frame rate
  const dAlpha = Fr / Na;     // fine cyclic resolution
  const alphaCeil = Math.min(alphaMax, Fr / 2 - dAlpha);
  const nAlpha = Math.min(Na, Math.max(2, Math.round(alphaCeil / dAlpha) + 1));

  // band power P(f) = mean_i |S(i,f)|²
  const P = new Float64Array(half);
  for (let f = 0; f < half; f++) { let acc = 0; for (let i = 0; i < K; i++) acc += Sre[i][f] ** 2 + Sim[i][f] ** 2; P[f] = acc / K; }
  let Pmax = 0; for (let f = 0; f < half; f++) if (P[f] > Pmax) Pmax = P[f];
  const eps = 1e-3 * Pmax;    // ignore near-silent bins (avoid 0/0 → spurious coherence)

  const alpha = new Float64Array(nAlpha);
  for (let a = 0; a < nAlpha; a++) alpha[a] = a * dAlpha;
  const carriers = new Float64Array(half);
  for (let f = 0; f < half; f++) carriers[f] = (f * fs) / N;
  const cols: Float64Array[] = [];
  for (let a = 0; a < nAlpha; a++) cols.push(new Float64Array(half));

  // each bin-lag m owns the contiguous α-band [(m−½)Δf, (m+½)Δf]; the slow FFT over frames fills it finely.
  const maxLag = Math.round(alphaCeil / Df) + 1;
  const rr = new Float64Array(Na), ii = new Float64Array(Na);
  for (let m = 0; m <= maxLag; m++) {
    const aLo = m === 0 ? 1 : Math.max(1, Math.round((m - 0.5) * Df / dAlpha));
    const aHi = Math.min(nAlpha - 1, Math.round((m + 0.5) * Df / dAlpha));
    if (aLo > aHi) continue;
    for (let pp = m; pp < half; pp++) {
      const q = pp - m;
      const denom = Math.sqrt(P[pp] * P[q]);
      if (denom <= eps) continue;
      rr.fill(0); ii.fill(0);
      for (let i = 0; i < K; i++) {
        const ar = Sre[i][pp], ai = Sim[i][pp], br = Sre[i][q], bi = Sim[i][q];
        rr[i] = ar * br + ai * bi;   // Re(S(p)·conj(S(q)))
        ii[i] = ai * br - ar * bi;   // Im(S(p)·conj(S(q)))
      }
      fft(rr, ii);                   // → cyclic frequency (slow FFT over frames)
      const fmid = (pp + q) >> 1;
      for (let a = aLo; a <= aHi; a++) {
        let g = Math.hypot(rr[a], ii[a]) / (K * denom);
        if (g > 1) g = 1;
        if (g > cols[a][fmid]) cols[a][fmid] = g;
      }
    }
  }
  for (let f = 0; f < half; f++) cols[0][f] = 0;   // α=0 is the PSD, not cyclostationarity

  const ees = new Float64Array(nAlpha);
  for (let a = 0; a < nAlpha; a++) { let s = 0; for (let f = 0; f < half; f++) s += cols[a][f]; ees[a] = s / half; }

  const Keff = overlapCorrectedK(K, hop, N, win);
  const gamma2Thr = cohThreshold(Keff, p);
  // EES significance floor: the EES is a MEAN of |γ| over N_f carriers, so its null is far below the per-pixel
  // threshold. Under H0, |γ|²~Beta(1,Keff−1) ⇒ E[|γ|]=Γ(1.5)·Γ(Keff)/Γ(Keff+½)≈0.886/√(Keff+¼), E[|γ|²]=1/Keff;
  // the EES (mean of N_f≈half such values) has that mean and std √(Var[|γ|]/N_f). One-sided (1−p) ≈ mean+1.645·std.
  const Nf = half;
  const egamma = 0.8862269 / Math.sqrt(Keff + 0.25);     // E[|γ|]
  const vgamma = Math.max(0, 1 / Keff - egamma * egamma); // Var[|γ|] = E[|γ|²] − E[|γ|]²
  const eesFloor = egamma + 1.6449 * Math.sqrt(vgamma / Nf);
  return { alpha, carriers, cols, ees, K, Keff, gamma2Thr, gammaThr: Math.sqrt(gamma2Thr), eesFloor, alphaMaxHz: alphaCeil };
}
// (The earlier magnitude-only Cyclic Modulation Spectrum (CMS) estimator was removed in T9, superseded by
// fastSpectralCoherence above, which retains the cross-carrier phase the CMS discarded.)
