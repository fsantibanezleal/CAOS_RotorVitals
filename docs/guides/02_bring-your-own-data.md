# 02 — Bring your own vibration data

RotorVitals is not limited to replaying CWRU — Contract 1 is the gate that lets it ingest a NEW accelerometer
recording.

## 1. Describe the record (Contract 1)

A record needs: `fs ∈ {12000, 48000}` Hz, `channel ∈ {DE, FE, BA}`, `rpm`, `load_hp`, `fault_type ∈ {normal,
inner, outer, ball}`, optional `fault_size_in`. See `data/examples/records.csv` for a passing sample.

```python
from rotorlab.io.contract import validate_records, validate_signal
rep = validate_records([{ "case_id": "mine", "fs": 48000, "channel": "DE",
                          "rpm": 1797, "load_hp": 0, "fault_type": "outer" }])
print(rep.summary())                       # accepted / rejected (with reason) / flagged
ok, reason, flags = validate_signal(signal, fs=48000)   # NaN/Inf, length, clipping, flatline guards
```

48 kHz is **flagged** (it will be decimated ×4 to 12 kHz); an unknown `fs`, channel, or fault type is **rejected
with a reason** — never silently coerced.

## 2. Window + feature it (the model input)

`model/features.window_signal` → z-scored 2048-sample windows at 12 kHz; `model/features.spectral_feat` → the 64-D
deep-AE input. These are the **same** functions the offline lane and the browser use, so a conforming record sees
exactly the model the held-out CWRU evaluation measured.

## 3. Diagnose

Offline: feed the windows through `stages/infer` (or re-train including your record). Live: the browser path
(`dsp/learned.ts` + `lib/ort.ts`) runs the committed ONNX on any conforming 2048-window. The honesty caveats of the
training data still apply — see `docs/cases/README.md`.
