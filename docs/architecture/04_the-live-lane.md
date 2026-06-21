# 04 — The live lane (client-side)

RotorVitals' live lane is **TypeScript + onnxruntime-web**, not Pyodide. The archetype permits either ("Pyodide +
lightweight wheels, OR a small TS engine") — RotorVitals uses the same exported models the offline lane trained, so
the live lane is faithful, not a toy surrogate.

## Inference (`frontend/src/lib/ort.ts`)

```ts
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;   // GitHub Pages has no COOP/COEP for threaded WASM
```

* `wdcnnLogits(window2048)` → 4 class logits (the WDCNN).
* `aeReconstruct(feat64)` → the reconstruction (the caller computes the MSE = health indicator).

Runs are **serialized per model** (a per-model promise lock) so concurrent calls don't trip "Session already
started". The ONNX version (`onnxruntime-web@1.27.0`) and the `wasmPaths` CDN are pinned to the **same** version —
a drift would silently break the WASM/JS contract.

## DSP (`frontend/src/dsp/`)

The classical chain (envelope/SES, kurtogram, cepstrum, Campbell, cyclostationary `csc`, infogram, ISO severity,
prognostics) is pure TypeScript, reproducing the offline numerics. The deep-AE input is the same 64-D log-binned
magnitude-spectrum summary the offline `model/features.py::spectral_feat` computes, standardized by the scaler
shipped in `rv-learned-metrics.json` (`aeScaler.mean/std`) — so the in-browser HI matches the offline evaluation.

## Live-vs-offline parity (the thing to guard)

The browser path must reproduce the offline `evaluate` numbers: softmax over the WDCNN logits, and AE MSE over the
**standardized** 64-D feature. If the browser standardizes differently, the p99 HI threshold is meaningless. The
48 kHz → 12 kHz decimation (offline `scipy.signal.decimate(x, 4, ftype='fir', zero_phase=True)`) must be identical
on both sides — so the live lane consumes only the **already-12-kHz, already-windowed** committed segments; it never
ingests raw 48 kHz in the browser.
