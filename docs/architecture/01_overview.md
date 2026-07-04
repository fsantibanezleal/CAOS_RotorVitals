# 01, Overview

**What the app is**, the live workbench at a glance:

![RotorVitals, a condition-monitoring & prognostics workbench: offline engine → committed artifacts → live SPA](../diagrams/01-the-app.svg)

**The lanes**, what runs WEB (live TS engine + in-browser ONNX inference) vs OFFLINE/COMPUTE (precompute bake + torch training) vs REPLAY (committed artifacts):

![The three lanes, web (live) / offline (precompute + train) / replay (committed artifacts)](../diagrams/02-lanes.svg)

RotorVitals is split into a heavy **offline engine** (`data-pipeline/rotorlab/`) and a **frontend SPA**
(`frontend/`), bound by two data contracts. The committed compact artifacts under `data/derived/` are the offline
engine's real outputs and the SPA's replay payload.

```
raw CWRU .mat ──(Contract 1: io/contract.py)──► windows ──► WDCNN + deep-AE (train, offline, torch)
   (data/raw, git-ignored)                                         │
                                                                   ├─► wdcnn.onnx, rv-ae.onnx        ┐
classical envelope/SES (model/classical.py) ──────────────────────┼─► cwru-benchmark.json           │ data/derived/
held-out eval + SNR curve (stages/evaluate) ──────────────────────┼─► rv-learned-metrics.json       │ (committed)
held-out segments (stages/export) ────────────────────────────────┴─► rv-cwru-samples.json          ┘
                                                                   │
per-case replay (pipeline, numpy) ──(Contract 2: core/manifest.py)─► data/derived/<case>/trace.json + manifests/
                                                                   │
frontend (copy-data.mjs overlays data/derived) ──► onnxruntime-web + TS DSP run LIVE in the browser
```

## Packages

* **`data-pipeline/rotorlab/`**, the offline engine: `io/` (contracts, formats, CWRU fetch), `core/` (rng, trace,
  manifest, gate), `model/` (WDCNN, deep-AE, spectral features, classical chain), `stages/` (the named pipeline),
  `cases/` + `registry.py` (cases by category), `pipeline.py` (orchestrator + CLI), `live.py` (dormant Pyodide).
* **`frontend/`**, the React/Vite SPA: `src/dsp/` (the TS DSP chain), `src/lib/ort.ts` (onnxruntime-web), `src/viz/`
  (the visualizations), `src/pages/` (the 6 standard pages), `src/lib/contract.types.ts` (the Contract-2 mirror).
* **`app/`**, a dormant FastAPI backend (RotorVitals is static-first; no request-time compute).

## The two lanes of the pipeline

* **Default (numpy-only):** `python -m rotorlab.pipeline all` rebuilds every per-case replay trace + manifest from
  the committed artifacts, no torch, no CWRU download. A clone replays immediately; this is what CI + Pages run.
* **Heavy (`--retrain`):** regenerates `wdcnn.onnx`, `rv-ae.onnx`, `rv-cwru-samples.json`, `rv-learned-metrics.json`,
  and `cwru-benchmark.json` from `data/raw/cwru/` (torch + scipy). Local-only; reproducible from a fixed seed.
