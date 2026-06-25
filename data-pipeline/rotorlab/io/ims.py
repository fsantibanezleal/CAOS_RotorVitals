"""IMS (NSF I/UCR Center for Intelligent Maintenance Systems) bearing run-to-failure dataset, via NASA PCoE.

REAL prognostics data — three run-to-failure tests on a shaft with four Rexnord ZA-2115 bearings at 2000 rpm under a
6000 lb radial load, 1 s snapshots @ 20 kHz taken every ~10 min until a bearing failed:
  - Test 1 (1st_test): 8 channels (4 bearings x 2 axes). Bearing 3 inner-race + Bearing 4 roller-element failure.
  - Test 2 (2nd_test): 4 channels. Bearing 1 outer-race failure.
  - Test 3 (4th_test/txt): 4 channels. Bearing 3 outer-race failure.

This reduces each FAILING bearing to HI(t) = per-snapshot RMS acceleration, with real elapsed time parsed from the
snapshot filenames (YYYY.MM.DD.HH.MM.SS), and an adaptive first-passage trueFail. Emits the same compact App artifact
shape as FEMTO/XJTU so it slots straight into the corrected RUL/trajectory source. Raw data is link-only (gitignored).
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np

FS_HZ = 20_000
RPM = 2000
LOAD_N = 26_689  # 6000 lbf radial

# (test dir, file-glob subdir, 0-indexed columns of the FAILING bearings, per-bearing label/fault)
TESTS = [
    ("1st_test", "", [(4, "B3", "inner"), (6, "B4", "roller")]),
    ("2nd_test", "", [(0, "B1", "outer")]),
    ("4th_test", "txt", [(2, "B3", "outer")]),  # NASA packages the 3rd test under 4th_test/txt
]
STRIDE = 2  # process every 2nd snapshot (~20 min) — the HI curve is smooth; halves the I/O


def _parse_ts(name: str) -> datetime | None:
    try:
        return datetime.strptime(name, "%Y.%m.%d.%H.%M.%S")
    except ValueError:
        return None


def _rms_col(path: Path, col: int) -> float:
    try:
        a = np.loadtxt(path, usecols=(col,))
    except Exception:
        return float("nan")
    return float(np.sqrt(np.mean(a * a))) if a.size else float("nan")


def trajectories(ims_root: str | Path) -> list[dict]:
    root = Path(ims_root)
    out: list[dict] = []
    for test_dir, sub, bearings in TESTS:
        d = root / test_dir / sub if sub else root / test_dir
        files = [(p.name, p) for p in d.iterdir() if p.is_file() and _parse_ts(p.name)]
        files.sort(key=lambda x: x[0])
        files = files[::STRIDE]
        if not files:
            print(f"  {test_dir}: no snapshots found", flush=True)
            continue
        t0 = _parse_ts(files[0][0])
        hours = np.array([(_parse_ts(n) - t0).total_seconds() / 3600.0 for n, _ in files])
        for col, bid, fault in bearings:
            rms = np.array([_rms_col(p, col) for _, p in files], dtype=float)
            ok = np.isfinite(rms)
            rms, hrs = rms[ok], hours[ok]
            out.append(
                {
                    "id": f"{test_dir.split('_')[0]}-{bid}",
                    "set": "ims",
                    "condition": fault,  # rpm is rendered separately by the App option template
                    "rpm": RPM,
                    "loadN": LOAD_N,
                    "nSnapshots": int(rms.size),
                    "lifeHours": round(float(hrs[-1]), 3) if rms.size else 0.0,
                    "hours": [round(float(x), 4) for x in hrs],
                    "hi": [round(float(x), 6) for x in rms],
                }
            )
            print(f"  {test_dir}/{bid} ({fault}): {rms.size} snaps, HI {rms[0]:.4f}->{rms[-1]:.4f} g, life {hrs[-1]:.1f} h", flush=True)
    return out


def _smooth(y: np.ndarray, w: int = 9) -> np.ndarray:
    return y if y.size < w else np.convolve(y, np.ones(w) / w, mode="same")


def frontend_artifact(trajs: list[dict], n_points: int = 160) -> dict:
    """IMS RMS magnitudes are dataset-specific (much smaller than FEMTO/XJTU's 2 g), so the alarm is adaptive per
    trajectory: threshold = max(4x healthy baseline, baseline + 6 sigma of the healthy window). trueFail = first
    passage of the smoothed HI through it — a REAL end-of-life marker, not a fixed constant."""
    sel: list[dict] = []
    for t in trajs:
        hi = np.asarray(t["hi"], dtype=float)
        hrs = np.asarray(t["hours"], dtype=float)
        if hi.size < 30:
            continue
        s = _smooth(hi)
        n0 = max(5, hi.size // 5)  # healthy window = first 20%
        base = float(np.median(s[:n0]))
        sd = float(np.std(s[:n0]))
        threshold = round(max(4.0 * base, base + 6.0 * sd), 5)
        cross = np.where(s >= threshold)[0]
        true_fail = round(float(hrs[cross[0]]), 3) if cross.size else None
        idx = np.unique(np.linspace(0, hi.size - 1, min(n_points, hi.size)).astype(int))
        pts = [{"t": round(float(hrs[i]), 4), "hi": round(float(hi[i]), 5)} for i in idx]
        sel.append({"id": t["id"], "condition": t["condition"], "rpm": t["rpm"], "loadN": t["loadN"], "lifeHours": t["lifeHours"], "threshold": threshold, "trueFail": true_fail, "points": pts})
    sel.sort(key=lambda x: x["id"])
    return {"source": "IMS (Univ. of Cincinnati / NASA PCoE)", "thresholdMode": "adaptive per-trajectory", "nTrajectories": len(sel), "trajectories": sel}


def main() -> None:
    repo = Path(__file__).resolve().parents[3]
    ims_root = repo / "data-pipeline" / "_raw" / "ims"
    print(f"IMS: reducing run-to-failure trajectories from {ims_root}", flush=True)
    trajs = trajectories(ims_root)
    (repo / "data-pipeline" / "_raw" / "ims_hi.json").write_text(json.dumps({"source": "IMS", "fsHz": FS_HZ, "trajectories": trajs}), encoding="utf-8")
    art = frontend_artifact(trajs)
    (repo / "frontend" / "public" / "rv-ims-rtf.json").write_text(json.dumps(art), encoding="utf-8")
    n_fail = sum(1 for t in art["trajectories"] if t["trueFail"] is not None)
    print(f"wrote rv-ims-rtf.json: {art['nTrajectories']} trajectories ({n_fail} reach the adaptive alarm)", flush=True)


if __name__ == "__main__":
    main()
