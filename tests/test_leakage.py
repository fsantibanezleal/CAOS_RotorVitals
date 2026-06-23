"""T15 — leakage-demonstration contract. Locks the SHIPPED `leakage` block in rv-learned-metrics.json so the honest
result (a real, modest inflation under a naive random-window split; the deep net saturates and hides it; the
classical baselines show the legible gap) and its four integrity controls cannot silently drift or be faked. Reads
the committed derived JSON (no torch / no raw .mat) so it runs in the light CI lane; the one helper test that
exercises the pure split-bookkeeping is numpy-only, and the heavy `run` is guarded with importorskip."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

DERIVED = Path(__file__).resolve().parents[1] / "data" / "derived"
CLASSES = {"normal", "outer", "inner", "ball"}
HENDRIKS_DOI = "10.1016/j.ymssp.2021.108732"


def _leak() -> dict:
    lk = json.loads((DERIVED / "rv-learned-metrics.json").read_text(encoding="utf-8")).get("leakage")
    assert lk, "leakage block missing from the shipped rv-learned-metrics.json"
    return lk


def test_shipped_leakage_structure():
    lk = _leak()
    assert set(lk["classes"]) == CLASSES
    assert lk["win"] == 2048 and lk["hop"] == 1024 and lk["overlapPct"] == 50
    assert lk["nSeeds"] >= 5
    sp = lk["naiveVsProduction"]["splits"]
    assert lk["nWindows"] == sp["leaky"]["nTrain"] + sp["leaky"]["nTest"]
    # both arms drawn from the same pool → comparable, matched ~26% test fractions (within a few windows)
    assert abs(sp["leaky"]["nTest"] - sp["honest"]["nTest"]) <= 5
    assert not sp["leaky"]["grouped"] and sp["honest"]["grouped"]
    assert sp["honest"]["heldOutRecordings"] == [100, 108, 121, 133]   # the 3 HP recordings = prod split


def test_isolated_overlap_is_the_clean_number():
    # the PRIMARY result — a purge/embargo control that isolates the pure window-overlap leak (load + test set held
    # constant). Removing overlapping neighbours can only HURT, so the isolated leak must be >= ~0 (small negative is
    # split noise) and small on this clean 0.007" pool — NOT the dramatic published collapse.
    iso = _leak()["overlapIsolated"]
    assert iso["nSeeds"] >= 5
    for m in ("svm", "rf"):
        d = iso[m]
        assert 0.0 <= d["purgedAcc"] <= 1.0 and 0.0 <= d["withOverlapAcc"] <= 1.0
        assert d["isolatedPts"] == round(100 * (d["withOverlapAcc"] - d["purgedAcc"]), 1)
        assert d["isolatedPts"] >= -2.0, f"{m} purged > with-overlap beyond noise — purge logic suspect"
        assert d["isolatedPts"] <= 20.0, f"{m} isolated overlap {d['isolatedPts']} pts implausibly large for pure overlap"
    assert iso["wdcnn"]["saturates"] in (True, False)


def test_naive_vs_production_is_an_upper_bound():
    # the SECONDARY result — honestly labelled as an upper bound (overlap leak + a 3 HP load-generalization penalty),
    # NOT pure leakage. The classical gap is real (leaky >= honest) but must exceed the isolated overlap (the extra
    # is the load penalty) — that ordering is the whole honest point.
    lk = _leak()
    nvp, iso = lk["naiveVsProduction"], lk["overlapIsolated"]
    assert "load" in nvp["note"].lower() and "upper bound" in nvp["note"].lower()
    for m in ("svm", "rf"):
        assert 0.0 <= nvp[m]["honestAcc"] <= 1.0 and 0.0 <= nvp[m]["leakyAcc"] <= 1.0
        assert nvp[m]["gapPts"] >= -0.5
        # the upper-bound gap is at least as large as the isolated overlap (it also carries the load penalty)
        assert nvp[m]["gapPts"] >= iso[m]["isolatedPts"] - 0.5


def test_leakage_integrity_controls():
    ctl = _leak()["controls"]
    # (1) shuffled-label PLUMBING check: both arms collapse to ~chance → rules out an index/label bug
    assert ctl["shuffledLabelPlumbing"]["pass"]
    assert abs(ctl["shuffledLabelPlumbing"]["leakyWdcnn"] - 0.25) < 0.12
    assert abs(ctl["shuffledLabelPlumbing"]["honestWdcnn"] - 0.25) < 0.12
    # (2) the leak is literally present in the random split and absent in the grouped one
    ov = ctl["overlapWindowsSharedTrainTest"]
    assert ov["leaky"] > 0 and ov["honest"] == 0
    # (3) class balance matched (load still differs — the note must say so, which is why (2) is an upper bound)
    assert ctl["classBalance"]["balancedOk"] and "load" in ctl["classBalance"]["note"].lower()
    # (4) the honest-T15 WDCNN reproduces the production hold-out-3HP number (same test recordings)
    assert ctl["honestVsProduction"]["consistent"]


def test_leakage_citation_is_verified():
    # the Hendriks-2022 DOI was a known trap (three candidate suffixes); lock the verified one
    dois = [r.get("doi") for r in _leak()["refs"]]
    assert HENDRIKS_DOI in dois


def test_overlap_bookkeeping_pure():
    # the overlap counter is pure numpy — verify it on a tiny synthetic (no scipy/torch)
    from rotorlab.stages.leakage import _overlap_shared, _test_class_frac
    rec = np.array([1, 1, 1, 2, 2])
    order = np.array([0, 1, 2, 0, 1])
    tr, te = np.array([0, 2, 3]), np.array([1, 4])
    # te window 1 = (rec1,order1): neighbour (1,0)∈tr → overlap; te window 4 = (rec2,order1): (2,0)∈tr → overlap
    assert _overlap_shared(rec, order, tr, te) == 2
    # a grouped split (whole recording 2 held out) → no shared overlap
    assert _overlap_shared(rec, order, np.array([0, 1, 2]), np.array([3, 4])) == 0
    frac = _test_class_frac(np.array([0, 0, 1, 1]), ["normal", "outer", "inner", "ball"])
    assert frac["normal"] == 0.5 and frac["outer"] == 0.5


def test_leakage_run_smoke_guarded():
    pytest.importorskip("scipy")
    pytest.importorskip("sklearn")
    from rotorlab.stages import leakage
    assert leakage.HONEST_TEST_REC == (100, 108, 121, 133)
    assert leakage.SEED_SPLIT == 15 and leakage.LEAKY_TEST_SIZE == 0.259
