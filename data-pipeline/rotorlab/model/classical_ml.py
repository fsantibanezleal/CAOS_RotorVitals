"""Classical-ML supervised diagnosers (T12) — the classical counterpoint to the deep WDCNN.

Where the WDCNN learns its representation end-to-end from the raw 2048-sample window, these baselines do what
bearing diagnosis did for decades: a small vector of **physics-informed hand-crafted features** fed to a generic
classifier. Two are shipped — an **SVM (RBF kernel)** and a **Random Forest** — trained on the IDENTICAL
leakage-safe split (hold out the entire 3 HP load) so their held-out accuracy is directly comparable to the
WDCNN's, and to the unsupervised envelope-SES benchmark (`model.classical`). Exported to ONNX (skl2onnx) so they
run live in the browser on the same committed real CWRU held-out segments.

Features (10), all scale-invariant (the windows are z-scored, so amplitude features are constant — only SHAPE
informs), in two families:
  - time-domain condition indicators (the classical ISO/standard set): kurtosis, skewness, crest, impulse, shape,
    clearance — the impulsiveness/peakedness signature of a localized defect;
  - frequency-domain physics features: the squared-envelope-spectrum harmonic-comb prominence at the outer (BPFO),
    inner (BPFI with sidebands) and rolling-element (2·BSF) defect frequencies (the same statistic the white-box
    diagnoser thresholds), plus the resonance-band spectral kurtosis.

Refs: Randall & Antoni 2011 (the envelope features); the time-domain shape factors are the classical machine-
condition indicators (ISO 13373). Requires scikit-learn + skl2onnx (the heavy precompute lane only).
"""
from __future__ import annotations

import numpy as np
from scipy.signal import hilbert

from . import classical as C

# the feature vector order — the SINGLE SOURCE OF TRUTH (the browser builds the same vector before the ONNX call).
FEATURE_NAMES = [
    "kurtosis", "skewness", "crest", "impulse", "shape", "clearance",
    "prom_outer", "prom_inner", "prom_ball", "spectral_kurtosis",
]
N_FEATURES = len(FEATURE_NAMES)


def window_features(w: np.ndarray, fs: int, rpm: int) -> np.ndarray:
    """The 10-D physics-informed feature vector for one (z-scored) window."""
    fr = rpm / 60.0
    m = w - w.mean()
    absm = np.abs(m)
    rms = float(np.sqrt(np.mean(m * m))) + 1e-12
    peak = float(absm.max())
    mean_abs = float(absm.mean()) + 1e-12
    sqrt_mean = float(np.mean(np.sqrt(absm))) ** 2 + 1e-12

    kurt = C.kurtosis(w)                                   # 4th-moment peakedness (excess)
    skew = float(np.mean(m ** 3) / (rms ** 3))             # asymmetry
    crest = peak / rms                                     # peak-to-rms (impulsiveness)
    impulse = peak / mean_abs
    shape = rms / mean_abs
    clearance = peak / sqrt_mean

    freq, mag = C.env_spectrum(w, fs, C.RESBAND)           # squared-envelope spectrum in the documented resonance band
    prom = [C.prominence(freq, mag, C.MULT[c] * fr, sideband=C.SIDEBAND[c] * fr) for c in ("outer", "inner", "ball")]
    sk = C.kurtosis(np.abs(hilbert(C.bandpass(w, fs, *C.RESBAND))))   # resonance-band envelope kurtosis

    return np.array([kurt, skew, crest, impulse, shape, clearance, *prom, sk], np.float32)


def features_matrix(X: np.ndarray, rpm: np.ndarray, fs: int = 12000) -> np.ndarray:
    return np.array([window_features(X[i], fs, int(rpm[i])) for i in range(len(X))], np.float32)


def train(trX: np.ndarray, trY: np.ndarray, trRpm: np.ndarray, fs: int = 12000) -> dict:
    """Fit the SVM-RBF and the Random Forest (each a StandardScaler + classifier pipeline) on the train split."""
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC

    F = features_matrix(trX, trRpm, fs)
    svm = make_pipeline(StandardScaler(),
                        SVC(kernel="rbf", C=10.0, gamma="scale", probability=True, random_state=0)).fit(F, trY)
    rf = make_pipeline(StandardScaler(),
                       RandomForestClassifier(n_estimators=300, max_depth=14, random_state=0, n_jobs=-1)).fit(F, trY)
    return {"svm": svm, "rf": rf, "trF": F}


def evaluate(models: dict, teX: np.ndarray, teY: np.ndarray, teRpm: np.ndarray,
             classes: list[str], fs: int = 12000) -> dict:
    """Held-out accuracy + 4x4 confusion + per-class recall for each classical-ML model (same split as the WDCNN)."""
    F = features_matrix(teX, teRpm, fs)
    out: dict = {"features": FEATURE_NAMES, "nTest": int(len(teY)), "teF": F}
    for name, model in (("svm", models["svm"]), ("rf", models["rf"])):
        pred = model.predict(F)
        conf = np.zeros((4, 4), int)
        for t, p in zip(teY, pred):
            conf[t, p] += 1
        per = {classes[c]: round(float((pred[teY == c] == c).mean()), 4) if (teY == c).any() else None
               for c in range(4)}
        out[name] = {"accuracy": round(float((pred == teY).mean()), 4), "perClass": per, "confusion": conf.tolist()}
    return out


def export_onnx(models: dict, derived_models_dir: str) -> None:
    """Export each pipeline (scaler + classifier) to ONNX. zipmap=False => a clean float probability tensor
    (onnxruntime-web friendly); the ML ops (SVMClassifier / TreeEnsembleClassifier, ai.onnx.ml domain) run on the
    WASM EP. Input is the RAW N_FEATURES vector (the StandardScaler is baked in)."""
    from pathlib import Path

    from skl2onnx import to_onnx

    dummy = np.zeros((1, N_FEATURES), np.float32)
    for name in ("svm", "rf"):
        clf = models[name].steps[-1][1]
        onx = to_onnx(models[name], dummy, target_opset=17, options={id(clf): {"zipmap": False}})
        (Path(derived_models_dir) / f"rv-{name}.onnx").write_bytes(onx.SerializeToString())
