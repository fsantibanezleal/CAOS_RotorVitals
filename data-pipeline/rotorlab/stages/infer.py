"""Stage 4, infer (heavy lane): run the trained WDCNN argmax + the deep-AE reconstruction MSE over the held-out
test windows, the OFFLINE mirror of the in-browser live path. Requires torch (lazy)."""
from __future__ import annotations

import numpy as np


def run(model: dict, teX: np.ndarray, teFz: np.ndarray) -> dict:
    import torch

    net, ae = model["net"], model["ae"]
    with torch.no_grad():
        pred = net(torch.tensor(teX).unsqueeze(1)).argmax(1).numpy()
        teRec = ((ae(torch.tensor(teFz)) - torch.tensor(teFz)) ** 2).mean(1).numpy()
    return {"pred": pred, "teRec": teRec}
