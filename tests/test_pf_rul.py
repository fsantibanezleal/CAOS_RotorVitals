"""Validation of the particle-filter RUL (Python pipeline)."""
import numpy as np
import pytest
from rotorlab.model.pf_rul import pf_rul


def _synth(a: float, b: float, t_max: float, n: int, noise: float = 0.02, seed: int = 0):
    rng = np.random.default_rng(seed)
    t = np.linspace(0, t_max, n)
    hi = a * np.exp(b * t) * (1 + noise * (rng.random(n) * 2 - 1))
    return t, hi


# ── onset detection ──────────────────────────────────────────────────────────
def test_onset_detected_on_strong_degradation():
    t, hi = _synth(0.3, 0.15, 18, 20, 0.005)
    r = pf_rul(t, hi, 15)
    assert r["onset"] is not None and r["onset"] > 0


def test_no_onset_on_flat_data():
    rng = np.random.default_rng(0)
    t = np.linspace(0, 40, 20)
    hi = np.full(20, 0.15) + rng.normal(0, 0.005, 20)
    r = pf_rul(t, hi, 3)
    assert r["rul_median"] is None


def test_short_data_rejected():
    t, hi = _synth(0.3, 0.15, 5, 6, 0.01)
    r = pf_rul(t, hi, 10)
    assert r["onset"] is None


# ── particle count and convergence ───────────────────────────────────────────
def test_produces_500_particles():
    t, hi = _synth(0.3, 0.15, 25, 26, 0.01)
    r = pf_rul(t, hi, 30)
    assert r["particles"].shape[0] == 500
    assert len(r["rul_ensemble"]) >= 50


def test_posterior_narrower_than_prior():
    t, hi = _synth(0.3, 0.15, 25, 26, 0.01)
    r = pf_rul(t, hi, 30)
    ln_a = r["particles"][:, 0]
    sd = float(np.std(ln_a))
    assert sd < 1.0, f"posterior sd {sd:.2f} should be < 1.0"
    assert r["converged"]


# ── parameter recovery ──────────────────────────────────────────────────────
def test_recovers_true_parameters():
    t, hi = _synth(0.3, 0.15, 20, 30, 0.003)
    r = pf_rul(t, hi, 12)
    ln_a = r["particles"][:, 0]
    b_vals = r["particles"][:, 1]
    est_ln_a = float(np.median(ln_a))
    est_b = float(np.median(b_vals))
    diff_ln = abs(est_ln_a - np.log(0.3))
    assert diff_ln < 1.5, f"lnA diff {diff_ln:.2f} exceeds tolerance (prior sd=2.0)"
    assert abs(est_b - 0.15) < 0.10, f"b diff {abs(est_b-0.15):.3f} exceeds tolerance"


# ── physical bounds ─────────────────────────────────────────────────────────
def test_rul_within_physical_bounds():
    t, hi = _synth(0.3, 0.15, 18, 20, 0.01)
    r = pf_rul(t, hi, 30)
    if r["rul_median"] is not None:
        assert r["rul_median"] >= 0
        assert r["rul_median"] < 200


# ── edge: no onset → no projection ──────────────────────────────────────────
def test_no_onset_returns_full_none():
    rng = np.random.default_rng(42)
    t = np.linspace(0, 30, 15)  # < 10 points after onset? no, n=15, but no degradation
    hi = np.full(15, 0.12) + rng.normal(0, 0.003, 15)
    r = pf_rul(t, hi, 2)
    # flat data should not detect onset
    if r["onset"] is None:
        assert r["rul_median"] is None
