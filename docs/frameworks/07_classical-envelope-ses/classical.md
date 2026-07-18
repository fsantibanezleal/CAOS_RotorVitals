# Method, Classical envelope / squared-envelope spectrum (SES)

**Provenance:** Randall & Antoni (2011), *Rolling element bearing diagnostics, A tutorial*, MSSP 25:485–520
(DOI 10.1016/j.ymssp.2010.07.017); Antoni (2006/2007) the **kurtogram** / fast-kurtogram (DOI
10.1016/j.ymssp.2005.12.002); Smith & Randall (2015) the CWRU benchmark study (DOI 10.1016/j.ymssp.2015.04.021).

**What:** the unsupervised, training-free physics baseline, **leakage-immune by construction**. A bearing defect
produces periodic impacts that amplitude-modulate a structural resonance; demodulating that resonance (band-pass →
Hilbert envelope → spectrum) exposes a **comb** at the kinematic defect frequency.

## The chain (`model/classical.py`)

1. **Band selection**, a fixed 2–4 kHz CWRU drive-end resonance band, OR the automatic **kurtogram** pick
   (max-kurtosis band), OR none (the raw-spectrum control).
2. **Envelope**, `|hilbert(bandpass(x))|`, then the magnitude spectrum.
3. **Comb prominence**, per-harmonic peak-to-local-median at the kinematic multiplier × shaft rate, taking the
   strongest of the fundamental and its ±sidebands (amplitude-modulated faults: inner = 1× shaft, ball = FTF).
4. **Decision**, a top score above an **absolute gate (4.5)** and a top/second ratio above a **relative gate
   (1.7)** → that fault; else normal. The full prominence statistic `P(f₀)`, the two gate constants, and the
   confidence blend are documented in [the diagnosis decision rule](../15_diagnosis-decision/diagnosis-decision.md).

## Kinematics (SKF 6205-2RS JEM, × shaft rate)

| | multiplier | sideband |
|---|---|---|
| BPFO (outer) | 3.5848 | n/a |
| BPFI (inner) | 5.4152 | 1× (shaft) |
| 2·BSF (ball) | 4.7136 | FTF 0.3983 |

## Honest reading

Band selection dominates: the resonance band recovers normal/inner/outer reliably, the kurtogram pick underperforms
on CWRU, and the raw comb is near chance (the `classical-rawcomb` case), which is exactly what proves the envelope
demodulation does the work. Ball faults stay the hard case (a weak, modulated 2·BSF line). This is the negative
control the learned tier is measured against.
