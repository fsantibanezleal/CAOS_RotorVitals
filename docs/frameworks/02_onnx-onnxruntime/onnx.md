# ONNX / onnxruntime / onnxruntime-web

**What:** the portable model format (`onnx==1.22.0`) + the runtimes — `onnxruntime==1.27.0` (offline parity checks)
and `onnxruntime-web^1.27.0` (the live in-browser inference).
**Why binding:** ONNX is the contract between the heavy torch training lane and the light client-side lane. The
exported `wdcnn.onnx` (input `x:[N,1,2048] → logits:[N,4]`) and `rv-ae.onnx` (input `x:[N,64] → xr:[N,64]`) are
small (242 KB + 20 KB) and committed under `data/derived/models/`.

**Lane:** offline export (torch) + live inference (browser).

## The version pin (load-bearing)

`frontend/src/lib/ort.ts` pins both the npm package **and** the WASM CDN to the **same** version:
```ts
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;   // Pages has no COOP/COEP for threaded WASM
```
A drift between the npm version and the `wasmPaths` CDN silently breaks the JS/WASM contract → no prediction. The
export opset (17) is compatible with onnxruntime-web 1.27.0.

## Usage

Offline export is part of `--retrain` (see the PyTorch card). Live:
```ts
const logits = await wdcnnLogits(window2048);   // 4 class logits
const xr = await aeReconstruct(feat64);         // reconstruction → MSE = HI
```
Runs are serialized per model (a promise lock) to avoid "Session already started".

## Applying to other data

The same ONNX runs on any conforming 2048-window / 64-D feature. To diagnose a new recording live, window + z-score
it to 12 kHz and compute the 64-D `spectral_feat`; the browser path then matches the offline evaluation.
