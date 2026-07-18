# Cases, taxonomy & coverage matrix

`data-pipeline/rotorlab/cases/cwru_cases.py` defines 21 cases across 6 categories. The App is a source-selected
workbench, a first-level selector switches between the synthetic generator, real diagnosis segments (CWRU held-out
3 HP, Ottawa order-tracked, MaFaulDa) and real run-to-failure trajectories (FEMTO / XJTU-SY / IMS); Benchmark hosts
the live learned tier (the WDCNN on committed CWRU segments + the cross-case summaries). The matrix below is the
**pipeline case registry** and is faithful to what is actually committed, the live learned tier covers the held-out
3 HP load (the segments in `rv-cwru-samples.json`); the classical tier covers the three demodulation methods; the
synthetic + prognostics registry cases are clearly labelled. The real segment and trajectory sources selectable in
the App are additional to this registry; the Experiments page coverage table lists them per dataset.

| Category | Case ids | kind | real / synthetic | Expected reading |
|---|---|---|---|---|
| **fault-class diagnosis** (held-out 3 HP, live WDCNN + deep-AE) | `dx-normal-3hp`, `dx-outer-3hp`, `dx-inner-3hp`, `dx-ball-3hp` | diagnosis | **real** (CWRU 100/133/108/121, 3 HP held out) | normal = no comb, AE < p99; outer = BPFO 3.5848× comb; inner = BPFI 5.4152× + 1× sidebands; ball = 2·BSF 4.7136× + FTF sidebands (the hard case) |
| **cross-severity diagnosis** (UNSEEN fault size, held-out 3 HP, live WDCNN) | `dx-{inner,ball,outer}-{014,021}-3hp` | diagnosis | **real** (CWRU 172/212, 188/225, 200/237) | the WDCNN trained only on 0.007″ faults diagnosing 0.014″/0.021″, a true held-out severity test. Honest result: nails 0.021″ (98.9%) but collapses on 0.014″ (27.8%); the unsupervised envelope/SES struggles on the same 0.014″ files → the signatures are weaker/atypical (Smith & Randall 2015), not a model bug |
| **robustness control** | `robust-snr-sweep` | robustness | **real + synthetic noise** | WDCNN accuracy degrades monotonically (≈100% clean → ~chance at −4 dB) |
| **classical baseline** (unsupervised envelope/SES) | `classical-envelope-resband`, `classical-kurtogram`, `classical-rawcomb` | classical | **real** | the 2–4 kHz resonance band recovers normal/inner/outer; the kurtogram pick underperforms; the raw comb is near chance |
| **synthetic self-validation** | `synth-healthy`, `synth-outer`, `synth-inner`, `synth-ball` | synthetic | **synthetic** (labelled) | the engine recovers the planted defect frequency |
| **prognostics / RUL demo** | `rul-outer`, `rul-inner`, `rul-ball` | prognostics | **synthetic** (labelled) | a rising HI trend → a 1/slope RUL projection toward failure |

## Honesty / roadmap

* **Seven real datasets are wired: CWRU (trained benchmark), MFPT (cross-dataset eval), Ottawa + MaFaulDa (real
  diagnosis segments, cross-domain WDCNN), FEMTO + XJTU-SY + IMS (real run-to-failure trajectories, 23 of the 36
  carry a real first-passage failure time).** CWRU is the trained benchmark, the training loads (0/1/2 HP) feed
  the model but only the held-out **3 HP** segments are committed as replayable live cases; MFPT is the held-out
  cross-DATASET domain-shift test (below). The synthetic + prognostics cases in the registry above are **labelled
  synthetic**, they are not presented as real benchmark numbers; the App's Real: RUL mode runs on the measured
  FEMTO/XJTU-SY/IMS life-frames.
* **Ottawa is wired with computed-order-tracking** (fault frequencies as constant orders under varying speed, a
  real Campbell/order map); the variable-speed claim is scoped to that. **Roadmap (still not wired):** Paderborn
  (more bearing diversity, artificial-vs-real damage transfer; host unreachable at last attempt) and a gear rig
  (→ only then claim gear). Until wired, the docs + UI do not claim them. The **offline RUL aggregate benchmark
  is under re-evaluation**, the original protocol was degenerate and its numbers were withdrawn (issue #128).
* **CWRU caveats:** a clean lab rig (optimistic accuracy → the SNR curve is the honest headline); one physical
  bearing per fault across loads (→ hold out a load, not a bearing); ball faults are the documented hard case
  (a weak, modulated 2·BSF line), not a bug.
* **Cross-severity generalization (T4):** the 0.014″/0.021″ cases are a held-out *severity* test, not extra
  training data, the WDCNN/AE/SVM/RF only ever see 0.007″ faults. The honest finding (a real 0.014″ collapse,
  corroborated by the training-free envelope/SES) is reported in full on the Benchmark page, not hidden. The
  `crossSeverity` block in `rv-learned-metrics.json` carries the per-(fault,size) numbers + where each WDCNN miss
  lands; see [`../frameworks/08_classical-ml/classical-ml.md`](../frameworks/08_classical-ml/classical-ml.md) for
  the shared feature path.
* **Cross-DATASET generalization (T13):** the CWRU-trained WDCNN is also run on **MFPT**, a DIFFERENT rig (NICE
  bearing, 48828/97656 Hz resampled to ~12 kHz, BPFO 3.245× / BPFI 4.755× vs CWRU 3.5848× / 5.4152×), downloaded
  link-only from the MathWorks/MFPT mirror, never re-hosted. The honest domain-shift result: the deep WDCNN
  **collapses** cross-rig (≈49% overall, **0% outer-race recall**, it calls MFPT outer faults *normal*), while the
  unsupervised envelope/SES (the same comb physics, at the CORRECT MFPT defect frequencies, auto band) **transfers
  perfectly (100%)**. The lesson, shown not claimed: *deep wins in-distribution, physics wins cross-distribution.*
  The `crossDataset` block carries the WDCNN-vs-physics recall + where the deep misses land; MFPT segments are
  committed for live in-browser replay (tagged `dataset:"MFPT"`).

See [`../architecture/06_model-evaluation.md`](../architecture/06_model-evaluation.md) for the split + the SNR + AE
protocol, and the per-case `data/derived/manifests/<case>.json` for the exact recorded numbers.
