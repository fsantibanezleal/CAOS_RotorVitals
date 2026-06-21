"""The measured live-vs-precompute GATE (ADR-0054), adapted for RotorVitals' client-side lane.

RotorVitals runs its live diagnosis ENTIRELY in the browser — onnxruntime-web executes the trained WDCNN + deep-AE
ONNX models, and a TypeScript DSP chain computes the classical features — so the "live wheels" of the SIR template
become "client-side runtimes". A case runs LIVE iff it is client-side AND its runtimes are a subset of the
deployed set AND a single forward pass + its replay trace are small/fast enough; otherwise it is PRECOMPUTE and the
SPA replays the committed artifact. The verdict + measured budgets go into the manifest; CI fails on mislabeling.
A single 2048-window WDCNN + a 64-D AE forward pass is milliseconds, so every RotorVitals case passes the gate —
this is a MEASUREMENT that documents that fact, never a hand-wave.
"""
from __future__ import annotations

LIVE_RUNTIMES: set[str] = {"ts-dsp", "onnxruntime-web"}   # the client-side runtimes the live lane is allowed to use
RUN_MS_GATE = 1500.0                                       # a live forward pass must complete within an interaction budget
TRACE_BYTES_GATE = 256 * 1024                             # a live/replay artifact must stay small


def classify_lane(*, client_side: bool, runtimes: set[str], run_ms: float, trace_bytes: int) -> dict:
    reasons: list[str] = []
    live = True
    if not client_side:
        live = False
        reasons.append("not client-side (needs a server)")
    extra = set(runtimes) - LIVE_RUNTIMES
    if extra:
        live = False
        reasons.append(f"runtimes not in the deployed client set: {sorted(extra)}")
    if run_ms > RUN_MS_GATE:
        live = False
        reasons.append(f"runtime exceeds the {RUN_MS_GATE:.0f}ms budget")
    if trace_bytes > TRACE_BYTES_GATE:
        live = False
        reasons.append(f"trace_bytes {trace_bytes} > {TRACE_BYTES_GATE}")
    # The raw measured run_ms drives the DECISION but is deliberately NOT stored — the committed manifest must be a
    # pure function of (params, seed); wall-clock would dirty git on re-run. We store the verdict + budgets instead;
    # the live runtime is measured separately, in the browser.
    return {
        "lane": "live" if live else "precompute",
        "client_side": client_side,
        "runtimes": sorted(runtimes),
        "trace_bytes": trace_bytes,
        "run_ms_budget": RUN_MS_GATE,
        "trace_bytes_budget": TRACE_BYTES_GATE,
        "reasons": reasons,
    }
