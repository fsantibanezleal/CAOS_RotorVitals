# 08 — The two data contracts

The full schemas live in [`../../data/README.md`](../../data/README.md); this is the architecture-level summary.

## Contract 1 — ingestion (raw vibration → pipeline)

`data-pipeline/rotorlab/io/contract.py`. The *bring-your-own-vibration* gate. `validate_records` accepts a
vibration-record descriptor iff it satisfies the schema (`fs ∈ {12000, 48000}`, `channel ∈ {DE, FE, BA}`,
`fault_type ∈ {normal, inner, outer, ball}`, …), **rejects** with a reason otherwise (never silently coerced), and
**flags** plausible-but-suspicious records (48 kHz → decimation, rpm outside [600, 3600], non-standard fault size).
`validate_signal` guards the raw array: NaN/Inf → reject, length < 2048 → reject, clipping > 1% → reject, flatline
window → flag + safe-normalize. A committed `data/examples/records.csv` PASSES Contract 1 (a clone-time test
asserts it), so the contract is exercised without a CWRU download.

## Contract 2 — artifact (pipeline → web)

`data-pipeline/rotorlab/core/{trace.py, manifest.py}`. Each case writes a compact `data/derived/<case>/trace.json`
(`rotorvitals.trace/v1`) + a manifest `data/derived/manifests/<case>.json` (`rotorvitals.manifest/v2`) recording the
category/kind, seed, engine+version, the shared learned-tier artifacts, the trace byte size, the lane/gate verdict,
the Contract-1 flags, and the case metrics; a flat `index.json` inventories all cases.
`frontend/src/lib/contract.types.ts` mirrors these schemas so a drift fails `tsc`; `scripts/check_artifacts.py`
(CI) enforces that every manifest points to a real trace of the recorded byte size with a consistent lane verdict.
