"""XJTU-SY run-to-failure bearing dataset (Wang, Lei et al., Xi'an Jiaotong University + Changxing Sumyoung Tech).

REAL prognostics data, 15 accelerated run-to-failure bearings across 3 operating conditions (35 Hz/12 kN,
37.5 Hz/11 kN, 40 Hz/10 kN), 5 bearings each. Each bearing folder holds per-minute CSVs (1.csv, 2.csv, ...; the
last file is failure). Each CSV: 32768 samples = 1.28 s at 25.6 kHz, two columns (Horizontal/Vertical vibration).

This reduces every trajectory to HI(t) = RMS of horizontal acceleration per minute-file, the standard XJTU HI; the
RUL of file k is (totalFiles - k) minutes. Emits the same compact App artifact shape as FEMTO so it slots straight
into the corrected RUL/trajectory source. Raw archive is link-only (gitignored).
"""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

import numpy as np

FS_HZ = 25_600
SAMPLES_PER_FILE = 32_768  # 1.28 s
CONDITION = {"35Hz12kN": {"rpm": 2100, "load_n": 12000}, "37.5Hz11kN": {"rpm": 2250, "load_n": 11000}, "40Hz10kN": {"rpm": 2400, "load_n": 10000}}

# Raw life-snapshot frames (companion artifact rv-xjtu-frames.json). Each selectable trajectory carries a
# handful of contiguous raw windows of the horizontal vibration channel at evenly spaced life fractions, so
# the App's "Real: RUL" mode can run the full signal suite (envelope/spectrogram/kurtogram/...) + a real
# degradation 3D waterfall + feature-space trajectory on genuine samples, not only the HI summary curve.
FRAME_FRACS = [0.0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0]  # life fractions; last == failure file
RAW_WIN = 2048  # samples per frame window (contiguous, from the start of the snapshot file)
RAW_DECIMALS = 4  # ~5 sig digits at ±2.5..±22 g; keeps the artifact small


def _horizontal_signal(raw: bytes) -> np.ndarray:
    """Decode one XJTU CSV file -> 1-D array of the horizontal vibration channel (column 0, g)."""
    text = raw.decode("utf-8", "ignore").strip().split("\n")
    if len(text) < 2:
        return np.empty(0)
    vals = []
    for line in text[1:]:  # skip header "Horizontal_vibration_signals,Vertical_vibration_signals"
        c = line.split(",")
        if c:
            try:
                vals.append(float(c[0]))  # Horizontal_vibration_signals
            except ValueError:
                pass
    return np.asarray(vals, dtype=float)


def _rms_horizontal(raw: bytes) -> float:
    a = _horizontal_signal(raw)
    if a.size == 0:
        return float("nan")
    return float(np.sqrt(np.mean(a * a)))


def trajectories(zip_path: str | Path) -> list[dict]:
    zf = zipfile.ZipFile(zip_path)
    groups: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for n in zf.namelist():
        if n.endswith(".csv"):
            parts = n.split("/")
            if len(parts) < 3:
                continue
            cond, bearing, fname = parts[-3], parts[-2], parts[-1]
            if cond not in CONDITION:
                continue
            try:
                idx = int(fname.replace(".csv", ""))
            except ValueError:
                continue
            groups.setdefault((cond, bearing), []).append((idx, n))

    out: list[dict] = []
    for (cond, bearing), files in sorted(groups.items()):
        files.sort()  # by minute index, this order IS the run-to-failure life order
        rms_all = np.array([_rms_horizontal(zf.read(p)) for _, p in files], dtype=float)
        fin = np.isfinite(rms_all)
        rms = rms_all[fin]
        paths = [p for (_, p), ok in zip(files, fin) if ok]  # paths aligned to the finite-RMS HI series
        minutes = np.arange(rms.size, dtype=float)  # one file = one minute
        hours = minutes / 60.0
        out.append(
            {
                "id": bearing,
                "set": "xjtu",
                "condition": cond,
                "rpm": CONDITION[cond]["rpm"],
                "loadN": CONDITION[cond]["load_n"],
                "nSnapshots": int(rms.size),
                "lifeHours": round(float(hours[-1]), 3) if rms.size else 0.0,
                "hours": [round(float(x), 4) for x in hours],
                "hi": [round(float(x), 5) for x in rms],
                "_paths": paths,  # internal: zip member per life index (stripped from the HI artifact)
            }
        )
        print(f"  {cond}/{bearing}: {rms.size} files, HI {rms[0]:.3f}->{rms[-1]:.3f} g, life {hours[-1]:.2f} h", flush=True)
    return out


def _smooth(y: np.ndarray, w: int = 9) -> np.ndarray:
    return y if y.size < w else np.convolve(y, np.ones(w) / w, mode="same")


def frontend_artifact(trajs: list[dict], threshold_g: float = 2.0, n_points: int = 160) -> dict:
    sel: list[dict] = []
    for t in trajs:
        hi = np.asarray(t["hi"], dtype=float)
        hrs = np.asarray(t["hours"], dtype=float)
        if hi.size < 30:
            continue
        s = _smooth(hi)
        cross = np.where(s >= threshold_g)[0]
        true_fail = round(float(hrs[cross[0]]), 3) if cross.size else None
        idx = np.unique(np.linspace(0, hi.size - 1, min(n_points, hi.size)).astype(int))
        pts = [{"t": round(float(hrs[i]), 4), "hi": round(float(hi[i]), 4)} for i in idx]
        sel.append({"id": t["id"], "condition": t["condition"], "rpm": t["rpm"], "loadN": t["loadN"], "lifeHours": t["lifeHours"], "threshold": threshold_g, "trueFail": true_fail, "points": pts})
    sel.sort(key=lambda x: (x["condition"], x["id"]))
    return {"source": "XJTU-SY (Wang/Lei, Xi'an Jiaotong University)", "thresholdG": threshold_g, "nTrajectories": len(sel), "trajectories": sel}


def _true_fail_hours(hi: np.ndarray, hrs: np.ndarray, threshold_g: float) -> float | None:
    """Replicates frontend_artifact's alarm-crossing rule so the frame set matches the selectable list."""
    if hi.size < 30:
        return None
    s = _smooth(hi)
    cross = np.where(s >= threshold_g)[0]
    return round(float(hrs[cross[0]]), 3) if cross.size else None


def frames_artifact(zip_path: str | Path, trajs: list[dict], threshold_g: float = 2.0) -> dict:
    """Raw life-snapshot windows for every SELECTABLE trajectory (trueFail != None).

    For each such trajectory we pick ~len(FRAME_FRACS) life snapshots at fractions FRAME_FRACS (clamped to the
    available files; the last == the failure file), read the corresponding raw zip member, take a contiguous
    RAW_WIN-sample window of the horizontal vibration channel, and store it (g) keyed by the trajectory id.
    """
    zf = zipfile.ZipFile(zip_path)
    frames: dict[str, list[dict]] = {}
    for t in trajs:
        hi = np.asarray(t["hi"], dtype=float)
        hrs = np.asarray(t["hours"], dtype=float)
        if _true_fail_hours(hi, hrs, threshold_g) is None:
            continue  # not selectable in the App -> no frames needed
        paths = t["_paths"]
        n = len(paths)
        if n == 0:
            continue
        # map life fractions -> file indices, clamp, dedupe, force the last == failure file
        idx = sorted({min(n - 1, max(0, int(round(f * (n - 1))))) for f in FRAME_FRACS})
        if idx[-1] != n - 1:
            idx.append(n - 1)
        snaps: list[dict] = []
        for i in idx:
            sig = _horizontal_signal(zf.read(paths[i]))
            if sig.size < RAW_WIN:
                continue
            w = sig[:RAW_WIN]
            rms = float(np.sqrt(np.mean(w * w)))
            snaps.append(
                {
                    "t": round(float(hrs[i]), 4),
                    "frac": round(float(i / (n - 1)) if n > 1 else 0.0, 4),
                    "rms": round(rms, 5),
                    "raw": [round(float(x), RAW_DECIMALS) for x in w],
                }
            )
        frames[t["id"]] = snaps
        print(f"  frames {t['id']}: {len(snaps)} snapshots, rms {snaps[0]['rms']:.3f}->{snaps[-1]['rms']:.3f} g", flush=True)
    return {"fs": FS_HZ, "win": RAW_WIN, "channel": "horizontal", "frames": frames}


def main() -> None:
    repo = Path(__file__).resolve().parents[3]
    zip_path = repo / "data-pipeline" / "_raw" / "xjtu-sy.zip"
    print(f"XJTU-SY: reducing trajectories from {zip_path}", flush=True)
    trajs = trajectories(zip_path)
    # xjtu_hi.json (intermediate HI dump) must not carry the internal _paths list
    hi_dump = [{k: v for k, v in t.items() if k != "_paths"} for t in trajs]
    (repo / "data-pipeline" / "_raw" / "xjtu_hi.json").write_text(json.dumps({"source": "XJTU-SY", "fsHz": FS_HZ, "trajectories": hi_dump}), encoding="utf-8")
    art = frontend_artifact(trajs)
    (repo / "frontend" / "public" / "rv-xjtu-rtf.json").write_text(json.dumps(art), encoding="utf-8")
    n_fail = sum(1 for t in art["trajectories"] if t["trueFail"] is not None)
    print(f"wrote rv-xjtu-rtf.json: {art['nTrajectories']} trajectories ({n_fail} reach the {art['thresholdG']} g alarm)", flush=True)
    # companion raw-frame artifact for the App's "Real: RUL" signal suite + degradation waterfall
    fr = frames_artifact(zip_path, trajs, threshold_g=art["thresholdG"])
    (repo / "frontend" / "public" / "rv-xjtu-frames.json").write_text(json.dumps(fr), encoding="utf-8")
    n_snap = sum(len(v) for v in fr["frames"].values())
    print(f"wrote rv-xjtu-frames.json: {len(fr['frames'])} trajectories, {n_snap} raw snapshots ({RAW_WIN} samples @ {FS_HZ} Hz)", flush=True)


if __name__ == "__main__":
    main()
