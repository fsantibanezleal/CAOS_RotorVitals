"""DeepRUL — a 1-D CNN for bearing remaining-useful-life (RUL) regression on raw vibration windows.

Architecture follows the WDCNN backbone (wide first-layer kernel, Zhang et al. 2017, Sensors 17(2):425)
with a regression head replacing the classification head. Input: (N,1,2048) raw vibration window.
Output: scalar RUL (hours) normalised to [0,1].

Training uses the XJTU-SY and FEMTO/PRONOSTIA run-to-failure bearings; each trajectory contributes
~8 evenly-spaced life snapshots (healthy → failure), each with its ground-truth life fraction (0..1),
giving a dense regression signal. Training is offline (torch); the EXPORTED ONNX runs live in
onnxruntime-web (cf. the WDCNN's frontend/src/lib/ort.ts loader).

References:
    Li, Ding & Sun (2018), "Remaining useful life estimation in prognostics using deep convolution
      neural networks", Reliability Eng. & System Safety 172:1–11. DOI 10.1016/j.ress.2017.11.008
    Zhang, Peng, Li, Chen, Zhang & Wang (2017), "A deep convolutional neural network with wide
      first-layer kernels for bearing fault diagnosis", Sensors 17(2):425.
    Zhu, Chen & Peng (2019), "Estimation of bearing RUL based on multi-scale CNN and LSTM",
      Measurement 149:106913. DOI 10.1016/j.measurement.2019.06.040
"""

from __future__ import annotations

import torch
import torch.nn as nn


class DeepRUL(nn.Module):
    """1-D CNN → regression head. Input (N,1,2048) → scalar RUL fraction [0,1]."""

    def __init__(self) -> None:
        super().__init__()

        def blk(ci: int, co: int, k: int, s: int, p: int) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv1d(ci, co, k, s, p), nn.BatchNorm1d(co), nn.ReLU(), nn.MaxPool1d(2),
            )

        # Same backbone as WDCNN — wide first kernel captures long-period degradation signatures
        self.features = nn.Sequential(
            blk(1, 16, 64, 16, 24),
            blk(16, 32, 3, 1, 1),
            blk(32, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
        )
        # 2048 → conv+pool layers: 64 → 32 → 16 → 8 → 4 time steps; 64 channels × 4 = 256
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 4, 100),
            nn.ReLU(),
            nn.Dropout(0.35),
            nn.Linear(100, 1),
            nn.Sigmoid(),  # [0,1] RUL fraction
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.features(x))


def train_deep_rul(
    model: DeepRUL,
    train_loader: torch.utils.data.DataLoader,
    val_loader: torch.utils.data.DataLoader | None,
    epochs: int = 120,
    lr: float = 1e-3,
    device: str = "cpu",
) -> dict:
    """Train the DeepRUL model with MSE loss. Returns a summary dict with final train/val loss."""
    model = model.to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5, patience=10)
    criterion = nn.MSELoss()

    best_val = float("inf")
    history: dict = {"train_loss": [], "val_loss": []}

    for ep in range(1, epochs + 1):
        model.train()
        tr_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device).float().view(-1, 1)
            opt.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            opt.step()
            tr_loss += loss.item() * len(xb)
        tr_loss /= len(train_loader.dataset)
        history["train_loss"].append(tr_loss)

        vl_loss = 0.0
        if val_loader is not None:
            model.eval()
            with torch.no_grad():
                for xb, yb in val_loader:
                    xb, yb = xb.to(device), yb.to(device).float().view(-1, 1)
                    vl_loss += criterion(model(xb), yb).item() * len(xb)
                vl_loss /= len(val_loader.dataset)
            history["val_loss"].append(vl_loss)
            scheduler.step(vl_loss)
            if vl_loss < best_val:
                best_val = vl_loss
    return {"best_val_loss": best_val if val_loader else None, "final_train_loss": tr_loss, "epochs": epochs}


def export_onnx(model: DeepRUL, path: str, device: str = "cpu") -> None:
    """Export the trained model to ONNX (opset 14) for onnxruntime-web. Input: (1,1,2048)."""
    model.eval()
    dummy = torch.randn(1, 1, 2048).to(device)
    torch.onnx.export(
        model.to(device), dummy, path, opset_version=14,
        input_names=["vibration"], output_names=["rul"],
        dynamic_axes={"vibration": {0: "batch"}, "rul": {0: "batch"}},
        dynamo=False,
    )
