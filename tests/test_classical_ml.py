"""T12 — the classical-ML baselines (SVM-RBF + Random Forest). Locks: (1) the 10-D feature contract the browser
mirrors; (2) a deterministic train→evaluate round-trip on separable synthetic windows; (3) the skl2onnx export
loads in onnxruntime and the ai.onnx.ml classifier agrees with sklearn on the same input (the op-domain the
browser depends on). Heavy deps (sklearn/skl2onnx/onnxruntime) are import-guarded so the light suite skips cleanly.
"""
from __future__ import annotations

import numpy as np
import pytest

pytest.importorskip("sklearn")
pytest.importorskip("skl2onnx")
ort = pytest.importorskip("onnxruntime")

from rotorlab.model import classical_ml as cml  # noqa: E402

FS = 12000
WIN = 2048
RPM = 1772
CLASSES = ["normal", "outer", "inner", "ball"]


def _synthetic_windows(n_per: int, seed: int = 0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Four z-scored classes with distinct SHAPE: normal = gaussian; the faults = periodic impacts at the BPFO/
    BPFI/2·BSF defect frequencies (so the env-comb prominences separate them). Scale-invariant by construction."""
    rng = np.random.default_rng(seed)
    fr = RPM / 60.0
    t = np.arange(WIN) / FS
    X, Y = [], []
    defect_hz = {1: cml.C.MULT["outer"] * fr, 2: cml.C.MULT["inner"] * fr, 3: cml.C.MULT["ball"] * fr}
    for cls in range(4):
        for _ in range(n_per):
            base = rng.standard_normal(WIN)
            if cls > 0:
                # a 4 kHz resonance amplitude-modulated by the defect-rate impact train
                carrier = np.sin(2 * np.pi * 4000 * t)
                impacts = (np.sin(2 * np.pi * defect_hz[cls] * t) > 0.97).astype(float)
                base = base * 0.3 + carrier * impacts * 6.0
            w = (base - base.mean()) / (base.std() + 1e-9)  # z-score => only shape survives
            X.append(w.astype(np.float32))
            Y.append(cls)
    idx = rng.permutation(len(X))
    return np.array(X)[idx], np.array(Y)[idx], np.full(len(X), RPM)


def test_feature_contract_shape_and_finiteness():
    X, _, rpm = _synthetic_windows(2)
    F = cml.features_matrix(X, rpm, FS)
    assert F.shape == (len(X), cml.N_FEATURES) == (len(X), 10)
    assert len(cml.FEATURE_NAMES) == 10
    assert np.isfinite(F).all(), "feature vector must be finite (the ONNX input cannot carry NaN/Inf)"


def test_train_evaluate_is_deterministic_and_separates():
    trX, trY, trRpm = _synthetic_windows(30, seed=1)
    teX, teY, teRpm = _synthetic_windows(12, seed=2)
    m1 = cml.train(trX, trY, trRpm, FS)
    ev1 = cml.evaluate(m1, teX, teY, teRpm, CLASSES, FS)
    m2 = cml.train(trX, trY, trRpm, FS)
    ev2 = cml.evaluate(m2, teX, teY, teRpm, CLASSES, FS)
    # pinned random_state => identical held-out accuracy across runs
    assert ev1["svm"]["accuracy"] == ev2["svm"]["accuracy"]
    assert ev1["rf"]["accuracy"] == ev2["rf"]["accuracy"]
    # the synthetic classes are separable by the physics features => both models well above chance (0.25)
    assert ev1["svm"]["accuracy"] >= 0.6 and ev1["rf"]["accuracy"] >= 0.6
    assert ev1["nTest"] == len(teY) and ev1["teF"].shape == (len(teY), 10)


def test_onnx_export_loads_and_matches_sklearn(tmp_path):
    trX, trY, trRpm = _synthetic_windows(30, seed=1)
    teX, _, teRpm = _synthetic_windows(4, seed=3)
    models = cml.train(trX, trY, trRpm, FS)
    cml.export_onnx(models, str(tmp_path))
    F = cml.features_matrix(teX, teRpm, FS)
    for name in ("svm", "rf"):
        onnx_path = tmp_path / f"rv-{name}.onnx"
        assert onnx_path.exists(), f"{name} ONNX not written"
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        for row in F:
            out = sess.run(None, {"X": row[None, :].astype(np.float32)})
            label = int(np.asarray(out[0]).ravel()[0])
            probs = np.asarray(out[1]).ravel()
            assert label == int(models[name].predict(row[None, :])[0]), f"{name}: ONNX/sklearn label mismatch"
            assert probs.shape[0] == 4 and abs(float(probs.sum()) - 1.0) < 1e-3, f"{name}: probs must be a 4-class simplex"
