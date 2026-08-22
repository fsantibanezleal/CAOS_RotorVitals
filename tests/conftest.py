"""Test bootstrap: make `pipeline` importable, and keep the suite out of the shipped artifacts.

TWO JOBS.

1. Import path. Make `pipeline` importable whether or not `pip install -e .` has run
   (belt-and-suspenders for CI and local runs).

2. Sandbox the writes. THIS IS THE IMPORTANT ONE. `pipeline.DERIVED` used to resolve straight to the
   repo's `data/derived`, and the suite writes there: `test_run_all_writes_index` calls
   `pipeline.run_all()`, which regenerates every manifest. MEASURED from a clean tree, `pytest tests/`
   left 22 committed files modified, the entire diff being an `engine_version` stamp moving
   0.30.000 -> 0.45.011.

   That reads as harmless and is not. A test run is not a bake, but it was producing bake output, so
   what got committed depended on whether someone happened to run the tests first - and the stamp it
   wrote came from whatever the working tree's version was at that moment, not from a real regeneration
   of the science. Artifacts the product ships must only ever change when someone deliberately bakes
   them.

   `DERIVED` is both an input and an output (`_load_artifacts` reads the committed heavy-lane outputs
   from it), so an empty temp directory is not enough: the sandbox is a COPY. The tests then exercise
   the real read-then-write path, against real committed inputs, and any writes land in the copy.

   The environment variable has to be set before `pipeline` is imported, because `DERIVED` is a module
   constant. conftest is imported before the test modules, which is what makes this work; setting it
   inside a fixture would be too late.
"""
import os
import pathlib
import shutil
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

# 1. import path
sys.path.insert(0, str(ROOT / "data-pipeline"))

# 2. sandbox, seeded from the committed artifacts
_real = ROOT / "data" / "derived"
if _real.exists() and not os.environ.get("RV_DERIVED_DIR"):
    _sandbox = pathlib.Path(tempfile.mkdtemp(prefix="rv-derived-")) / "derived"
    shutil.copytree(_real, _sandbox)
    os.environ["RV_DERIVED_DIR"] = str(_sandbox)
