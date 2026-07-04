"""LIVE lane entrypoint, DORMANT for RotorVitals.

The archetype's reference live lane is Pyodide running this module in the browser. RotorVitals instead implements
its live lane as a small TypeScript DSP engine + onnxruntime-web running the EXPORTED WDCNN/deep-AE ONNX directly
in the browser (frontend/src/lib/ort.ts, frontend/src/dsp/*), explicitly permitted by the archetype ("Pyodide +
lightweight wheels, OR a small TS engine"). That path is faster and uses the same trained models, so this Pyodide
entrypoint is present-but-dormant; the gate (core/gate.py) still classifies each case's lane. This solution does
not require the Pyodide live lane at the moment.
"""
from __future__ import annotations


def run_trace_json(*_args, **_kwargs):  # pragma: no cover - dormant
    raise NotImplementedError(
        "RotorVitals' live lane is TS + onnxruntime-web (frontend/), not Pyodide. This entrypoint is dormant."
    )
