# data-pipeline/ — the offline engine (`rotorlab`)

The staged, seeded, contract-bounded offline pipeline for RotorVitals (ADR-0057). Install editable from the repo
root (`pip install -e .`); run with `python -m rotorlab.pipeline`.

```
rotorlab/
├─ __init__.py            # __version__ = "0.25.000"
├─ pipeline.py            # orchestrator + CLI (light replay by default; --retrain runs the heavy lane)
├─ registry.py            # cases grouped by CATEGORY
├─ live.py                # Pyodide live-lane entrypoint — DORMANT (RotorVitals' live lane is TS + onnxruntime-web)
├─ io/
│  ├─ contract.py         # CONTRACT 1: vibration-record schema + outlier policy + raw-signal guard
│  ├─ schema.py           # typed inter-stage objects (VibrationRecord, WindowTable, DiagnosisResult)
│  ├─ formats.py          # standard readers/writers (CSV in, compact JSON out)
│  └─ fetch_cwru.py       # link-only CWRU downloader (staged into data/raw/cwru, git-ignored)
├─ core/
│  ├─ rng.py              # seed → determinism (the single RNG factory)
│  ├─ trace.py            # CONTRACT 2 compact per-case replay trace (rotorvitals.trace/v1)
│  ├─ manifest.py         # CONTRACT 2 manifest + index (rotorvitals.manifest/v2)
│  └─ gate.py             # the live-vs-precompute lane gate (client-side TS + onnxruntime-web)
├─ model/                 # the real science core
│  ├─ wdcnn.py            # WDCNN 1-D CNN (Zhang 2017) — torch
│  ├─ deep_ae.py          # deep-AE health indicator (González-Muñiz 2022) — torch
│  ├─ features.py         # 64-D spectral feature + windowing — numpy
│  └─ classical.py        # unsupervised envelope/SES/kurtogram baseline (Randall & Antoni 2011) — numpy + scipy
└─ stages/                # the named staged pipeline (preprocess → … → export)
   preprocess · feature_extraction · train · infer · evaluate · export
```

**Two lanes:**

* **Default (light, numpy-only)** — `python -m rotorlab.pipeline all` rebuilds every per-case replay trace +
  manifest from the committed real artifacts in `data/derived/`. No torch, no CWRU download — a clone replays.
* **Heavy (`--retrain`)** — `pipeline all --retrain` regenerates `wdcnn.onnx`, `rv-ae.onnx`,
  `rv-cwru-samples.json`, `rv-learned-metrics.json`, and `cwru-benchmark.json` from `data/raw/cwru/` (needs the
  `--precompute` setup: torch + scipy + onnx). See `docs/guides/01_precompute-pipeline.md`.
