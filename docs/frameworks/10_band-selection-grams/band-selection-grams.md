# Method, Demodulation-band selection: kurtogram, infogram, autogram & IESFOgram

**Provenance:** Antoni & Randall (2006), *The spectral kurtosis*, MSSP 20:308–331 (DOI
10.1016/j.ymssp.2004.09.002); Antoni (2007), *Fast computation of the kurtogram*, MSSP 21:108–124 (DOI
10.1016/j.ymssp.2005.12.002); Antoni (2016), *The infogram*, MSSP 74:73–94 (DOI 10.1016/j.ymssp.2015.04.034);
Moshrefzadeh & Fasana (2018), *The Autogram*, MSSP 105:294–318 (DOI 10.1016/j.ymssp.2017.12.009); Mauricio, Smith,
Randall, Antoni & Gryllias (2020), *IESFOgram*, MSSP 144:106891 (DOI 10.1016/j.ymssp.2020.106891).

**Code:** `frontend/src/dsp/kurtogram.ts` and `frontend/src/dsp/infogram.ts` (live) · App tabs **`kur`**
(Kurtogram) and **`gram`** (band-selection comparison) · panels `viz/Kurtogram.tsx`, `viz/GramPanel.tsx`,
`viz/BandGram.tsx`.

## Why a band selector exists

Envelope analysis rests on one fragile decision: **which band to demodulate**. The fault energy concentrates around
an unknown structural resonance; demodulate the wrong band and the envelope spectrum is flat and ambiguous. Choosing
the band by eye does not scale, it is the single largest failure mode of the method. All four "grams" automate the
choice by scoring every band of a **dyadic paving** of `[0, fs/2]` (levels `k = 1…5`, `2^k` equal-width bands per
level) and picking the maximum.

A shared guard skips any band whose lower edge falls below `0.02·fs` (and DC): that low end is dominated by
deterministic shaft/gear content, impulsive-looking but not a bearing fault, and would bias the selector.

## The four scores

| Gram | Scores each band by | Responds to | Blind to |
|---|---|---|---|
| **Kurtogram** | excess kurtosis of the Hilbert envelope | impulsiveness | periodicity (a lone spike fools it) |
| **Infogram** | negentropy of the squared envelope (SE) and of its spectrum (SES) | *repetitive* transients |, (robust to a single spike) |
| **Autogram** | kurtosis of the autocorrelation of the squared envelope | periodic impulsiveness | n/a |
| **IESFOgram** | prominence of the **diagnosed fault's** harmonic comb in the band's SES | the targeted fault period | impulses *not* at the fault period |

```
Excess kurtosis:  κ(x) = ⟨(x − x̄)⁴⟩ / ⟨(x − x̄)²⟩² − 3        (0 for Gaussian, > 0 impulsive)

Negentropy:       N(y) = ⟨ (y/⟨y⟩) · ln(y/⟨y⟩) ⟩               (0 for flat, > 0 peaky)   [infogram.ts]

IESFOgram:        IESFO(α₀) = (1/K) Σ_{k=1..K} max_{|α−kα₀|≤τ} √S(α)
                                      / median_{|α−kα₀|≤W, >τ} √S(α),   α̂₀ = argmax_band IESFO
```

## Kurtogram (`kurtogram.ts`)

For each dyadic cell: FFT-domain brick-wall band-pass → analytic-signal Hilbert envelope → **excess kurtosis of the
envelope**. Kurtosis is taken on the *envelope* (the demodulated quantity the downstream spectrum consumes), not the
raw band signal, so the cell score measures impulsiveness of exactly what will be spectrum-analysed. The max-kurtosis
cell's `[f₁, f₂]` becomes the demodulation band. A complementary per-frequency **spectral kurtosis** view is computed
as the excess kurtosis of `|STFT|` across frames (256-sample Hann, 50 % overlap).

## Infogram (`infogram.ts`)

Same dyadic grid, but each band is scored by **negentropy** of the squared envelope and of the SES instead of
kurtosis. Negentropy responds to *repetitive* transients rather than to any single impulse, so it is robust exactly
where the kurtogram is fooled, a lone non-Gaussian spike or electrical pickup. `negentropy()` returns 0 for a flat
sequence and grows for a peaky one; `sesPower()` is the single-sided `|DFT{SE − mean}|²` with the DC bin excluded.

## IESFOgram, the targeted selector

Instead of scoring a band by *general* impulsiveness (kurtogram) or *general* repetitiveness (infogram), the
IESFOgram scores it by how strongly its squared-envelope spectrum shows the harmonic **comb of the diagnosed fault
frequency** (BPFO, BPFI, or 2·BSF). We tell it which periodicity to look for and pick the band whose envelope best
reveals *that* fault. Consequence: an impulse **not** at the fault period enters neither the comb peak nor its local
median baseline, so the targeted selector is insensitive to it, when a spike makes the kurtogram jump, the targeted
IESFOgram does not move. A **blind** variant drops the prior by sweeping shaft orders (`≥ 1.5×fr`, excluding shaft
and cage) and choosing the strongest comb; it is weaker because it can latch onto gear-mesh lines.

## What it is NOT

* **Kurtosis ≠ periodicity.** The kurtogram measures impulsiveness only; it cannot tell a periodic fault train from a
  single transient. That is the motivation for the infogram/autogram/IESFOgram successors, and for the downstream
  **two-gate diagnosis** (absolute gate 4.5, relative gate 1.7; see
  [the diagnosis decision rule](../15_diagnosis-decision/diagnosis-decision.md)), which rejects an
  impulsive-but-aperiodic band (no comb → fails both gates → reported healthy).
* **Not the paper's exact IESFOgram.** Mauricio et al. integrate the cyclic spectral **coherence** over a
  constant-relative-bandwidth filterbank; this build scores fault-comb prominence on the plain per-band SES over the
  pragmatic dyadic `gramGrid`, with no IRLS regression. It is a spike-robust *surrogate* of the paper's targeted
  feature, attributed honestly, not claimed to be the full method.

## Data contract & outliers

* **Input:** one constant-speed segment + `fs` (+ the kinematic frequencies for the targeted IESFOgram).
* **Levels `k = 1…5`, bands `b = 0…2^k − 1`, lowest `0.02·fs` excluded.**
* **Outlier behaviour:** the *whole reason* the grams differ. Drop an electrical spike into a clean signal: the
  kurtogram's selected band jumps to the spike; the infogram and the targeted IESFOgram do not. The App's spike demo
  makes this visible, it is the honest way to show when each selector is trustworthy.

## Using it on other data

Any envelope-analysis problem (bearings, gears) where the resonance band is unknown. With a kinematic prior, prefer
the targeted IESFOgram; with no prior and a clean rig, the kurtogram is cheapest; on a noisy/spiky signal, prefer the
infogram. The dyadic grid and the `0.02·fs` guard transfer unchanged; only `fs` and the candidate frequencies change.

## Honest reading

Band selection dominates envelope analysis, and no single gram wins everywhere, which is why this build ships four
and lets the `gram` tab compare them on the same record. The selected band and its score are honest outputs of the
real algorithms on a physically-grounded synthetic signal; the severity and RUL trends shown alongside remain
illustrative.
