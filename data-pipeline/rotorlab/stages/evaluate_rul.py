"""Stage: evaluate the RUL models on the run-to-failure bearing datasets under the field-standard
PROGNOSTIC protocol (Saxena et al. 2010, IJPHM 1(1), DOI 10.36001/ijphm.2010.v1i1.1336) and write
a committed benchmark artifact (rv-rul-benchmark.json).

Protocol (the previous stage was broken: it compared the last-instant predicted RUL against the
ABSOLUTE failure time, so predicting zero at end-of-life scored 1.0, and it zip-misaligned the
filtered ground truth). The corrected protocol:

  * Only trajectories with a REAL first-passage failure (`trueFail` known) are evaluable.
  * At each life fraction λ ∈ {0.5, 0.7, 0.9}, feed the model ONLY the data up to t = λ·trueFail
    and compare the predicted RUL against the TRUE remaining life r*(λ) = (1 − λ)·trueFail.
  * Metrics (Saxena 2010):
      - α-λ accuracy: prediction lies in [(1−α)·r*, (1+α)·r*], with α = 0.2, aggregated as a hit rate.
      - Relative Accuracy RA(λ) = 1 − |r* − r̂| / r*  (per checkpoint; averaged over trajectories).
      - Cumulative RA (CRA): mean RA over the checkpoints.
      - Prognostic Horizon (PH): earliest λ from which every later prediction stays inside the α-cone,
        reported as the lead time (trueFail − t_PH) in hours, averaged over trajectories that reach it.

Produces: data/derived/rv-rul-benchmark.json — per (trajectory × model × checkpoint) predictions +
per-model aggregate metrics. The deep-RUL CNN is skipped unless its ONNX exists (heavy lane).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from ..model.gp_rul import gp_rul
from ..model.pf_rul import pf_rul

REPO_ROOT = Path(__file__).resolve().parents[3]
DERIVED = REPO_ROOT / "data" / "derived"

LIFE_FRACTIONS = (0.5, 0.7, 0.9)  # λ checkpoints (Saxena protocol)
ALPHA = 0.2  # α-cone half-width (±20 %)


def _exponential_rul(t: np.ndarray, hi: np.ndarray, threshold: float) -> float | None:
    """Classical exponential first-passage RUL from the data seen so far. RUL in hours, or None."""
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


def _predict_at(model: str, t: np.ndarray, hi: np.ndarray, threshold: float) -> float | None:
    """Predicted RUL (hours) from the slice seen so far, per model. None if no prediction yet."""
    if model == "exponential":
        return _exponential_rul(t, hi, threshold)
    if model == "pf":
        return pf_rul(t, hi, threshold).get("rul_median")
    if model == "gp":
        return gp_rul(t, hi, threshold).get("rul_median")
    return None


def _load_trajectories(frontend_pub: Path) -> list[dict]:
    trajs: list[dict] = []
    for name, fp in [
        ("femto", frontend_pub / "rv-femto-rtf.json"),
        ("xjtu", frontend_pub / "rv-xjtu-rtf.json"),
        ("ims", frontend_pub / "rv-ims-rtf.json"),
    ]:
        try:
            if fp.exists():
                data = json.loads(fp.read_text(encoding="utf-8"))
                for tr in data.get("trajectories", data.get("trajs", [])):
                    tr["_source"] = name
                    trajs.append(tr)
        except (FileNotFoundError, ValueError):
            continue
    return trajs


def evaluate_rul_models(data_root: str = "", output_path: str = "") -> dict:
    """Run the RUL models under the Saxena checkpoint protocol and write the benchmark artifact."""
    root = Path(data_root) if data_root else REPO_ROOT
    frontend_pub = root / "frontend" / "public"
    out = Path(output_path) if output_path else DERIVED / "rv-rul-benchmark.json"

    models = ["exponential", "pf", "gp"]
    trajs = _load_trajectories(frontend_pub)

    per_traj: list[dict] = []
    # accumulators: per model → per λ → lists of RA and α-hit; PH lead-times per model
    ra: dict[str, dict[float, list[float]]] = {m: {lam: [] for lam in LIFE_FRACTIONS} for m in models}
    hit: dict[str, dict[float, list[int]]] = {m: {lam: [] for lam in LIFE_FRACTIONS} for m in models}
    ph_lead: dict[str, list[float]] = {m: [] for m in models}
    n_evaluable = 0

    for tr in trajs:
        pts = tr.get("points", [])
        true_fail = tr.get("trueFail")
        if true_fail is None or len(pts) < 8:
            continue  # only trajectories with a real first-passage failure are evaluable
        n_evaluable += 1
        t_all = np.array([p["t"] for p in pts], dtype=float)
        hi_all = np.array([p["hi"] for p in pts], dtype=float)
        threshold = float(tr.get("threshold", 0))
        true_fail = float(true_fail)

        row: dict = {
            "traj_id": tr.get("id", ""),
            "source": tr.get("_source", ""),
            "true_fail_h": true_fail,
            "checkpoints": [],
        }

        # per-model α-cone entry tracking for the prognostic horizon
        cone_ok: dict[str, list[bool]] = {m: [] for m in models}

        for lam in LIFE_FRACTIONS:
            t_cp = lam * true_fail
            k = int(np.searchsorted(t_all, t_cp, side="right"))  # points up to the checkpoint
            r_star = (1.0 - lam) * true_fail  # true remaining life at the checkpoint
            cp: dict = {"lambda": lam, "t_h": round(t_cp, 4), "true_rul_h": round(r_star, 4)}
            if k < 8 or r_star <= 0:
                for m in models:
                    cp[f"{m}_rul_h"] = None
                    cone_ok[m].append(False)
                row["checkpoints"].append(cp)
                continue
            t_s, hi_s = t_all[:k], hi_all[:k]
            for m in models:
                pred = _predict_at(m, t_s, hi_s, threshold)
                cp[f"{m}_rul_h"] = None if pred is None else round(float(pred), 4)
                if pred is None:
                    cone_ok[m].append(False)
                    continue
                in_cone = (1 - ALPHA) * r_star <= pred <= (1 + ALPHA) * r_star
                hit[m][lam].append(1 if in_cone else 0)
                ra[m][lam].append(max(0.0, 1.0 - abs(r_star - pred) / r_star))
                cone_ok[m].append(bool(in_cone))
            row["checkpoints"].append(cp)

        # prognostic horizon: earliest checkpoint from which every LATER prediction stays in-cone
        for m in models:
            flags = cone_ok[m]
            ph = None
            for i, lam in enumerate(LIFE_FRACTIONS):
                if flags[i] and all(flags[i:]):
                    ph = lam
                    break
            if ph is not None:
                ph_lead[m].append((1.0 - ph) * true_fail)  # lead time before failure, hours
        per_traj.append(row)

    def _mean(xs: list[float]) -> float | None:
        return round(float(np.mean(xs)), 4) if xs else None

    summary = {
        "protocol": "saxena2010-checkpoints",
        "protocol_doi": "10.36001/ijphm.2010.v1i1.1336",
        "alpha": ALPHA,
        "life_fractions": list(LIFE_FRACTIONS),
        "trajectories_evaluable": n_evaluable,
        "models": {},
    }
    for m in models:
        all_hits = [h for lam in LIFE_FRACTIONS for h in hit[m][lam]]
        summary["models"][m] = {
            "alpha_lambda_accuracy": _mean([float(h) for h in all_hits]),  # hit rate across all checkpoints
            "ra_by_lambda": {str(lam): _mean(ra[m][lam]) for lam in LIFE_FRACTIONS},
            "cra": _mean([v for lam in LIFE_FRACTIONS for v in ra[m][lam]]),
            "prognostic_horizon_h": _mean(ph_lead[m]),
            "n_predictions": len(all_hits),
        }

    payload = {"summary": summary, "trajectories": per_traj}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


if __name__ == "__main__":
    r = evaluate_rul_models()
    s = r["summary"]
    print(f"RUL benchmark (Saxena protocol): {s['trajectories_evaluable']} evaluable trajectories, "
          f"checkpoints λ={s['life_fractions']}, α={s['alpha']}")
    for m, mm in s["models"].items():
        al = mm["alpha_lambda_accuracy"]
        cra = mm["cra"]
        ph = mm["prognostic_horizon_h"]
        print(f"  {m:12s} α-λ acc {al if al is not None else '—'}  "
              f"CRA {cra if cra is not None else '—'}  "
              f"PH {ph if ph is not None else '—'} h  (n={mm['n_predictions']})")
    print(f"  written to {DERIVED / 'rv-rul-benchmark.json'}")
