"""Stage — cross-DATASET generalization (heavy lane, T13). The ultimate "is it real?" test: run the CWRU-trained
WDCNN + the unsupervised envelope/SES on **MFPT** — a DIFFERENT rig (NICE bearing, 48828/97656 Hz). The WDCNN never
saw a single MFPT sample, so this is a true domain-shift test.

The honest expectation (reported however it lands): the deep WDCNN's features are *rig-specific* (resonance bands,
sampling, geometry all differ), so it should transfer POORLY; the envelope/SES is *rig-agnostic* physics — bandpass
→ Hilbert envelope → comb at the CORRECT MFPT defect frequencies — so it should transfer well. If so, it completes
the arc: deep wins in-distribution (T12), physics wins cross-distribution (T13). Requires torch + scipy.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..io.fetch_mfpt import MFPT_FILES
from ..io.schema import HOP, WIN
from ..model import classical as C
from ..model.features import spectral_feat, window_signal

TARGET_FS = 12000
MFPT_CLASSES = ["normal", "outer", "inner"]   # MFPT has no rolling-element (ball) fault


def _load_mfpt(root: Path, rel: str):
    from scipy.io import loadmat
    from scipy.signal import decimate
    m = loadmat(str(root / rel))
    bear = m["bearing"][0, 0]
    gs = np.asarray(bear["gs"]).squeeze().astype(np.float64)
    sr = int(np.asarray(bear["sr"]).ravel()[0])
    rate = float(np.asarray(bear["rate"]).ravel()[0])              # shaft speed (Hz)
    bpfo = float(np.asarray(m["BPFO"]).ravel()[0])                 # MFPT defect frequencies (Hz) at this rate
    bpfi = float(np.asarray(m["BPFI"]).ravel()[0])
    factor = max(1, round(sr / TARGET_FS))                         # resample ~12 kHz (÷4 from 48828, ÷8 from 97656)
    if factor > 1:
        gs = decimate(gs, factor, ftype="fir", zero_phase=True)
    return gs, sr / factor, rate, bpfo, bpfi


def _mfpt_classical_predict(x, fs, rate, bpfo, bpfi, max_win: int = 6) -> list[str]:
    """Unsupervised envelope/SES with MFPT's OWN kinematics + the auto (kurtogram) band — rig-agnostic physics,
    nothing CWRU-specific. Scores outer (BPFO) vs inner (BPFI + 1× shaft sidebands); same ABS/REL gates."""
    w = int(1.0 * fs)
    band = C.kurtogram_band(x, fs)                                # auto band (MFPT resonance differs from CWRU)
    preds: list[str] = []
    for i in range(0, len(x) - w, w):
        if len(preds) >= max_win:
            break
        freq, mag = C.env_spectrum(x[i:i + w], fs, band)
        scores = {"outer": C.prominence(freq, mag, bpfo, sideband=0.0),
                  "inner": C.prominence(freq, mag, bpfi, sideband=rate)}
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        top, second = ranked[0], (ranked[1][1] or 1e-9)
        preds.append("normal" if (top[1] < C.ABS_GATE or top[1] / second < C.REL_GATE) else top[0])
    return preds


def run(model: dict, raw_dir: str, cwru_classes: list[str]) -> dict:
    import torch

    root = Path(raw_dir)
    net = model["net"]
    fmu, fsd = model["fmu"], model["fsd"]

    # accumulators per MFPT class
    wd_pred: dict[str, list[str]] = {c: [] for c in MFPT_CLASSES}
    cl_pred: dict[str, list[str]] = {c: [] for c in MFPT_CLASSES}
    per_file: list[dict] = []
    samples: list[dict] = []
    rngsel = np.random.RandomState(11)
    bpfo_mult = bpfi_mult = 0.0

    for rel, cls in MFPT_FILES.items():
        x, fs, rate, bpfo, bpfi = _load_mfpt(root, rel)
        bpfo_mult, bpfi_mult = bpfo / rate, bpfi / rate
        ws = window_signal(x, win=WIN, hop=HOP)
        if not ws:
            continue
        Xw = np.array(ws, np.float32)
        with torch.no_grad():
            wpred = net(torch.tensor(Xw).unsqueeze(1)).argmax(1).numpy()
        wlabels = [cwru_classes[k] for k in wpred]
        wd_pred[cls].extend(wlabels)
        cpred = _mfpt_classical_predict(x, fs, rate, bpfo, bpfi)
        cl_pred[cls].extend(cpred)
        per_file.append({"file": rel.split("/")[-1], "class": cls, "fs": round(fs, 1), "rate": rate,
                         "nWin": int(len(Xw)), "bpfoHz": round(bpfo, 2), "bpfiHz": round(bpfi, 2)})
        # commit one real MFPT segment per file for live WDCNN replay (raw + AE feat)
        k = int(rngsel.choice(len(Xw)))
        fz = (spectral_feat(Xw[k]) - fmu) / fsd
        samples.append({"cls": cls, "dataset": "MFPT", "file": rel.split("/")[-1].replace(".mat", ""),
                        "seg": 1, "caseId": f"mfpt-{cls}-{len(samples) + 1}",
                        "raw": [round(float(v), 4) for v in Xw[k]],
                        "feat": [round(float(v), 4) for v in fz]})

    def _recall(pred_map):
        out = {}
        for c in MFPT_CLASSES:
            p = pred_map[c]
            out[c] = round(float(np.mean([pp == c for pp in p])) if p else 0.0, 4)
        return out

    def _overall(pred_map):
        tot = sum(len(pred_map[c]) for c in MFPT_CLASSES)
        cor = sum(sum(1 for pp in pred_map[c] if pp == c) for c in MFPT_CLASSES)
        return round(cor / tot, 4) if tot else 0.0

    def _dist(pred_map, c):                                       # where the WDCNN sends class c (incl CWRU's ball)
        from collections import Counter
        ct = Counter(pred_map[c])
        return {k: int(ct.get(k, 0)) for k in cwru_classes}

    return {
        "dataset": "MFPT (NICE bearing — a different test rig)",
        "trainedOn": "CWRU (SKF 6205-2RS, 12 kHz drive-end)",
        "classes": MFPT_CLASSES,
        "kinematics": {
            "cwru": {"bearing": "SKF 6205-2RS JEM", "BPFO": 3.5848, "BPFI": 5.4152, "fsHz": 12000},
            "mfpt": {"bearing": "NICE (8 balls)", "BPFO": round(bpfo_mult, 4), "BPFI": round(bpfi_mult, 4),
                     "fsHz": "48828/97656 → ~12000 (resampled)"},
        },
        "wdcnn": {"recall": _recall(wd_pred), "overall": _overall(wd_pred),
                  "dist": {c: _dist(wd_pred, c) for c in MFPT_CLASSES}},
        "classical": {"recall": _recall(cl_pred), "overall": _overall(cl_pred), "method": "envelope/SES (auto band)"},
        "perFile": per_file,
        "note": "MFPT is a DIFFERENT rig (NICE bearing, 48828/97656 Hz resampled to ~12 kHz). The CWRU-trained WDCNN "
                "never saw it — a true domain-shift test. The deep model's learned features are rig-specific; the "
                "unsupervised envelope/SES (bandpass→envelope→comb at the CORRECT MFPT defect frequencies, auto "
                "band) is rig-agnostic physics. Reported however it lands.",
        "samples": samples,
    }
