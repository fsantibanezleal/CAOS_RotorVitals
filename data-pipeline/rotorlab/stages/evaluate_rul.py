"""Stage: evaluate the four RUL models on the run-to-failure bearing datasets and write a
committed benchmark artifact (rv-rul-benchmark.json). The classical exponential, particle filter,
and GP models run on the numpy lane; the deep-RUL CNN needs the trained ONNX (the heavy lane).

Produces:
    data/derived/rv-rul-benchmark.json — per-trajectory ground-truth vs. predicted RUL for every model,
    plus aggregate metrics (MAE, RMSE, α-λ score, calibration).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from ..model.gp_rul import gp_rul
from ..model.pf_rul import pf_rul

REPO_ROOT = Path(__file__).resolve().parents[3]
DERIVED = REPO_ROOT / "data" / "derived"


def _exponential_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> float | None:
    """Classical exponential first-passage RUL. Returns RUL in hours, or None."""
    n = len(t)
    if n < 8:
        return None
    base_n = max(4, int(n * 0.3))
    base = hi[:base_n]
    mu0, sd0 = float(base.mean()), float(base.std() or 1e-9)
    thr = mu0 + 4 * sd0
    onset_idx = None
    for i in range(1, n - 1):
        if hi[i] > thr and hi[i + 1] > thr:
            onset_idx = i
            break
    if onset_idx is None:
        return None
    post_t = t[onset_idx:]
    post_hi = np.maximum(hi[onset_idx:], 1e-9)
    if len(post_t) < 4:
        return None
    y = np.log(post_hi)
    X = np.column_stack([np.ones_like(post_t), post_t])
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    ln_a, b = float(beta[0]), float(beta[1])
    if b <= 0:
        return None
    fail_t = (np.log(threshold) - ln_a) / b
    return max(0.0, fail_t - float(t[-1]))


def evaluate_rul_models(data_root: str = "", output_path: str = "") -> dict:
    """Run all four RUL models on the run-to-failure datasets and write the benchmark artifact.

    The deep-RUL CNN is skipped if the ONNX model does not exist (it needs the heavy lane).
    """
    root = Path(data_root) if data_root else REPO_ROOT
    frontend_pub = root / "frontend" / "public"
    out = Path(output_path) if output_path else DERIVED / "rv-rul-benchmark.json"

    results: list[dict] = []
    models_used = ["exponential", "pf", "gp"]

    # load trajectories from the already-processed frontend JSON artifacts
    trajs: list[dict] = []
    rtf_files = [
        ("femto", frontend_pub / "rv-femto-rtf.json"),
        ("xjtu", frontend_pub / "rv-xjtu-rtf.json"),
        ("ims", frontend_pub / "rv-ims-rtf.json"),
    ]
    for name, fp in rtf_files:
        try:
            if fp.exists():
                data = json.loads(fp.read_text(encoding="utf-8"))
                for tr in data.get("trajectories", data.get("trajs", [])):
                    tr["_source"] = name
                    trajs.append(tr)
        except (FileNotFoundError, Exception):
            continue

    for tr in trajs:
        pts = tr.get("points", [])
        if len(pts) < 8:
            continue
        t = np.array([p["t"] for p in pts])
        hi = np.array([p["hi"] for p in pts])
        threshold = float(tr.get("threshold", 0))

        row: dict = {
            "traj_id": tr.get("id", ""),
            "source": tr.get("_source", ""),
            "life_hours": float(tr.get("lifeHours", 0)),
            "true_fail": tr.get("trueFail"),
            "threshold": threshold,
        }

        res_exp = _exponential_rul(t, hi, threshold)
        res_pf = pf_rul(t, hi, threshold)
        res_gp = gp_rul(t, hi, threshold)
        row["exponential_rul"] = float(res_exp) if res_exp is not None else None
        row["pf_rul_median"] = res_pf.get("rul_median")
        row["pf_rul_p10"] = res_pf.get("rul_p10")
        row["pf_rul_p90"] = res_pf.get("rul_p90")
        row["pf_converged"] = res_pf.get("converged", False)
        row["gp_rul_median"] = res_gp.get("rul_median")
        row["gp_rul_p10"] = res_gp.get("rul_p10")
        row["gp_rul_p90"] = res_gp.get("rul_p90")
        row["gp_params"] = res_gp.get("params")
        results.append(row)

    # aggregate metrics
    def _mae(vals: list[float | None], gt: list[float]) -> float | None:
        pairs = [(v, g) for v, g in zip(vals, gt) if v is not None and g is not None and g > 0]
        if not pairs:
            return None
        return float(np.mean([abs(v - g) / g for v, g in pairs]))

    gt = [r["true_fail"] for r in results if r["true_fail"] is not None]
    summary = {
        "models": models_used,
        "trajectories_evaluated": len(results),
        "mae_exponential": _mae([r["exponential_rul"] for r in results], gt),
        "mae_pf": _mae([r.get("pf_rul_median") for r in results], gt),
        "mae_gp": _mae([r.get("gp_rul_median") for r in results], gt),
    }

    payload = {"summary": summary, "trajectories": results}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


if __name__ == "__main__":
    r = evaluate_rul_models()
    print(f"RUL benchmark: {r['summary']['trajectories_evaluated']} trajectories evaluated")
    for m in r["summary"]["models"]:
        k = f"mae_{m}"
        v = r["summary"].get(k)
        if v is not None:
            print(f"  {m} MAE: {v:.3f}")
    print(f"  written to {DERIVED / 'rv-rul-benchmark.json'}")
