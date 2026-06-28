"""Deep-HI & Deep-RUL — CNN-BiLSTM hybrid for bearing degradation modelling.

Architecture (SOTA 2023-2024): a shared 1D CNN backbone extracts spatial features from
each raw vibration window; a BiLSTM models the temporal degradation sequence; two output
heads produce either a sequence of HI values (Deep-HI) or a scalar RUL (Deep-RUL).

References:
    Muthukumar & Philip (2024), "CNN-LSTM Hybrid Deep Learning Model for RUL Estimation"
    Yang et al. (2024), "PSO-CNN-BiLSTM-MHSA for bearing RUL prediction", Electronics
    Guo et al. (2023), "1DCNN-ON-LSTM for bearing RUL prediction", Meas. Sci. Technol.
    Li et al. (2024), "CNN-Bi-LSTM Domain Adaptation for bearing RUL", Sensors
"""

from __future__ import annotations

import torch
import torch.nn as nn


class CnnFeatureExtractor(nn.Module):
    """Lightweight 1D CNN — shared across time steps. Same family as WDCNN but fewer
    channels (16→32→64→64→64) to keep the ONNX small for browser inference."""

    def __init__(self) -> None:
        super().__init__()

        def blk(ci: int, co: int, k: int, s: int, p: int) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv1d(ci, co, k, s, p), nn.BatchNorm1d(co), nn.ReLU(), nn.MaxPool1d(2),
            )

        self.net = nn.Sequential(
            blk(1, 16, 64, 16, 24),   # 2048 → 128
            blk(16, 32, 3, 1, 1),     # 128 → 64
            blk(32, 64, 3, 1, 1),     # 64 → 32
            blk(64, 64, 3, 1, 1),     # 32 → 16
            blk(64, 64, 3, 1, 1),     # 16 → 8
        )
        # output: (batch, 64, 4) → flattened to (batch, 256)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, channels=1, samples=2048)
        return self.net(x)  # (batch, 64, 8)


class DeepHIRUL(nn.Module):
    """CNN-BiLSTM for bearing degradation sequence modelling.

    Input:  (batch, seq_len, 1, 2048) — a trajectory of raw vibration windows
    Output: two heads —
        hi:   (batch, seq_len)         — predicted HI value at each time step
        rul:  (batch,)                 — predicted RUL (scalar, normalised)
    """

    def __init__(self, cnn_out_dim: int = 256, lstm_hidden: int = 128,
                 lstm_layers: int = 2, dropout: float = 0.3) -> None:
        super().__init__()
        self.cnn = CnnFeatureExtractor()
        self.lstm = nn.LSTM(
            input_size=cnn_out_dim, hidden_size=lstm_hidden,
            num_layers=lstm_layers, batch_first=True,
            bidirectional=True, dropout=dropout if lstm_layers > 1 else 0.0,
        )
        lstm_out = lstm_hidden * 2  # bidirectional
        self.hi_head = nn.Sequential(nn.Linear(lstm_out, 64), nn.ReLU(), nn.Linear(64, 1))
        self.rul_head = nn.Sequential(
            nn.Linear(lstm_out, 64), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, 1), nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        """x: (batch, seq_len, 1, 2048)"""
        B, S, C, L = x.shape
        # CNN over each time step (flatten batch×seq for parallel conv)
        x_flat = x.view(B * S, C, L)         # (B*S, 1, 2048)
        feats = self.cnn(x_flat)              # (B*S, 64, 8)
        feats = feats.view(B * S, -1)         # (B*S, 512)
        feats = feats.view(B, S, -1)          # (B, S, 512)
        # BiLSTM over the sequence
        lstm_out, _ = self.lstm(feats)        # (B, S, 2*hidden)
        # heads
        hi = self.hi_head(lstm_out).squeeze(-1)   # (B, S)
        rul = self.rul_head(lstm_out[:, -1, :]).squeeze(-1)  # (B,) — last time step
        return {"hi": hi, "rul": rul}


def export_onnx(model: DeepHIRUL, path: str, seq_len: int = 8, device: str = "cpu") -> None:
    """Export the trained model to ONNX (opset 14) for onnxruntime-web.
    Input: (1, seq_len, 1, 2048). Outputs: hi (1, seq_len), rul (1)."""
    model.eval()
    dummy = torch.randn(1, seq_len, 1, 2048).to(device)
    torch.onnx.export(
        model.to(device), dummy, path,
        opset_version=14,
        input_names=["vibration_seq"],
        output_names=["hi", "rul"],
        dynamic_axes={
            "vibration_seq": {0: "batch", 1: "seq_len"},
            "hi": {0: "batch", 1: "seq_len"},
            "rul": {0: "batch"},
        },
        dynamo=False,
    )
