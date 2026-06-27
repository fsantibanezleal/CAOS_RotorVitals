#!/usr/bin/env python3
"""Cross-validate RUL models: Python (reference) vs TypeScript (frontend) on identical synthetic data.
Generates 5 test scenarios (clean / noisy / early / late / edge), runs PF and GP in both languages,
reports discrepancies. Fails (exit 1) if cross-lang agreement exceeds tolerance."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
FRONTEND = REPO / "frontend"

SCENARIOS = {
    "clean_strong": dict(a=0.3, b=0.15, tMax=18, n=20, noise=0.005, thr=30.0, seed=0),
    "noisy_weak": dict(a=0.5, b=0.06, tMax=40, n=25, noise=0.04, thr=6.0, seed=1),
    "early_onset": dict(a=0.2, b=0.25, tMax=10, n=15, noise=0.01, thr=15.0, seed=2),
    "late_no_onset": dict(a=0.1, b=0.01, tMax=30, n=20, noise=0.005, thr=5.0, seed=3),
    "sharp_rise": dict(a=0.08, b=0.30, tMax=12, n=16, noise=0.02, thr=20.0, seed=4),
}


def generate(sc: dict) -> dict:
    rng = np.random.default_rng(sc["seed"])
    t = np.linspace(0, sc["tMax"], sc["n"])
    hi = sc["a"] * np.exp(sc["b"] * t) + rng.normal(0, sc["noise"], len(t))
    return {"t": t.tolist(), "hi": hi.tolist(), "threshold": sc["thr"],
            "label": f"a={sc['a']},b={sc['b']},n={sc['n']}"}


def run_python(data: dict) -> dict:
    from rotorlab.model.pf_rul import pf_rul
    from rotorlab.model.gp_rul import gp_rul
    t = np.array(data["t"]); hi = np.array(data["hi"]); thr = data["threshold"]
    pf = pf_rul(t, hi, thr)
    gp = gp_rul(t, hi, thr)
    return {
        "pf_rul": pf.get("rul_median"), "pf_p10": pf.get("rul_p10"), "pf_p90": pf.get("rul_p90"),
        "gp_rul": gp.get("rul_median"), "gp_onset": gp.get("onset"),
    }


def run_typescript(data: dict) -> dict:
    proc = subprocess.run(
        ["node", "--import", "tsx", "test/cross_validate_rul.ts"],
        input=json.dumps(data), cwd=str(FRONTEND), capture_output=True, text=True, timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"TS subprocess failed:\n{proc.stderr[:400]}")
    return json.loads(proc.stdout)


def main():
    sys.path.insert(0, str(REPO / "data-pipeline"))
    print(f"{'SCENARIO':<20} {'PF_py':>8} {'PF_ts':>8} {'OK':>6}  {'GP_py':>8} {'GP_ts':>8} {'OK':>6}")
    print("-" * 78)
    errors = 0
    for name, sc in SCENARIOS.items():
        data = generate(sc)
        pyt = run_python(data)
        ts = run_typescript(data)
        pf_ok = _agree(pyt.get("pf_rul"), ts.get("pf_rul"), name, 0.3)
        gp_ok = _agree(pyt.get("gp_rul"), ts.get("gp_rul"), name, 0.5)
        if not pf_ok: errors += 1
        if not gp_ok: errors += 1
        pf_mark = "OK" if pf_ok else "FAIL"
        gp_mark = "OK" if gp_ok else "FAIL"
        print(f"{name:<20} {pyt['pf_rul'] or 0:>8.1f} {ts['pf_rul'] or 0:>8.1f} {pf_mark:>6}  "
              f"{pyt['gp_rul'] or 0:>8.1f} {ts['gp_rul'] or 0:>8.1f} {gp_mark:>6}")
    print(f"\nCross-validation errors: {errors}")
    if errors:
        print("FIX DISCREPANCIES between TS and Python implementations.")
    else:
        print("All models agree within tolerance. Implementations are consistent.")
    sys.exit(1 if errors else 0)


def _agree(py_val, ts_val, name, tol):
    if py_val is None and ts_val is None: return True
    if py_val is None or ts_val is None: return False
    if max(py_val, ts_val) < 1e-6: return True
    return abs(py_val - ts_val) / max(abs(py_val), abs(ts_val), 1e-6) < tol


if __name__ == "__main__":
    main()
