"""Typed objects passed between pipeline stages — the inter-stage contract. Plain dataclasses (no heavy deps), so
the same types describe a record whether it came from a CWRU .mat, a CSV, or a live bring-your-own recording."""
from __future__ import annotations

from dataclasses import dataclass, field

# Canonical processing constants (the model input is fixed by the trained WDCNN/AE).
CANONICAL_FS = 12000   # Hz — every window is brought to this rate (48 kHz is decimated x4)
WIN = 2048             # samples per window (WDCNN input length)
HOP = 1024             # window stride
N_FEAT = 64            # deep-AE input: a 64-D log-binned magnitude-spectrum summary
CLASSES = ("normal", "outer", "inner", "ball")


@dataclass(frozen=True)
class VibrationRecord:
    """One validated vibration recording descriptor (CONTRACT 1 output). `signal` is optional: the light pipeline
    validates descriptors only; the heavy precompute lane attaches the raw drive-end signal for windowing."""
    case_id: str
    fs: int                       # Hz; one of {12000, 48000} (48 kHz is decimated to 12 kHz downstream)
    channel: str                  # DE (drive-end) | FE (fan-end) | BA (base)
    rpm: int                      # r/min (shaft speed)
    load_hp: int                  # motor load in HP (CWRU: 0..3)
    fault_type: str               # normal | inner | outer | ball
    fault_size_in: float | None = None   # inches (CWRU 0.007/0.014/0.021); None/declared for BYO
    bearing: str = "skf6205"      # DE = SKF 6205-2RS JEM
    n_samples: int = 0
    signal: list[float] | None = None
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class WindowTable:
    """z-scored CANONICAL_FS windows of length WIN (preprocess output, heavy lane)."""
    case_id: str
    fs: int
    win: int
    windows: list           # list[np.ndarray] (float32) — never serialized whole; summarized into the trace
    labels: list[int]       # class index per window


@dataclass(frozen=True)
class DiagnosisResult:
    """The learned-tier output for a set of held-out windows (infer/evaluate, heavy lane)."""
    case_id: str
    pred_class: str
    probs: list[float]
    health_indicator: float    # deep-AE reconstruction MSE
    is_anomaly: bool
    extra: dict = field(default_factory=dict)
