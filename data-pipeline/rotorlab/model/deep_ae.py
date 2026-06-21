"""Deep autoencoder health indicator (González-Muñiz et al. 2022, Reliab. Eng. Syst. Saf. 224:108482). Trained on
HEALTHY windows only; its reconstruction error over a 64-D spectral feature is the novelty / health indicator — a
faulty window reconstructs poorly -> high HI. Requires torch (the heavy precompute lane); the deployed live lane
runs the EXPORTED ONNX in onnxruntime-web."""
from __future__ import annotations

import torch.nn as nn


class AE(nn.Module):
    """Deep autoencoder over a 64-D engineered window summary -> reconstruction-error HI."""

    def __init__(self, d_in: int = 64, d: int = 8):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(d_in, 32), nn.ReLU(), nn.Linear(32, d))
        self.dec = nn.Sequential(nn.Linear(d, 32), nn.ReLU(), nn.Linear(32, d_in))

    def forward(self, x):
        return self.dec(self.enc(x))
