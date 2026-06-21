"""Fetch the real CWRU 12 kHz drive-end bearing recordings into data/raw/cwru/ (git-ignored, never re-hosted).

Link-only redistribution: the raw .mat files are downloaded from the Case Western Reserve University Bearing
Data Center and are NEVER committed. `scripts/fetch-data` calls this before the heavy precompute (--retrain) lane.
Refs: CWRU Bearing Data Center (engineering.case.edu/bearingdatacenter); Smith & Randall 2015 (MSSP 64-65:100-131)
for the difficulty/leakage caveats. Bearing SKF 6205-2RS JEM defect multipliers per the CWRU bearing page.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

BASE_URL = "https://engineering.case.edu/sites/default/files/{}.mat"

# file number -> (class, load HP, shaft rpm). 12 kHz DE; 0.007" faults + Normal baseline.
# rpm by load: 0HP=1797, 1HP=1772, 2HP=1750, 3HP=1730 (CWRU). Normal files are 48 kHz (decimated downstream).
FILES: dict[int, tuple[str, int, int]] = {
    97: ("normal", 0, 1797), 98: ("normal", 1, 1772), 99: ("normal", 2, 1750), 100: ("normal", 3, 1730),
    105: ("inner", 0, 1797), 106: ("inner", 1, 1772), 107: ("inner", 2, 1750), 108: ("inner", 3, 1730),
    118: ("ball", 0, 1797), 119: ("ball", 1, 1772), 120: ("ball", 2, 1750), 121: ("ball", 3, 1730),
    130: ("outer", 0, 1797), 131: ("outer", 1, 1772), 132: ("outer", 2, 1750), 133: ("outer", 3, 1730),
}


def _valid(p: Path) -> bool:
    """A file is valid iff it is large enough AND loadmat succeeds AND it carries a DE channel (catches truncation)."""
    if not (p.exists() and p.stat().st_size > 100_000):
        return False
    try:
        from scipy.io import loadmat  # lazy: only the heavy lane installs scipy
        m = loadmat(str(p))
        return any(k.endswith("DE_time") for k in m)
    except Exception:
        return False


def download(dst: str | Path) -> Path:
    out = Path(dst)
    out.mkdir(parents=True, exist_ok=True)
    for n in FILES:
        p = out / f"{n}.mat"
        if _valid(p):
            continue
        ok = False
        for attempt in range(4):
            print(f"  downloading {n}.mat (try {attempt + 1}) ...", flush=True)
            if p.exists():
                p.unlink()
            subprocess.run(
                ["curl", "-s", "-L", "--retry", "4", "--retry-all-errors", "--max-time", "300",
                 "-o", str(p), BASE_URL.format(n)],
                check=False,
            )
            if _valid(p):
                ok = True
                break
        if not ok:
            raise SystemExit(f"failed to download a valid {n}.mat after 4 tries")
    return out


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(prog="rotorlab.io.fetch_cwru")
    ap.add_argument("--dst", default="data/raw/cwru")
    args = ap.parse_args()
    out = download(args.dst)
    print(f"CWRU ready in {out} ({len(FILES)} files, link-only — not re-hosted)")


if __name__ == "__main__":
    main()
