# Method, STFT magnitude spectrogram

**Provenance:** Randall & Antoni (2011), *Rolling element bearing diagnostics, a tutorial*, MSSP 25:485–520 (DOI
10.1016/j.ymssp.2010.07.017), the time-frequency view of impulsive bearing content.

**Code:** `frontend/src/dsp/spectrogram.ts` (live) · App tab **`spec`** / waterfall view; the 3-D waterfall is
`viz/Waterfall3D.tsx`.

## What it is

The short-time Fourier transform magnitude in dB, the time-frequency image that answers *when* impulsive energy
appears and *in which band*, and whether the fault content is **stationary** or comes and goes.

```
STFT(t, f) = F{ w·x }(t, f),     S_dB(t, f) = 20·log₁₀( 2·|STFT(t, f)| / Σw + 1e-9 )
```

Implementation (`spectrogram(x, fs, nperseg = 512, overlap = 0.75)`): a sliding `512`-sample **Hann** window with
`75 %` overlap (`hop = N·(1 − overlap)`), FFT per frame, single-sided magnitude scaled by `2/Σw` (coherent-gain
calibration), converted to dB with a `1e-9` floor. Column centres are the frame mid-times `(s + N/2)/fs`; row centres
are the positive-frequency bins.

## Why it complements the spectrum

A plain spectrum integrates over the whole record and hides *transience*: a fault that fires in bursts and a
continuous broadband source can look alike. The spectrogram separates them on the time axis, a real bearing fault
shows a horizontal band of energy that flickers at the (slow) fault rate; an electrical transient is a single
vertical streak; a speed change tilts the harmonic ridges. It is the sanity check behind the cyclostationary
ridge: "is the impulsive energy actually periodic in time, or a one-off?"

## What it is NOT

* **Not a demodulator.** The spectrogram *shows* where the resonance is, but reading the fault rate still needs the
  envelope spectrum (or the cyclic plane). Use it to pick/confirm the band, not to score the fault.
* **Not high-resolution in both axes at once.** `nperseg = 512` is a deliberate time/frequency trade, fine enough
  to see bursts, coarse enough in frequency to keep them visible. A different record may want a different window.

## Data contract & outliers

* **Input:** one segment + `fs`; needs `≥ nperseg` samples or it returns no columns.
* **Outlier behaviour:** the `1e-9` dB floor keeps spectral nulls finite; very short records yield few columns (low
  time resolution). A mid-segment speed change tilts ridges, read it as non-stationarity, not as a frequency error.

## Using it on other data

Any non-stationary or burst-like vibration/acoustic signal: run-up/coast-down (ridges sweep), intermittent faults,
gear transients. Supply `fs`; tune `nperseg` to the burst duration you expect.

## Honest reading

The most familiar, training-free time-frequency view, exact and transferable. It earns its place by catching the
failure modes a single spectrum hides (transience, non-stationarity); nothing here is illustrative.
