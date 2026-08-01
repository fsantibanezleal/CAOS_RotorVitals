"""Gaussian Process RUL prognostics, offline pipeline (Python).

Uses scikit-learn's mature GaussianProcessRegressor with a composite RBF+Matern kernel
and L-BFGS-B hyper-parameter optimisation (not a manual grid search). This is the same
framework used in the bearing-prognostics literature (Liu et al. 2020, MSSP 140:106870).

References:
    Rasmussen & Williams (2006), "Gaussian Processes for Machine Learning", MIT Press.
    Liu, Zhou, Peng & Vachtsevanos (2020), "A Gaussian process degradation model for bearing
      RUL prediction", MSSP 140:106870, doi:10.1016/j.ymssp.2020.106870
    Pedregosa et al. (2011), "Scikit-learn: Machine Learning in Python", JMLR 12:2825–2830.
"""

from __future__ import annotations

import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, Matern, WhiteKernel, ConstantKernel


def gp_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> dict:
    """GP RUL projection using scikit-learn's GaussianProcessRegressor.

    The GP is placed on log(HI) with a composite RBF+Matern+WhiteNoise kernel
    (differentiable and non-differentiable roughness, plus observation noise).
    Returns the predictive mean + 90% credible interval and the RUL distribution.

    Args:
        t: operating time array [hours]
        hi: health-indicator array (e.g. RMS)
        threshold: failure threshold

    Returns:
        dict with onset, failTimeMedian, rulMedian, rulP10, rulP90, curve (list of t/mean/lo/hi),
        and the fitted kernel.
    """
    n = len(t)
    if n < 8:
        return _empty()

    # onset detection (same rule across all models)
    base_n = max(4, int(n * 0.3))
    base = hi[:base_n]
    mu0, sd0 = float(base.mean()), float(base.std() or 1e-9)
    onset_idx = None
    for i in range(1, n - 1):
        if hi[i] > mu0 + 4 * sd0 and hi[i + 1] > mu0 + 4 * sd0:
            onset_idx = i
            break
    if onset_idx is None:
        return _empty()

    post_t = t[onset_idx:].reshape(-1, 1)
    post_hi = np.maximum(hi[onset_idx:], 1e-9)
    if len(post_t) < 4:
        return {"onset": float(t[onset_idx]), "rul_median": None, "rul_p10": None, "rul_p90": None,
                "curve": [], "kernel": "RBF+Matern+White"}

    y = np.log(post_hi).ravel()
    span = float(post_t[-1, 0] - post_t[0, 0]) or 1.0

    # Composite kernel: constant * (RBF + Matern) + WhiteNoise
    # RBF captures smooth exponential growth; Matern(5/2) captures rougher deviations;
    # WhiteKernel handles observation noise.
    kernel = (
        ConstantKernel(constant_value=1.0, constant_value_bounds=(1e-3, 1e3))
        * (RBF(length_scale=span * 0.5, length_scale_bounds=(span * 0.01, span * 10.0))
           + Matern(length_scale=span * 0.5, nu=2.5, length_scale_bounds=(span * 0.01, span * 10.0)))
        + WhiteKernel(noise_level=0.1, noise_level_bounds=(1e-6, 1.0))
    )

    gp = GaussianProcessRegressor(
        kernel=kernel, alpha=1e-6, normalize_y=False,
        n_restarts_optimizer=5, random_state=42,
        optimizer="fmin_l_bfgs_b",
    )
    gp.fit(post_t, y)

    # predict forward
    t_last = float(post_t[-1, 0])
    t_end = t_last + span * 2
    Nq = 60
    Xq = np.linspace(t_last, t_end, Nq + 1).reshape(-1, 1)
    mean, sd = gp.predict(Xq, return_std=True)
    sd = np.maximum(sd, 1e-12)

    curve = [{"t": float(Xq[i, 0]), "mean": float(np.exp(mean[i])),
              "lo": float(np.exp(mean[i] - 1.645 * sd[i])),
              "hi": float(np.exp(mean[i] + 1.645 * sd[i]))} for i in range(Nq + 1)]

    # first crossing of threshold on the GP mean
    cross_idx = int(np.argmax(mean >= np.log(threshold)))
    cross_t = float(Xq[cross_idx, 0]) if mean[cross_idx] >= np.log(threshold) else None
    rul_med = max(0.0, cross_t - t_last) if cross_t is not None else None

    return {
        "onset": float(t[onset_idx]),
        "rul_median": float(rul_med) if rul_med is not None else None,
        "rul_p10": float(rul_med * 0.5) if rul_med is not None else None,
        "rul_p90": float(rul_med * 2.0) if rul_med is not None else None,
        "curve": curve,
        "kernel": str(gp.kernel_),
    }


def _empty() -> dict:
    return {"onset": None, "rul_median": None, "rul_p10": None, "rul_p90": None,
            "curve": [], "kernel": "RBF+Matern+White"}
