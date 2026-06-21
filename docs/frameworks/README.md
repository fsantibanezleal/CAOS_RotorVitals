# Frameworks & methods

The research made binding: every engine RotorVitals depends on is pinned (`requirements-precompute.txt` /
`frontend/package.json`) and documented here — no toy substitute. Engine cards cover what/why/install/use; method
cards cover the algorithm + its provenance.

## Engines

| Card | Pin | Lane |
|---|---|---|
| [PyTorch](01_pytorch/pytorch.md) | `torch==2.12.1` (CPU) | offline (train) |
| [ONNX / onnxruntime / onnxruntime-web](02_onnx-onnxruntime/onnx.md) | `onnx==1.22.0`, `onnxruntime==1.27.0`, `onnxruntime-web^1.27.0` | offline export + live inference |
| [SciPy](03_scipy/scipy.md) | `scipy==1.18.0` | offline (decimate, hilbert, loadmat) |
| [NumPy](04_numpy/numpy.md) | `numpy==2.4.6` | both lanes |

## Methods

| Card | Provenance |
|---|---|
| [WDCNN](05_wdcnn/wdcnn.md) | Zhang et al. 2017, Sensors 17(2):425 |
| [Deep-AE health indicator](06_deep-ae/deep-ae.md) | González-Muñiz et al. 2022, RESS 224:108482 |
| [Classical envelope/SES](07_classical-envelope-ses/classical.md) | Randall & Antoni 2011, MSSP 25:485–520; Antoni 2006/2007 (kurtogram); Smith & Randall 2015 |

All 28 DOI-verified references are in `frontend/src/data/citations.ts` and surfaced in the Methodology page.
