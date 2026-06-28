"""University of Ottawa bearing dataset under TIME-VARYING rotational speed (Huang & Baddour 2018).

REAL diagnosis data for RotorVitals where the SHAFT SPEED is NOT constant -- the whole reason the dataset exists.
A classical fixed-frequency spectrum smears the bearing-defect lines across the run; the cure is COMPUTED ORDER
TRACKING (COT): use the shaft encoder to resample the vibration to a constant number of samples-per-revolution, so
the analysis lives in the ANGLE / ORDER domain where BPFO/BPFI/BSF are CONSTANT multiples of shaft rate regardless of
the varying rpm. This module is the genuine COT front-end; the App then runs all of its order-domain tools on the
emitted angle-resampled windows.

Rig (Huang & Baddour 2018, Data in Brief 21:1745): a shaft on two ER-16K deep-groove ball bearings; the LEFT bearing
is healthy, the RIGHT (test) bearing is swapped between health states. An ICP accelerometer (PCB 623C01) on the test
housing is Channel_1 (vibration); an incremental shaft encoder (1024 cycles/rev) is Channel_2. Both sampled at
fs = 200 kHz for 10 s (2,000,000 samples). Speed varies through the record.

Files: {H,I,O}-{A,B,C,D}-{1,2,3}.mat
  H = healthy, I = inner-race fault, O = outer-race fault (a B = ball and combined set also exists upstream).
  A = increasing speed, B = decreasing, C = increasing-then-decreasing, D = decreasing-then-increasing.
  1/2/3 = repeated trials.

ER-16K bearing geometry (Huang & Baddour, Table 1): n = 9 balls, ball dia d = 7.94 mm, pitch dia D = 38.52 mm,
deep-groove => contact angle ~ 0 deg. The data-descriptor lists BPFO = 3.57 fr and BPFI = 5.43 fr (orders of shaft
rate). Recomputing from the geometry gives BPFO = 3.5724, BPFI = 5.4276, BSF = 2.3226 (ball-spin; a ball defect
strikes a race at 2*BSF = 4.645/rev), FTF = 0.3969 -- BPFO/BPFI match the paper to 2 d.p., so the geometry is the
authoritative source for the two frequencies the paper omits.

Emits frontend/public/rv-ottawa-samples.json: per sample a 16-revolution order-domain angle-resampled window
(samples/rev = 2048, so 32768 floats), a matching time-domain window resampled to 12 kHz for the CWRU-trained WDCNN
cross-domain test, an rpm-vs-order map for the Campbell/waterfall tools, and the bearing block with the fault orders.
Raw .mat are link-only (gitignored).

NOT a run-to-failure set -> no RUL/ISO content (those stay FEMTO/IMS/XJTU). Tools: signal, envelope, spectrogram,
cyclostationary, kurtogram, infogram, campbell, waterfall, featurespace, recommendation -- all in the ORDER domain.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.signal import hilbert, resample_poly

FS_HZ = 200_000           # raw sampling rate of both channels
CPR = 1024                # encoder cycles per shaft revolution (Channel_2)
SPR = 2048                # samples per revolution of the angle-resampled (order-domain) signal -> Nyquist = 1024 orders
RAW_REVS = 16             # length of the emitted order-domain window, in revolutions (16*SPR = 32768 order samples)
RAW_DP = 4                # decimal places for the order-domain window (keeps the artifact under ~3 MB)
WDCNN_FS = 12_000         # the CWRU-trained WDCNN expects 12 kHz time-domain windows
WDCNN_WIN = 2048          # WDCNN input length (samples)

# ER-16K geometry (Huang & Baddour 2018, Table 1). Deep-groove => contact angle 0 deg.
BEARING = {
    "model": "ER-16K",
    "n": 9,
    "d": 7.94,            # ball diameter [mm]
    "D": 38.52,           # pitch diameter [mm]
    "contactAngle": 0.0,  # deg
}

CLASS_OF = {"H": "healthy", "I": "inner", "O": "outer"}
COND_NAME = {"A": "increasing", "B": "decreasing", "C": "inc-then-dec", "D": "dec-then-inc"}

# which (class, condition, trial) to emit -- classes x two speed conditions (A increasing, B decreasing).
# 11 samples (3 healthy + 4 inner + 4 outer) keeps the artifact under ~3 MB with full-fidelity 16-rev order windows.
SELECTION = [
    ("H", "A", 1), ("H", "B", 1), ("H", "A", 2),
    ("I", "A", 1), ("I", "B", 1), ("I", "A", 2), ("I", "B", 2),
    ("O", "A", 1), ("O", "B", 1), ("O", "A", 2), ("O", "B", 2),
]


def _fault_orders() -> dict:
    """Characteristic bearing-defect orders (multiples of shaft rate) from the ER-16K geometry."""
    n, d, D = BEARING["n"], BEARING["d"], BEARING["D"]
    c = np.cos(np.deg2rad(BEARING["contactAngle"]))
    r = d / D
    bpfo = (n / 2) * (1 - r * c)
    bpfi = (n / 2) * (1 + r * c)
    bsf = (D / (2 * d)) * (1 - (r * c) ** 2)   # ball-spin frequency; a ball defect strikes at 2*BSF
    ftf = 0.5 * (1 - r * c)
    return {
        "bpfo": round(float(bpfo), 4),
        "bpfi": round(float(bpfi), 4),
        "bsf": round(float(bsf), 4),
        "ftf": round(float(ftf), 4),
    }


def _encoder_edges(tac: np.ndarray) -> np.ndarray:
    """Rising-edge sample indices of the 1024-cycle/rev encoder pulse train (Channel_2)."""
    thr = 0.5 * (float(tac.max()) + float(tac.min()))
    above = tac > thr
    return np.where((~above[:-1]) & (above[1:]))[0].astype(np.float64)


def order_track(vib: np.ndarray, tac: np.ndarray, spr: int = SPR):
    """COMPUTED ORDER TRACKING. From the encoder build a monotone (sample-index -> cumulative-revolution) map, then
    resample the vibration onto a UNIFORM-ANGLE grid of `spr` samples/rev. Returns (angle_signal, total_revs, edges).

    Each rising edge advances the shaft by exactly 1/CPR rev, so cumulative revolution is known at every edge; we
    invert that to find the sample index at each uniform-angle target and linearly interpolate the vibration there.
    In the resulting signal the time axis is REVOLUTIONS, so a spectrum's x-axis is ORDERS (cycles/rev) and the
    defect lines are stationary even though the rpm sweeps."""
    edges = _encoder_edges(tac)
    rev_at_edge = np.arange(edges.size) / CPR
    total_revs = float(rev_at_edge[-1])
    n_out = int(total_revs * spr)
    rev_grid = np.arange(n_out) / spr
    samp_at_rev = np.interp(rev_grid, rev_at_edge, edges)          # sample index at each uniform-angle point
    vib_ang = np.interp(samp_at_rev, np.arange(vib.size, dtype=np.float64), vib)
    return vib_ang.astype(np.float64), total_revs, edges


def rpm_profile(edges: np.ndarray, n: int = 24) -> np.ndarray:
    """Instantaneous shaft rpm over the record (n coarse bins), from the time between successive full revolutions."""
    rev_times = edges[::CPR] / FS_HZ                               # time [s] at each completed revolution
    rpm = 60.0 / np.diff(rev_times)
    t = rev_times[:-1]
    grid = np.linspace(t[0], t[-1], n)
    return np.interp(grid, t, rpm)


def _envelope_order_spectrum(seg: np.ndarray, res_lo: float, res_hi: float, spr: int = SPR):
    """Band-pass the angle signal in a resonance ORDER band [res_lo,res_hi], take the Hilbert envelope, and return
    its order spectrum. This is squared-envelope analysis carried out entirely in the order domain."""
    seg = seg - seg.mean()
    N = seg.size
    X = np.fft.rfft(seg * np.hanning(N))
    fo = np.fft.rfftfreq(N, d=1.0 / spr)                           # orders
    mask = (fo >= res_lo) & (fo <= res_hi)
    Xb = np.zeros_like(X)
    Xb[mask] = X[mask]
    band = np.fft.irfft(Xb, n=N)
    env = np.abs(hilbert(band))
    env = env - env.mean()
    F = np.abs(np.fft.rfft(env * np.hanning(N)))
    orders = np.fft.rfftfreq(N, d=1.0 / spr)
    return orders, F


def _order_map(vib_ang: np.ndarray, edges: np.ndarray, spr: int = SPR,
               rev_per_block: int = 16, n_order_bins: int = 96, max_order: float = 12.0):
    """Compact rpm-vs-order map for Campbell / waterfall. Slice the angle signal into consecutive blocks of
    `rev_per_block` revolutions; for each block compute the order spectrum (0..max_order) and tag it with the mean rpm
    over that block. Returns (rpmBins[list], orderBins[list], mag[list-of-list]) with rows = blocks (rpm-ordered),
    cols = order bins. Magnitudes are normalized to the map max so the App can colour them directly."""
    block = rev_per_block * spr
    nblocks = vib_ang.size // block
    if nblocks < 2:
        nblocks = max(1, vib_ang.size // (spr * 4))
        block = vib_ang.size // nblocks
    # rpm at each block centre, from the encoder
    rev_times = edges[::CPR] / FS_HZ
    rpm_inst = 60.0 / np.diff(rev_times)
    rev_idx = np.arange(rpm_inst.size)                            # revolution index of each rpm sample
    order_axis = np.linspace(0.0, max_order, n_order_bins)
    rows, rpm_bins = [], []
    for b in range(nblocks):
        seg = vib_ang[b * block:(b + 1) * block]
        if seg.size < spr * 2:
            break
        seg = seg - seg.mean()
        N = seg.size
        F = np.abs(np.fft.rfft(seg * np.hanning(N)))
        fo = np.fft.rfftfreq(N, d=1.0 / spr)
        row = np.interp(order_axis, fo, F)                       # resample to the fixed order grid
        rows.append(row)
        # mean rpm over the revolutions spanned by this block
        rev_lo, rev_hi = b * rev_per_block, (b + 1) * rev_per_block
        sel = (rev_idx >= rev_lo) & (rev_idx < rev_hi)
        rpm_bins.append(float(np.mean(rpm_inst[sel])) if sel.any() else float(np.mean(rpm_inst)))
    mag = np.array(rows)
    if mag.size:
        mag = mag / (mag.max() + 1e-12)
    # order rows by ascending rpm so a Campbell plot reads bottom-up
    order_by_rpm = np.argsort(rpm_bins)
    mag = mag[order_by_rpm]
    rpm_bins = [round(rpm_bins[i], 1) for i in order_by_rpm]
    return rpm_bins, [round(float(o), 3) for o in order_axis], [[round(float(v), 4) for v in r] for r in mag]


def _wdcnn_window(vib: np.ndarray, n: int = WDCNN_WIN) -> list[float]:
    """A 12 kHz time-domain window for the CWRU-trained WDCNN cross-domain test. Resample the raw 200 kHz vibration to
    12 kHz (up=3, down=50 -> exact 200k/12k), take a centred mean-removed window of `n` samples. The model was trained
    on 12 kHz CWRU drive-end data, so the domain gap here is rig + speed-profile, the honest cross-domain story."""
    y = resample_poly(vib, 3, 50)
    mid = y.size // 2
    w = y[mid - n // 2: mid - n // 2 + n].astype(np.float64)
    w = w - w.mean()
    return [round(float(v), 5) for v in w]


def build_sample(key: tuple[str, str, int], raw_dir: Path) -> dict:
    cls_code, cond, trial = key
    path = raw_dir / f"{cls_code}-{cond}-{trial}.mat"
    m = loadmat(str(path))
    vib = m["Channel_1"].ravel().astype(np.float64)
    tac = m["Channel_2"].ravel().astype(np.float64)
    vib_ang, total_revs, edges = order_track(vib, tac)

    # order-domain raw window: RAW_REVS revolutions (RAW_REVS*SPR order samples) centred in the record. 16 revs is
    # long enough that envelope analysis of THIS window alone resolves BPFO (3.57/rev) and BPFI (5.43/rev) lines.
    n_raw = RAW_REVS * SPR
    mid = vib_ang.size // 2
    raw = vib_ang[mid - n_raw // 2: mid - n_raw // 2 + n_raw]
    raw = raw - raw.mean()

    rpm = rpm_profile(edges)
    rpm_bins, order_bins, order_mag = _order_map(vib_ang, edges)

    cls = CLASS_OF[cls_code]
    return {
        "cls": cls,
        "cond": cond,                                            # A/B/C/D speed profile
        "condName": COND_NAME[cond],
        "trial": trial,
        "revs": round(total_revs, 1),
        "rpmMin": round(float(rpm.min()), 1),
        "rpmMax": round(float(rpm.max()), 1),
        "rpmProfile": [round(float(x), 1) for x in rpm],         # 24-bin instantaneous rpm sweep
        "raw": [round(float(v), RAW_DP) for v in raw],           # RAW_REVS*SPR order-domain floats, fs = SPR samples/rev
        "rawTimeFs": WDCNN_FS,
        "rawTime": _wdcnn_window(vib),                           # 2048 floats @ 12 kHz for the WDCNN cross-domain test
        "orderMap": {                                            # Campbell / waterfall: rpm rows x order cols
            "rpmBins": rpm_bins,
            "orderBins": order_bins,
            "mag": order_mag,
        },
    }


def _peak_order(sample: dict, lo: float, hi: float) -> float:
    """Envelope-order peak of a sample's raw window inside [lo,hi] -- used for validation."""
    seg = np.asarray(sample["raw"], dtype=np.float64)
    # use the full angle signal would be better, but the raw window is enough to show the line; widen via resonance band
    orders, F = _envelope_order_spectrum(seg, 20.0, 120.0)
    band = (orders >= lo) & (orders <= hi)
    return float(orders[band][np.argmax(F[band])]) if band.any() else float("nan")


def build(raw_dir: str | Path) -> dict:
    raw_dir = Path(raw_dir)
    orders = _fault_orders()
    samples = []
    for key in SELECTION:
        path = raw_dir / f"{key[0]}-{key[1]}-{key[2]}.mat"
        if not path.exists():
            print(f"  skip {path.name} (missing)", flush=True)
            continue
        s = build_sample(key, raw_dir)
        samples.append(s)
        print(f"  {path.name}: cls={s['cls']:7s} cond={s['cond']} revs={s['revs']:.0f} "
              f"rpm {s['rpmMin']:.0f}->{s['rpmMax']:.0f} raw={len(s['raw'])} map={len(s['orderMap']['rpmBins'])}x"
              f"{len(s['orderMap']['orderBins'])}", flush=True)
    return {
        "source": "University of Ottawa bearing dataset, time-varying speed (Huang & Baddour 2018, Data in Brief 21:1745)",
        "fs": SPR,                                               # samples per revolution (order domain)
        "domain": "orders",
        "rawTimeFs": WDCNN_FS,
        "classes": ["healthy", "inner", "outer"],
        "bearing": {**BEARING, **orders},
        "wdcnnClasses": ["normal", "inner", "outer"],            # cross-domain mapping to the CWRU-trained WDCNN
        "conditions": COND_NAME,
        "samples": samples,
    }


def main() -> None:
    import argparse

    repo = Path(__file__).resolve().parents[3]
    ap = argparse.ArgumentParser(prog="rotorlab.io.ottawa")
    ap.add_argument("--raw", default=str(repo / "data-pipeline" / "_raw" / "ottawa"))
    ap.add_argument("--out", default=str(repo / "frontend" / "public" / "rv-ottawa-samples.json"))
    args = ap.parse_args()

    print(f"Ottawa: computed order tracking of {args.raw}", flush=True)
    art = build(args.raw)
    Path(args.out).write_text(json.dumps(art, separators=(",", ":")), encoding="utf-8")
    sz = Path(args.out).stat().st_size / 1024
    print(f"wrote {args.out}: {len(art['samples'])} samples, {sz:.0f} KB", flush=True)


if __name__ == "__main__":
    main()
