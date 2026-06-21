"""WDCNN — a 1-D deep CNN with a WIDE first-layer kernel (Zhang et al. 2017, Sensors 17(2):425), supervised
4-class bearing-fault diagnosis (normal / outer / inner / ball) on a raw 2048-sample window. Requires torch
(the heavy precompute lane only); the deployed live lane runs the EXPORTED ONNX in onnxruntime-web, not this."""
from __future__ import annotations

import torch.nn as nn


class WDCNN(nn.Module):
    """Input (N,1,2048) -> 4 logits."""

    def __init__(self, n_cls: int = 4):
        super().__init__()

        def blk(ci, co, k, s, p):
            return nn.Sequential(nn.Conv1d(ci, co, k, s, p), nn.BatchNorm1d(co), nn.ReLU(), nn.MaxPool1d(2))

        self.f = nn.Sequential(
            blk(1, 16, 64, 16, 24),   # wide first-layer kernel
            blk(16, 32, 3, 1, 1),
            blk(32, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
        )
        # 2048 -> (wide-conv+pool) 64 -> 32 -> 16 -> 8 -> 4 ; 64 channels x 4 = 256
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(64 * 4, 100), nn.ReLU(), nn.Linear(100, n_cls))

    def forward(self, x):
        return self.head(self.f(x))
