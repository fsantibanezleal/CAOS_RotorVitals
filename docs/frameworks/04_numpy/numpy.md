# NumPy (`numpy==2.4.6`)

**What:** the array/FFT/linear-algebra workhorse.
**Why binding:** it is the **only** dependency of the default (light) pipeline, windowing, the 64-D log-binned
`rfft` spectral feature, the metrics (confusion/AUC/SNR), the seeded RNG (`np.random.default_rng`), and the synthetic
prognostics trend all run on numpy. This is what lets a clone rebuild the entire replay layer + pass the tests
**without torch or a CWRU download**.

**Lane:** both, the light replay path (always) and the heavy precompute path (alongside torch/scipy).

## Install

`pip install numpy==2.4.6` (the whole of `requirements.txt`; `setup.sh` installs it into both venvs).

## Usage

`python -m rotorlab.pipeline all` (numpy-only) rebuilds every per-case trace + manifest. `core/rng.py::make_rng`
is the single RNG factory, determinism flows from seeding it.
