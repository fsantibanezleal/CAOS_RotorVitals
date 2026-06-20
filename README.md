# RotorVitals — rotating-machinery condition monitoring & prognostics

> A real, in-browser bearing/rotating-machinery diagnosis & prognostics workbench: pick a real held-out CWRU
> recording and a trained **WDCNN** + **deep-autoencoder** run **live** to diagnose it, alongside the full
> classical signal-processing chain (envelope/SES, spectral kurtosis & kurtogram, cyclostationary CMS, Campbell/
> order, ISO severity, RUL). Part of the **[Faena](https://faena.fasl-work.com)** mining-analytics hub.

Live: **https://rotorvitals.fasl-work.com**

## What it is

The condition-monitoring lane for rotating machinery (bearings first). It pairs **two heavy learned models**
trained on the real **Case Western Reserve University** 12 kHz drive-end bearing data with a deep classical DSP
toolbox, in one interactive workbench. The user has real action capability: choose a real held-out recording and
diagnose it live, or drive the synthetic signal generator + the classical chain with the sidebar controls.

## The six pages

- **App** — control sidebar + tabbed view set. The first tab, **Real diagnosis (WDCNN)**, runs the trained
  models live (onnxruntime-web) on real held-out CWRU segments (prediction vs the true label + per-class probs +
  deep-AE health indicator). The rest are the classical chain (signal & spectrum, envelope·SES, spectrogram,
  cyclostationary CMS, kurtogram, infogram, Campbell/order, 3-D waterfall, prognostics·RUL, RUL eval, ISO trend,
  feature space).
- **Introduction** — problem, who it's for, approach, honest scope.
- **Methodology** — term-by-term math per family (band selection, envelope, kurtosis, cyclostationarity, RUL,
  learned tier) with SVG figures + DOI refs.
- **Implementation** — the two-lane architecture (offline precompute → committed artifacts; live in-browser DSP +
  ONNX inference).
- **Experiments** — design, leakage-safe protocol, coverage, results.
- **Benchmark** — **learned-vs-classical on held-out real CWRU**: WDCNN vs envelope/SES, the noise-robustness
  curve, the deep-AE one-class metrics, and the classical per-band confusion matrices. Real numbers only.

## Architecture

```
OFFLINE (.venv, Python)                          LIVE (browser, TypeScript)
  tools/cwru-benchmark/  real CWRU download         classical DSP chain (FFT/envelope/kurtogram/CMS/…)
  tools/ml/  train WDCNN + deep-AE on real CWRU      onnxruntime-web → WDCNN + deep-AE inference
        │  commit compact artifacts                  uPlot / three.js visualization
        ▼
  public/wdcnn.onnx · rv-ae.onnx · rv-cwru-samples.json · rv-learned-metrics.json · cwru-benchmark.json
```

No application server, no database — static files on a CDN; all numerical work is either precomputed into compact
committed artifacts or runs live in the browser on one bounded signal segment.

## Develop

```bash
npm install
npm run dev       # vite dev server
npm test          # DSP unit tests (node --test)
npm run build     # tsc --noEmit && vite build (+ SPA 404.html)

# the real-data ML pipeline (isolated .venv, never committed):
cd tools/ml && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
python train_models.py      # trains on real CWRU in ../cwru-benchmark/data → public/*.onnx + metrics
```

## Honesty

The learned models are trained on **real CWRU recordings**; the held-out split holds out an entire load (3 HP) so
no test recording is seen in training. CWRU is a clean lab rig (Smith & Randall 2015), so clean accuracy is
optimistic — Benchmark reports the **noise-robustness curve**, not a bare 100%. The classical-chain demo signal (a
damped-resonance impulse train) and the run-to-failure RUL trend are **labelled synthetic**; the kinematic fault
frequencies and the DSP outputs are exact. No fabricated benchmark numbers.

## License

Source-available for review. © Felipe Santibáñez-Leal · part of [Faena](https://faena.fasl-work.com).
