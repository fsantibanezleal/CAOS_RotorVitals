# Method — Real cepstrum

**Provenance:** Randall & Antoni (2011), *Rolling element bearing diagnostics — a tutorial*, MSSP 25:485–520 (DOI
10.1016/j.ymssp.2010.07.017); Borghesani et al. (2013), cepstrum pre-whitening under variable speed, MSSP 36:370–384
(DOI 10.1016/j.ymssp.2012.11.001).

**Code:** `frontend/src/dsp/cepstrum.ts` (live) · surfaced in the App spectrum view (tab **`spec`**).

## What it is

The real cepstrum is the inverse FFT of the log-magnitude spectrum:

```
c(τ) = F⁻¹{ log| F{ w(t)·x(t) } | },     τ = i / fs   (quefrency, seconds)
```

A **uniformly spaced family of spectral lines** — a harmonic train or a sideband family — collapses to a *single*
peak in the cepstrum at the **quefrency** equal to the reciprocal of the line spacing. It is therefore the natural
detector for the question "is there a regularly spaced family here?", complementary to the spectrum: where the
spectrum spreads a harmonic comb across many bins, the cepstrum concentrates it into one rahmonic.

The implementation (`realCepstrum`): mean-remove, Hann-window, FFT, take `log(|·| + 1e-12)`, then IFFT; the
single-sided quefrency axis runs to `N/2`. The `+1e-12` floor guards `log(0)` at spectral nulls.

## Why "quefrency", "rahmonic"

Cepstral analysis deliberately swaps syllables of the spectral vocabulary (spectrum→cepstrum, frequency→quefrency,
harmonic→rahmonic, filter→lifter) because the cepstrum is a *spectrum of a spectrum* — the independent axis is time
(seconds), not frequency, and a peak there means *periodic structure in the log-spectrum*.

## What it is NOT

* **Not a fault-frequency reader on its own.** The cepstrum reports *spacing*, not *location*; a bearing harmonic
  family and a gear-sideband family at the same spacing share a rahmonic. Use it to confirm a regularly spaced family
  exists, then read the envelope spectrum for which kinematic frequency it sits at.
* **Not pre-whitening here.** Cepstrum *pre-whitening* (editing the cepstrum to flatten deterministic families, then
  inverting — Borghesani 2013) is a distinct, heavier operation; this build computes the diagnostic real cepstrum
  only, not the pre-whitening edit.

## Data contract & outliers

* **Input:** one segment + `fs`. Mean-removed and Hann-windowed internally.
* **Outlier behaviour:** a strong DC or first-shaft-order line dominates the log-spectrum and can mask weak fault
  rahmonics — Hann windowing and mean removal mitigate it but do not eliminate it. Spectral nulls (true zeros) are
  floored at `1e-12` so they do not blow up `log`; read very-low-quefrency content with caution (it tracks the
  spectral envelope shape, not periodicity).

## Using it on other data

Any signal with suspected uniformly-spaced spectral families: gear-mesh sideband families, bearing harmonic trains,
speech formant/pitch separation (the cepstrum's original 1960s use), echo detection. Supply `fs`; a rahmonic at
quefrency `τ` means a family spaced `1/τ` Hz.

## Honest reading

A cheap, exact, training-free transform — one FFT pair — that adds an independent angle to the same record: the
spectrum, the envelope spectrum, and the cepstrum each answer a different question about the *same* signal. The
relations it exposes are exact; nothing here is illustrative.
