"""CONTRACT 2 (artifact) tests: a manifest points to a real trace with the recorded byte size, the lane verdict is
consistent with the gate, and the schema is the RotorVitals one. Uses the committed real artifacts (no torch)."""
from rotorlab import pipeline


def test_manifest_matches_artifact_and_gate():
    m = pipeline.precompute("dx-inner-3hp", seed=7)
    artifact = pipeline.DERIVED / m["artifact"]["path"]
    assert artifact.exists(), "manifest points to a non-existent trace"
    assert artifact.stat().st_size == m["artifact"]["bytes"], "manifest byte size drifted from the trace"
    assert m["schema"].startswith("rotorvitals.manifest/")
    assert m["lane"] in ("live", "precompute")
    assert m["gate"]["lane"] == m["lane"], "manifest lane disagrees with the gate verdict"
    # the WDCNN+AE forward pass is client-side + tiny => must be classified LIVE
    assert m["lane"] == "live", f"expected live lane, got {m['lane']} ({m['gate']['reasons']})"
    assert m["real_or_synthetic"] == "real"


def test_diagnosis_trace_references_real_segments():
    import json

    m = pipeline.precompute("dx-ball-3hp", seed=7)
    trace = json.loads((pipeline.DERIVED / m["artifact"]["path"]).read_text(encoding="utf-8"))
    assert trace["kind"] == "diagnosis"
    assert trace["payload"]["fault_type"] == "ball"
    assert trace["payload"]["n_segments"] >= 1, "no committed held-out ball segments referenced"
