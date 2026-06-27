"""Particle-filter RUL prognostics — offline pipeline (Python).

Same algorithm as frontend/src/dsp/pf_rul.ts: sequential importance resampling (SIR) with
systematic resampling + jitter regularisation for the exponential degradation model. Numpy
is the only dependency; runs on the light pipeline lane (no torch needed — pure Bayesian math).

References:
    An, Kim & Choi (2013), doi:10.1016/j.ress.2012.09.011
    Arulampalam et al. (2002), doi:10.1109/78.978374
    Orchard & Vachtsevanos (2009), doi:10.1177/0142331208093993
"""

from __future__ import annotations

import numpy as np

N = 500  # particles
RESIDUAL_SD = 0.2


def _resample(particles: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Systematic resampling (O(N), low-variance). Returns (new_particles, uniform_weights)."""
    inv_n = 1.0 / N
    u0 = np.random.uniform(0, inv_n)
    indices = np.zeros(N, dtype=int)
    cdf = np.cumsum(weights)
    j = 0
    for i in range(N):
        u = u0 + i * inv_n
        while u > cdf[j] and j < N - 1:
            j += 1
        indices[i] = j
    return particles[indices], np.full(N, inv_n)


def _jitter(particles: np.ndarray, s_ln_a: float = 0.04, s_b: float = 0.002) -> np.ndarray:
    particles[:, 0] += np.random.randn(N) * s_ln_a
    particles[:, 1] += np.random.randn(N) * s_b
    particles[:, 1] = np.maximum(1e-9, particles[:, 1])
    return particles


def _onset_idx(points: np.ndarray) -> int | None:
    """Return the index of degradation onset, or None."""
    n = len(points)
    if n < 8:
        return None
    base_n = max(4, int(n * 0.3))
    base = points[:base_n]
    mu0 = base.mean()
    sd0 = base.std() or 1e-9
    threshold_val = mu0 + 4 * sd0
    for i in range(1, n - 1):
        if points[i] > threshold_val and points[i + 1] > threshold_val:
            return i
    return None


def pf_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> dict:
    """Particle-filter RUL projection.

    Args:
        t: operating time array [hours]
        hi: health-indicator array (e.g. RMS)
        threshold: failure threshold

    Returns:
        dict with onset, failTimeMedian, rulMedian, rulP10, rulP90, particles (N,3) as (lnA,b,w)
    """
    # 1. onset
    idx = _onset_idx(hi)
    if idx is None:
        return {"onset": None, "rul_median": None, "rul_p10": None, "rul_p90": None, "particles": np.empty((0, 3))}
    onset_t = t[idx]
    post_mask = (t >= onset_t) & (hi > 0)
    post_t = t[post_mask]
    post_hi = hi[post_mask]
    if len(post_t) < 4:
        return {"onset": float(onset_t), "rul_median": None, "rul_p10": None, "rul_p90": None, "particles": np.empty((0, 3))}

    # 2. OLS seed
    y = np.log(post_hi)
    X = np.column_stack([np.ones_like(post_t), post_t])
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    ln_a_ols, b_ols = float(beta[0]), float(beta[1])
    if b_ols <= 0:
        return {"onset": float(onset_t), "rul_median": None, "rul_p10": None, "rul_p90": None, "particles": np.empty((0, 3))}

    # 3. initialise particles
    particles = np.column_stack([
        ln_a_ols + np.random.randn(N) * 0.5,
        np.maximum(1e-9, b_ols + np.random.randn(N) * 0.03),
    ])
    particles = _jitter(particles)

    # 4. sequential importance resampling
    for i in range(len(post_t)):
        ti = post_t[i]
        yi = post_hi[i]
        pred = particles[:, 0] + particles[:, 1] * ti
        err = np.log(max(yi, 1e-9)) - pred
        w = np.exp(-0.5 * (err / RESIDUAL_SD) ** 2)
        w_sum = w.sum()
        if w_sum < 1e-30:
            w = np.full(N, 1.0 / N)
        else:
            w /= w_sum
        ess = 1.0 / (w @ w)
        if ess < N * 0.5:
            particles, w = _resample(particles, w)
            particles = _jitter(particles)
            w = np.full(N, 1.0 / N)

    # 5. RUL ensemble
    t_last = float(t[-1])
    rul = np.maximum(0, (np.log(threshold) - particles[:, 0]) / particles[:, 1] - t_last)
    nrul = np.sort(rul[np.isfinite(rul)])
    K = len(nrul) or 1
    pct = lambda q: float(nrul[max(0, min(K - 1, int(q * (K - 1))))]) if K > 0 else None

    return {
        "onset": float(onset_t),
        "rul_median": pct(0.5),
        "rul_p10": pct(0.1),
        "rul_p90": pct(0.9),
        "particles": np.column_stack([particles, w]) if K > 0 else np.empty((0, 3)),
    }
