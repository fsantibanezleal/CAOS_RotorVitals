"""Stage 5, evaluate (the TEST stage, heavy lane): held-out accuracy + 4x4 confusion + per-class recall + the
honest SNR-robustness curve (the real deliverable, since clean CWRU is optimistic) for the WDCNN; the deep-AE
healthy p99 threshold + fault-vs-healthy AUC + held-out healthy false-flag rate. Plus the leakage-immune classical
benchmark (model.classical) over all 16 files. Leakage-safe by the held-out-load split + the unsupervised classical
path. Requires torch (WDCNN robustness) + scipy (classical)."""
from __future__ import annotations

import numpy as np


def run(model: dict, infer_out: dict, teX: np.ndarray, teY: np.ndarray, classes: list[str]) -> dict:
    import torch

    net = model["net"]
    pred = infer_out["pred"]
    teRec = infer_out["teRec"]
    healthy_recon = model["healthy_recon"]

    acc = float((pred == teY).mean())
    conf = np.zeros((4, 4), int)
    for t, p in zip(teY, pred):
        conf[t, p] += 1
    per_cls = {classes[c]: round(float((pred[teY == c] == c).mean()), 4) if (teY == c).any() else None
               for c in range(4)}

    # robustness vs additive noise (SNR in dB relative to each window's unit power; windows are z-scored)
    snr_curve = []
    rng = np.random.RandomState(7)
    for snr_db in [99, 10, 6, 2, 0, -2, -4]:
        if snr_db >= 99:
            Xn = teX
        else:
            nstd = float(np.sqrt(10 ** (-snr_db / 10)))
            Xn = (teX + rng.randn(*teX.shape) * nstd).astype(np.float32)
        with torch.no_grad():
            pn = net(torch.tensor(Xn).unsqueeze(1)).argmax(1).numpy()
        snr_curve.append({"snrDb": (None if snr_db >= 99 else snr_db),
                          "accuracy": round(float((pn == teY).mean()), 4)})

    thr = float(np.percentile(healthy_recon, 99))
    pos = teRec[teY != 0]
    auc = float((pos[:, None] > healthy_recon[None, :]).mean()) if len(pos) and len(healthy_recon) else None
    healthy_flag = float((teRec[teY == 0] > thr).mean()) if (teY == 0).any() else 0.0
    return {
        "accuracy": round(acc, 4), "perClass": per_cls, "confusion": conf.tolist(),
        "snrCurve": snr_curve, "thresholdP99": round(thr, 5),
        "faultVsHealthyAUC": round(auc, 4) if auc is not None else None,
        "healthyFalseFlagRate": round(healthy_flag, 4),
    }


def run_classical_benchmark(raw_dir: str) -> dict:
    """Reproduce the unsupervised envelope/SES benchmark over all 16 CWRU files (model.classical)."""
    from pathlib import Path

    from ..io.fetch_cwru import FILES
    from ..model import classical as C

    raw = Path(raw_dir)

    def load_de(n):
        from scipy.io import loadmat
        m = loadmat(str(raw / f"{n}.mat"))
        key = next((k for k in m if k.endswith("DE_time")), None)
        if key is None:
            return None, None
        x = np.asarray(m[key], dtype=float).ravel()
        fs = 48000 if len(x) > 240000 else 12000
        return x, fs

    methods: dict[str, list] = {
        "Envelope-SES (resonance band 2–4 kHz)": [],
        "Envelope-SES (auto kurtogram band)": [],
        "Raw-spectrum comb (no demodulation)": [],
    }
    per_file = []
    for n, (cls, load, rpm) in FILES.items():
        if not (raw / f"{n}.mat").exists():
            continue
        x, fs = load_de(n)
        if x is None:
            continue
        for p in C.run_pipeline(x, fs, rpm, fixed_band=C.RESBAND):
            methods["Envelope-SES (resonance band 2–4 kHz)"].append((cls, p))
        for p in C.run_pipeline(x, fs, rpm, fixed_band=None):
            methods["Envelope-SES (auto kurtogram band)"].append((cls, p))
        for p in C.raw_comb_predict(x, fs, rpm):
            methods["Raw-spectrum comb (no demodulation)"].append((cls, p))
        per_file.append({"file": n, "class": cls, "loadHP": load, "rpm": rpm, "fs": fs})

    return {
        "dataset": "CWRU 12 kHz Drive-End (0.007 in faults) + Normal baseline",
        "source": "https://engineering.case.edu/bearingdatacenter",
        "redistribution": "link-only; raw .mat NOT re-hosted",
        "bearing": "SKF 6205-2RS JEM",
        "multipliers": {"BPFO": 3.5848, "BPFI": 5.4152, "2BSF": round(C.MULT["ball"], 4), "FTF": 0.3983},
        "protocol": "Unsupervised envelope/SES comb-scoring (no training -> leakage-immune by construction); 1 s "
                    "windows from independent recordings; per-class row-normalized confusion. The three methods "
                    "differ ONLY in the demodulation band.",
        "classes": C.CLASSES,
        "files": per_file,
        "methods": {name: C.metrics_from(pairs) for name, pairs in methods.items()},
        "caveat": "Band selection dominates; rolling-element (ball) faults stay the hard case; the 0.007 in faults "
                  "are large/largely separable (Smith & Randall 2015), so this is not field-grade difficulty.",
        "refs": [
            {"label": "CWRU Bearing Data Center", "url": "https://engineering.case.edu/bearingdatacenter"},
            {"label": "Smith & Randall 2015", "doi": "10.1016/j.ymssp.2015.04.021"},
        ],
    }
