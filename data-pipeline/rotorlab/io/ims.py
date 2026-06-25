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

# --- Raw life-snapshot frames (for the App's "Real: RUL" signal suite + 3D waterfall) ---
RAW_WIN = 2048        # contiguous samples kept per snapshot (window of the main vibration channel)
RAW_FS = FS_HZ        # 20 kHz — the raw window keeps the native sample rate (NOT order-tracked)
LIFE_FRACS = [0.0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0]  # target life fractions for the snapshots
# Only the SELECTABLE failing trajectories (trueFail != null) carry raw frames. Maps the emitted
# trajectory id -> (test dir, file-glob subdir, 0-indexed main/horizontal vibration column).
FRAME_SOURCES = {
    "2nd-B1": ("2nd_test", "", 0),   # Bearing 1 outer-race failure, 4 channels, col 0
    "4th-B3": ("4th_test", "txt", 2),  # Bearing 3 outer-race failure (NASA's 3rd test), 4 channels, col 2
}


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


def _raw_window(path: Path, col: int, n: int = RAW_WIN) -> np.ndarray:
    """Read a contiguous n-sample window of the given channel from a 20480x4 tab-separated snapshot.
    Reads only the first n rows (max_rows) to keep I/O light; returns the channel as float32 g-units."""
    a = np.loadtxt(path, usecols=(col,), max_rows=n)
    return np.asarray(a, dtype=np.float32)


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) if x.size else float("nan")


def frames_artifact(ims_root: str | Path) -> dict:
    """For each SELECTABLE failing trajectory, emit ~8 raw life-snapshots at the LIFE_FRACS fractions.

    Each snapshot stores a contiguous RAW_WIN-sample window of the main vibration channel (g), with the
    real elapsed time/frac from the filename timestamps. The frac=1.0 (failure) snapshot is snapped to the
    peak-RMS file in the last ~5 % of life, because on some IMS bearings (notably 2nd-B1) the literal last
    file is a post-failure flat/clipped reading — the peak-RMS file carries the genuine failure signature."""
    root = Path(ims_root)
    frames: dict[str, list[dict]] = {}
    for tid, (test_dir, sub, col) in FRAME_SOURCES.items():
        d = root / test_dir / sub if sub else root / test_dir
        named = [(p.name, p) for p in d.iterdir() if p.is_file() and _parse_ts(p.name)]
        named.sort(key=lambda x: x[0])
        if not named:
            print(f"  frames {tid}: no snapshots found", flush=True)
            continue
        names = [n for n, _ in named]
        paths = [p for _, p in named]
        t0 = _parse_ts(names[0])
        hours = np.array([(_parse_ts(n) - t0).total_seconds() / 3600.0 for n in names])
        life = float(hours[-1]) if hours.size else 0.0

        # Snap the failure point (frac=1.0) to the peak-RMS file in the last 5 % of life — avoids the
        # post-failure flat tail. Scan that tail once.
        tail_lo = np.searchsorted(hours, 0.95 * life)
        tail_idx = range(tail_lo, len(paths))
        peak_i, peak_rms = len(paths) - 1, -1.0
        for i in tail_idx:
            r = _rms(_raw_window(paths[i], col))
            if np.isfinite(r) and r > peak_rms:
                peak_i, peak_rms = i, r

        # Map each target fraction to a file index (nearest in elapsed time), the last one = failure file.
        chosen: list[int] = []
        for f in LIFE_FRACS:
            if f >= 1.0:
                idx = peak_i
            else:
                idx = int(np.argmin(np.abs(hours - f * life)))
            if chosen and idx <= chosen[-1]:
                idx = min(chosen[-1] + 1, len(paths) - 1)  # keep strictly increasing
            chosen.append(idx)
        chosen = sorted(set(chosen))

        flist: list[dict] = []
        for i in chosen:
            raw = _raw_window(paths[i], col)
            flist.append(
                {
                    "t": round(float(hours[i]), 4),
                    "frac": round(float(hours[i] / life) if life else 0.0, 4),
                    "rms": round(_rms(raw), 6),
                    "raw": [round(float(v), 5) for v in raw],
                }
            )
        frames[tid] = flist
        rmss = [fr["rms"] for fr in flist]
        print(f"  frames {tid}: {len(flist)} snaps, rms {rmss[0]:.4f}->{rmss[-1]:.4f} g, win {RAW_WIN} @ {RAW_FS} Hz", flush=True)
    return {"fs": RAW_FS, "win": RAW_WIN, "frames": frames}


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

    frames = frames_artifact(ims_root)
    (repo / "frontend" / "public" / "rv-ims-frames.json").write_text(json.dumps(frames, separators=(",", ":")), encoding="utf-8")
    nfr = sum(len(v) for v in frames["frames"].values())
    print(f"wrote rv-ims-frames.json: {len(frames['frames'])} selectable trajectories, {nfr} raw life-snapshots", flush=True)


if __name__ == "__main__":
    main()
