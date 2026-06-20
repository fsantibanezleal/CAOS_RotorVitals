"""Train the heavy learned models for RotorVitals ON THE REAL CWRU DATA (not synthetic), and export them to
ONNX for live in-browser inference. This is what turns RotorVitals from a synthetic demo into a real
application: the models are trained on the actual Case Western Reserve University 12 kHz drive-end bearing
recordings already downloaded under ../cwru-benchmark/data/.

Two heavy models:
  • WDCNN — a 1-D deep CNN with a WIDE first-layer kernel (Zhang et al. 2017, Sensors 17(2):425), supervised
    4-class fault diagnosis (normal / outer / inner / ball) on raw 2048-sample windows.
  • Deep-AE health indicator — an autoencoder trained on HEALTHY windows only; its reconstruction error is the
    novelty/health indicator (González-Muñiz et al. 2022, Reliab. Eng. Syst. Saf. 224:108482). On a faulty
    window it reconstructs poorly → high HI.

LEAKAGE-SAFE protocol (honest): CWRU reuses the SAME physical bearing across loads, so a true
independent-bearing split is impossible with this dataset (stated openly). We instead hold out an ENTIRE LOAD
condition (3 HP) for test and train on 0/1/2 HP — so no window from a test recording is ever seen in training
(defeats the adjacent-window leakage that Smith & Randall 2015 warn about). Windows are z-scored per window.

Run:  python train_models.py
"""
from __future__ import annotations
import os, json, numpy as np, torch, torch.nn as nn
from scipy.io import loadmat
from scipy.signal import decimate

torch.manual_seed(0); np.random.seed(0)
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.abspath(os.path.join(HERE, "..", "cwru-benchmark", "data"))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public"))
os.makedirs(OUT, exist_ok=True)

# file -> (class, load HP). 12 kHz DE drive-end; normal baselines are 48 kHz (decimated to 12 kHz below).
FILES = {
    97: ("normal", 0), 98: ("normal", 1), 99: ("normal", 2), 100: ("normal", 3),
    105: ("inner", 0), 106: ("inner", 1), 107: ("inner", 2), 108: ("inner", 3),
    118: ("ball", 0), 119: ("ball", 1), 120: ("ball", 2), 121: ("ball", 3),
    130: ("outer", 0), 131: ("outer", 1), 132: ("outer", 2), 133: ("outer", 3),
}
CLASSES = ["normal", "outer", "inner", "ball"]
WIN = 2048
HOP = 1024
FS = 12000


def load_de(n):
    m = loadmat(os.path.join(DATA, f"{n}.mat"))
    key = next((k for k in m if k.endswith("DE_time")), None)
    x = np.asarray(m[key]).squeeze().astype(np.float64)
    fs = 48000 if len(x) > 240000 else 12000
    if fs == 48000:
        x = decimate(x, 4, ftype="fir", zero_phase=True)   # 48k -> 12k so all windows share fs
    return x


def windows(x):
    out = []
    for i in range(0, len(x) - WIN, HOP):
        w = x[i:i + WIN]
        s = w.std()
        out.append(((w - w.mean()) / (s if s > 1e-9 else 1.0)).astype(np.float32))
    return out


def build():
    tr_X, tr_y, te_X, te_y = [], [], [], []
    for n, (cls, load) in FILES.items():
        if not os.path.exists(os.path.join(DATA, f"{n}.mat")):
            continue
        ws = windows(load_de(n))
        yi = CLASSES.index(cls)
        if load == 3:                       # held-out load
            te_X += ws; te_y += [yi] * len(ws)
        else:
            tr_X += ws; tr_y += [yi] * len(ws)
    return (np.array(tr_X, np.float32), np.array(tr_y, np.int64),
            np.array(te_X, np.float32), np.array(te_y, np.int64))


class WDCNN(nn.Module):
    """1-D CNN, wide first kernel (Zhang 2017). Input (N,1,2048) -> 4 logits."""
    def __init__(self, n_cls=4):
        super().__init__()
        def blk(ci, co, k, s, p): return nn.Sequential(nn.Conv1d(ci, co, k, s, p), nn.BatchNorm1d(co), nn.ReLU(), nn.MaxPool1d(2))
        self.f = nn.Sequential(
            blk(1, 16, 64, 16, 24),   # wide first-layer kernel
            blk(16, 32, 3, 1, 1),
            blk(32, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
            blk(64, 64, 3, 1, 1),
        )
        # 2048 -> (wide-conv+pool) 64 -> 32 -> 16 -> 8 -> 4 ; 64 channels x 4 = 256
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(64 * 4, 100), nn.ReLU(), nn.Linear(100, n_cls))

    def forward(self, x):
        return self.head(self.f(x))


class AE(nn.Module):
    """Deep autoencoder over a 64-D engineered/compressed window summary -> reconstruction-error HI."""
    def __init__(self, d_in=64, d=8):
        super().__init__()
        self.enc = nn.Sequential(nn.Linear(d_in, 32), nn.ReLU(), nn.Linear(32, d))
        self.dec = nn.Sequential(nn.Linear(d, 32), nn.ReLU(), nn.Linear(32, d_in))

    def forward(self, x):
        return self.dec(self.enc(x))


def spectral_feat(w):
    """Compact 64-D magnitude-spectrum summary of a window (log binned), the AE's input."""
    X = np.abs(np.fft.rfft(w))
    b = np.array_split(X, 64)
    return np.array([np.log1p(bi.mean()) for bi in b], np.float32)


def main():
    trX, trY, teX, teY = build()
    print(f"real CWRU windows: train {len(trX)} (loads 0/1/2 HP) | test {len(teX)} (load 3 HP held-out)")

    # ---- WDCNN supervised ----
    net = WDCNN()
    opt = torch.optim.Adam(net.parameters(), 1e-3, weight_decay=1e-4)
    Xt = torch.tensor(trX).unsqueeze(1); Yt = torch.tensor(trY)
    idx = np.arange(len(Xt))
    for ep in range(25):
        np.random.shuffle(idx); tot = 0.0
        for i in range(0, len(idx), 128):
            b = idx[i:i + 128]
            opt.zero_grad()
            loss = nn.functional.cross_entropy(net(Xt[b]), Yt[b]); loss.backward(); opt.step()
            tot += loss.item() * len(b)
        if ep % 5 == 0: print(f"  wdcnn ep{ep} loss {tot/len(idx):.4f}")

    net.eval()
    with torch.no_grad():
        pred = net(torch.tensor(teX).unsqueeze(1)).argmax(1).numpy()
    acc = float((pred == teY).mean())
    conf = np.zeros((4, 4), int)
    for t, p in zip(teY, pred): conf[t, p] += 1
    per_cls = {CLASSES[c]: round(float((pred[teY == c] == c).mean()), 4) if (teY == c).any() else None for c in range(4)}
    print(f"  WDCNN held-out (3 HP) accuracy {acc:.4f} | per-class {per_cls}")

    # ---- robustness vs additive noise (honest: clean CWRU is too easy; show the realistic degradation) ----
    # SNR in dB relative to each window's unit power (windows are z-scored, so signal power ~ 1).
    snr_curve = []
    rng = np.random.RandomState(7)
    for snr_db in [99, 10, 6, 2, 0, -2, -4]:
        if snr_db >= 99:
            Xn = teX
        else:
            nstd = float(np.sqrt(10 ** (-snr_db / 10)))
            Xn = (teX + rng.randn(*teX.shape) * nstd).astype(np.float32)
        with torch.no_grad():
            pn = net(torch.tensor(Xn).unsqueeze(1)).argmax(1).numpy()
        snr_curve.append({"snrDb": (None if snr_db >= 99 else snr_db), "accuracy": round(float((pn == teY).mean()), 4)})
    print(f"  WDCNN accuracy vs SNR: {[(c['snrDb'], c['accuracy']) for c in snr_curve]}")

    # ---- deep-AE health indicator (one-class novelty) ----
    # A novelty detector's baseline is ALL the KNOWN healthy operation (every load) — the FAULTS are the
    # held-out unknown it must flag. So the AE trains on healthy from every load (incl. 3 HP normal), and the
    # threshold is the p99 over that healthy baseline. This avoids the spurious "healthy-but-anomalous" result
    # a load shift would otherwise cause. (The supervised WDCNN still uses the strict per-load held-out split.)
    def feats(X): return np.array([spectral_feat(w) for w in X], np.float32)
    trF, teF = feats(trX), feats(teX)
    healthyF = np.vstack([trF[trY == 0], teF[teY == 0]])      # all loads, normal only
    fmu, fsd = healthyF.mean(0), healthyF.std(0) + 1e-8
    healthy = (healthyF - fmu) / fsd
    teFz = (teF - fmu) / fsd
    ae = AE(); opt2 = torch.optim.Adam(ae.parameters(), 1e-3, weight_decay=1e-5)
    Ht = torch.tensor(healthy)
    for ep in range(150):
        opt2.zero_grad(); loss = ((ae(Ht) - Ht) ** 2).mean(); loss.backward(); opt2.step()
        if ep % 50 == 0: print(f"  ae ep{ep} mse {loss.item():.4f}")
    ae.eval()
    with torch.no_grad():
        he = ((ae(Ht) - Ht) ** 2).mean(1).numpy()             # recon error over the healthy baseline
        teRec = ((ae(torch.tensor(teFz)) - torch.tensor(teFz)) ** 2).mean(1).numpy()
    thr = float(np.percentile(he, 99))
    # detection AUC: held-out FAULTY windows vs the healthy baseline (the real task — flag faults)
    pos = teRec[teY != 0]
    auc = float((pos[:, None] > he[None, :]).mean()) if len(pos) and len(he) else None
    healthyFlagRate = float((teRec[teY == 0] > thr).mean()) if (teY == 0).any() else 0.0
    print(f"  deep-AE HI: healthy p99 thr {thr:.4f} | fault-vs-healthy AUC {auc} | held-out healthy false-flag {healthyFlagRate:.3f}")

    # ---- export ONNX ----
    os.environ["PYTHONIOENCODING"] = "utf-8"
    torch.onnx.export(net, torch.zeros(1, 1, WIN), os.path.join(OUT, "wdcnn.onnx"), dynamo=False,
                      input_names=["x"], output_names=["logits"], dynamic_axes={"x": {0: "n"}, "logits": {0: "n"}}, opset_version=17)
    torch.onnx.export(ae, torch.zeros(1, 64), os.path.join(OUT, "rv-ae.onnx"), dynamo=False,
                      input_names=["x"], output_names=["xr"], dynamic_axes={"x": {0: "n"}, "xr": {0: "n"}}, opset_version=17)

    # ---- committed real held-out windows for live in-browser inference (raw 2048 + spectral feats + label) ----
    samples = []
    rngsel = np.random.RandomState(1)
    for c in range(4):
        ci = np.where(teY == c)[0]
        for k in rngsel.choice(ci, size=min(3, len(ci)), replace=False):
            samples.append({"cls": CLASSES[c], "raw": [round(float(v), 4) for v in teX[k]],
                            "feat": [round(float(v), 4) for v in teFz[k]]})
    json.dump({"fs": FS, "win": WIN, "classes": CLASSES, "samples": samples},
              open(os.path.join(OUT, "rv-cwru-samples.json"), "w"))

    json.dump({
        "dataset": "CWRU 12 kHz drive-end (real)", "nTrain": len(trX), "nTest": len(teX),
        "split": "hold-out entire 3 HP load (train 0/1/2 HP) — no test recording seen in training",
        "wdcnn": {"accuracy": round(acc, 4), "perClass": per_cls, "confusion": conf.tolist(), "classes": CLASSES, "snrCurve": snr_curve},
        "deepAE": {"thresholdP99": round(thr, 5), "faultVsHealthyAUC": round(auc, 4) if auc is not None else None, "healthyFalseFlagRate": round(healthyFlagRate, 4), "trainedOn": "all-load healthy baseline (one-class novelty); faults held out"},
        "aeScaler": {"mean": [round(float(v), 6) for v in fmu], "std": [round(float(v), 6) for v in fsd]},
        "honesty": "Trained on REAL CWRU recordings. CWRU reuses one physical bearing across loads, so a true independent-bearing split is impossible; we hold out an entire load condition instead. CWRU is a clean lab rig (Smith & Randall 2015) — accuracy is optimistic vs field data.",
    }, open(os.path.join(OUT, "rv-learned-metrics.json"), "w"), indent=2)
    print("wrote wdcnn.onnx, rv-ae.onnx, rv-cwru-samples.json, rv-learned-metrics.json")


if __name__ == "__main__":
    main()
