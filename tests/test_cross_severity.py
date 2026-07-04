"""T4, cross-severity generalization contract. Locks (1) the registry's 6 unseen-size cases; (2) the cross_severity
stage helpers; (3) the SHIPPED artifacts (rv-learned-metrics.json `crossSeverity` block + the severity sample
segments in rv-cwru-samples.json), so the honest generalization story can't silently drift or vanish. Reads the
committed derived JSON (no torch / no raw .mat needed), so it runs in the light CI lane."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from rotorlab import registry
from rotorlab.io.fetch_cwru import FILES, SEVERITY_FILES

# NOTE: rotorlab.stages.cross_severity pulls in scipy (via model.classical), a HEAVY-lane dep absent in light CI.
# So it is imported lazily inside the one test that needs it (guarded by importorskip); the rest only touch the
# registry / fetch table / committed JSON and run everywhere.

DERIVED = Path(__file__).resolve().parents[1] / "data" / "derived"
SIZES = {0.007, 0.014, 0.021}
FAULTS = {"inner", "ball", "outer"}


def test_severity_files_are_disjoint_from_training():
    # the 0.014"/0.021" eval files must NOT be training files (else the "unseen size" claim is false)
    assert set(SEVERITY_FILES).isdisjoint(set(FILES))
    assert len(SEVERITY_FILES) == 6
    assert {s for _, s in SEVERITY_FILES.values()} == {0.014, 0.021}
    assert {c for c, _ in SEVERITY_FILES.values()} == FAULTS


def test_registry_has_six_unseen_size_cases():
    sev = [c for c in registry.list_cases() if c.category.startswith("cross-severity")]
    assert len(sev) == 6
    for c in sev:
        assert c.kind == "diagnosis"                 # reuse the live WDCNN path
        assert c.real_or_synthetic == "real"
        assert c.params.get("sizeIn") in {0.014, 0.021}
        assert c.fault_type in FAULTS


def test_cross_severity_helpers():
    pytest.importorskip("scipy")   # cross_severity -> model.classical -> scipy (heavy lane only)
    from rotorlab.stages import cross_severity
    assert cross_severity._size_tag(0.007) == "007"
    assert cross_severity._size_tag(0.014) == "014"
    assert cross_severity._size_tag(0.021) == "021"
    rows = cross_severity._eval_rows()
    assert len(rows) == 9                            # 3 faults x 3 sizes
    assert sum(1 for *_, is_new in rows if is_new) == 6   # 0.014 + 0.021 are the new (unseen) ones
    assert {r[2] for r in rows} == SIZES


def test_shipped_metrics_cross_severity_block():
    xs = json.loads((DERIVED / "rv-learned-metrics.json").read_text(encoding="utf-8")).get("crossSeverity")
    assert xs, "crossSeverity block missing from the shipped rv-learned-metrics.json"
    assert xs["sizesIn"] == [0.007, 0.014, 0.021]
    assert xs["methods"] == ["wdcnn", "svm", "rf", "env"]
    for meth in xs["methods"]:
        by = xs["byMethodBySize"][meth]
        assert set(by) == {"007", "014", "021"}
        assert all(0.0 <= v <= 1.0 for v in by.values())
    assert len(xs["rows"]) == 9
    for r in xs["rows"]:
        assert r["fault"] in FAULTS and r["sizeIn"] in SIZES
        assert 0.0 <= r["wdcnn"] <= 1.0
        assert sum(r["wdcnnDist"].values()) == r["nWin"]   # the distribution accounts for every window


def test_shipped_severity_samples():
    s = json.loads((DERIVED / "rv-cwru-samples.json").read_text(encoding="utf-8"))
    # severity samples carry sizeIn (the MFPT cross-dataset samples also carry caseId but no sizeIn, exclude them)
    sev = [x for x in s["samples"] if x.get("sizeIn") is not None]
    assert sev, "no cross-severity sample segments committed"
    for x in sev:
        assert x["sizeIn"] in {0.014, 0.021}
        assert x["caseId"].startswith("dx-") and x["caseId"].endswith("-3hp")
        assert len(x["clsFeat"]) == 10 and len(x["raw"]) == 2048
    # provenance map present
    assert s.get("severityFiles") and len(s["severityFiles"]) == 6
