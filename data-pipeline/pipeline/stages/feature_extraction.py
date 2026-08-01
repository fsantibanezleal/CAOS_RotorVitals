"""Stage 2, feature_extraction (heavy lane): the deep-AE input = a 64-D log-binned magnitude-spectrum summary per
window (model.features.spectral_feat). The classical envelope/SES features are computed inside the classical
benchmark (evaluate.run_classical_benchmark) on the raw 1 s windows. NumPy only."""
from __future__ import annotations

import numpy as np

from ..model.features import spectral_feat


def run(X: np.ndarray) -> np.ndarray:
    """Stack the 64-D spectral feature for every window in X."""
    return np.array([spectral_feat(w) for w in X], np.float32)
