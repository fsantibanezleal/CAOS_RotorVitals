# 05, The staged precompute pipeline

**The science/algorithm flow**, real CWRU → windows → classical envelope/SES + WDCNN + deep-AE → held-out metrics → ONNX:

![The science flow, raw CWRU → contract gate → classical SES + WDCNN + deep-AE training → held-out eval → ONNX export](../diagrams/04-the-science.svg)

`data-pipeline/rotorlab/stages/`, six named, seeded, typed stages with an explicit input→output contract. Frozen
names; the bodies are the real CWRU science (split out of the original `train_models.py` + `cwru-benchmark/run.py`).

| Stage | What it does | Deps | Skippable? |
|---|---|---|---|
| `preprocess` | Contract 1 over the file descriptors; load DE channel; decimate 48→12 kHz; z-scored 2048/1024 windows; **leakage-safe split: hold out the entire 3 HP load** | numpy + scipy | no |
| `feature_extraction` | the 64-D log-binned magnitude-spectrum summary per window (the deep-AE input) | numpy | no |
| `train` | fit the **WDCNN** (Adam 1e-3, wd 1e-4, 25 ep, CE) + the **deep-AE** (Adam 1e-3, 150 ep, MSE on the all-load healthy baseline) | torch | **yes**, reuse the committed ONNX if present |
| `infer` | WDCNN argmax + AE reconstruction MSE over the held-out windows (the offline mirror of the browser path) | torch | no (cheap) |
| `evaluate` | held-out accuracy + 4×4 confusion + per-class recall + the **SNR-robustness curve**; the AE p99 threshold + fault-vs-healthy AUC + held-out healthy false-flag rate; the unsupervised **classical benchmark** | torch + scipy | no |
| `export` | Contract 2: write `wdcnn.onnx`/`rv-ae.onnx` (opset 17, dynamic batch) + the held-out samples + the metrics JSON; then build the per-case replay traces + manifests + index | torch (models) / numpy (replay) | replay path always runs |

`pipeline.py` orchestrates them. The **default** invocation only runs the light replay path (`export.build_replay`)
over the committed artifacts; `--retrain` runs the heavy stages first. The two paths share the `export` module so
the Contract-2 trace/manifest shapes are produced in exactly one place.

## Determinism levers

`torch.manual_seed(0); np.random.seed(0)` (training); `RandomState(7)` (SNR noise); `RandomState(1)` (sample
selection). A `--retrain` from a clean `data/raw/cwru/` reproduces the committed ONNX + metrics from the seed.
