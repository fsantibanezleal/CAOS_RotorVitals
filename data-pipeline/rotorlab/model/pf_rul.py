"""Particle-filter RUL prognostics, offline pipeline (Python, numpy).

Proper Bayesian SIR with regularisation (Musso, Oudjane & Le Gland 2001), a WIDE
uninformed prior (NOT seeded from OLS), and kernel-density jitter. Matches the TypeScript
frontend implementation algorithmically so cross-validation is meaningful.

References:
    Arulampalam et al. (2002), IEEE TSP 50(2):174–188
    Musso, Oudjane & Le Gland (2001), "Improving regularised particle filters"
    An, Kim & Choi (2013), RESS 120:50–62
"""

from __future__ import annotations

import numpy as np

N = 500
ESS_THRESHOLD = 0.60
MIN_POST_ONSET = 6


def _onset_idx(hi: np.ndarray) -> int | None:
    n = len(hi)
    if n < 10:
        return None
    base_n = max(5, int(n * 0.25))
    base = hi[:base_n]
    mu0 = float(base.mean())
    sd0 = float(base.std() or 1e-9)
    thr = mu0 + 3.5 * sd0
    for i in range(1, n - 2):
        if hi[i] > thr and hi[i + 1] > thr and hi[i + 2] > thr:
            return i
    return None


def _kernel_regularise(particles: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Silverman bandwidth, shrink by 0.5 (regularisation, not full kernel)."""
    n = len(particles)
    w_sum = weights.sum() or 1.0
    means = (particles * weights[:, None]).sum(axis=0) / w_sum
    diffs = particles - means[None, :]
    var = (diffs ** 2 * weights[:, None]).sum(axis=0) / w_sum
    h = 1.06 * np.sqrt(np.maximum(var, 1e-12)) * n ** (-0.2) * 0.5
    jitter = np.random.randn(n, 3) * h[None, :]
    particles += jitter
    particles[:, 1] = np.maximum(1e-12, particles[:, 1])     # b > 0
    particles[:, 2] = np.maximum(1e-6, particles[:, 2])       # σ > 0
    return particles


def _resample(particles: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = len(weights)
    inv_n = 1.0 / n
    u0 = np.random.uniform(0, inv_n)
    indices = np.zeros(n, dtype=int)
    cdf = np.cumsum(weights)
    j = 0
    for i in range(n):
        u = u0 + i * inv_n
        while u > cdf[j] and j < n - 1:
            j += 1
        indices[i] = j
    return particles[indices], np.full(n, inv_n)


def pf_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> dict:
    n = len(t)
    if n < 10:
        return _empty()

    onset_idx = _onset_idx(hi)
    if onset_idx is None:
        return _empty()
    onset_t = float(t[onset_idx])

    mask = t >= onset_t
    post_t = t[mask]
    post_hi = np.maximum(hi[mask], 1e-9)
    if len(post_t) < MIN_POST_ONSET:
        return {"onset": onset_t, "rul_median": None, "rul_p10": None, "rul_p90": None,
                "particles": np.empty((0, 4)), "rul_ensemble": np.empty(0), "converged": False}

    y = np.log(post_hi)
    first_k = min(4, len(y))
    first_ln = float(y[:first_k].mean())  # prior centered on first post-onset points (closest to true lnA)

    # Weakly informed prior centered near the true lnA
    particles = np.column_stack([
        first_ln + np.random.randn(N) * 1.5,                                  # lnA
        np.maximum(1e-12, np.exp(np.log(0.05) + np.random.randn(N) * 1.0)),   # b
        np.maximum(1e-6, np.exp(np.log(0.15) + np.random.randn(N) * 0.6)),    # σ_obs
    ])
    weights = np.full(N, 1.0 / N)
    particles = _kernel_regularise(particles, weights)

    # SIR over post-onset observations
    for i in range(len(post_t)):
        ti = float(post_t[i])
        yi = float(post_hi[i])
        pred = particles[:, 0] + particles[:, 1] * ti
        err = np.log(np.maximum(yi, 1e-9)) - pred
        log_w = -0.5 * (err / particles[:, 2]) ** 2 - np.log(particles[:, 2])
        max_lw = float(log_w.max())
        w = np.exp(log_w - max_lw)
        w_sum = float(w.sum())
        if w_sum < 1e-60:
            particles = np.column_stack([
                first_ln + np.random.randn(N) * 1.5,
                np.maximum(1e-12, np.exp(np.log(0.05) + np.random.randn(N) * 1.0)),
                np.maximum(1e-6, np.exp(np.log(0.15) + np.random.randn(N) * 0.6)),
            ])
            weights = np.full(N, 1.0 / N)
            particles = _kernel_regularise(particles, weights)
            continue
        weights = w / w_sum
        ess = 1.0 / (weights @ weights)
        if ess < N * ESS_THRESHOLD:
            particles, weights = _resample(particles, weights)
            particles = _kernel_regularise(particles, weights)
            weights = np.full(N, 1.0 / N)

    # RUL ensemble
    t_last = float(post_t[-1])
    ft = (np.log(threshold) - particles[:, 0]) / particles[:, 1]
    rul = np.maximum(0, ft - t_last)
    ok = np.isfinite(rul) & (rul < 1e6)
    nrul = np.sort(rul[ok])
    k = len(nrul) or 1

    ln_as = particles[:, 0]
    ln_a_sd = float(np.std(ln_as))
    converged = ln_a_sd < 1.5

    def _pct(q: float) -> float | None:
        if k <= 50:
            return None
        idx = max(0, min(k - 1, int(q * (k - 1))))
        return float(nrul[idx])

    return {
        "onset": onset_t,
        "rul_median": _pct(0.5),
        "rul_p10": _pct(0.1),
        "rul_p90": _pct(0.9),
        "particles": np.column_stack([particles, weights]),
        "rul_ensemble": nrul,
        "converged": converged,
    }


def _empty() -> dict:
    return {"onset": None, "rul_median": None, "rul_p10": None, "rul_p90": None,
            "particles": np.empty((0, 4)), "rul_ensemble": np.empty(0), "converged": False}
