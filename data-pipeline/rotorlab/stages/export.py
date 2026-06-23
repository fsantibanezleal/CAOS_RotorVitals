"""Stage 6 — export (CONTRACT 2). Two paths:

* build_replay (LIGHT, numpy/stdlib): the default pipeline path. Builds the compact per-case trace from the REAL
  committed learned-tier artifacts (samples/metrics/benchmark), runs the lane gate, and writes the manifest. No
  torch/scipy — so the contract + replay regenerate deterministically anywhere, and CI stays fast.
* export_models (HEAVY, torch): the --retrain path. Writes wdcnn.onnx + rv-ae.onnx (opset 17, dynamic batch), the
  held-out sample segments, and rv-learned-metrics.json — the artifacts the LIGHT path then consumes.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json

# deterministic per-kind forward-pass budget used only for the gate DECISION (not a measured wall-clock).
_RUN_MS = {"diagnosis": 6.0, "robustness": 6.0, "classical": 4.0, "synthetic": 3.0, "prognostics": 2.0}
_RUNTIMES = {
    "diagnosis": {"ts-dsp", "onnxruntime-web"},
    "robustness": {"ts-dsp", "onnxruntime-web"},
    "classical": {"ts-dsp"},
    "synthetic": {"ts-dsp"},
    "prognostics": {"ts-dsp"},
}


def _case_metrics(case: Any, trace: dict) -> dict:
    p = trace["payload"]
    if case.kind == "diagnosis":
        return {"wdcnn_per_class_recall": p["wdcnn"]["per_class_recall"] or 0.0,
                "wdcnn_accuracy": p["wdcnn"]["accuracy"], "ae_threshold_p99": p["deep_ae"]["threshold_p99"]}
    if case.kind == "robustness":
        cur = p["snr_curve"]
        return {"clean_accuracy": cur[0]["accuracy"], "worst_accuracy": cur[-1]["accuracy"]}
    if case.kind == "classical":
        return {"accuracy": p["accuracy"], "n": p["n"]}
    if case.kind == "synthetic":
        return {"defect_hz": p["defect_hz"] or 0.0}
    if case.kind == "prognostics":
        return {"rul_est_norm": p["rul_est_norm"], "t_fail_est": p["t_fail_est"]}
    return {}


def build_replay(case: Any, *, derived_dir: str, manifests_dir: str,
                 samples: dict, metrics: dict, benchmark: dict, contract_flags: list[dict], seed: int) -> dict:
    trace = build_trace(case, samples=samples, metrics=metrics, benchmark=benchmark, seed=seed)
    artifact_rel = f"{case.id}/trace.json"
    trace_bytes = write_json(Path(derived_dir) / artifact_rel, trace)
    gate = classify_lane(client_side=True, runtimes=_RUNTIMES[case.kind],
                         run_ms=_RUN_MS[case.kind], trace_bytes=trace_bytes)
    manifest = build_case_manifest(
        case=case, seed=seed, artifact_rel=artifact_rel, trace_bytes=trace_bytes,
        gate=gate, flags=contract_flags, metrics=_case_metrics(case, trace),
    )
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest


def export_models(*, train_out: dict, infer_out: dict, eval_metrics: dict, classical_benchmark: dict,
                  cml_models: dict, cml_metrics: dict, cross_severity: dict, cross_dataset: dict,
                  teX, teY, teFz, classes: list[str], derived_dir: str) -> None:
    """HEAVY: write the ONNX models + committed held-out samples + the learned-metrics + classical-benchmark JSON."""
    import json
    import os

    import numpy as np
    import torch

    from ..model import classical_ml

    derived = Path(derived_dir)
    (derived / "models").mkdir(parents=True, exist_ok=True)
    net, ae = train_out["net"], train_out["ae"]
    fmu, fsd = train_out["fmu"], train_out["fsd"]

    os.environ["PYTHONIOENCODING"] = "utf-8"
    torch.onnx.export(net, torch.zeros(1, 1, 2048), str(derived / "models" / "wdcnn.onnx"), dynamo=False,
                      input_names=["x"], output_names=["logits"],
                      dynamic_axes={"x": {0: "n"}, "logits": {0: "n"}}, opset_version=17)
    torch.onnx.export(ae, torch.zeros(1, 64), str(derived / "models" / "rv-ae.onnx"), dynamo=False,
                      input_names=["x"], output_names=["xr"],
                      dynamic_axes={"x": {0: "n"}, "xr": {0: "n"}}, opset_version=17)
    # classical-ML supervised baselines (T12) -> ONNX (skl2onnx); run live alongside the WDCNN on the same samples.
    classical_ml.export_onnx(cml_models, str(derived / "models"))

    teF = cml_metrics["teF"]   # the classical feature matrix, aligned with teX (so committed samples carry their vector)

    # committed real held-out windows for live in-browser inference (raw 2048 + AE spectral feats + classical-ML
    # feature vector + label + provenance) — so the WDCNN, deep-AE AND the SVM/RF all run live on the SAME segment.
    from ..io.fetch_cwru import FILES
    src_file = {cls: n for n, (cls, load, _rpm) in FILES.items() if load == 3}  # the held-out 3 HP file per class
    # the WDCNN's 100-D penultimate LEARNED feature per held-out window (T14 — the feature-space embedding)
    with torch.no_grad():
        teEmb = net.embed(torch.tensor(teX).unsqueeze(1)).numpy()
    samples = []
    rngsel = np.random.RandomState(1)
    for c in range(4):
        ci = np.where(teY == c)[0]
        for seg, k in enumerate(rngsel.choice(ci, size=min(3, len(ci)), replace=False), start=1):
            samples.append({"cls": classes[c], "file": int(src_file.get(classes[c], 0)), "seg": seg,
                            "raw": [round(float(v), 4) for v in teX[k]],
                            "feat": [round(float(v), 4) for v in teFz[k]],
                            "clsFeat": [round(float(v), 5) for v in teF[k]],
                            "emb": [round(float(v), 4) for v in teEmb[k]]})
    # cross-severity (T4) + cross-dataset (T13) committed segments: real unseen-size + real MFPT (diff-rig) windows
    # for the live App severity / MFPT cases.
    from ..io.fetch_cwru import SEVERITY_FILES
    sev_samples = cross_severity.get("samples", [])
    mfpt_samples = cross_dataset.get("samples", [])
    write_json(derived / "rv-cwru-samples.json",
               {"fs": 12000, "win": 2048, "loadHp": 3, "rpm": 1730, "classes": classes,
                "clsFeatures": classical_ml.FEATURE_NAMES,
                "sourceFiles": {c: int(src_file.get(c, 0)) for c in classes},
                "severityFiles": {f"{cls}-{int(round(sz * 1000)):03d}": int(n)
                                  for n, (cls, sz) in SEVERITY_FILES.items()},
                "samples": samples + sev_samples + mfpt_samples})

    metrics = {
        "dataset": "CWRU 12 kHz drive-end (real)",
        "nTrain": int(len(train_out["trX"])) if train_out.get("trX") is not None else 0,
        "nTest": int(len(teX)),
        "split": "hold-out entire 3 HP load (train 0/1/2 HP) — no test recording seen in training",
        "wdcnn": {"accuracy": eval_metrics["accuracy"], "perClass": eval_metrics["perClass"],
                  "confusion": eval_metrics["confusion"], "classes": classes, "snrCurve": eval_metrics["snrCurve"]},
        "deepAE": {"thresholdP99": eval_metrics["thresholdP99"], "faultVsHealthyAUC": eval_metrics["faultVsHealthyAUC"],
                   "healthyFalseFlagRate": eval_metrics["healthyFalseFlagRate"],
                   "trainedOn": "all-load healthy baseline (one-class novelty); faults held out"},
        "aeScaler": {"mean": [round(float(v), 6) for v in fmu], "std": [round(float(v), 6) for v in fsd]},
        # T12: the classical-ML supervised baselines on the SAME leakage-safe held-out split (directly comparable).
        "classicalML": {
            "features": cml_metrics["features"], "nTest": cml_metrics["nTest"],
            "svm": cml_metrics["svm"], "rf": cml_metrics["rf"], "classes": classes,
            "note": "SVM-RBF and Random Forest over 10 physics-informed hand-crafted features (time-domain shape "
                    "indicators + envelope-spectrum BPFO/BPFI/2BSF comb prominences + resonance-band kurtosis), the "
                    "classical counterpoint to the end-to-end WDCNN. Same hold-out-3HP split → comparable.",
        },
        # T4: cross-severity generalization — every model evaluated on unseen 0.014"/0.021" faults at the held-out
        # 3 HP load (trained only on 0.007" faults at 0/1/2 HP). The honest "is it a toy?" answer.
        "crossSeverity": cross_severity,
        # T13: cross-DATASET generalization — the CWRU-trained WDCNN vs unsupervised envelope/SES on MFPT (a
        # different rig). The domain-shift test: learned features are rig-specific, physics is rig-agnostic.
        "crossDataset": cross_dataset,
        "honesty": "Trained on REAL CWRU recordings. CWRU reuses one physical bearing across loads, so a true "
                   "independent-bearing split is impossible; we hold out an entire load condition instead. CWRU is "
                   "a clean lab rig (Smith & Randall 2015) — accuracy is optimistic vs field data.",
    }
    (derived / "rv-learned-metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (derived / "cwru-benchmark.json").write_text(json.dumps(classical_benchmark, indent=2), encoding="utf-8")
