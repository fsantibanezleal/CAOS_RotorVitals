"""Wang et al. (2020) — RVM + exponential degradation + Fréchet distance for adaptive RUL.

Reference: Wang, B., Lei, Y., Li, N. & Li, N. (2020). A Hybrid Prognostics Approach for
Estimating Remaining Useful Life of Rolling Element Bearings. IEEE Trans. Reliability 69(1),
401–412. DOI: 10.1109/TR.2018.2882682

Method summary:
  1. Feature extraction (RMS, kurtosis, spectral moments, etc.) → PCA → 1D health indicator
  2. RVM (Relevance Vector Machine) regression for sparse/smooth representation of HI curve
  3. Exponential+linear degradation model: h(t) = φ + β·t + α·exp(t), fitted via ridge regression
     with a sliding window for adaptivity
  4. Discrete Fréchet distance to match the current partial trajectory against a pre-built
     reference library of full run-to-failure trajectories
  5. Adaptive RUL: RUL = t_fail(ref) − t_now, where t_fail(ref) comes from the best-matching
     reference trajectory's exponential model crossing the failure threshold
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Optional

import numpy as np
from numpy.typing import NDArray
from sklearn.linear_model import ARDRegression, Ridge


# ═══════════════════════════════════════════════════════════════════════════════
# Discrete Fréchet distance
# ═══════════════════════════════════════════════════════════════════════════════


def _fréchet_c(i: int, j: int, P: NDArray, Q: NDArray, ca: NDArray) -> float:
    """Recursive helper for discrete Fréchet distance with memoisation."""
    if ca[i, j] > -1:
        return ca[i, j]
    d = float(np.sqrt((P[i, 0] - Q[j, 0]) ** 2 + (P[i, 1] - Q[j, 1]) ** 2))
    if i == 0 and j == 0:
        ca[i, j] = d
    elif i > 0 and j == 0:
        ca[i, j] = max(_fréchet_c(i - 1, 0, P, Q, ca), d)
    elif i == 0 and j > 0:
        ca[i, j] = max(_fréchet_c(0, j - 1, P, Q, ca), d)
    elif i > 0 and j > 0:
        ca[i, j] = max(
            min(
                _fréchet_c(i - 1, j, P, Q, ca),
                _fréchet_c(i - 1, j - 1, P, Q, ca),
                _fréchet_c(i, j - 1, P, Q, ca),
            ),
            d,
        )
    else:
        ca[i, j] = float("inf")
    return ca[i, j]


def discrete_fréchet(P: NDArray, Q: NDArray) -> float:
    """Discrete Fréchet distance between two 2-D curves P and Q.

    Each curve is an (n, 2) array: column 0 = time, column 1 = HI value.
    Both axes contribute to the distance so curves with similar degradation
    SHAPE but different absolute HI scale still match.
    """
    n, m = P.shape[0], Q.shape[0]
    if n < 1 or m < 1:
        return float("inf")
    ca = np.full((n, m), -1.0, dtype=np.float64)
    return _fréchet_c(n - 1, m - 1, P, Q, ca)


# ═══════════════════════════════════════════════════════════════════════════════
# Exponential + linear degradation model
# ═══════════════════════════════════════════════════════════════════════════════


def _build_design(t: NDArray) -> NDArray:
    """Build design matrix A = [1, t, exp(t)] for ridge regression.

    h(t) = φ + β·t + α·exp(t)   →   A · [φ, β, α]ᵀ
    """
    t = np.asarray(t, dtype=np.float64)
    return np.column_stack([np.ones_like(t), t, np.exp(t)])


def fit_exp_linear(t: NDArray, hi: NDArray, alpha: float = 1.0) -> tuple[float, float, float]:
    """Fit h(t) = φ + β·t + αᵉ·exp(t/c) via ridge regression.

    Time is scaled by span so exp(t) stays numerically stable.
    Returns (φ, β, α_exp, t0, t_scale) where t0 = t[0], t_scale = max(t) - t[0].
    """
    t_arr = np.asarray(t, dtype=np.float64)
    t0 = float(t_arr[0])
    t_scale = float(t_arr[-1] - t0) or 1.0
    t_norm = (t_arr - t0) / t_scale  # [0, 1]
    A = np.column_stack([np.ones_like(t_norm), t_norm, np.exp(t_norm)])
    ridge = Ridge(alpha=alpha, fit_intercept=False)
    ridge.fit(A, hi)
    phi = float(ridge.coef_[0])
    beta = float(ridge.coef_[1]) / t_scale  # rescale to raw t
    alpha_exp = float(ridge.coef_[2])
    return phi, beta, alpha_exp, t0, t_scale


def project_exp_linear(phi: float, beta: float, alpha_exp: float,
                       t: NDArray, t0: float, t_scale: float) -> NDArray:
    """Evaluate h(t) = φ + β·(t−t0)/t_scale + α_exp·exp((t−t0)/t_scale)."""
    t_arr = np.asarray(t, dtype=np.float64)
    t_norm = (t_arr - t0) / t_scale
    return phi + beta * t_scale * t_norm + alpha_exp * np.exp(t_norm)


def _safe_exp(x: float) -> float:
    """Exp capped to avoid overflow."""
    return math.exp(x) if x < 700 else float("inf")


def crossing_time(phi: float, beta: float, alpha_exp: float,
                  threshold: float, t_start: float, t0: float, t_scale: float,
                  t_max: float = 500.0) -> Optional[float]:
    """Find first t > t_start where h(t) = threshold (binary search).

    t_max is bounded to 500 hours — well beyond any bearing life in our datasets.
    """
    lo, hi = float(t_start), min(float(t_max), t_start + 500.0)
    h_hi = phi + beta * (hi - t0) + alpha_exp * _safe_exp((hi - t0) / t_scale)
    # If even at hi the model doesn't cross threshold, expand cautiously
    while not np.isinf(h_hi) and h_hi < threshold and hi < 1e4:
        hi = hi * 1.5
        h_hi = phi + beta * (hi - t0) + alpha_exp * _safe_exp((hi - t0) / t_scale)
    if np.isinf(h_hi) or h_hi is None:
        return float(hi)

    for _ in range(60):
        mid = (lo + hi) / 2.0
        t_norm = (mid - t0) / t_scale
        h = phi + beta * (mid - t0) + alpha_exp * _safe_exp(t_norm)
        if h < threshold:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-4:
            return (lo + hi) / 2.0
    return (lo + hi) / 2.0


# ═══════════════════════════════════════════════════════════════════════════════
# RVM-based sparse representation
# ═══════════════════════════════════════════════════════════════════════════════


def rvm_smooth(t: NDArray, hi: NDArray) -> NDArray:
    """Sparse/smooth representation of the HI curve via ARD regression.

    ARDRegression (Automatic Relevance Determination) is a Bayesian linear
    regression that prunes irrelevant features — the same principle as RVM.
    It produces a smoother curve by fitting only the relevant basis functions.

    Uses a polynomial basis (degree 6) so the ARD can select the right complexity.
    """
    t_arr = np.asarray(t, dtype=np.float64).reshape(-1, 1)
    hi_arr = np.asarray(hi, dtype=np.float64)
    # Polynomial basis: [1, t, t², ..., t⁶]
    basis = np.column_stack([t_arr.ravel() ** k for k in range(7)])
    ard = ARDRegression(max_iter=300, tol=1e-3, compute_score=False)
    ard.fit(basis, hi_arr)
    return ard.predict(basis)


# ═══════════════════════════════════════════════════════════════════════════════
# Reference trajectory library
# ═══════════════════════════════════════════════════════════════════════════════


def build_reference(t: NDArray, hi: NDArray, threshold: float,
                    alpha_ridge: float = 1.0) -> dict:
    """Build a reference trajectory entry from a full run-to-failure sequence.

    Returns a dict with the smoothed HI curve, exponential-linear model
    parameters, failure time, and the 2-D trajectory (t, hi) for Fréchet matching.
    """
    hi_smooth = rvm_smooth(t, hi)
    phi, beta, alpha_exp, t0, t_scale = fit_exp_linear(t, hi_smooth, alpha=alpha_ridge)
    t_fail = crossing_time(phi, beta, alpha_exp, threshold, float(t[-1]), t0, t_scale)
    # Build 2-D trajectory for Fréchet distance: normalise time and HI axes
    t_norm = (t - t[0]) / max(1.0, float(t[-1] - t[0]))
    hi_norm = hi_smooth / max(1e-9, float(np.max(hi_smooth)))
    traj = np.column_stack([t_norm, hi_norm])
    return {
        "t_raw": t.tolist(),
        "hi_raw": hi.tolist(),
        "hi_smooth": hi_smooth.tolist(),
        "phi": phi,
        "beta": beta,
        "alpha_exp": alpha_exp,
        "t0": t0,
        "t_scale": t_scale,
        "t_fail": t_fail,
        "trajectory": traj.tolist(),
        "t_max": float(t[-1]),
        "hi_max": float(np.max(hi_smooth)),
    }


def match_best_ref(partial_t: NDArray, partial_hi: NDArray, refs: list[dict]) -> dict:
    """Find the best-matching reference trajectory for a partial observation.

    Returns the matched reference dict with an added 'fréchet_distance' field,
    plus estimated RUL.
    """
    if len(partial_t) < 2:
        return {"error": "too few points", "rul": None}
    # Normalise partial trajectory using the same scheme as build_reference
    t_norm = (partial_t - partial_t[0]) / max(1.0, float(partial_t[-1] - partial_t[0]))
    hi_val = np.asarray(partial_hi, dtype=np.float64)
    hi_norm = hi_val / max(1e-9, float(np.max(hi_val)))
    P = np.column_stack([t_norm, hi_norm])

    best, best_dist = None, float("inf")
    for ref in refs:
        Q = np.array(ref["trajectory"], dtype=np.float64)
        d = discrete_fréchet(P, Q)
        if d < best_dist:
            best_dist = d
            best = ref

    if best is None:
        return {"error": "no refs", "rul": None}

    # RUL estimate: use the best reference's failure time
    t_now = float(partial_t[-1])
    # Scale the reference failure time to our time axis
    t_fail_ref = best.get("t_fail")
    if t_fail_ref is None or not np.isfinite(t_fail_ref):
        return {**best, "fréchet_distance": best_dist, "rul": None,
                "error": "ref has no valid t_fail"}

    rul = max(0.0, t_fail_ref - t_now)
    return {**best, "fréchet_distance": best_dist, "rul": rul,
            "t_now": t_now, "matched_t_fail": t_fail_ref}


# ═══════════════════════════════════════════════════════════════════════════════
# Library builder
# ═══════════════════════════════════════════════════════════════════════════════


def build_ref_library(trajectories: list[dict], threshold: float,
                      alpha_ridge: float = 1.0) -> list[dict]:
    """Build a reference library from multiple full run-to-failure trajectories.

    Each input trajectory dict should have 't' (array) and 'hi' (array) keys.
    """
    refs = []
    for traj in trajectories:
        t = np.asarray(traj["t"], dtype=np.float64)
        hi = np.asarray(traj["hi"], dtype=np.float64)
        if len(t) < 4:
            continue
        try:
            ref = build_reference(t, hi, threshold, alpha_ridge)
            refs.append(ref)
        except Exception:
            continue
    return refs


def export_ref_library(refs: list[dict], path: str) -> None:
    """Export the reference library as a compact JSON artifact for the frontend.

    Strips the full trajectory arrays (used only for Fréchet matching) but keeps
    everything the browser needs.
    """
    out = []
    for r in refs:
        out.append({
            "trajectory": r["trajectory"],
            "t_fail": r["t_fail"],
            "phi": r["phi"],
            "beta": r["beta"],
            "alpha_exp": r["alpha_exp"],
            "t0": r["t0"],
            "t_scale": r["t_scale"],
            "t_max": r["t_max"],
            "hi_max": r["hi_max"],
        })
    Path(path).write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
