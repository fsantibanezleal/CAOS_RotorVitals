# 02 — Determinism & the replay trace

## Determinism

Every run is a pure function of `(case, seed)`. There is one RNG factory (`core/rng.py::make_rng`); no stage uses a
global/implicit RNG. Training is seeded (`torch.manual_seed(0); np.random.seed(0)`), the SNR noise uses
`RandomState(7)`, the held-out sample selection uses `RandomState(1)`, and the synthetic prognostics trends use
`make_rng(seed)`. Consequence: re-running the default pipeline produces **byte-identical** traces + manifests (the
CI determinism guard) — there is no wall-clock anywhere in a committed artifact.

## The compact trace (`rotorvitals.trace/v1`)

`core/trace.py` builds one small JSON per case from the committed real artifacts. It **references** the held-out
segments by class (indices into `rv-cwru-samples.json`) instead of copying raw arrays, so every trace stays well
under the 256 KB gate budget. The payload is discriminated by `kind`:

| kind | payload |
|---|---|
| `diagnosis` | the held-out segment refs for the class + WDCNN per-class recall / confusion row / accuracy + the deep-AE p99 threshold / AUC / false-flag rate |
| `robustness` | the WDCNN accuracy-vs-SNR curve |
| `classical` | the chosen method's confusion / row-recall / accuracy |
| `synthetic` | the planted defect multiplier + the implied defect frequency (Hz) |
| `prognostics` | a seeded synthetic HI trend + a 1/slope RUL projection |

The frontend mirrors this shape in `frontend/src/lib/contract.types.ts` (`CaseTrace` / `TracePayload`), so a drift
between the Python trace and the TS reader **fails `tsc`**.
