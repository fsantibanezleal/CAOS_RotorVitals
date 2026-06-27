"""Stage: train the Deep-RUL CNN on XJTU-SY + FEMTO/PRONOSTIA run-to-failure bearing data.

This stage is part of the offline `--retrain` lane (torch required). It reads the life-snapshot
frames already produced by the io layer (rv-xjtu-frames.json, rv-femto-frames.json), builds a
PyTorch DataLoader mapping each raw 2048-sample window to its ground-truth life fraction [0,1],
trains the DeepRUL model, and exports the ONNX to frontend/public/deep_rul.onnx.

The model follows the DeepRUL class in rotorlab.model.deep_rul. The WDCNN backbone is shared so
the model architecture is type-consistent with the diagnosis tier.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from ..model.deep_rul import DeepRUL, export_onnx, train_deep_rul

REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_PUBLIC = REPO_ROOT / "frontend" / "public"


def _load_frames(path: str) -> list[tuple[np.ndarray, float]]:
    """Read a run-to-failure frames artifact and return [(window2048, life_fraction), ...]."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    pairs: list[tuple[np.ndarray, float]] = []
    frames = data.get("frames", {})
    for _traj_id, snaps in frames.items():
        for snap in snaps:
            raw = np.array(snap["raw"], dtype=np.float32)
            if len(raw) >= 2048:
                pairs.append((raw[:2048], float(snap.get("frac", 0))))
    return pairs


def _build_dataset(pairs: list[tuple[np.ndarray, float]], val_frac: float = 0.15,
                   seed: int = 42) -> tuple[DataLoader, DataLoader | None]:
    """Shuffle, split train/val, normalise fractions to [0,1], build DataLoaders."""
    random.seed(seed)
    random.shuffle(pairs)
    n_val = max(1, int(len(pairs) * val_frac))
    train_pairs = pairs[n_val:]
    val_pairs = pairs[:n_val]

    def _loader(sub: list[tuple[np.ndarray, float]], batch: int = 32, shuffle: bool = True):
        x = torch.tensor(np.stack([p[0] for p in sub]), dtype=torch.float32).unsqueeze(1)
        y = torch.tensor(np.array([p[1] for p in sub], dtype=np.float32))
        return DataLoader(TensorDataset(x, y), batch_size=batch, shuffle=shuffle)

    return _loader(train_pairs), _loader(val_pairs, shuffle=False)


def train_deep_rul_stage(xjtu_path: str = "", femto_path: str = "", epochs: int = 120,
                         device: str = "cpu") -> dict:
    """Train Deep-RUL from XJTU-SY + FEMTO frame artifacts, export the ONNX, return a summary.

    xjtu_path, femto_path default to the committed artifacts under frontend/public/.
    """
    xjtu = xjtu_path or str(FRONTEND_PUBLIC / "rv-xjtu-frames.json")
    femto = femto_path or str(FRONTEND_PUBLIC / "rv-femto-frames.json")
    all_pairs: list[tuple[np.ndarray, float]] = []

    for fp in [xjtu, femto]:
        p = Path(fp)
        if p.exists():
            all_pairs.extend(_load_frames(str(p)))

    if not all_pairs:
        raise FileNotFoundError(
            f"No RUL frame data found at {xjtu} or {femto}. "
            f"Run the XJTU/FEMTO io parsers first to generate the frames artifacts."
        )

    train_ldr, val_ldr = _build_dataset(all_pairs)
    model = DeepRUL()
    summary = train_deep_rul(model, train_ldr, val_ldr, epochs=epochs, device=device)

    onnx_path = str(FRONTEND_PUBLIC / "deep_rul.onnx")
    export_onnx(model, onnx_path, device=device)
    summary["onnx_path"] = onnx_path
    summary["train_samples"] = len(train_ldr.dataset)
    summary["val_samples"] = len(val_ldr.dataset) if val_ldr else 0
    return summary


if __name__ == "__main__":
    import sys

    device = "cuda" if torch.cuda.is_available() else "cpu"
    result = train_deep_rul_stage(device=device)
    print(f"Deep-RUL trained ({result['train_samples']} train / {result['val_samples']} val samples)")
    print(f"  best val loss: {result.get('best_val_loss', 'N/A')}")
    print(f"  ONNX exported to {result['onnx_path']}")
    sys.exit(0)
