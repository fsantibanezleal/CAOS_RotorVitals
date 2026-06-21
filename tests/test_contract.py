"""CONTRACT 1 (ingestion) tests: good vibration records validate; bad records are rejected with a reason;
suspicious-but-plausible records are flagged; the raw-signal guard rejects NaN/Inf/short and flags flatlines."""
from rotorlab.io.contract import validate_records, validate_signal
from rotorlab.io.schema import WIN


def test_good_records_accepted():
    rep = validate_records([
        {"case_id": "a", "fs": "12000", "channel": "DE", "rpm": "1730", "load_hp": "3", "fault_type": "inner"},
    ])
    assert rep.ok and len(rep.accepted) == 1 and not rep.rejected
    assert rep.accepted[0].fault_type == "inner"


def test_bad_records_rejected_not_coerced():
    rows = [
        {"case_id": "fs", "fs": "44100", "channel": "DE", "rpm": "1730", "load_hp": "3", "fault_type": "inner"},   # bad fs
        {"case_id": "ch", "fs": "12000", "channel": "XX", "rpm": "1730", "load_hp": "3", "fault_type": "inner"},   # bad channel
        {"case_id": "ft", "fs": "12000", "channel": "DE", "rpm": "1730", "load_hp": "3", "fault_type": "wobble"},  # bad fault
        {"case_id": "miss", "fs": "12000", "channel": "DE", "rpm": "1730", "load_hp": "3"},                        # missing fault_type
        {"case_id": "txt", "fs": "fast", "channel": "DE", "rpm": "1730", "load_hp": "3", "fault_type": "inner"},   # non-numeric fs
    ]
    rep = validate_records(rows)
    assert len(rep.accepted) == 0
    assert len(rep.rejected) == len(rows)
    assert all("reason" in r for r in rep.rejected)


def test_outlier_flagged_but_accepted():
    rep = validate_records([
        {"case_id": "slow", "fs": "48000", "channel": "DE", "rpm": "120", "load_hp": "0", "fault_type": "outer"},
    ])
    assert rep.ok and rep.flagged
    flags = " ".join(rep.flagged[0]["flags"])
    assert "rpm" in flags and "decimated" in flags


def test_committed_example_passes_contract():
    from pathlib import Path

    from rotorlab.io.formats import read_csv_rows

    csv = Path(__file__).resolve().parents[1] / "data" / "examples" / "records.csv"
    rep = validate_records(read_csv_rows(csv))
    assert rep.ok and not rep.rejected, f"example records.csv should pass Contract 1: {rep.summary()}"
    assert any("decimated" in " ".join(f["flags"]) for f in rep.flagged), "the 48 kHz example should flag decimation"


def test_signal_guard():
    ok, reason, _ = validate_signal([float("nan")] * WIN, fs=12000)
    assert not ok and "NaN" in reason
    ok, reason, _ = validate_signal([0.0] * (WIN - 1), fs=12000)
    assert not ok and "length" in reason
    ok, _reason, flags = validate_signal([0.0] * WIN, fs=12000)
    assert ok and any("flatline" in f for f in flags)
