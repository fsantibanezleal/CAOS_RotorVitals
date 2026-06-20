# Changelog

All notable changes to CAOS RotorVitals are documented here. Versions follow `X.XX.XXX`
(major.minor.patch); the project stays in `0.x` while the showcase suite is being built out.

## [0.24.000] — 2026-06-20

The real-application step: the heavy learned models now run live on real data (previously the app was
synthetic-only and the trained models were orphaned).

### Added
- **"Real diagnosis (WDCNN)" tab** — the user picks a real held-out CWRU 12 kHz drive-end segment and the
  trained **WDCNN** (1-D CNN, wide first kernel) runs **live in the browser** via onnxruntime-web to diagnose it
  (prediction vs the true label + per-class probabilities), alongside a **deep-AE health indicator**. Real
  action capability on real recordings, not synthetic.
- **`tools/ml/` real-data pipeline**: trains WDCNN (4-class) + a deep autoencoder on the actual CWRU recordings
  (leakage-safe: the entire 3 HP load held out), exports `wdcnn.onnx` + `rv-ae.onnx` + the held-out segments +
  `rv-learned-metrics.json`.
- **Benchmark** now shows **learned-vs-classical on held-out real data**: WDCNN 100% vs envelope/SES 73.7%, the
  honest **noise-robustness curve** (100% clean → 84% @2 dB → 35% @−4 dB), and the deep-AE one-class metrics.

### Fixed
- The deep-AE flagged a healthy 3 HP segment as anomalous (load-shift OOD) → retrained as an **all-load
  one-class novelty** baseline (held-out healthy false-flag 4.3%, fault-vs-healthy AUC 1.0).
- **Honesty**: Methodology no longer says deep learning is "out of scope" / aspirational — the WDCNN + deep-AE
  are implemented and run live; the text now points to the real tab + Benchmark numbers.
- `.gitignore` now excludes `**/.venv` + raw `.mat` (a torch DLL had leaked into a commit).

### Note
- Versions 0.16–0.23 were incremental DSP/visualization iterations (CSC, infogram, Campbell, prognostics-eval,
  feature-space, degradation-replay, 3-D waterfall, ISO trend) shipped without individual changelog entries —
  recorded here as a consolidated gap; from 0.24 every release is logged.

## [0.15.000] — 2026-06-19

### Added
- **Campbell / order map** tab: a synthetic run-up (600–3600 rpm) of the envelope spectrum. The bearing
  defect frequency climbs linearly with shaft speed (a ray in Hz); an Hz↔order toggle resamples each
  column onto `order = f/(rpm/60)`, straightening the defect line to a constant order (BPFO 3.58×,
  BPFI 5.42×, 2·BSF 4.71×) — the order-tracking idea made visible. Operating-speed band; hover gives
  the conjugate (order in Hz mode, Hz in order mode). Reacts to bearing/fault/severity/rpm.

### Changed
- **Deep documentation rewrite** (Introduction, Methodology, Implementation, Experiments). Each page
  now carries rigorous bilingual narrative, term-by-term equations, the specific definitions this
  build uses, and quality theme-aware SVG diagrams: the end-to-end pipeline (Introduction), the
  envelope/SES signal flow, the kurtogram plane, the cyclostationary bi-frequency plane, the
  decomposition/deconvolution chain, the RUL projection and ISO zone bar (Methodology), the
  offline→artifact→live compute-tier architecture (Implementation), and the leakage-safe experiment
  protocol (Experiments). 16 DOI-verified references; ISO severity zones framed honestly by machine
  class (ISO 20816-3 for the ≥15 kW mining machines targeted; ISO 10816-1 Class I for the sub-15 kW
  calibration rig behind the synthetic signal).



### Fixed
- **Spectrogram tab crashed the whole app** (white screen, `Cannot read properties of undefined`).
  Root cause: `Heatmap2D` painted via `putImageData`, which ignores the device-pixel-ratio transform
  (rendered into a corner on hi-DPI) and could index past the frequency rows. Now renders to an
  offscreen canvas then `drawImage`, with the top row clamped to the available bins. The
  Cyclostationary (CSC) map shared the same code path and is fixed too.
- **3D waterfall and RUL prognostics did not react to the scenario.** Both used `useMemo(…, [])`
  with hard-coded bearing/fault/rpm. They now depend on the live `bearingId / fault / severity / rpm`:
  the run-to-failure trend's onset and remaining-useful-life scale with severity (healthy ⇒ no onset),
  and the waterfall demodulates the active fault so the emerging ridge sits at the real defect band.

### Added
- **Live value readouts** on every uPlot chart (waveform, spectrum, SES, cepstrum): the legend now
  reads out `(x, y)` with units at the cursor, so hovering a defect comb tells you the exact
  frequency and amplitude — not just a bare crosshair.
- Defect combs (BPFO/BPFI/2·BSF/fr) are now labeled with their numeric frequency in Hz.
- **3D waterfall**: hover raycasting reads `(frequency, life, amplitude)`; a translucent ridge plane
  marks the active defect frequency; axis legend and a ground reference grid added.
- **Kurtogram** and **RUL chart**: hover readouts (band/level/kurtosis; time/HI and projected median),
  threshold and onset annotated with their values.

## [0.13.000] — 2026-06-18
- Cyclostationary (CSC) cyclic-modulation-spectrum tab; multi-page shell per ADR-0016.
