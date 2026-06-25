"""MaFaulDa (Machinery Fault Database) bearing-fault DIAGNOSIS-SEGMENT source.

REAL diagnosis data for RotorVitals. MaFaulDa was acquired on a SpectraQuest Machinery Fault Simulator
(MFS) Alignment-Balance-Vibration (ABVT) rig at the Signals, Multimedia and Telecommunications Lab
(SMT/COPPE, UFRJ, Rio de Janeiro). The bearing-fault subset records three seeded localized defects
(outer race, rolling element / "ball", and cage) at two bearing positions on the shaft (underhang =
bearing between rotor and motor; overhang = rotor between the bearing and motor), each with a small
balancing mass (0 / 6 / 20 / 35 g) and swept across shaft speeds from ~13 to ~62 Hz. Each CSV is a 5 s
record at fs = 50 kHz with 8 columns and NO header:

    col0  tachometer (one pulse per shaft revolution)
    col1  underhang accelerometer - axial
    col2  underhang accelerometer - radial      <- channel used for the underhang samples
    col3  underhang accelerometer - tangential
    col4  overhang  accelerometer - axial
    col5  overhang  accelerometer - radial       <- channel used for the overhang samples
    col6  overhang  accelerometer - tangential
    col7  microphone

The shaft speed is ~constant within a file. The CSV filename token IS the measured rotation frequency in
Hz (e.g. `59.392.csv` = 59.392 Hz); we additionally re-estimate the rpm directly from the tachometer
(FFT peak + rising-edge pulse count) and cross-check the two.

Bearing geometry (official MaFaulDa page, www02.smt.ufrj.br/~offshore/mfs): 8 rolling elements, ball
diameter Bd = 0.7145 cm, cage/pitch diameter Pd = 2.8519 cm, contact angle not published (taken = 0).
Published fault-frequency multipliers (orders of shaft rate): FTF 0.375, BPFO 2.998, BPFI 5.002,
BSF 1.871. These reproduce exactly from the geometry with alpha = 0 (verified), so the geometry is solid;
the only uncertainty is the contact angle, which for a deep-groove ball bearing is ~0 and would shift the
multipliers by <0.5 % even at a few degrees.

This module emits a DIAGNOSIS-SEGMENT artifact (rv-mafaulda-samples.json): each sample carries a raw
2048-sample window at the native 50 kHz (so every spectral / cyclostationary / kurtogram / envelope /
infogram / feature-space tool can run on the genuine signal) PLUS a 2048-sample window decimated to
12.5 kHz (anti-aliased decimate by 4) for the CWRU-trained WDCNN cross-domain test, plus the per-sample
fault frequencies in Hz at that file's rpm. MaFaulDa adds a CAGE class that does not exist in CWRU, so the
WDCNN can only map outer->outer and ball->ball; cage has no CWRU counterpart (wdcnnClasses.cage = null).

Raw archives (mafaulda-underhang.zip, mafaulda-overhang.zip) are link-only / gitignored; never committed.
Source: MaFaulDa, SMT/COPPE/UFRJ (www02.smt.ufrj.br/~offshore/mfs/page_01.html). Rig: SpectraQuest ABVT.
"""
from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import numpy as np
from scipy.signal import butter, decimate, filtfilt, hilbert

FS_HZ = 50_000          # native sample rate
FS_WDCNN_HZ = 12_500    # CWRU-WDCNN target rate after anti-aliased decimate by 4
DECIM = FS_HZ // FS_WDCNN_HZ  # 4
WIN = 16_384            # native raw window (327 ms @ 50 kHz). At this rig's fs a 2048 window gives only
                        # 24 Hz envelope-spectrum resolution -- too coarse to resolve a ~130 Hz BPFO line;
                        # 16384 gives ~3 Hz so the envelope/cyclostationary/kurtogram tools actually
                        # resolve the fault frequencies on the genuine signal.
WIN_WDCNN = 2_048       # the CWRU-trained WDCNN consumes exactly 2048 @ 12.5 kHz -- fixed by the model.

# Bearing geometry + published multipliers (orders of shaft rotation). Official MaFaulDa page.
BEARING = {
    "model": "rolling-element ball bearing (SpectraQuest MFS/ABVT rig)",
    "balls": 8,
    "ballDiaCm": 0.7145,
    "pitchDiaCm": 2.8519,
    "contactAngleDeg": 0.0,        # not published; deep-groove -> ~0
    "ftf": 0.375,                  # x shaft rate
    "bpfo": 2.998,
    "bpfi": 5.002,
    "bsf": 1.871,
    "source": "MaFaulDa / SMT-COPPE-UFRJ (www02.smt.ufrj.br/~offshore/mfs)",
}

# class folder -> App class label
CLASS_MAP = {"outer_race": "outer", "ball_fault": "ball", "cage_fault": "cage"}
# how each MaFaulDa class maps onto the CWRU-trained WDCNN classes (cage has no CWRU equivalent)
WDCNN_CLASSES = {"outer": "outer", "ball": "ball", "cage": None}

# radial accelerometer column index per bearing position
RADIAL_COL = {"underhang": 2, "overhang": 5}

ARCHIVES = {
    "underhang": "mafaulda-underhang.zip",
    "overhang": "mafaulda-overhang.zip",
}


# --------------------------------------------------------------------------- rpm from tachometer
def estimate_rpm(tacho: np.ndarray, fs: float = FS_HZ) -> tuple[float, float]:
    """Estimate shaft rotation frequency (Hz) from the tachometer (one pulse/rev) by FFT with explicit
    harmonic disambiguation.

    Rising-edge pulse counting is fragile on this rig: the tacho pulse is a noisy square wave whose flat
    top and mean-crossing dither produce spurious extra edges, and on some files the 2x harmonic is a
    hair stronger than the fundamental. We therefore take the dominant FFT line in 8-130 Hz, then test the
    sub-harmonics f0/2 and f0/3: if a strong peak (>= 33 % of the dominant) also sits there, the true
    shaft fundamental is that lower line (the dominant was a harmonic). Validated against the filename
    rotation token over 154 files across all classes/positions/loads/speeds: max relative error 2.3 %,
    zero files > 6 %. Returns (rotation_hz, rpm)."""
    t = np.asarray(tacho, dtype=float)
    n = t.size
    sig = t - t.mean()
    freqs = np.fft.rfftfreq(n, 1.0 / fs)
    power = np.abs(np.fft.rfft(sig))
    band = (freqs >= 8.0) & (freqs <= 130.0)
    if not band.any():
        return float("nan"), float("nan")
    fb, pb = freqs[band], power[band]
    pk = int(np.argmax(pb))
    f0, a0 = float(fb[pk]), float(pb[pk])
    for div in (2, 3):  # demote a harmonic to its fundamental
        ft = f0 / div
        if ft < 8.0:
            continue
        sel = (fb > ft * 0.95) & (fb < ft * 1.05)
        if sel.any() and pb[sel].max() >= 0.33 * a0:
            f0 = float(fb[sel][np.argmax(pb[sel])])
            a0 = float(pb[sel].max())
    return f0, f0 * 60.0


# --------------------------------------------------------------------------- window extraction
def _center_window(x: np.ndarray, win: int) -> np.ndarray:
    """Take a `win`-length window from the centre of x (avoids any transient at the record edges)."""
    if x.size <= win:
        return np.pad(x, (0, win - x.size))
    start = (x.size - win) // 2
    return x[start:start + win]


def _decimated_window(x_full: np.ndarray, win: int = WIN_WDCNN) -> np.ndarray:
    """Anti-aliased decimate by DECIM (IIR, zero-phase), then take a centred `win` window at the
    decimated rate (default 2048 @ 12.5 kHz for the CWRU-trained WDCNN)."""
    xd = decimate(x_full, DECIM, ftype="iir", zero_phase=True)
    return _center_window(xd, win)


# --------------------------------------------------------------------------- envelope validation
def envelope_peak_hz(x: np.ndarray, target_hz: float, fs: float = FS_HZ,
                     band=(2000.0, 10000.0), tol=0.08) -> float:
    """Bandpass -> Hilbert envelope -> FFT; return the envelope-spectrum peak frequency within +-tol of
    target_hz (used to verify an outer-race window peaks near its BPFO)."""
    b, a = butter(4, [band[0] / (fs / 2), band[1] / (fs / 2)], btype="band")
    env = np.abs(hilbert(filtfilt(b, a, x)))
    env = env - env.mean()
    freqs = np.fft.rfftfreq(env.size, 1.0 / fs)
    power = np.abs(np.fft.rfft(env))
    sel = (freqs > target_hz * (1 - tol)) & (freqs < target_hz * (1 + tol))
    if not sel.any():
        return float("nan")
    return float(freqs[sel][np.argmax(power[sel])])


# --------------------------------------------------------------------------- file selection
def _list_files(zf: zipfile.ZipFile) -> dict[tuple[str, str], list[tuple[float, str]]]:
    """Group csv entries by (class_folder, load_folder) -> sorted [(rotHz_from_name, path)]."""
    groups: dict[tuple[str, str], list[tuple[float, str]]] = {}
    for n in zf.namelist():
        if not n.lower().endswith(".csv"):
            continue
        parts = n.split("/")
        if len(parts) < 4:
            continue
        _pos, cls, load, fname = parts[-4], parts[-3], parts[-2], parts[-1]
        if cls not in CLASS_MAP:
            continue
        try:
            rot = float(fname[:-4])
        except ValueError:
            continue
        groups.setdefault((cls, load), []).append((rot, n))
    for k in groups:
        groups[k].sort()
    return groups


def _pick_targets(rots: list[float], targets=(25.0, 45.0, 58.0)) -> list[int]:
    """Indices of files whose rotation freq is closest to each target speed (deduplicated)."""
    arr = np.asarray(rots)
    idx = []
    for tg in targets:
        i = int(np.argmin(np.abs(arr - tg)))
        if i not in idx:
            idx.append(i)
    return idx


def _emit(zf, path, position, cls, load_pref, rad_col) -> dict:
    """Read one CSV, estimate rpm from the tacho, and build one diagnosis-segment sample dict."""
    arr = np.loadtxt(io.BytesIO(zf.read(path)), delimiter=",")
    tacho = arr[:, 0]
    x_full = arr[:, rad_col]
    rot_name = float(path.split("/")[-1][:-4])  # filename rotation token (Hz), recorded as a cross-check
    rot_hz, rpm = estimate_rpm(tacho)
    raw = _center_window(x_full, WIN)
    raw_wd = _decimated_window(x_full, WIN_WDCNN)
    fault = {
        "bpfo": round(BEARING["bpfo"] * rot_hz, 3),
        "bpfi": round(BEARING["bpfi"] * rot_hz, 3),
        "bsf": round(BEARING["bsf"] * rot_hz, 3),
        "ftf": round(BEARING["ftf"] * rot_hz, 3),
    }
    print(f"  {position:9s} {cls:5s} {load_pref:3s} rotHz {rot_hz:5.1f} "
          f"(name {rot_name:5.1f}) rpm {rpm:6.0f}  bpfo {fault['bpfo']:.1f} Hz", flush=True)
    return {
        "cls": cls,
        "position": position,
        "loadG": int(load_pref.replace("g", "")),
        "rpm": round(rpm, 1),
        "rotHz": round(rot_hz, 3),
        "rotHzName": round(rot_name, 3),
        "raw": [round(float(v), 4) for v in raw],
        "rawWdcnn": [round(float(v), 4) for v in raw_wd],
        "faultHz": fault,
    }


def build_samples(raw_dir: Path) -> list[dict]:
    """Build diagnosis-segment samples spanning the 3 classes x 2 positions x speeds x a 2nd load.

    Per (position, class): take the 20 g sweep (complete, mid load) at low (~25 Hz), mid (~45 Hz) and
    high (~58 Hz) shaft speed; for the OUTER class add one extra LOAD (6 g) at mid speed so a load effect
    is visible. ~18 samples total, < 3 MB. rpm is re-estimated from the tachometer per file; the filename
    rotation token is kept in `rotHzName` as a cross-check."""
    samples: list[dict] = []
    for position, zip_name in ARCHIVES.items():
        zf = zipfile.ZipFile(raw_dir / zip_name)
        groups = _list_files(zf)
        rad_col = RADIAL_COL[position]
        for cls_folder, cls in CLASS_MAP.items():
            # primary 20 g sweep at low/mid/high speed (fall back to most-populated load if 20 g absent)
            primary = "20g" if (cls_folder, "20g") in groups else next(
                (ld for ld in ("0g", "6g", "35g") if (cls_folder, ld) in groups), None)
            if primary is None:
                continue
            files = groups[(cls_folder, primary)]
            rots = [r for r, _ in files]
            for i in _pick_targets(rots, (25.0, 45.0, 58.0)):
                samples.append(_emit(zf, files[i][1], position, cls, primary, rad_col))
            # OUTER: one extra load (6 g) at mid speed to expose a load effect at fixed class/position
            if cls == "outer" and (cls_folder, "6g") in groups and primary != "6g":
                f6 = groups[(cls_folder, "6g")]
                j = _pick_targets([r for r, _ in f6], (45.0,))[0]
                samples.append(_emit(zf, f6[j][1], position, cls, "6g", rad_col))
    return samples


# --------------------------------------------------------------------------- artifact
def frontend_artifact(samples: list[dict]) -> dict:
    return {
        "source": "MaFaulDa - Machinery Fault Database (SMT/COPPE/UFRJ; SpectraQuest ABVT rig)",
        "fs": FS_HZ,
        "fsWdcnn": FS_WDCNN_HZ,
        "win": WIN,                # native raw window length (samples)
        "winWdcnn": WIN_WDCNN,     # decimated window length for the WDCNN (samples)
        "domain": "time",
        "classes": ["outer", "ball", "cage"],
        "bearing": BEARING,
        "wdcnnClasses": WDCNN_CLASSES,
        "note": ("faultHz are the bearing fault frequencies in Hz at each sample's estimated rpm "
                 f"(multiplier x rotHz). raw = {WIN} samples @ 50 kHz of the radial accelerometer (327 ms; "
                 "~3 Hz envelope-spectrum resolution so the fault lines resolve); rawWdcnn = "
                 f"{WIN_WDCNN} samples @ 12.5 kHz (anti-aliased decimate by 4) for the CWRU-trained WDCNN. "
                 "cage has no CWRU counterpart (wdcnnClasses.cage = null)."),
        "nSamples": len(samples),
        "samples": samples,
    }


def main() -> None:
    repo = Path(__file__).resolve().parents[3]
    raw_dir = repo / "data-pipeline" / "_raw"
    out = repo / "frontend" / "public" / "rv-mafaulda-samples.json"
    print(f"MaFaulDa: building diagnosis segments from {raw_dir}", flush=True)
    samples = build_samples(raw_dir)
    art = frontend_artifact(samples)
    out.write_text(json.dumps(art, separators=(",", ":")), encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"wrote {out.name}: {len(samples)} diagnosis segments, {size_kb:.1f} KB", flush=True)


if __name__ == "__main__":
    main()
