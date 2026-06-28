# RotorVitals — rotating-machinery condition monitoring & prognostics

> A real, in-browser bearing/rotating-machinery diagnosis & prognostics workbench: pick a real held-out CWRU
> recording and a trained **WDCNN** + **deep-autoencoder** run **live** to diagnose it, alongside the full
> classical signal-processing chain (envelope/SES, spectral kurtosis & kurtogram, cyclostationary CMS, Campbell/
> order, ISO severity, RUL). Part of the **[Faena](https://faena.fasl-work.com)** mining-analytics hub.

Live: **https://rotorvitals.fasl-work.com**

## What it is

The condition-monitoring lane for rotating machinery (bearings first). It pairs **two heavy learned models**
trained on the real **Case Western Reserve University** 12 kHz drive-end bearing data with a deep classical DSP
toolbox, in one interactive workbench. The user has real action capability: load a real measured artifact and
analyse it live, or drive the synthetic signal generator + the classical chain with the sidebar controls.

## The six pages

- **App** — a **first-level source selector** decides what the whole workbench operates on, and the tool set
  reacts to the kind of data loaded:
  - **Synthetic** — the full signal generator: every scenario knob (fault, severity, rpm, SNR) and every one of
    the 13 tools, to explore the space.
  - **Real: segment (diagnosis)** — a measured segment from **CWRU** (12 kHz, the WDCNN's native domain),
    **Ottawa** (time-varying speed, computed-**order-tracked** → defect frequencies are constant orders) or
    **MaFaulDa** (50 kHz; outer/ball/cage). The signal-analysis tools run on the measured window; the **WDCNN (ONNX)**
    runs live — in-domain on CWRU, cross-domain on Ottawa/MaFaulDa (labelled, the honest domain-gap test). Scenario
    knobs become read-only metadata; the analysis knobs stay live — you really can re-process real data.
  - **Real: RUL (prognosis)** — a real run-to-failure trajectory from **FEMTO/PRONOSTIA, XJTU-SY or IMS** (23 total).
    A life-instant slider scrubs ~8 measured raw windows (healthy→failure): the full signal suite runs on each
    instant, the **3D waterfall is the real degradation surface**, the **feature space is the measured degradation
    trajectory**, and `projectRUL` runs on the HI(t) curve against the experiment's true failure time.
- **Introduction** — problem, who it's for, approach, honest scope.
- **Methodology** — term-by-term math per family (band selection, envelope, kurtosis, cyclostationarity, RUL,
  learned tier) with SVG figures + DOI refs.
- **Implementation** — the two-lane architecture (offline precompute → committed artifacts; live in-browser DSP +
  ONNX inference).
- **Experiments** — design, leakage-safe protocol, coverage, results.
- **Benchmark** — **learned-vs-classical on held-out real CWRU**: WDCNN vs envelope/SES, the noise-robustness
  curve, the deep-AE one-class metrics, and the classical per-band confusion matrices. Real numbers only.

## Architecture

Instantiated from the CAOS product-repo archetype (ADR-0057): a heavy **offline engine** + a **frontend SPA**, bound
by two data contracts. See [`STRUCTURE.md`](STRUCTURE.md) and the [`docs/`](docs/README.md) wiki.

```
OFFLINE  data-pipeline/rotorlab/ (torch+scipy)     LIVE  frontend/src/ (browser, TypeScript)
  stages/  preprocess→…→export                        dsp/      classical chain (FFT/envelope/kurtogram/CMS/…)
  model/   WDCNN + deep-AE + classical                lib/ort.ts onnxruntime-web → WDCNN + deep-AE inference
        │  --retrain regenerates the artifacts         viz/      uPlot / three.js visualization
        ▼
  data/derived/  models/wdcnn.onnx · rv-ae.onnx · rv-cwru-samples.json · rv-learned-metrics.json · cwru-benchmark.json
        │  (the committed compact artifacts = the heavy lane's real outputs)
        ▼
  pipeline (numpy) → data/derived/<case>/trace.json + manifests/  (Contract 2; copy-data overlays into frontend/public)
```

No application server, no database — static files on a CDN; all numerical work is either precomputed into compact
committed artifacts or runs live in the browser on one bounded signal segment. The default pipeline is **numpy-only**
(rebuilds the replay layer from the committed artifacts), so a clone replays without torch or a CWRU download.

## Develop

```bash
./scripts/setup.sh            # venvs + light deps + editable pkg (numpy+ruff+pytest)   [.ps1 on Windows]
./scripts/precompute.sh       # python -m rotorlab.pipeline all  (rebuild the replay layer, numpy-only)
.venv-pipeline/bin/python -m pytest    # 10 passed     ·     ./scripts/smoke.sh   # CONTRACT 2 OK
./scripts/dev.sh              # cd frontend && npm install && npm run dev (vite + live ONNX)
cd frontend && npm run build  # tsc --noEmit && vite build (+ copy-data overlay + SPA 404.html)

# regenerate the models from the real CWRU data (local-only, torch+scipy):
./scripts/setup.sh --precompute && ./scripts/fetch-data.sh && ./scripts/precompute.sh all --retrain
```

## Honesty

The learned models are trained on **real CWRU recordings**; the held-out split holds out an entire load (3 HP) so
no test recording is seen in training. CWRU is a clean lab rig (Smith & Randall 2015), so clean accuracy is
optimistic — Benchmark reports the **noise-robustness curve**, not a bare 100%. The synthetic source's demo signal
(a damped-resonance impulse train) and its run-to-failure trend are **labelled synthetic**; the real sources are
**measured data** — CWRU segments for diagnosis, and FEMTO/XJTU/IMS run-to-failure curves for prognosis, each
reduced offline to a compact artifact with the dataset's real first-passage failure time (raw archives are
link-only, gitignored). The kinematic fault frequencies and all DSP outputs are exact. No fabricated numbers.

## License

Source-available for review. © Felipe Santibáñez-Leal · part of [Faena](https://faena.fasl-work.com).
