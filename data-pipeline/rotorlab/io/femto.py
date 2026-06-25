"""FEMTO / PRONOSTIA (IEEE PHM 2012) run-to-failure bearing dataset.

REAL prognostics data for RotorVitals — until now the RUL page was driven by a synthetic forward model. FEMTO is
17 accelerated run-to-failure trajectories (6 learning + 11 test, three operating conditions). Each trajectory is a
sequence of acc_NNNNN.csv snapshots recorded every 10 s; each snapshot is 2560 samples @ 25.6 kHz of horizontal +
vertical acceleration (columns: hour, minute, second, microsecond, accel_horizontal, accel_vertical).

This module reads the downloaded archive (link-only redistribution — the zip is NOT committed) and reduces every
trajectory to its health-indicator curve HI(t) = RMS of horizontal acceleration per snapshot, the standard FEMTO HI.
That curve is the genuine flat-then-rising degradation the RUL stage projects, so the prognostics shown in the App
are computed from real bearing life, not a synthetic trend.

Operating conditions (Nectoux et al. 2012): C1 = 1800 rpm / 4000 N (Bearing1_*), C2 = 1650 rpm / 4200 N (Bearing2_*),
C3 = 1500 rpm / 5000 N (Bearing3_*). Sampling 25.6 kHz, 0.1 s record every 10 s.

Source: IEEE PHM 2012 Prognostic Challenge (FEMTO-ST). Download: the wkzs111 GitHub mirror of the official set.
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import numpy as np

ARCHIVE_URL = "https://github.com/wkzs111/phm-ieee-2012-data-challenge-dataset/archive/refs/heads/master.zip"
INNER_PREFIX = "phm-ieee-2012-data-challenge-dataset-master/"
FS_HZ = 25_600
SNAPSHOT_PERIOD_S = 10.0  # one acc record every 10 s
CONDITION = {"1": {"rpm": 1800, "load_n": 4000}, "2": {"rpm": 1650, "load_n": 4200}, "3": {"rpm": 1500, "load_n": 5000}}


def _snapshot_rms(raw: bytes) -> float:
    """RMS of the horizontal-acceleration column (index 4) of one acc_*.csv snapshot."""
    flat = np.fromstring(raw.replace(b"\n", b",").replace(b";", b","), sep=",")
    if flat.size < 6:
        return float("nan")
    m = flat[: (flat.size // 6) * 6].reshape(-1, 6)
    h = m[:, 4]
    return float(np.sqrt(np.mean(h * h)))


def trajectories(zip_path: str | Path) -> list[dict]:
    """Reduce every run-to-failure trajectory to its HI(t) = per-snapshot RMS curve."""
    zf = zipfile.ZipFile(zip_path)
    groups: dict[tuple[str, str], list[str]] = {}
    for n in zf.namelist():
        if n.endswith(".csv") and "/acc_" in n:
            parts = n.split("/")
            key = (parts[-3], parts[-2])  # (set, bearing)
            groups.setdefault(key, []).append(n)

    out: list[dict] = []
    for (setname, bearing), files in sorted(groups.items()):
        files.sort()  # acc_00001 < acc_00002 < ...
        rms = np.array([_snapshot_rms(zf.read(f)) for f in files], dtype=float)
        rms = rms[np.isfinite(rms)]
        hours = (np.arange(rms.size) * SNAPSHOT_PERIOD_S) / 3600.0
        cond = bearing.replace("Bearing", "")[0]  # '1' / '2' / '3'
        setcat = "learning" if "Learning" in setname else ("full" if "Full" in setname else "test")
        out.append(
            {
                "id": bearing,
                "set": setcat,  # learning/full = complete (run to failure); test = truncated challenge trajectory
                "condition": cond,
                "rpm": CONDITION[cond]["rpm"],
                "loadN": CONDITION[cond]["load_n"],
                "nSnapshots": int(rms.size),
                "lifeHours": round(float(hours[-1]), 3) if rms.size else 0.0,
                "hours": [round(float(x), 4) for x in hours],
                "hi": [round(float(x), 5) for x in rms],  # health indicator = RMS of horizontal accel [g]
            }
        )
        print(f"  {setname}/{bearing}: {rms.size} snapshots, HI {rms[0]:.3f}->{rms[-1]:.3f} g, life {hours[-1]:.2f} h", flush=True)
    return out


def _smooth(y: np.ndarray, w: int = 9) -> np.ndarray:
    if y.size < w:
        return y
    return np.convolve(y, np.ones(w) / w, mode="same")


def frontend_artifact(trajs: list[dict], threshold_g: float = 2.0, n_points: int = 160) -> dict:
    """Compact App artifact: the COMPLETE trajectories (learning + full-test, which run to failure) reduced to a
    decimated HI curve plus a REAL first-passage trueFail at an absolute alarm threshold (g RMS). The truncated
    challenge trajectories (set='test') have no failure point, so they are excluded from the RUL set."""
    sel: list[dict] = []
    for t in trajs:
        if t["set"] == "test":
            continue
        hi = np.asarray(t["hi"], dtype=float)
        hrs = np.asarray(t["hours"], dtype=float)
        if hi.size < 30:
            continue
        s = _smooth(hi)
        cross = np.where(s >= threshold_g)[0]
        true_fail = round(float(hrs[cross[0]]), 3) if cross.size else None
        idx = np.unique(np.linspace(0, hi.size - 1, min(n_points, hi.size)).astype(int))
        pts = [{"t": round(float(hrs[i]), 4), "hi": round(float(hi[i]), 4)} for i in idx]
        sel.append(
            {
                "id": t["id"],
                "condition": t["condition"],
                "rpm": t["rpm"],
                "loadN": t["loadN"],
                "lifeHours": t["lifeHours"],
                "threshold": threshold_g,
                "trueFail": true_fail,
                "points": pts,
            }
        )
    sel.sort(key=lambda x: (x["condition"], x["id"]))
    return {"source": "FEMTO/PRONOSTIA (IEEE PHM 2012, FEMTO-ST)", "thresholdG": threshold_g, "nTrajectories": len(sel), "trajectories": sel}


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    repo = Path(__file__).resolve().parents[3]
    ap.add_argument("--zip", default=str(repo / "data-pipeline" / "_raw" / "femto.zip"))
    ap.add_argument("--out", default=str(repo / "data-pipeline" / "_raw" / "femto_hi.json"))
    ap.add_argument("--frontend-out", default=str(repo / "frontend" / "public" / "rv-femto-rtf.json"))
    args = ap.parse_args()
    print(f"FEMTO: reducing trajectories from {args.zip}", flush=True)
    trajs = trajectories(args.zip)
    payload = {"source": "FEMTO/PRONOSTIA (IEEE PHM 2012, FEMTO-ST)", "fsHz": FS_HZ, "snapshotPeriodS": SNAPSHOT_PERIOD_S, "trajectories": trajs}
    Path(args.out).write_text(json.dumps(payload), encoding="utf-8")
    print(f"wrote {args.out}: {len(trajs)} real run-to-failure HI trajectories", flush=True)
    art = frontend_artifact(trajs)
    Path(args.frontend_out).write_text(json.dumps(art), encoding="utf-8")
    n_fail = sum(1 for t in art["trajectories"] if t["trueFail"] is not None)
    print(f"wrote {args.frontend_out}: {art['nTrajectories']} complete trajectories ({n_fail} reach the {art['thresholdG']} g alarm)", flush=True)


if __name__ == "__main__":
    main()
