# 03, GPU lane (DORMANT)

This solution does not require a GPU at the moment. RotorVitals' CWRU training is CPU-fast (25-ep WDCNN + 150-ep AE
over a few thousand 2048-windows, ~1–2 min). `requirements-gpu.txt` is a dormant placeholder.

Activate only if a future heavy dataset (e.g. XJTU-SY run-to-failure with long sequences) makes training slow:
install the CUDA torch build, document the pin in `requirements-gpu.txt` + this guide, and keep the CPU path as the
default reproducible lane.
