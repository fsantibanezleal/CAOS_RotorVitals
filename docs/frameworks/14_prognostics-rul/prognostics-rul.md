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
recommendation maps each piece onto a five-step priority ladder **`ok → watch → plan → alarm → trip`** and takes the
**WORST of the three** (`recommend.ts:111`). The three mappings are explicit constants, not vibes:

| Evidence | → ok | → watch | → plan | → alarm |
|---|---|---|---|---|
| **ISO zone** (`ZONE_PRIORITY`, line 58) | A | B | C | D |
| **Fault severity state** (`faultStateOf`, lines 51-55 — aligned with the App gauge zones **3/6/9** of the 0–12 scale) | sev < 3 (healthy) | sev < 6 (incipient) | sev < 9 (developed) | sev ≥ 9 (severe) |
| **RUL fraction** `frac = RUL / life` (`rulPriority`, line 108) | frac ≥ 0.5 | frac < 0.5 | frac < 0.2 | frac < 0.05 |

**Escalation to `trip`** happens only when the three worst indicators agree: `state = severe` **AND** `zone = D`
**AND** `rulPriority = alarm` (`recommend.ts:113`). The **honest disagreement** flag fires when the broadband ISO
screen looks calm (Zone A or B) but the envelope confirms a real fault with `sev ≥ 6` (`recommend.ts:116`) — the fault
energy lives in the high-frequency resonance, **outside** the 10–1000 Hz ISO band, so the engine surfaces the
mismatch and trusts the envelope, which is exactly why envelope analysis exists. The decision exports as structured
JSON, a Markdown report, or a printable PDF (the deliverable attached to the work order).

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

## Model 2 — Particle Filter (Bayesian state estimation)

**LIVE (browser):** `frontend/src/dsp/pf_rul.ts` — pure TypeScript, no training.
**PIPELINE (offline):** `data-pipeline/rotorlab/model/pf_rul.py` — numpy, vectorised SIR.

A sequential-importance-resampling (SIR) particle filter over the exponential degradation model `HI(t)=a·exp(b·t)`.
Each of 500 particles carries a pair `(ln a, b)`; as each new HI observation arrives, particles are reweighted by
log-likelihood and, when the effective sample size drops below 250, resampled via **systematic resampling**
(Arulampalam et al. 2002, low-variance O(N)) with Gaussian jitter regularisation to avoid sample impoverishment.
The RUL distribution is the ensemble of per-particle first-passage times — giving not just a point estimate but the
full posterior: median, 10th/90th percentiles, and the raw particle cloud for histogram visualisation.

References: An, Kim & Choi (2013), doi:10.1016/j.ress.2012.09.011; Orchard & Vachtsevanos (2009),
doi:10.1177/0142331208093993; Arulampalam et al. (2002), doi:10.1109/78.978374.

## Model 3 — Gaussian Process (non-parametric Bayesian regression)

**LIVE (browser):** `frontend/src/dsp/gp_rul.ts` — pure TypeScript, RBF kernel, Cholesky decomposition, grid-search.
**PIPELINE (offline):** `data-pipeline/rotorlab/model/gp_rul.py` — scikit-learn `GaussianProcessRegressor`,
composite RBF+Matern(ν=2.5)+WhiteKernel, L-BFGS-B hyper-parameter optimisation with 5 restarts.

A GP is placed on `log(HI) ~ GP(0, k(t, t'))` and the posterior predictive distribution is projected forward.
The pipeline version uses scikit-learn's mature implementation (Pedregosa et al. 2011) with a composite kernel:
the RBF captures smooth exponential growth, the Matérn 5/2 captures rougher deviations (once-differentiable), and
a WhiteKernel models observation noise — all three variance and length-scale parameters are learned from the data
via the log marginal likelihood. The RUL is the first-passage time of the predictive mean to the failure threshold.

The frontend version implements the same RBF kernel + Cholesky solver in TypeScript, with a coarse grid search
for hyper‑parameters — good enough for the 5–20 post-onset points typical of bearing prognostics, and dependency‑free
in the browser.

References: Rasmussen & Williams (2006), ISBN 0-262-18253-X; Liu et al. (2020), doi:10.1016/j.ymssp.2020.106870;
Pedregosa et al. (2011), JMLR 12:2825–2830.

## Model 4 — Deep-RUL CNN (learned, offline training → ONNX → live inference)

**PIPELINE (offline):** `data-pipeline/rotorlab/model/deep_rul.py` — PyTorch, WDCNN backbone, regression head.
Training stage: `data-pipeline/rotorlab/stages/train_rul.py` — reads XJTU-SY + FEMTO life-snapshot frames,
trains on life-fraction regression, exports `deep_rul.onnx`.
**LIVE (browser):** `frontend/src/lib/ort.ts::deepRul()` — `onnxruntime-web`, WASM EP, single-threaded.

A 1-D convolutional neural network with the same backbone as the WDCNN diagnosis model (Zhang et al. 2017): five
Conv1d→BatchNorm→ReLU→MaxPool blocks, the first with a wide kernel (64 samples at stride 16) to capture
long-period degradation signatures. A regression head (Flatten→100→Dropout→1→Sigmoid) outputs the life fraction
[0,1]. Trained on ~112 labelled snapshots from XJTU-SY and FEMTO/PRONOSTIA run-to-failure bearings, exported to
ONNX (opset 16, `(1,1,2048)→scalar`), and loaded in the browser by the same `onnxruntime-web` pipeline that
already serves the WDCNN and deep-AE classifiers. The model architecture follows the deep-RUL CNN of Li, Ding &
Sun (2018) and the multi-scale variant of Zhu, Chen & Peng (2019).

References: Li, Ding & Sun (2018), doi:10.1016/j.ress.2017.11.008; Zhu, Chen & Peng (2019),
doi:10.1016/j.measurement.2019.06.040; Zhang et al. (2017), Sensors 17(2):425.

## Model ladder summary (all four in both lanes)

| Model | Frontend (live) | Pipeline (offline) | Framework (pipeline) | Training needed |
|---|---|---|---|---|
| Exponential | `health.ts::projectRUL` | `evaluate_rul.py::_exponential_rul` | numpy OLS | No |
| Particle Filter | `pf_rul.ts` | `pf_rul.py` | numpy (vectorised SIR) | No |
| Gaussian Process | `gp_rul.ts` | `gp_rul.py` | sklearn.GaussianProcessRegressor (RBF+Matern+White) | No |
| Deep-RUL CNN | `ort.ts::deepRul()` (ONNX) | `deep_rul.py` + `train_rul.py` | PyTorch → ONNX | Yes (offline) |

## Honest reading

A ladder of four prognostic models from transparent closed-form to SOTA learned. The classical exponential is
the bottom rung — transparent, structural honesty (no onset → no number, `b ≤ 0` → no number, band widens).
The particle filter buys a full posterior distribution at the cost of particle resampling. The Gaussian
Process buys calibrated uncertainty bands with a composite kernel, at the cost of the O(n³) Cholesky (negligible
for the ~5–20 post-onset points typical of bearings). The deep-RUL CNN buys features learned directly from raw
vibration at the cost of offline training and an ONNX artifact. All methods and the ISO severity zones are exact
and transferable; the absolute severity/hours in the demos are synthetic and labelled.
