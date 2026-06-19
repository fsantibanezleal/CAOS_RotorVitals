# Changelog

All notable changes to CAOS RotorVitals are documented here. Versions follow `X.XX.XXX`
(major.minor.patch); the project stays in `0.x` while the showcase suite is being built out.

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
