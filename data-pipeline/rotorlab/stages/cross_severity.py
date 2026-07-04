"""Stage, cross-severity generalization (heavy lane, T4). The honest answer to "is the App a toy?".

The WDCNN, the deep-AE, the SVM-RBF and the Random Forest are ALL trained only on **0.007" faults at 0/1/2 HP**.
Here every model diagnoses REAL CWRU inner/ball/outer faults at three diameters, **0.007" / 0.014" / 0.021"**, at
the **held-out 3 HP load**. The 0.014" and 0.021" sizes are NEVER seen in training, so this is a true held-out
severity+load generalization test: does a model trained on small faults still recognise larger faults of the same
type? Larger spalls give stronger impacts (usually easier), but the deep-vs-classical gap can shift, and we report
where the misses go. Requires torch + scipy (the heavy precompute lane only).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..io.fetch_cwru import FILES, SEVERITY_FILES
from ..io.schema import HOP, WIN
from ..model import classical as C
from ..model import classical_ml
from ..model.features import spectral_feat, window_signal

RPM_3HP = 1730
_ORDER = {"inner": 0, "ball": 1, "outer": 2}


def _size_tag(size_in: float) -> str:
    """0.007 -> '007', 0.014 -> '014', 0.021 -> '021' (the case-id / sample size token)."""
    return f"{int(round(size_in * 1000)):03d}"


def _eval_rows() -> list[tuple[int, str, float, bool]]:
    """(file, fault, size_in, is_new) ordered by fault then size. 0.007" is the held-out-3HP baseline (seen size,
    from FILES); 0.014"/0.021" are the unseen-severity eval (from SEVERITY_FILES)."""
    base = [(n, cls, 0.007, False) for n, (cls, load, _r) in FILES.items() if load == 3 and cls != "normal"]
    sev = [(n, cls, size, True) for n, (cls, size) in SEVERITY_FILES.items()]
    return sorted(base + sev, key=lambda r: (_ORDER.get(r[1], 9), r[2]))


def _load_de(raw: Path, n: int) -> np.ndarray:
    from scipy.io import loadmat
    from scipy.signal import decimate
    m = loadmat(str(raw / f"{n}.mat"))
    key = next((k for k in m if k.endswith("DE_time")), None)
    x = np.asarray(m[key]).squeeze().astype(np.float64)
    if len(x) > 240000:                                   # 48 kHz -> decimate x4 -> 12 kHz (same as preprocess)
        x = decimate(x, 4, ftype="fir", zero_phase=True)
    return x


def run(model: dict, cml_models: dict, raw_dir: str, classes: list[str], fs: int = 12000) -> dict:
    """Evaluate WDCNN + SVM/RF + envelope-SES per (fault, size) at the held-out 3 HP load; collect committed sample
    segments for the new (0.014"/0.021") cases for live in-browser replay."""
    import torch

    raw = Path(raw_dir)
    net = model["net"]
    fmu, fsd = model["fmu"], model["fsd"]
    cls_idx = {c: i for i, c in enumerate(classes)}

    rows: list[dict] = []
    samples: list[dict] = []
    rngsel = np.random.RandomState(7)
    for n, cls, size, is_new in _eval_rows():
        p = raw / f"{n}.mat"
        if not p.exists():
            continue
        x = _load_de(raw, n)
        ws = window_signal(x, win=WIN, hop=HOP)
        if not ws:
            continue
        Xw = np.array(ws, np.float32)
        ti = cls_idx[cls]

        with torch.no_grad():                              # deep WDCNN on the raw 2048 windows
            wpred = net(torch.tensor(Xw).unsqueeze(1)).argmax(1).numpy()
            wemb = net.embed(torch.tensor(Xw).unsqueeze(1)).numpy()   # 100-D learned feature (T14 embedding)
        # classical-ML on the 10-D physics feature vector (same as T12), at the 3 HP shaft rate
        F = classical_ml.features_matrix(Xw, np.full(len(Xw), RPM_3HP), fs)
        svm_pred = cml_models["svm"].predict(F)
        rf_pred = cml_models["rf"].predict(F)
        # unsupervised envelope-SES on the raw signal (its own ~1 s windows; leakage-immune)
        env_preds = C.run_pipeline(x, fs, RPM_3HP, fixed_band=C.RESBAND)

        rows.append({
            "fault": cls, "sizeIn": size, "file": n, "isNew": is_new, "nWin": int(len(Xw)),
            "wdcnn": round(float((wpred == ti).mean()), 4),
            "svm": round(float((svm_pred == ti).mean()), 4),
            "rf": round(float((rf_pred == ti).mean()), 4),
            "env": round(float(np.mean([pp == cls for pp in env_preds])) if env_preds else 0.0, 4),
            # where the WDCNN's predictions land (so a miss is legible, not hidden)
            "wdcnnDist": {classes[k]: int((wpred == k).sum()) for k in range(4)},
        })

        if is_new:                                         # commit up to 2 real segments per new case for live replay
            sel = rngsel.choice(len(Xw), size=min(2, len(Xw)), replace=False)
            for seg, k in enumerate(sel, start=1):
                fz = (spectral_feat(Xw[k]) - fmu) / fsd
                samples.append({
                    "cls": cls, "sizeIn": size, "file": int(n), "seg": seg,
                    "caseId": f"dx-{cls}-{_size_tag(size)}-3hp",
                    "raw": [round(float(v), 4) for v in Xw[k]],
                    "feat": [round(float(v), 4) for v in fz],
                    "clsFeat": [round(float(v), 5) for v in F[k]],
                    "emb": [round(float(v), 4) for v in wemb[k]],
                })

    by_size: dict[str, dict[str, float]] = {}
    for m in ("wdcnn", "svm", "rf", "env"):
        acc_by_size: dict[str, list[float]] = {}
        for r in rows:
            acc_by_size.setdefault(_size_tag(r["sizeIn"]), []).append(r[m])
        by_size[m] = {s: round(float(np.mean(v)), 4) for s, v in acc_by_size.items()}

    return {
        "trainedOn": "0.007 in faults, 0/1/2 HP loads",
        "evaluatedAt": "held-out 3 HP load (rpm 1730)",
        "sizesIn": [0.007, 0.014, 0.021],
        "methods": ["wdcnn", "svm", "rf", "env"],
        "rows": rows,
        "byMethodBySize": by_size,
        "note": "Cross-severity held-out generalization: the WDCNN/AE/SVM/RF are trained ONLY on 0.007 in faults at "
                "0/1/2 HP; 0.014 in and 0.021 in are unseen sizes at the unseen 3 HP load. 0.007 in here is the "
                "held-out-load baseline (seen size). Accuracy = fault recall (each file is one fault type). Larger "
                "faults usually give stronger, easier impacts; the wdcnnDist column shows where any miss goes.",
        "samples": samples,
    }
