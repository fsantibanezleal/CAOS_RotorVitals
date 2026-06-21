"""RotorVitals cases spanning CATEGORIES (the bearing-diagnosis problem-type taxonomy). Each case carries: id,
category, the discriminating `kind` (which replay payload it produces), the fault_type, an expected band a domain
expert should read, the real|synthetic flag, and a validation anchor. The matrix is faithful to what is actually
committed: the live learned-tier replay covers the held-out 3 HP load (the segments in rv-cwru-samples.json); the
classical baseline covers the three demodulation methods; the synthetic + prognostics cases are CLEARLY labelled
synthetic. Per-load training data (0/1/2 HP) and the XJTU-SY/MFPT/Paderborn roadmap are documented in docs/cases/.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# SKF 6205-2RS JEM defect-frequency multipliers (x shaft rate); ball diagnosed at 2*BSF.
MULT = {"outer": 3.5848, "inner": 5.4152, "ball": 4.7136}   # 2*BSF = 2*2.3568
FTF = 0.3983
HELDOUT_RPM = 1730   # 3 HP load


@dataclass(frozen=True)
class Case:
    id: str
    category: str
    kind: str                       # diagnosis | robustness | classical | synthetic | prognostics
    fault_type: str                 # normal | inner | outer | ball | mixed
    expected_band: str
    real_or_synthetic: str          # real | synthetic | real+synthetic-noise
    validation_anchor: str
    params: dict = field(default_factory=dict)


_DX = "fault-class diagnosis (held-out 3 HP, live WDCNN + deep-AE)"
_ROB = "robustness control (real held-out + synthetic noise)"
_CLS = "classical baseline (real, unsupervised envelope/SES)"
_SYN = "synthetic self-validation (labelled synthetic)"
_RUL = "prognostics / RUL demo (labelled synthetic)"


CASES: list[Case] = [
    # --- learned-tier diagnosis on the REAL held-out 3 HP load (the live action capability) ---
    Case("dx-normal-3hp", _DX, "diagnosis", "normal",
         "no dominant defect comb; deep-AE reconstruction error below the healthy p99 threshold",
         "real", "CWRU 100 (Normal, 3 HP held out of training)", {"load_hp": 3, "rpm": HELDOUT_RPM}),
    Case("dx-outer-3hp", _DX, "diagnosis", "outer",
         "BPFO 3.5848x fr comb (no sidebands)", "real",
         "CWRU 133 (Outer 0.007in, 3 HP held out)", {"load_hp": 3, "rpm": HELDOUT_RPM, "mult": MULT["outer"]}),
    Case("dx-inner-3hp", _DX, "diagnosis", "inner",
         "BPFI 5.4152x fr comb + shaft-rate (1x) sidebands", "real",
         "CWRU 108 (Inner 0.007in, 3 HP held out)", {"load_hp": 3, "rpm": HELDOUT_RPM, "mult": MULT["inner"], "sideband": 1.0}),
    Case("dx-ball-3hp", _DX, "diagnosis", "ball",
         "2*BSF 4.7136x fr comb + FTF (0.3983x) sidebands — the documented hard case (weak modulated line)", "real",
         "CWRU 121 (Ball 0.007in, 3 HP held out)", {"load_hp": 3, "rpm": HELDOUT_RPM, "mult": MULT["ball"], "sideband": FTF}),

    # --- robustness: the honest SNR-degradation curve (clean CWRU is optimistic) ---
    Case("robust-snr-sweep", _ROB, "robustness", "mixed",
         "WDCNN accuracy degrades monotonically as additive noise lowers SNR (100% clean -> ~chance at -4 dB)",
         "real+synthetic-noise", "held-out 3 HP windows + additive noise at {10,6,2,0,-2,-4} dB", {}),

    # --- classical baseline: the three demodulation methods (leakage-immune, no training) ---
    Case("classical-envelope-resband", _CLS, "classical", "mixed",
         "envelope/SES in the documented 2-4 kHz resonance band recovers normal/inner/outer reliably", "real",
         "Envelope-SES (resonance band 2-4 kHz) over all 16 CWRU files",
         {"method": "Envelope-SES (resonance band 2–4 kHz)"}),
    Case("classical-kurtogram", _CLS, "classical", "mixed",
         "auto kurtogram band pick — underperforms the fixed resonance band on this data", "real",
         "Envelope-SES (auto kurtogram band)", {"method": "Envelope-SES (auto kurtogram band)"}),
    Case("classical-rawcomb", _CLS, "classical", "mixed",
         "raw-spectrum comb without demodulation — near chance (proves envelope demodulation does the work)", "real",
         "Raw-spectrum comb (no demodulation)", {"method": "Raw-spectrum comb (no demodulation)"}),

    # --- synthetic self-validation: the engine recovers a planted defect frequency ---
    Case("synth-healthy", _SYN, "synthetic", "normal",
         "no planted comb; envelope spectrum flat -> classified healthy", "synthetic",
         "damped-resonance impulse train, seed 101", {"seed": 101, "planted": None}),
    Case("synth-outer", _SYN, "synthetic", "outer",
         "planted BPFO comb recovered at 3.5848x fr", "synthetic",
         "damped-resonance impulse train, seed 202", {"seed": 202, "planted": MULT["outer"]}),
    Case("synth-inner", _SYN, "synthetic", "inner",
         "planted BPFI comb recovered at 5.4152x fr with sidebands", "synthetic",
         "damped-resonance impulse train, seed 303", {"seed": 303, "planted": MULT["inner"]}),
    Case("synth-ball", _SYN, "synthetic", "ball",
         "planted 2*BSF comb recovered at 4.7136x fr (weak, modulated)", "synthetic",
         "damped-resonance impulse train, seed 404", {"seed": 404, "planted": MULT["ball"]}),

    # --- prognostics / RUL demo: a synthetic run-to-failure health-indicator trend ---
    Case("rul-outer", _RUL, "prognostics", "outer",
         "rising HI trend -> RUL projection converges toward true failure", "synthetic",
         "XJTU-SY-like run-to-failure trend (synthetic), outer-race onset", {"onset": 0.45}),
    Case("rul-inner", _RUL, "prognostics", "inner",
         "rising HI trend -> RUL projection converges toward true failure", "synthetic",
         "XJTU-SY-like run-to-failure trend (synthetic), inner-race onset", {"onset": 0.55}),
    Case("rul-ball", _RUL, "prognostics", "ball",
         "slow rising HI trend (ball faults degrade gradually) -> wider RUL band", "synthetic",
         "XJTU-SY-like run-to-failure trend (synthetic), ball onset", {"onset": 0.65}),
]
