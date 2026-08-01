"""Feature extraction shared by the offline pipeline. The deep-AE consumes a compact 64-D log-binned
magnitude-spectrum summary of a window; this is the SAME encoding the browser reproduces byte-for-byte before
running the AE ONNX, so it lives here as the single source of truth. NumPy only (no heavy deps)."""
from __future__ import annotations

import numpy as np

from ..io.schema import N_FEAT, WIN


def spectral_feat(w: np.ndarray) -> np.ndarray:
    """Compact N_FEAT-D magnitude-spectrum summary of a window (log-binned), the deep-AE input."""
    X = np.abs(np.fft.rfft(w))
    b = np.array_split(X, N_FEAT)
    return np.array([np.log1p(bi.mean()) for bi in b], np.float32)


def window_signal(x: np.ndarray, win: int = WIN, hop: int = 1024) -> list[np.ndarray]:
    """Segment a signal into z-scored fixed windows (safe-normalize flatlines by 1.0)."""
    out: list[np.ndarray] = []
    for i in range(0, len(x) - win, hop):
        w = x[i:i + win]
        s = w.std()
        out.append(((w - w.mean()) / (s if s > 1e-9 else 1.0)).astype(np.float32))
    return out


def standardize(feat: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    """Apply the AE feature scaler shipped in rv-learned-metrics.json (the browser does the same)."""
    return (feat - mean) / std
