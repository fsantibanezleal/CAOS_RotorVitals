"""CONTRACT 1 — ingestion (raw vibration -> pipeline). The *bring-your-own-vibration* gate.

Declares the required schema (columns, units, ranges) of a vibration-record descriptor and an EXPLICIT outlier
policy: a record is ACCEPTED iff it passes; bad records are REJECTED with a reason (never silently coerced);
plausible-but-suspicious records are FLAGGED (accepted, the flag travels into the manifest). This is what lets
RotorVitals diagnose a NEW accelerometer recording instead of only replaying baked CWRU cases. A separate
`validate_signal` enforces the raw-array guards (NaN/Inf, length, flatline, clipping) applied when a signal is
attached. Documented in data/README.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .schema import WIN, VibrationRecord

REQUIRED_COLUMNS: tuple[str, ...] = ("case_id", "fs", "channel", "rpm", "load_hp", "fault_type")

VALID_FS: frozenset[int] = frozenset({12000, 48000})          # 48 kHz is decimated x4 -> 12 kHz downstream
VALID_CHANNELS: frozenset[str] = frozenset({"DE", "FE", "BA"})
VALID_FAULTS: frozenset[str] = frozenset({"normal", "inner", "outer", "ball"})
STD_FAULT_SIZES_IN: frozenset[float] = frozenset({0.007, 0.014, 0.021})

RPM_MIN, RPM_MAX = 600, 3600                                   # rig operating band; outside => FLAG (not reject)
CLIP_FRACTION_REJECT = 0.01                                    # >1% of samples pinned at a rail => REJECT
FLATLINE_STD = 1e-9


@dataclass
class ContractReport:
    accepted: list[VibrationRecord]
    rejected: list[dict[str, Any]]
    flagged: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return len(self.accepted) > 0

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def validate_records(raw_rows: list[dict[str, Any]]) -> ContractReport:
    """Apply CONTRACT 1 to raw vibration-record descriptors (e.g. from a CSV or a .mat manifest). Pure;
    deterministic; no I/O. Validates the metadata gate; raw signal arrays are checked by validate_signal."""
    accepted: list[VibrationRecord] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []

    for i, row in enumerate(raw_rows):
        cid = str(row.get("case_id", f"row{i}"))
        missing = [c for c in REQUIRED_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "case_id": cid, "reason": f"missing/empty columns: {missing}"})
            continue
        try:
            fs = int(float(row["fs"]))
            rpm = int(float(row["rpm"]))
            load_hp = int(float(row["load_hp"]))
        except (TypeError, ValueError):
            rejected.append({"row": i, "case_id": cid, "reason": "non-numeric fs/rpm/load_hp"})
            continue
        channel = str(row["channel"]).upper()
        fault = str(row["fault_type"]).lower()

        bad: list[str] = []
        if fs not in VALID_FS:
            bad.append(f"fs={fs} not in {sorted(VALID_FS)} (unknown sampling rate; cannot align defect bands)")
        if channel not in VALID_CHANNELS:
            bad.append(f"channel={channel!r} not in {sorted(VALID_CHANNELS)}")
        if fault not in VALID_FAULTS:
            bad.append(f"fault_type={fault!r} not in {sorted(VALID_FAULTS)}")
        if bad:
            rejected.append({"row": i, "case_id": cid, "reason": "; ".join(bad)})
            continue

        rec_flags: list[str] = []
        if not (RPM_MIN <= rpm <= RPM_MAX):
            rec_flags.append(f"rpm={rpm} outside [{RPM_MIN},{RPM_MAX}] — RUL/Campbell unreliable, still diagnosable")
        if fs == 48000:
            rec_flags.append("fs=48000 -> will be decimated x4 (FIR, zero-phase) to 12000")
        size = row.get("fault_size_in")
        fault_size_in: float | None = None
        if size not in (None, ""):
            try:
                fault_size_in = float(size)
                if fault != "normal" and fault_size_in not in STD_FAULT_SIZES_IN:
                    rec_flags.append(f"fault_size_in={fault_size_in:g} not a standard CWRU severity")
            except (TypeError, ValueError):
                rec_flags.append(f"fault_size_in={size!r} non-numeric — dropped")

        if rec_flags:
            flagged.append({"case_id": cid, "flags": rec_flags})
        accepted.append(VibrationRecord(
            case_id=cid, fs=fs, channel=channel, rpm=rpm, load_hp=load_hp,
            fault_type=fault, fault_size_in=fault_size_in,
            bearing=str(row.get("bearing", "skf6205")), flags=tuple(rec_flags),
        ))
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)


def validate_signal(signal: list[float], fs: int) -> tuple[bool, str, list[str]]:
    """Raw-array guard applied when a signal is attached (the heavy preprocess lane). Returns
    (ok, reject_reason, flags). REJECT on NaN/Inf, too-short, or clipping > 1%; FLAG flatline windows."""
    flags: list[str] = []
    n = len(signal)
    if n < WIN:
        return False, f"signal length {n} < window {WIN}", flags
    if any(math.isnan(v) or math.isinf(v) for v in signal):
        return False, "NaN/Inf in signal", flags
    lo = min(signal)
    hi = max(signal)
    if hi > lo:
        rail_lo = sum(1 for v in signal if v <= lo + 1e-12)
        rail_hi = sum(1 for v in signal if v >= hi - 1e-12)
        clip_frac = (rail_lo + rail_hi) / n
        if clip_frac > CLIP_FRACTION_REJECT:
            return False, f"clipping {clip_frac:.1%} of samples pinned at a rail (> {CLIP_FRACTION_REJECT:.0%})", flags
    mean = sum(signal) / n
    var = sum((v - mean) ** 2 for v in signal) / n
    if var ** 0.5 < FLATLINE_STD:
        flags.append("flatline/dropout (std < 1e-9) — safe-normalized by 1.0")
    return True, "", flags
