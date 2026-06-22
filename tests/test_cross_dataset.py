"""T13 — cross-DATASET (MFPT) generalization contract. Locks (1) the curated MFPT file set; (2) the SHIPPED
`crossDataset` block in rv-learned-metrics.json + the MFPT sample segments — so the honest domain-shift story
(deep WDCNN fails cross-rig, physics envelope/SES transfers) can't silently drift or vanish. Reads the committed
derived JSON (no torch / no raw .mat), so it runs in the light CI lane. The one helper test that touches scipy is
guarded with importorskip."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from rotorlab.io.fetch_mfpt import MFPT_FILES

DERIVED = Path(__file__).resolve().parents[1] / "data" / "derived"
MFPT_CLASSES = {"normal", "outer", "inner"}


def test_mfpt_file_set():
    assert len(MFPT_FILES) == 9
    assert set(MFPT_FILES.values()) == MFPT_CLASSES          # normal/outer/inner (MFPT has no ball)
    # filename → class is consistent with the MathWorks/MFPT naming
    for rel, cls in MFPT_FILES.items():
        name = rel.split("/")[-1].lower()
        assert (cls == "normal") == name.startswith("baseline")
        assert (cls == "outer") == name.startswith("outerrace")
        assert (cls == "inner") == name.startswith("innerrace")


def test_shipped_cross_dataset_block():
    xd = json.loads((DERIVED / "rv-learned-metrics.json").read_text(encoding="utf-8")).get("crossDataset")
    assert xd, "crossDataset block missing from the shipped rv-learned-metrics.json"
    assert "MFPT" in xd["dataset"] and "CWRU" in xd["trainedOn"]
    assert set(xd["classes"]) == MFPT_CLASSES
    # a DIFFERENT rig → different defect kinematics (the whole point)
    assert xd["kinematics"]["cwru"]["BPFO"] != xd["kinematics"]["mfpt"]["BPFO"]
    for blk in ("wdcnn", "classical"):
        assert 0.0 <= xd[blk]["overall"] <= 1.0
        assert set(xd[blk]["recall"]) == MFPT_CLASSES
        assert all(0.0 <= v <= 1.0 for v in xd[blk]["recall"].values())
    # the honest contrast must be real: the unsupervised physics transfers better than the deep model on MFPT
    assert xd["classical"]["overall"] >= xd["wdcnn"]["overall"]
    assert len(xd["perFile"]) == len(MFPT_FILES)


def test_shipped_mfpt_samples():
    s = json.loads((DERIVED / "rv-cwru-samples.json").read_text(encoding="utf-8"))
    mfpt = [x for x in s["samples"] if x.get("dataset") == "MFPT"]
    assert len(mfpt) == len(MFPT_FILES)
    for x in mfpt:
        assert x["cls"] in MFPT_CLASSES
        assert len(x["raw"]) == 2048 and len(x["feat"]) == 64     # raw window + AE feature (for the live WDCNN+AE)
        assert "sizeIn" not in x                                  # MFPT carries no fault-size (distinct from T4)


def test_cross_dataset_helpers():
    pytest.importorskip("scipy")   # cross_dataset -> model.classical -> scipy (heavy lane only)
    from rotorlab.stages import cross_dataset
    assert cross_dataset.MFPT_CLASSES == ["normal", "outer", "inner"]
    assert cross_dataset.TARGET_FS == 12000
