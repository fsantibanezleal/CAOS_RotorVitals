"""Stage 3, train (OFFLINE, heavy lane): fit the WDCNN (Adam 1e-3, wd 1e-4, 25 ep, cross-entropy) on the
leakage-safe train split, and the deep-AE (Adam 1e-3, 150 ep, MSE) on the ALL-LOAD healthy baseline (one-class
novelty). Deterministic (torch + numpy seeded). Requires torch, imported lazily so the light pipeline never
touches it. Skippable: with the committed ONNX present and inputs unchanged, the default pipeline reuses them."""
from __future__ import annotations

import numpy as np


def run(trX: np.ndarray, trY: np.ndarray, healthyF: np.ndarray) -> dict:
    import torch
    import torch.nn as nn

    from ..model.deep_ae import AE
    from ..model.wdcnn import WDCNN

    torch.manual_seed(0)
    np.random.seed(0)

    # ---- WDCNN supervised ----
    net = WDCNN()
    opt = torch.optim.Adam(net.parameters(), 1e-3, weight_decay=1e-4)
    Xt = torch.tensor(trX).unsqueeze(1)
    Yt = torch.tensor(trY)
    idx = np.arange(len(Xt))
    for ep in range(25):
        np.random.shuffle(idx)
        tot = 0.0
        for i in range(0, len(idx), 128):
            b = idx[i:i + 128]
            opt.zero_grad()
            loss = nn.functional.cross_entropy(net(Xt[b]), Yt[b])
            loss.backward()
            opt.step()
            tot += loss.item() * len(b)
        if ep % 5 == 0:
            print(f"  wdcnn ep{ep} loss {tot / len(idx):.4f}", flush=True)
    net.eval()

    # ---- deep-AE one-class novelty over the all-load healthy baseline ----
    fmu, fsd = healthyF.mean(0), healthyF.std(0) + 1e-8
    healthy = (healthyF - fmu) / fsd
    ae = AE()
    opt2 = torch.optim.Adam(ae.parameters(), 1e-3, weight_decay=1e-5)
    Ht = torch.tensor(healthy)
    for ep in range(150):
        opt2.zero_grad()
        loss = ((ae(Ht) - Ht) ** 2).mean()
        loss.backward()
        opt2.step()
        if ep % 50 == 0:
            print(f"  ae ep{ep} mse {loss.item():.4f}", flush=True)
    ae.eval()
    with torch.no_grad():
        healthy_recon = ((ae(Ht) - Ht) ** 2).mean(1).numpy()
    return {"net": net, "ae": ae, "fmu": fmu, "fsd": fsd, "healthy_recon": healthy_recon}
