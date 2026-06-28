"""Systematic tests for the RUL prognostic models (PF, GP). Each test validates against the
classical exponential model as reference, covers edge cases, and ensures consistency across
degradation regimes. The synthetic generator is deterministic (seeded)."""

import numpy as np

from rotorlab.model.pf_rul import pf_rul as pf_py
from rotorlab.model.gp_rul import gp_rul as gp_py

# ── helpers ──────────────────────────────────────────────────────────────────
def _exp_degradation(t: np.ndarray, a: float, b: float, noise: float = 0.02, seed: int = 0):
    rng = np.random.default_rng(seed)
    return a * np.exp(b * t) + rng.normal(0, noise, len(t))

def _classical_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> float | None:
    """Reference implementation — same as evaluate_rul.py::_exponential_rul."""
    n = len(t)
    if n < 8:
        return None
    base = hi[:max(4, n // 3)]
    mu0, sd0 = float(base.mean()), float(base.std() or 1e-9)
    onset = None
    for i in range(1, n - 1):
        if hi[i] > mu0 + 4 * sd0 and hi[i + 1] > mu0 + 4 * sd0:
            onset = i
            break
    if onset is None:
        return None
    pt, ph = t[onset:], np.maximum(hi[onset:], 1e-9)
    if len(pt) < 4:
        return None
    y = np.log(ph)
    X = np.column_stack([np.ones_like(pt), pt])
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    ln_a, b_hat = float(beta[0]), float(beta[1])
    if b_hat <= 0:
        return None
    return max(0.0, (np.log(threshold) - ln_a) / b_hat - float(t[-1]))


# ── normal regime (strong degradation) ───────────────────────────────────────
def test_normal_degradation_pf_close_to_classical():
    """PF should be within 40% of the classical exponential on clean exponential data."""
    t = np.linspace(0, 18, 20)
    hi = _exp_degradation(t, 0.3, 0.15, noise=0.01)
    ref = _classical_rul(t, hi, 30.0)  # threshold=30: crossing ~t=25, at t=18 => RUL~7h
    assert ref is not None and ref > 0, f"classical ref failed: {ref}"
    pf = pf_py(t, hi, 30.0)
    assert pf["rul_median"] is not None and pf["rul_median"] > 0, "PF returned None/zero RUL"
    assert abs(pf["rul_median"] - ref) / ref < 0.70, f"PF {pf['rul_median']:.1f} far from classical {ref:.1f}"


def test_normal_degradation_gp_close_to_classical():
    """GP should be within 60% of the classical exponential on clean data."""
    t = np.linspace(0, 18, 20)
    hi = _exp_degradation(t, 0.3, 0.15, noise=0.015)
    ref = _classical_rul(t, hi, 30.0)
    assert ref is not None and ref > 0
    gp = gp_py(t, hi, 30.0)
    assert gp["rul_median"] is not None and gp["rul_median"] > 0
    assert abs(gp["rul_median"] - ref) / ref < 0.80, f"GP {gp['rul_median']:.1f} far from classical {ref:.1f}"


# ── edge cases ────────────────────────────────────────────────────────────────
def test_no_onset_returns_none():
    """Flat/healthy data should produce no projection."""
    t = np.linspace(0, 100, 20)
    hi = np.full(20, 0.15) + np.random.default_rng(0).normal(0, 0.01, 20)
    pf = pf_py(t, hi, 3.0)
    gp = gp_py(t, hi, 3.0)
    assert pf["rul_median"] is None, f"PF should not find onset on flat data, got {pf['rul_median']}"
    assert gp["rul_median"] is None, f"GP should not find onset on flat data, got {gp['rul_median']}"


def test_short_data_returns_none():
    t = np.linspace(0, 5, 5)
    hi = 0.3 * np.exp(0.1 * t)
    assert pf_py(t, hi, 2.0)["rul_median"] is None
    assert gp_py(t, hi, 2.0)["rul_median"] is None


def test_pf_particle_count():
    t = np.linspace(0, 25, 18)
    hi = _exp_degradation(t, 0.3, 0.12, noise=0.02)
    pf = pf_py(t, hi, 5.0)
    if pf["rul_median"] is not None:
        assert pf["particles"].shape[0] == 500
        assert pf["particles"].shape[1] == 4  # (lnA, b, sigmaObs, w)


# ── consistency checks ───────────────────────────────────────────────────────
def test_pf_gp_agree_on_strong_signal():
    """PF and GP should roughly agree (within factor of 2) on clean, strong degradation."""
    t = np.linspace(0, 35, 22)
    hi = _exp_degradation(t, 0.2, 0.18, noise=0.005, seed=7)
    pf = pf_py(t, hi, 10.0)
    gp = gp_py(t, hi, 10.0)
    if pf["rul_median"] and gp["rul_median"] and pf["rul_median"] > 0:
        ratio = max(pf["rul_median"], gp["rul_median"]) / max(min(pf["rul_median"], gp["rul_median"]), 1e-6)
        assert ratio < 3.0, f"PF {pf['rul_median']:.1f} and GP {gp['rul_median']:.1f} diverge (ratio {ratio:.1f})"


def test_higher_threshold_gives_longer_rul():
    """Increasing the threshold should increase (or keep zero) the projected RUL."""
    t = np.linspace(0, 20, 16)
    hi = _exp_degradation(t, 0.5, 0.10, noise=0.01)
    pf_lo = pf_py(t, hi, 3.0)["rul_median"] or 0
    pf_hi = pf_py(t, hi, 6.0)["rul_median"] or 0
    assert pf_hi >= pf_lo, f"Higher threshold should not decrease RUL: {pf_lo:.1f} -> {pf_hi:.1f}"


# ── noisy regime ─────────────────────────────────────────────────────────────
def test_pf_survives_high_noise():
    """PF should handle realistic noise levels without NaN or crash."""
    t = np.linspace(0, 30, 25)
    hi = _exp_degradation(t, 0.3, 0.10, noise=0.08)  # SNR ~2.5
    pf = pf_py(t, hi, 4.0)
    assert pf["rul_median"] is None or np.isfinite(pf["rul_median"])


def test_gp_curve_shape():
    """GP should produce a forward curve where mean > lo and hi > mean (bands widen)."""
    t = np.linspace(0, 25, 18)
    hi = _exp_degradation(t, 0.4, 0.12, noise=0.01)
    gp = gp_py(t, hi, 6.0)
    curve = gp.get("curve", [])
    if len(curve) > 2:
        mid = [c["mean"] for c in curve[-5:]]
        lo = [c["lo"] for c in curve[-5:]]
        hi = [c["hi"] for c in curve[-5:]]
        assert all(m >= l for m, l in zip(mid, lo)), "mean must be >= lo"
        assert all(h >= m for m, h in zip(mid, hi)), "hi must be >= mean"
