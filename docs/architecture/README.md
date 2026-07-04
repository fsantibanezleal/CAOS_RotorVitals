# Architecture

How RotorVitals is shaped as a CAOS product-repo (ADR-0057). The science core is real and SOTA-pinned; the base
around it is the frozen archetype, instantiated here.

| # | Doc | What |
|---|---|---|
| 01 | [overview](01_overview.md) | the repo at a glance, lanes, packages, data flow |
| 02 | [determinism-and-trace](02_determinism-and-trace.md) | seeded determinism; the compact replay trace |
| 03 | [the-gate](03_the-gate.md) | the measured live-vs-precompute lane gate (client-side TS + ONNX) |
| 04 | [the-live-lane](04_the-live-lane.md) | onnxruntime-web + the TS DSP chain in the browser |
| 05 | [precompute-pipeline](05_precompute-pipeline.md) | the named offline stages (preprocess → … → export) |
| 06 | [model-evaluation](06_model-evaluation.md) | the leakage-safe held-out protocol + the SNR curve + the AE threshold |
| 07 | [deploy](07_deploy.md) | GitHub Pages static deterministic-replay |
| 08 | [data-contracts](08_data-contracts.md) | Contract 1 (ingestion) + Contract 2 (artifact) |
| 09 | [leakage-demo](09_leakage-demo.md) | the window-overlap leakage demo (T15), honest decomposition (isolated leak vs load penalty) |
