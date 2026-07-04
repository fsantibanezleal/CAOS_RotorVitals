# 01, Regenerate the models (`--retrain`)

The heavy lane reproduces `wdcnn.onnx`, `rv-ae.onnx`, `rv-cwru-samples.json`, `rv-learned-metrics.json`, and
`cwru-benchmark.json` from the **real CWRU** data. Local-only (CI never retrains). Deterministic from the fixed seed.

```bash
# 1) install the heavy SOTA engines (torch CPU + scipy + onnx) into .venv-pipeline
./scripts/setup.sh --precompute        # (PowerShell:  ./scripts/setup.ps1 -Precompute)

# 2) stage the real CWRU recordings into data/raw/cwru (git-ignored, link-only, never re-hosted)
./scripts/fetch-data.sh

# 3) preprocess → train → infer → evaluate → export, then rebuild the replay layer
./scripts/precompute.sh all --retrain
```

What runs (`pipeline.retrain` → `stages/*`): leakage-safe windowing (hold out 3 HP) → 64-D spectral features →
WDCNN (25 ep) + deep-AE (150 ep) → held-out eval + SNR curve + classical benchmark → ONNX/metrics export. Expect
the held-out WDCNN accuracy, the SNR curve, and the AE thresholds to match the committed `rv-learned-metrics.json`
(determinism). Then `git status` should show the regenerated artifacts byte-identical (or the diff IS your change).

> CPU-fast: ~1–2 min on a laptop. No GPU needed (see `docs/frameworks/03_scipy` + `01_pytorch`).
