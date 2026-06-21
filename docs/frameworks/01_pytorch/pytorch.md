# PyTorch (`torch==2.12.1`, CPU)

**What:** the deep-learning framework that trains the two learned models and exports them to ONNX.
**Why binding:** the WDCNN (1-D CNN) and the deep-AE are the learned tier; `torch.onnx.export` is the bridge to the
live browser lane. CWRU training is CPU-fast (25-ep WDCNN + 150-ep AE over a few thousand 2048-windows), so the CPU
build is used — no GPU required.

**Lane:** offline only (`stages/{train,infer,evaluate,export}.py`). Never shipped to the browser.

## Install

```
pip install torch==2.12.1 --index-url https://download.pytorch.org/whl/cpu
```
(or `./scripts/setup.sh --precompute`, which installs it + the rest of `requirements-precompute.txt`).

## Usage

```
./scripts/fetch-data.sh                 # stage data/raw/cwru (link-only)
./scripts/precompute.sh all --retrain   # preprocess → train → infer → evaluate → export ONNX
```

`train.run` seeds `torch.manual_seed(0)`; `export.export_models` calls `torch.onnx.export(..., opset_version=17,
dynamo=False, dynamic_axes={0:'n'})` for both models.

## Applying to other data

Any vibration recording that passes Contract 1 (12 kHz / 48 kHz drive-end, one of the four fault classes) can join
the training set — add it to `io/fetch_cwru.FILES` (or a new loader) and re-run `--retrain`. The model input is a
z-scored 2048-sample window at 12 kHz; nothing about the architecture is CWRU-specific.
