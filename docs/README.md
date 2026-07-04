# RotorVitals, documentation wiki

The navigable wiki for RotorVitals (ADR-0056), authored as the product is built. RotorVitals is a public,
didactic **rotating-machinery condition-monitoring + prognostics studio**: it diagnoses rolling-element bearing
faults from vibration with a real learned tier (a WDCNN classifier + a deep-autoencoder health indicator, trained
on the **real CWRU** data) and a classical envelope/SES tier, and projects remaining useful life, all running
**live in the browser**.

## What it is / what it is NOT

* **Is:** a real application, a first-level source selector drives the whole workbench: pick a held-out real
  CWRU segment (or a real Ottawa/MaFaulDa segment, cross-domain) and the trained WDCNN + deep-AE run live
  (onnxruntime-web) to diagnose it, or pick a real FEMTO/XJTU-SY/IMS run-to-failure trajectory and the prognosis
  suite runs on measured life-frames; a full classical DSP chain (envelope/SES, kurtogram, cepstrum, Campbell,
  cyclostationary, ISO severity) on real or labelled-synthetic signals; an honest SNR-robustness curve and a
  leakage-safe held-out benchmark.
* **Is NOT:** a certified protection system. The clean CWRU lab rig makes raw accuracy optimistic (the honest
  deliverable is the SNR curve); the synthetic generator's scenarios and its run-to-failure trend are **labelled
  synthetic**, while the real tier spans seven measured sets, CWRU (trained benchmark), MFPT (cross-dataset eval),
  Ottawa + MaFaulDa (real diagnosis segments), FEMTO + XJTU-SY + IMS (real run-to-failure trajectories, 23 with a
  real first-passage failure); Paderborn and a gear rig remain roadmap; the offline RUL aggregate benchmark is
  **under re-evaluation** (degenerate protocol withdrawn, issue #128); CWRU reuses one physical bearing across
  loads, so the leakage-safe split holds out an entire **load**, not a bearing.

## Map

| Folder | What it answers |
|---|---|
| [`architecture/`](architecture/README.md) | how the repo is shaped: the two data contracts, the staged offline pipeline, the lane gate, determinism, model evaluation, deploy |
| [`frameworks/`](frameworks/README.md) | the binding research engines (PyTorch, ONNX/onnxruntime(-web), SciPy, NumPy) + the method cards (WDCNN, deep-AE, classical envelope/SES) |
| [`cases/`](cases/README.md) | the case taxonomy by category + the coverage matrix + the real-vs-synthetic + roadmap honesty |
| [`guides/`](guides/README.md) | run the pipeline, bring your own vibration data, regenerate the models |
| [`../data/README.md`](../data/README.md) | the data contract (Contract 1 schema + outlier policy; Contract 2 artifact layout) |

## The three lanes (at a glance)

1. **Offline (precompute, heavy)**, torch + scipy train the WDCNN + deep-AE on the real CWRU data and export ONNX.
   Local-only (`--retrain`); the outputs are committed under `data/derived/`.
2. **Live (client-side)**, onnxruntime-web runs the exported ONNX + a TypeScript DSP chain, entirely in the
   browser. This is the real action capability.
3. **Replay (static)**, the committed per-case traces + metrics, served from GitHub Pages; the default
   (numpy-only) pipeline rebuilds them from the committed artifacts.
