"""Stage 1 — preprocess (heavy lane): apply CONTRACT 1, load the real CWRU drive-end signals, decimate 48->12 kHz,
segment into z-scored 2048/1024 windows. Leakage-safe split: hold out the entire 3 HP load for test. Requires
numpy + scipy; imported only by the --retrain orchestrator, never by the light pipeline."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..io.contract import validate_records, validate_signal
from ..io.fetch_cwru import FILES
from ..io.schema import HOP, WIN
from ..model.features import window_signal


def _load_de(raw_dir: Path, n: int) -> np.ndarray:
    from scipy.io import loadmat
    from scipy.signal import decimate
    m = loadmat(str(raw_dir / f"{n}.mat"))
    key = next((k for k in m if k.endswith("DE_time")), None)
    x = np.asarray(m[key]).squeeze().astype(np.float64)
    if len(x) > 240000:                                   # 48 kHz -> decimate x4 (FIR, zero-phase) -> 12 kHz
        x = decimate(x, 4, ftype="fir", zero_phase=True)
    return x


def run(raw_dir: str) -> dict:
    """Return the leakage-safe train/test window arrays + the CONTRACT-1 report over the file descriptors."""
    raw = Path(raw_dir)
    classes = ["normal", "outer", "inner", "ball"]
    rows = [{"case_id": f"cwru-{n}", "fs": 12000, "channel": "DE", "rpm": rpm, "load_hp": load,
             "fault_type": cls, "fault_size_in": (None if cls == "normal" else 0.007)}
            for n, (cls, load, rpm) in FILES.items()]
    report = validate_records(rows)

    tr_X, tr_y, tr_rpm, te_X, te_y, te_rpm = [], [], [], [], [], []
    for n, (cls, load, rpm) in FILES.items():
        p = raw / f"{n}.mat"
        if not p.exists():
            continue
        x = _load_de(raw, n)
        ok, reason, _flags = validate_signal(x.tolist()[:WIN * 4], fs=12000)  # cheap head-of-signal guard
        if not ok:
            report.rejected.append({"case_id": f"cwru-{n}", "reason": reason})
            continue
        ws = window_signal(x, win=WIN, hop=HOP)
        yi = classes.index(cls)
        if load == 3:                                     # held-out load
            te_X += ws
            te_y += [yi] * len(ws)
            te_rpm += [rpm] * len(ws)
        else:
            tr_X += ws
            tr_y += [yi] * len(ws)
            tr_rpm += [rpm] * len(ws)
    return {
        "trX": np.array(tr_X, np.float32), "trY": np.array(tr_y, np.int64),
        "teX": np.array(te_X, np.float32), "teY": np.array(te_y, np.int64),
        # per-window shaft rpm — the kinematic defect frequencies (BPFO/BPFI/2·BSF) the classical-ML envelope
        # features key off depend on it (the deep WDCNN/AE do not need it; they consume the raw window/spectrum).
        "trRpm": np.array(tr_rpm, np.int64), "teRpm": np.array(te_rpm, np.int64),
        "classes": classes, "report": report,
    }
