# 03, The lane gate

`core/gate.py::classify_lane` is the **measured** decision of whether a case runs live in the browser or is replayed
from a committed artifact (ADR-0054). For RotorVitals the SIR-template's "Pyodide-safe wheels" become **client-side
runtimes**: the live lane is `onnxruntime-web` (the exported WDCNN/deep-AE) + a TypeScript DSP chain (`ts-dsp`).

A case is classified **live** iff:

1. it is **client-side** (no server needed), and
2. its runtimes ⊆ `{ts-dsp, onnxruntime-web}` (the deployed client set), and
3. a single forward pass fits the interaction budget (`run_ms ≤ 1500`), and
4. its replay trace is small (`trace_bytes ≤ 256 KB`).

A single 2048-sample WDCNN forward pass + a 64-D AE pass is **milliseconds**, and the traces reference (not copy)
the segments, so **every** RotorVitals case passes the gate. The verdict + the deterministic budgets are stamped
into each manifest; `scripts/check_artifacts.py` (CI) fails if a manifest's `lane` disagrees with its `gate.lane`.

> Note: the raw measured `run_ms` drives the decision but is **not** stored (it would dirty git on re-run). The live
> runtime is measured separately, in the browser. The gate is a measurement of a real property, never a hand-wave.
