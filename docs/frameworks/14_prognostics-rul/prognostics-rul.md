# Method — Prognostics / RUL + ISO 20816 severity zones

**Provenance:** Lei et al. (2018), *Machinery health prognostics — a systematic review*, MSSP 104:799–834 (DOI
10.1016/j.ymssp.2017.11.016); Wang, Lei, Li & Li (2020), the XJTU-SY RUL benchmark, IEEE TR 69:401–412 (DOI
10.1109/TR.2018.2882682); Saxena et al. (2010), the α-λ prognostic-performance metric, Int. J. Prognostics and Health
Management 1:4–23; ISO 20816-1:2016 / ISO 20816-3:2022 (severity zones) and ISO 10816-1 Class I (≤15 kW).

**Code:** `frontend/src/dsp/prognostics.ts` + `frontend/src/dsp/health.ts` (RUL) and `frontend/src/dsp/iso.ts`
(severity) · App tabs **`rul`** (Prognostics · RUL), **`eval`** (RUL eval), **`iso`** (ISO trend), **`rec`**
(Recommendation · report). Mirrors the web Methodology "Prognostics / RUL + ISO" tab.

## What it is — RUL by first-passage

Prognosis is framed as **first-passage** of a health indicator (HI) to a failure threshold. A scalar HI (an
RMS-type amplitude) is trended over operating time; once degradation starts, an exponential model is fit and
projected to the alarm threshold.

1. **Onset detection** (`prognostics.ts::fitDegradation`) — the baseline is the first `max(4, ⌊0.3·n⌋)` points;
   compute its mean `μ` and std `σ`. Onset is the **first index `i` where two consecutive points exceed `μ + 4σ`**
   (`points[i].hi > μ+4σ AND points[i+1].hi > μ+4σ`). The two-in-a-row requirement is the whole point: a single 4σ
   spike is almost always a transient; requiring a *sustained* excursion turns a noisy threshold into a usable onset
   detector. **Until onset fires the function returns `null`** — a healthy machine correctly yields no RUL number.
2. **Log-linear fit** — on the post-onset points (`hi > 0`), ordinary least squares in log space:
   `ln(HI) = ln a + b·t`, i.e. exponential growth `HI(t) = a·e^{bt}`. The model is **accepted only if `b > 0`**; a
   non-positive slope means "not actually degrading" and the build refuses to emit a fictitious RUL.
3. **First-passage + band** — `t_fail = (ln(threshold) − ln a) / b`; `RUL = max(0, t_fail − t_now)`. The uncertainty
   fan is `exp(ln_mid ± 2s)` where `s = √(RSS/(m−2))` is the log-scale residual std (`m−2` is the correct DOF
   correction for a two-parameter fit). Because the band is ±2σ on a multiplicative scale it is asymmetric in linear
   units and widens with time — exactly the shape of physical uncertainty when the growth rate is itself uncertain.

```
onset:   first i with HI_i > μ₀+4σ₀  AND  HI_{i+1} > μ₀+4σ₀     (μ₀,σ₀ from first max(4,⌊0.3n⌋) points)
fit:     ln HI(t) = ln a + b·t     (OLS, post-onset, require b > 0)
RUL:     t_fail = (ln HI_thr − ln a)/b,   RUL = max(0, t_fail − t_now)
band:    HI_lo/hi(t) = exp(ln a + b·t ∓ 2s),   s = √(RSS/(m−2))
```

## Honest prognostic quality — α-λ and calibration (`prognostics.ts`)

A point RUL is not enough; the build also ships the two standard prognostic-performance diagnostics (App `eval` tab):

* **α-λ plot** (`alphaLambda`, default `α = 0.2`) — re-fit the model at successive "now" times and ask whether the
  predicted RUL stays inside an `±α` cone of the true RUL as end-of-life approaches (Saxena et al. 2010).
* **Calibration / reliability curve** (`calibration`) — across many run-to-failure trajectories, does a nominal `p %`
  credible interval actually contain the true RUL `p %` of the time? A forecast whose band is too thin fails here.

These exist precisely so the RUL is reported with its *calibration*, not as a single deceptive line.

## What it is — ISO 20816 severity zones (`iso.ts`)

A complementary, *present-tense* judgement: broadband **velocity RMS (10–1000 Hz)** at the bearing housings sorted
into four zones — **A** as-new, **B** acceptable long-term, **C** investigate / plan repair, **D** danger / stop. The
A/B/C/D framework is identical across machine classes; only the numeric limits move. The build ships all three:

| Scale (`iso.ts`) | Applies to | A/B | B/C (ALERT) | C/D (DANGER) |
|---|---|---|---|---|
| `classI` — ISO 10816-1 Class I | machines ≤ 15 kW | 0.71 | 1.8 | 4.5 mm/s |
| `group2` — ISO 20816-3 Group 2 | 15–300 kW, rigid support | 1.4 | 2.8 | 4.5 mm/s |
| `group1` — ISO 20816-3 Group 1 | > 300 kW, rigid support | 2.3 | 4.5 | 7.1 mm/s |

The CWRU-class rig behind the synthetic signal is ~1.5 kW (sub-15 kW), so **Class I** is the correct scale; ISO
20816-3 applies to the ≥15 kW mining machines the suite ultimately targets. Operationally the **B/C** boundary is the
ALERT setpoint and **C/D** the DANGER / trip setpoint.

## The decision layer (`recommend.ts`, App `rec` tab)

Diagnosis, ISO severity, and RUL are three pieces of evidence; a technician acts on **one** decision. The
recommendation fuses them and takes the **WORST of the three** on a priority ladder (ok → watch → plan → alarm →
trip; trip only when a severe fault, Zone D, and a short RUL all agree). The key honesty: when the broadband ISO
screen looks calm (Zone A/B) but the envelope confirms a real bearing fault — its energy lives in the high-frequency
resonance, **outside** the 10–1000 Hz ISO band — the engine surfaces the disagreement and trusts the envelope.

## What it is NOT

* **Not a unit mix-up.** The ISO layer is **velocity RMS in mm/s**; the prognostic HI is an **acceleration-RMS-style**
  indicator with its own demonstration threshold — two scales answering two questions; the build keeps them distinct.
* **Not a field measurement.** The method (onset rule, exponential fit, first-passage, band, α-λ, calibration) is
  exactly what runs and is exact/transferable; the **severity and hours-to-failure numbers in the shipped scenarios
  are synthetic and labelled** — higher planted severity yields earlier onset + faster growth; a healthy case yields
  no projection. The ISO velocity magnitude shown is an illustrative calibration of the synthetic case.
* **Not the only HI.** RMS rises late; kurtosis rises early then falls back to 3 as damage spreads; spectral kurtosis
  stays sensitive longer. No single HI is monotone over the whole life, so the model is fit only to the post-onset
  segment.

## Data contract & outliers

* **Input:** a run-to-failure HI trend (per-snapshot HI over operating hours) + a failure threshold; ISO takes the
  broadband velocity-RMS reading + the machine class.
* **Outlier behaviour:** a lone 4σ spike does **not** trigger onset (the two-in-a-row rule); a non-degrading trend
  (`b ≤ 0`) returns **no** projection rather than a fabricated number; the failure threshold is treated as a fuzzy
  region (ISO + experience give a band, not a line), so the RUL is honestly a distribution over crossing times.

## Using it on other data

Any monotone-after-onset degradation signal (bearing, gear, tool wear) fits the onset→exponential→first-passage
template; supply the HI trend + threshold. For severity, pick the ISO class matching the machine power/mounting; the
A/B/C/D logic is unchanged. Calibrate the ±2σ band against held-out run-to-failure trajectories before trusting it in
production (the α-λ/calibration tools are there for exactly that).

## Honest reading

A transparent, closed-form prognostic at the bottom of the model ladder (the heavier particle-filter / GP / deep-RUL
options buy better-calibrated uncertainty at the cost of data and compute). Its honesty is structural: no onset → no
number, `b ≤ 0` → no number, and the band widens. The method and the ISO zones are exact and transferable; the
absolute severity/hours in the demos are synthetic and labelled.
