"""CONTRACT 2 — artifact (pipeline -> web). The manifest is the authoritative, versioned record of a baked case:
its category, the discriminating kind, seed, engine+version, the shared learned-tier artifacts (the ONNX models +
metrics it draws on), the compact per-case trace pointer + byte size, the lane/gate verdict, the CONTRACT-1 flags,
and the evaluation metrics. The web loads ONLY manifests + traces + the shared artifacts;
frontend/src/lib/contract.types.ts mirrors this schema so a drift fails the build. A flat index.json inventories
every case. The committed ONNX + metrics ARE the real outputs of the heavy precompute lane — the manifest records
that provenance honestly (real vs synthetic per case)."""
from __future__ import annotations

from typing import Any

from .. import __version__
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "rotorvitals.manifest/v2"
INDEX_SCHEMA = "rotorvitals.index/v1"

DATASET = "CWRU 12 kHz drive-end (real)"
SPLIT = "hold-out entire 3 HP load (train 0/1/2 HP) — no test recording seen in training"
HONESTY = (
    "Trained on REAL CWRU recordings. CWRU reuses one physical bearing across loads, so a true "
    "bearing-independent split is impossible; we hold out an entire load condition instead. CWRU is a clean lab "
    "rig (Smith & Randall 2015) — accuracy is optimistic vs field data, so the honest deliverable is the "
    "SNR-robustness curve. Synthetic + run-to-failure cases are clearly labelled synthetic."
)


def shared_artifacts() -> dict:
    """The learned-tier artifacts every diagnosis case shares (paths relative to data/derived/)."""
    return {
        "models": [
            {"id": "wdcnn", "file": "models/wdcnn.onnx", "opset": 17, "input": [1, 1, 2048]},
            {"id": "deep_ae", "file": "models/rv-ae.onnx", "opset": 17, "input": [1, 64]},
        ],
        "samples": "rv-cwru-samples.json",
        "learned_metrics": "rv-learned-metrics.json",
        "classical_metrics": "cwru-benchmark.json",
    }


def build_case_manifest(
    *,
    case: Any,
    seed: int,
    artifact_rel: str,
    trace_bytes: int,
    gate: dict,
    flags: list[dict],
    metrics: dict,
) -> dict:
    # Deterministic: a pure function of (case, seed). No wall-clock here (would dirty git on re-run) — the
    # lane/gate verdict + budgets carry the lane decision; live timing is measured in the browser, not committed.
    return {
        "schema": MANIFEST_SCHEMA,
        "case_id": case.id,
        "category": case.category,
        "kind": case.kind,
        "fault_type": case.fault_type,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "validation_anchor": case.validation_anchor,
        "engine": {"package": "rotorlab", "version": __version__,
                   "model": "WDCNN (Zhang 2017) + deep-AE HI (González-Muñiz 2022) + classical envelope/SES"},
        "dataset": DATASET,
        "split": SPLIT,
        "seed": seed,
        "shared": shared_artifacts(),
        "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes},
        "lane": gate["lane"],
        "gate": gate,
        "flags": flags,
        "metrics": metrics,
        "honesty": HONESTY,
    }


def build_index(entries: list[dict]) -> dict:
    """entries: [{case_id, category, kind, manifest_path}] -> the flat authoritative inventory."""
    return {
        "schema": INDEX_SCHEMA,
        "engine_version": __version__,
        "dataset": DATASET,
        "n_cases": len(entries),
        "cases": sorted(entries, key=lambda e: e["case_id"]),
    }
