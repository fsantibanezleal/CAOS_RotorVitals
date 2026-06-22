"""Fetch the MFPT Society bearing fault dataset (T13 — the cross-DATASET generalization test).

Link-only redistribution: the data is downloaded from the MathWorks `RollingElementBearingFaultDiagnosis-Data`
repository (which redistributes the MFPT Society set) and is NEVER committed (`data/raw/` is git-ignored). It is a
DIFFERENT test rig from CWRU — a NICE bearing (8 balls, BPFO ≈ 3.245× / BPFI ≈ 4.755× shaft rate), sampled at
48828 / 97656 Hz — so running the CWRU-trained WDCNN on it is a true held-out cross-dataset (domain-shift) test.

Each `.mat` holds a `bearing` struct: `gs` (acceleration signal), `sr` (sample rate Hz), `rate` (shaft Hz), `load`
(lbs). Class is encoded in the filename: baseline_* = normal, OuterRaceFault* = outer, InnerRaceFault* = inner
(MFPT has no rolling-element/ball fault). Refs: MFPT Society fault data sets (mfpt.org); Bechhoefer (2013).
"""
from __future__ import annotations

import subprocess
import zipfile
from pathlib import Path

ARCHIVE_URL = "https://github.com/mathworks/RollingElementBearingFaultDiagnosis-Data/archive/refs/heads/master.zip"
SUBDIR = "RollingElementBearingFaultDiagnosis-Data-master"

# A curated, class-balanced MFPT subset spanning both sample rates. file (relative to SUBDIR) -> class. None of
# these were ever in WDCNN training (the model only ever saw CWRU), so the whole set is held out by construction.
MFPT_FILES: dict[str, str] = {
    "train_data/baseline_1.mat": "normal",
    "train_data/baseline_2.mat": "normal",
    "test_data/baseline_3.mat": "normal",
    "train_data/OuterRaceFault_1.mat": "outer",   # 97656 Hz constant-speed set
    "train_data/OuterRaceFault_2.mat": "outer",
    "test_data/OuterRaceFault_3.mat": "outer",
    "train_data/InnerRaceFault_vload_1.mat": "inner",  # 48828 Hz variable-load set
    "train_data/InnerRaceFault_vload_3.mat": "inner",
    "test_data/InnerRaceFault_vload_6.mat": "inner",
}


def _valid(p: Path) -> bool:
    if not (p.exists() and p.stat().st_size > 100_000):
        return False
    try:
        from scipy.io import loadmat
        m = loadmat(str(p))
        return "bearing" in m
    except Exception:
        return False


def download(dst: str | Path) -> Path:
    """Download + extract the MFPT archive into dst/ (idempotent). Returns the SUBDIR root."""
    out = Path(dst)
    out.mkdir(parents=True, exist_ok=True)
    root = out / SUBDIR
    have_all = all(_valid(root / rel) for rel in MFPT_FILES)
    if have_all:
        return root
    zpath = out / "mfpt.zip"
    if not (zpath.exists() and zpath.stat().st_size > 1_000_000):
        print(f"  downloading MFPT archive -> {zpath} ...", flush=True)
        subprocess.run(["curl", "-s", "-L", "--retry", "4", "--retry-all-errors", "--max-time", "300",
                        "-o", str(zpath), ARCHIVE_URL], check=False)
    if not (zpath.exists() and zpath.stat().st_size > 1_000_000):
        raise SystemExit("failed to download the MFPT archive")
    with zipfile.ZipFile(zpath) as z:
        z.extractall(out)
    missing = [rel for rel in MFPT_FILES if not _valid(root / rel)]
    if missing:
        raise SystemExit(f"MFPT archive extracted but these files are missing/invalid: {missing}")
    return root


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(prog="rotorlab.io.fetch_mfpt")
    ap.add_argument("--dst", default="data/raw/mfpt")
    args = ap.parse_args()
    root = download(args.dst)
    print(f"MFPT ready in {root} ({len(MFPT_FILES)} files, link-only — not re-hosted)")


if __name__ == "__main__":
    main()
