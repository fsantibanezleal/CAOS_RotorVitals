"""Pipeline smoke + determinism: a case regenerates deterministically (same seed -> identical trace), the
synthetic prognostics control runs, and run_all writes the flat index covering every category."""
import json

from rotorlab import pipeline, registry


def test_case_deterministic_same_seed():
    a = pipeline.precompute("classical-envelope-resband", seed=7)
    b = pipeline.precompute("classical-envelope-resband", seed=7)
    assert a["artifact"]["bytes"] == b["artifact"]["bytes"]
    trace = json.loads((pipeline.DERIVED / a["artifact"]["path"]).read_text(encoding="utf-8"))
    assert 0.0 <= trace["payload"]["accuracy"] <= 1.0


def test_synthetic_prognostics_runs():
    m = pipeline.precompute("rul-ball", seed=1)
    trace = json.loads((pipeline.DERIVED / m["artifact"]["path"]).read_text(encoding="utf-8"))
    assert trace["real_or_synthetic"] == "synthetic"
    assert len(trace["payload"]["hi"]) == len(trace["payload"]["t"]) >= 2
    assert trace["payload"]["t_fail_est"] >= 0.0


def test_run_all_writes_index():
    entries = pipeline.run_all(seed=42)
    assert len(entries) == len(registry.list_cases()) >= 12
    idx = json.loads((pipeline.MANIFESTS / "index.json").read_text(encoding="utf-8"))
    assert idx["n_cases"] == len(entries)
    assert idx["schema"].startswith("rotorvitals.index/")
    # every category from the registry appears in the index
    cats = {e["category"] for e in idx["cases"]}
    assert cats == set(registry.list_categories())
