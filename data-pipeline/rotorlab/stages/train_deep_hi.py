"""Train Deep-HI/RUL (CNN-BiLSTM) on XJTU-SY + FEMTO run-to-failure bearing data.

Each trajectory contributes a sequence of ~8 raw vibration windows (healthy → failure).
The CNN extracts spatial features per window; the BiLSTM models the temporal degradation.
Two heads are trained jointly: HI prediction (MSE) and RUL prediction (MSE on fraction).

Exports: frontend/public/deep_hi.onnx — a single ONNX with both outputs.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from ..model.deep_hi import DeepHIRUL, export_onnx

REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_PUBLIC = REPO_ROOT / "frontend" / "public"
SEQ_LEN = 8


def _load_sequences(path: str) -> list[dict]:
    """Read a frames artifact and return a list of per-trajectory sequences.
    Each sequence: {frames: [(2048,), ...], hi: [float,...], rul_frac: float}"""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    sequences: list[dict] = []
    for _tid, snaps in data.get("frames", {}).items():
        snaps_sorted = sorted(snaps, key=lambda s: s.get("frac", 0))
        if len(snaps_sorted) < 4:
            continue
        # Take up to SEQ_LEN evenly-spaced snaps
        indices = np.linspace(0, len(snaps_sorted) - 1, min(SEQ_LEN, len(snaps_sorted))).astype(int)
        selected = [snaps_sorted[i] for i in indices]
        frames = []
        hi_vals = []
        for s in selected:
            raw = np.array(s["raw"], dtype=np.float32)
            if len(raw) < 2048:
                raw = np.pad(raw, (0, 2048 - len(raw)))
            else:
                raw = raw[:2048]
            # normalise per-window
            mu, sd = raw.mean(), raw.std() or 1e-9
            raw = (raw - mu) / sd
            frames.append(raw)
            hi_vals.append(float(s.get("rms", s.get("hi", 0))))
        sequences.append({
            "frames": np.stack(frames),  # (seq_len, 2048)
            "hi": np.array(hi_vals, dtype=np.float32),
            "rul_frac": 1.0 - float(selected[-1].get("frac", 0)),
        })
    return sequences


def train_deep_hi_stage(xjtu_path: str = "", femto_path: str = "",
                        epochs: int = 150, lr: float = 1e-3, device: str = "cpu") -> dict:
    xjtu = xjtu_path or str(FRONTEND_PUBLIC / "rv-xjtu-frames.json")
    femto = femto_path or str(FRONTEND_PUBLIC / "rv-femto-frames.json")

    seqs = _load_sequences(xjtu) + _load_sequences(femto)
    if len(seqs) < 10:
        raise RuntimeError(f"Only {len(seqs)} sequences found. Run XJTU/FEMTO io parsers first.")

    random.seed(42)
    random.shuffle(seqs)
    n_val = max(1, int(len(seqs) * 0.15))
    train_seqs, val_seqs = seqs[n_val:], seqs[:n_val]

    def make_loader(sub: list[dict], batch: int = 8, shuffle: bool = True) -> DataLoader:
        max_len = max(s["frames"].shape[0] for s in sub)
        X_list, HI_list, RUL_list = [], [], []
        for s in sub:
            f = s["frames"]
            # pad to max_len if needed (most have exactly 8)
            if f.shape[0] < max_len:
                pad = np.zeros((max_len - f.shape[0], 2048), dtype=np.float32)
                f = np.concatenate([f, pad])
            X_list.append(f)
            hi = s["hi"]
            if len(hi) < max_len:
                hi = np.concatenate([hi, np.zeros(max_len - len(hi), dtype=np.float32)])
            HI_list.append(hi)
            RUL_list.append(s["rul_frac"])
        X = torch.tensor(np.stack(X_list), dtype=torch.float32).unsqueeze(2)  # (N, S, 1, 2048)
        Y_hi = torch.tensor(np.stack(HI_list), dtype=torch.float32)
        Y_rul = torch.tensor(np.array(RUL_list, dtype=np.float32))
        return DataLoader(TensorDataset(X, Y_hi, Y_rul), batch_size=batch, shuffle=shuffle)

    train_ldr = make_loader(train_seqs)
    val_ldr = make_loader(val_seqs, shuffle=False)
    model = DeepHIRUL().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, mode="min", factor=0.5, patience=15)
    mse = nn.MSELoss()

    best_val = float("inf")
    for ep in range(1, epochs + 1):
        model.train()
        tr_loss = 0.0
        for xb, hi_b, rul_b in train_ldr:
            xb, hi_b, rul_b = xb.to(device), hi_b.to(device), rul_b.to(device)
            opt.zero_grad()
            out = model(xb)
            loss = mse(out["hi"], hi_b) + 0.5 * mse(out["rul"], rul_b)
            loss.backward()
            opt.step()
            tr_loss += loss.item() * len(xb)
        tr_loss /= len(train_ldr.dataset)

        model.eval()
        vl_loss = 0.0
        with torch.no_grad():
            for xb, hi_b, rul_b in val_ldr:
                xb, hi_b, rul_b = xb.to(device), hi_b.to(device), rul_b.to(device)
                out = model(xb)
                vl_loss += (mse(out["hi"], hi_b) + 0.5 * mse(out["rul"], rul_b)).item() * len(xb)
            vl_loss /= len(val_ldr.dataset)
        scheduler.step(vl_loss)
        if vl_loss < best_val:
            best_val = vl_loss

    onnx_path = str(FRONTEND_PUBLIC / "deep_hi.onnx")
    export_onnx(model, onnx_path, seq_len=SEQ_LEN, device=device)
    return {
        "train_samples": len(train_seqs), "val_samples": len(val_seqs),
        "best_val_loss": best_val, "onnx_path": onnx_path, "epochs": epochs,
    }


if __name__ == "__main__":
    import sys
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    r = train_deep_hi_stage(device=dev)
    print(f"Deep-HI/RUL trained: {r['train_samples']} train / {r['val_samples']} val")
    print(f"  best val loss: {r['best_val_loss']:.6f}")
    print(f"  ONNX: {r['onnx_path']}")
    sys.exit(0)
