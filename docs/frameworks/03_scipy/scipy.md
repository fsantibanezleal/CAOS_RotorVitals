# SciPy (`scipy==1.18.0`)

**What:** signal processing + I/O for the offline lane.
**Why binding:** three uses, each load-bearing:

* `scipy.io.loadmat` — read the real CWRU `.mat` recordings (and detect truncated files via the missing DE channel);
* `scipy.signal.decimate(x, 4, ftype='fir', zero_phase=True)` — bring 48 kHz Normal baselines to the canonical
  12 kHz so every window shares `fs` (the **same** filter must be used anywhere 48 kHz is ingested — see the live-lane
  parity note);
* `scipy.signal.hilbert` — the analytic-signal envelope at the heart of the classical envelope/SES chain.

**Lane:** offline only (`stages/preprocess.py`, `model/classical.py`, `io/fetch_cwru.py`). Not shipped to the browser
(the TS DSP chain reimplements the envelope numerically).

## Install

`pip install scipy==1.18.0` (included by `requirements-precompute.txt` / `setup.sh --precompute`).

## Applying to other data

`loadmat`/`decimate`/`hilbert` are format-agnostic — point the loader at any drive-end accelerometer record; the
contract normalizes it to 12 kHz windows before the models see it.
