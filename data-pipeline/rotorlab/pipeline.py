"""The offline pipeline orchestrator + CLI (ADR-0057). Per case it applies CONTRACT 1, builds the compact per-case
trace from the REAL committed learned-tier artifacts, runs the lane gate, and writes the manifest + a flat index
(CONTRACT 2). The committed ONNX + metrics ARE the heavy lane's real outputs, so the DEFAULT path is light
(numpy/stdlib, no torch) and deterministic. `--retrain` first regenerates those artifacts from the raw CWRU data
(torch + scipy) and then rebuilds the replay layer.

    python -m rotorlab.pipeline                 # rebuild all replay traces + manifests from committed artifacts
    python -m rotorlab.pipeline dx-inner-3hp    # one case
    python -m rotorlab.pipeline all --retrain   # regenerate the ONNX/metrics from raw CWRU, then rebuild
"""
from __future__ import annotations

import argparse
from pathlib import Path

from . import registry
from .core.manifest import build_index
from .io.contract import validate_records
from .io.fetch_cwru import FILES
from .io.formats import read_json, write_json
from .stages import export

# data-pipeline/rotorlab/pipeline.py -> parents[2] = repo root (works under `pip install -e .` too)
REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
RAW_CWRU = REPO_ROOT / "data" / "raw" / "cwru"
RAW_MFPT = REPO_ROOT / "data" / "raw" / "mfpt"

STAGES = ("preprocess", "feature_extraction", "train", "infer", "evaluate", "export")


def _load_artifacts() -> tuple[dict, dict, dict]:
    need = ["rv-cwru-samples.json", "rv-learned-metrics.json", "cwru-benchmark.json"]
    missing = [n for n in need if not (DERIVED / n).exists()]
    if missing:
        raise SystemExit(
            f"missing committed artifacts in {DERIVED}: {missing}. "
            f"These are the heavy lane's outputs — run `python -m rotorlab.pipeline all --retrain` "
            f"(after scripts/fetch-data) to regenerate them, or restore the committed copies."
        )
    return (read_json(DERIVED / "rv-cwru-samples.json"),
            read_json(DERIVED / "rv-learned-metrics.json"),
            read_json(DERIVED / "cwru-benchmark.json"))


def _contract_flags() -> list[dict]:
    """Apply CONTRACT 1 to the CWRU file descriptors — proves the ingestion gate and carries any flags forward."""
    rows = [{"case_id": f"cwru-{n}", "fs": 12000, "channel": "DE", "rpm": rpm, "load_hp": load,
             "fault_type": cls, "fault_size_in": (None if cls == "normal" else 0.007)}
            for n, (cls, load, rpm) in FILES.items()]
    return validate_records(rows).flagged


def precompute(case_id: str, seed: int = 42,
               artifacts: tuple[dict, dict, dict] | None = None, flags: list[dict] | None = None) -> dict:
    case = registry.get_case(case_id)
    samples, metrics, benchmark = artifacts if artifacts is not None else _load_artifacts()
    return export.build_replay(
        case, derived_dir=str(DERIVED), manifests_dir=str(MANIFESTS),
        samples=samples, metrics=metrics, benchmark=benchmark,
        contract_flags=(flags if flags is not None else _contract_flags()), seed=seed,
    )


def retrain(seed: int = 42) -> None:
    """HEAVY lane: regenerate the ONNX models + metrics + classical benchmark from the raw CWRU data."""
    from .stages import evaluate, feature_extraction, infer, preprocess, train

    if not RAW_CWRU.exists():
        raise SystemExit(f"raw CWRU not found in {RAW_CWRU}. Run scripts/fetch-data first.")
    print(f"[retrain] preprocess {RAW_CWRU} ...", flush=True)
    pre = preprocess.run(str(RAW_CWRU))
    print(f"  {pre['report'].summary()}; train {len(pre['trX'])} | test {len(pre['teX'])}", flush=True)
    trF, teF = feature_extraction.run(pre["trX"]), feature_extraction.run(pre["teX"])
    import numpy as np
    healthyF = np.vstack([trF[pre["trY"] == 0], teF[pre["teY"] == 0]])
    model = train.run(pre["trX"], pre["trY"], healthyF)
    model["trX"] = pre["trX"]
    fmu, fsd = model["fmu"], model["fsd"]
    teFz = (teF - fmu) / fsd
    iout = infer.run(model, pre["teX"], teFz)
    emetrics = evaluate.run(model, iout, pre["teX"], pre["teY"], pre["classes"])
    benchmark = evaluate.run_classical_benchmark(str(RAW_CWRU))
    # classical-ML supervised baselines (T12): SVM-RBF + Random Forest over physics-informed features, SAME split.
    from .model import classical_ml
    print("[retrain] classical-ML baselines (SVM-RBF + Random Forest) ...", flush=True)
    cml_models = classical_ml.train(pre["trX"], pre["trY"], pre["trRpm"])
    cml_metrics = classical_ml.evaluate(cml_models, pre["teX"], pre["teY"], pre["teRpm"], pre["classes"])
    print(f"  svm acc {cml_metrics['svm']['accuracy']} | rf acc {cml_metrics['rf']['accuracy']} "
          f"(wdcnn {emetrics['accuracy']})", flush=True)
    # cross-severity generalization (T4): diagnose unseen 0.014/0.021 in faults at the held-out 3 HP load.
    from .stages import cross_severity
    print("[retrain] cross-severity generalization (0.007/0.014/0.021 in @ held-out 3 HP) ...", flush=True)
    xsev = cross_severity.run(model, cml_models, str(RAW_CWRU), pre["classes"])
    for s in ("007", "014", "021"):
        print(f"  WDCNN @0.{s} in: {xsev['byMethodBySize']['wdcnn'].get(s)} "
              f"| SVM {xsev['byMethodBySize']['svm'].get(s)} | RF {xsev['byMethodBySize']['rf'].get(s)} "
              f"| env-SES {xsev['byMethodBySize']['env'].get(s)}", flush=True)
    # cross-DATASET generalization (T13): the CWRU-trained WDCNN vs unsupervised envelope/SES on MFPT (a diff rig).
    from .io import fetch_mfpt
    from .stages import cross_dataset
    print("[retrain] cross-dataset generalization (MFPT — a different rig) ...", flush=True)
    mfpt_root = fetch_mfpt.download(RAW_MFPT)
    xdata = cross_dataset.run(model, str(mfpt_root), pre["classes"])
    print(f"  MFPT: WDCNN overall {xdata['wdcnn']['overall']} (deep) vs env-SES {xdata['classical']['overall']} "
          f"(physics) | WDCNN recall {xdata['wdcnn']['recall']}", flush=True)
    export.export_models(train_out=model, infer_out=iout, eval_metrics=emetrics, classical_benchmark=benchmark,
                         cml_models=cml_models, cml_metrics=cml_metrics, cross_severity=xsev, cross_dataset=xdata,
                         teX=pre["teX"], teY=pre["teY"], teFz=teFz, classes=pre["classes"], derived_dir=str(DERIVED))
    print(f"[retrain] wrote ONNX + metrics + benchmark -> {DERIVED}", flush=True)


def run_all(seed: int = 42) -> list[dict]:
    artifacts = _load_artifacts()
    flags = _contract_flags()
    entries = []
    for c in registry.list_cases():
        precompute(c.id, seed=seed, artifacts=artifacts, flags=flags)
        entries.append({"case_id": c.id, "category": c.category, "kind": c.kind,
                        "manifest_path": f"manifests/{c.id}.json"})
    write_json(MANIFESTS / "index.json", build_index(entries))
    return entries


def main() -> None:
    ap = argparse.ArgumentParser(prog="rotorlab.pipeline")
    ap.add_argument("case", nargs="?", default="all", help="a case id, or 'all'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--retrain", action="store_true",
                    help="regenerate the ONNX/metrics from raw CWRU (torch + scipy) before rebuilding the replay")
    args = ap.parse_args()
    if args.retrain:
        retrain(args.seed)
    if args.case == "all":
        entries = run_all(args.seed)
        print(f"precomputed {len(entries)} cases -> {DERIVED}")
        for e in entries:
            print(f"  {e['case_id']:24s} [{e['category']}]")
        print(f"index -> {MANIFESTS / 'index.json'}")
    else:
        m = precompute(args.case, args.seed)
        print(f"precomputed {args.case}: lane={m['lane']} bytes={m['artifact']['bytes']} "
              f"metrics={m['metrics']} -> {DERIVED / m['artifact']['path']}")


if __name__ == "__main__":
    main()
