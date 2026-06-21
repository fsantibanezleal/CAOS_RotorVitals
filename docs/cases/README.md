# Cases — taxonomy & coverage matrix

`data-pipeline/rotorlab/cases/cwru_cases.py` defines 15 cases across 5 categories. The App shows **one selected
case**; Experiments/Benchmark show **cross-case summaries by category**. The matrix is faithful to what is actually
committed — the live learned tier covers the held-out 3 HP load (the segments in `rv-cwru-samples.json`); the
classical tier covers the three demodulation methods; the synthetic + prognostics cases are clearly labelled.

| Category | Case ids | kind | real / synthetic | Expected reading |
|---|---|---|---|---|
| **fault-class diagnosis** (held-out 3 HP, live WDCNN + deep-AE) | `dx-normal-3hp`, `dx-outer-3hp`, `dx-inner-3hp`, `dx-ball-3hp` | diagnosis | **real** (CWRU 100/133/108/121, 3 HP held out) | normal = no comb, AE < p99; outer = BPFO 3.5848× comb; inner = BPFI 5.4152× + 1× sidebands; ball = 2·BSF 4.7136× + FTF sidebands (the hard case) |
| **robustness control** | `robust-snr-sweep` | robustness | **real + synthetic noise** | WDCNN accuracy degrades monotonically (≈100% clean → ~chance at −4 dB) |
| **classical baseline** (unsupervised envelope/SES) | `classical-envelope-resband`, `classical-kurtogram`, `classical-rawcomb` | classical | **real** | the 2–4 kHz resonance band recovers normal/inner/outer; the kurtogram pick underperforms; the raw comb is near chance |
| **synthetic self-validation** | `synth-healthy`, `synth-outer`, `synth-inner`, `synth-ball` | synthetic | **synthetic** (labelled) | the engine recovers the planted defect frequency |
| **prognostics / RUL demo** | `rul-outer`, `rul-inner`, `rul-ball` | prognostics | **synthetic** (labelled) | a rising HI trend → a 1/slope RUL projection toward failure |

## Honesty / roadmap

* **Only CWRU is a live real dataset.** The training loads (0/1/2 HP) feed the model but only the held-out **3 HP**
  segments are committed as replayable live cases. The synthetic + run-to-failure cases are **labelled synthetic** —
  they are NOT presented as real benchmark numbers.
* **Roadmap (not yet wired as live cases):** XJTU-SY / FEMTO / IMS (real run-to-failure → replace the synthetic RUL
  trend), Ottawa-TVS (variable-speed → only then claim variable-speed), a gear rig (→ only then claim gear),
  Paderborn / MFPT (more bearing diversity). Until wired, the docs + UI do not claim them.
* **CWRU caveats:** a clean lab rig (optimistic accuracy → the SNR curve is the honest headline); one physical
  bearing per fault across loads (→ hold out a load, not a bearing); ball faults are the documented hard case
  (a weak, modulated 2·BSF line), not a bug.

See [`../architecture/06_model-evaluation.md`](../architecture/06_model-evaluation.md) for the split + the SNR + AE
protocol, and the per-case `data/derived/manifests/<case>.json` for the exact recorded numbers.
