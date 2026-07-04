"""Build the Wang et al. (2020) reference trajectory library from XJTU-SY + FEMTO data.

Exports: frontend/public/rv-wang2020-refs.json, a compact JSON artifact containing
normalised reference trajectories and their exponential-linear model parameters
for live Fréchet-distance matching in the browser.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from ..model.wang2020 import build_ref_library, export_ref_library

REPO_ROOT = Path(__file__).resolve().parents[3]
FRONTEND_PUBLIC = REPO_ROOT / "frontend" / "public"


def _load_trajectories(path: str) -> list[dict]:
    """Load frames artifact and extract per-trajectory HI curves (RMS).
    Uses ALL available frames, not just 8 evenly-spaced snapshots."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    trajectories: list[dict] = []
    frames = data.get("frames", {})
    for _tid, snaps in frames.items():
        snaps_sorted = sorted(snaps, key=lambda s: s.get("frac", 0))
        if len(snaps_sorted) < 5:
            continue
        t_vals = []
        hi_vals = []
        for s in snaps_sorted:
            t_vals.append(float(s.get("frac", 0)) * 100)  # scale to ~hours
            hi_vals.append(float(s.get("rms", s.get("hi", 0))))
        trajectories.append({"t": np.array(t_vals), "hi": np.array(hi_vals)})
    return trajectories


def build_wang2020_refs_stage(
    xjtu_path: str = "",
    femto_path: str = "",
    threshold: float = 30.0,
    alpha_ridge: float = 1.0,
) -> dict:
    xjtu = xjtu_path or str(FRONTEND_PUBLIC / "rv-xjtu-frames.json")
    femto = femto_path or str(FRONTEND_PUBLIC / "rv-femto-frames.json")

    trajs = _load_trajectories(xjtu) + _load_trajectories(femto)
    if len(trajs) < 5:
        raise RuntimeError(f"Only {len(trajs)} trajectories found. Run XJTU/FEMTO io parsers first.")

    refs = build_ref_library(trajs, threshold, alpha_ridge)
    out_path = str(FRONTEND_PUBLIC / "rv-wang2020-refs.json")
    export_ref_library(refs, out_path)

    return {
        "n_trajectories": len(trajs),
        "n_refs": len(refs),
        "threshold": threshold,
        "alpha_ridge": alpha_ridge,
        "output": out_path,
    }


if __name__ == "__main__":
    import sys
    r = build_wang2020_refs_stage()
    print(f"Wang 2020 reference library: {r['n_refs']} refs from {r['n_trajectories']} trajectories")
    print(f"  → {r['output']}")
    sys.exit(0)
