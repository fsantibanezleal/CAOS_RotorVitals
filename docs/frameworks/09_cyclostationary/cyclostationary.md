# Method — Cyclostationary analysis: Fast Spectral Correlation & the enhanced envelope spectrum

**Provenance:** Antoni (2007), *Cyclic spectral analysis of rolling-element bearing signals — facts and fictions*,
JSV 304:497–529 (DOI 10.1016/j.jsv.2007.02.029); Antoni, Xin & Hamzaoui (2017), *Fast computation of the spectral
correlation*, MSSP 92:248–277 (DOI 10.1016/j.ymssp.2017.01.011); Carter, Knapp & Nuttall (1973), the
magnitude-squared-coherence null distribution, IEEE TAU 21:337–344 (DOI 10.1109/TAU.1973.1162496); Borghesani et al.
(2013), the squared-envelope-spectrum ↔ cyclic-coherence relationship (DOI 10.1016/j.ymssp.2013.05.012).

**Code:** `frontend/src/dsp/csc.ts` (live, TypeScript) · App tab **`csc`** (Cyclostationary), panel
`frontend/src/viz/CscPanel.tsx`.

## What it is

A bearing fault is a **second-order cyclostationary (CS2)** process: random in waveform (jittered arrival times,
random amplitudes) but **periodic in its statistics** — the variance rises and falls at the fault period even though
the mean does not. The right image of a CS2 process is two-dimensional: a **carrier frequency** `f` (the fast
oscillation, the excited resonance, often several kHz) and a **cyclic frequency** `α` (the slow modulation rate, the
fault-repetition rate). The spectral correlation `S_x(f, α)` and its normalized form the **cyclic spectral
coherence** `γ_x(f, α) ∈ [0, 1]` live on this plane.

```
S_x(f, α) = lim_{T→∞} (1/T) · E[ X_T(f + α/2) · X_T*(f − α/2) ]

γ_x(f, α) = S_x(f, α) / sqrt( S_x(f + α/2, 0) · S_x(f − α/2, 0) ),   0 ≤ |γ_x| ≤ 1
```

A fault deposits energy as a **vertical ridge**: a band of carriers `f` all modulated at the same `α = BPFO` (or
BPFI, 2·BSF, FTF, and their harmonics). Deterministic content (shaft imbalance, gear-mesh tones) is *first-order*
periodic — it sits only on the `α = 0` axis (the ordinary power spectrum) and does **not** spread vertically. That
is the rigorous discriminator: the cyclic plane asks not "is there energy near the fault frequency?" but "is energy
*at* the fault frequency organizing a whole band of carriers?" — far harder to fake than a coincidental peak.

The one-dimensional, user-facing product is the **enhanced envelope spectrum (EES)**: integrate `|γ|` over the
carrier axis, collapsing the vertical ridges to peaks on an `α` axis.

```
EES(α) = (1/N_f) · Σ_f |γ_x(f, α)|
```

## The chain (`csc.ts`)

This build computes a **true Fast Spectral Correlation**, not the magnitude-only cyclic-modulation spectrum.

1. **AR prewhitening** (Levinson–Durbin, order 64) removes the predictable, deterministic part (shaft + gear lines).
   Without it the phase-retaining cross-product would report those tones as *fake* α-ridges — the magnitude-only CMS
   was immune to that, so the prewhitening restores that robustness.
2. **Complex Hann STFT** — `N = 256`, `hop = 16` (75 % overlap), keeping the **complex** coefficients. The frame
   rate is `Fr = fs/hop = 750 Hz` (at `fs = 12 kHz`), so the cyclic Nyquist `Fr/2 = 375 Hz` covers
   BPFO/BPFI/2·BSF/FTF and their first harmonics with **no bin-lag de-aliasing**.
3. **Cross-spectrum over carrier pairs** `(p, q = p − m)`, averaged over frames, then Fourier-transformed over the
   frame index → the `α` axis at fine resolution `Δα = Fr/Nα ≈ 0.7 Hz`. The bin-lag `m = round(α/Δf)` supplies the
   cross-carrier phase that `|STFT|²` discards.
4. **Normalize** each pixel by `sqrt(P(f₊)·P(f₋))` → the coherence `|γ| ∈ [0, 1]` (the Cauchy–Schwarz bound).
5. **Significance mask** — the *exact* Carter–Knapp–Nuttall result: under H₀ the squared coherence is
   `Beta(1, K_eff − 1)`, so the `(1 − p)` threshold is `|γ|²_thr = 1 − p^{1/(K_eff − 1)}`, with `K_eff` the
   **overlap-corrected** independent-average count (from the window's own autocorrelation) — a real statistical test
   replacing the median+3·MAD heuristic.
6. **EES marginal** `EES(α) = ⟨|γ(f, α)|⟩_f`, with its own `(1 − p)` significance floor (a carrier-mean, far below
   the per-pixel threshold).

## What it is NOT

* **Not the full dense `(f, α)` correlation map.** Fast-SC reconstructs `α` finely up to `≈ Fr/2 = 375 Hz` — the
  decisive diagnostic band — not the entire bi-frequency plane to Nyquist. A dense map over the full plane is a
  precompute method, not this live one.
* **Not order-tracked.** Like every cyclic method here it assumes roughly **constant speed**. Run-up / coast-down
  needs order-domain resampling, which this build does not do — point it only at constant-speed segments.
* **Not a magnitude-only CMS.** The earlier cyclic-modulation spectrum kept only `|STFT|²`; this keeps complex phase,
  which is what lets the CKN null distribution apply.

## Data contract & outliers

* **Input:** one constant-speed acceleration segment + `fs` + the kinematic frequencies (from geometry, see the
  envelope doc). No raw 48 kHz — consume the already-decimated 12 kHz segment.
* **Empirical false-alarm rate:** measured `~4–5 %` at the nominal `p = 0.05` on white noise (calibrated with the
  overlap-corrected `K_eff`); the small residual comes from the AR prewhitening and zero-padding. Report it; do not
  claim an exact 5 %.
* **Outlier behaviour:** a lone non-cyclostationary spike (electrical pickup, sensor knock) does **not** raise an
  α-ridge — it has no consistent cyclic phase — which is the whole point of using coherence over a raw envelope
  spectrum. A speed that drifts mid-segment smears the ridges (the constant-speed assumption breaking); treat a
  blurred ridge as a speed-stability warning, not a faint fault.

## Using it on other data

Any vibration/acoustic CS2 problem fits: gear local faults (cyclic at the gear-mesh-modulated rate), reciprocating
machines, even some electrical-machine fault currents. Supply the candidate `α` (the kinematic rate) and read the
EES at that `α` and its harmonics. With **no** prior, scan `α` and look for any ridge family that clears the CKN
mask — but expect more false positives without the kinematic anchor.

## Honest reading

Fast-SC is the most rigorous discriminator in the suite: it separates genuinely modulated fault energy from
deterministic lines and from one-off transients, with a *real* significance test rather than a tuned threshold. Its
cost is the constant-speed assumption and the `375 Hz` cyclic ceiling. The frequency relations and the CKN threshold
are exact and transferable; the synthetic-demo severity and run-to-failure trends shown alongside are illustrative
and labelled as such. Validated numerically: planted-AM signals peak at the planted `α` to `< 1 Hz`, and the App's
own `synth()` cases produce outer→BPFO, inner→BPFI, ball→2·BSF ridges (healthy → no ridge).
