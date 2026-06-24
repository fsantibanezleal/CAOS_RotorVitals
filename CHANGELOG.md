# Changelog

All notable changes to CAOS RotorVitals are documented here. Versions follow `X.XX.XXX`
(major.minor.patch); the project stays in `0.x` while the showcase suite is being built out.

## [0.37.003] — 2026-06-23

Consistency fix (patch) — abstracted internal paths out of the ⓘ Architecture-modal PROSE bodies (ADR-0017 §3
"zero internal references"; the SVG monospace labels remain ADR-0058-exempt). Replaced `frontend/src/dsp/`,
`.venv`, `--retrain`, `.venv-precompute`, `copy-data(.mjs)`, `contract.types.ts`, `data/derived` and the bare
`.onnx` filenames in the modal description text with abstract equivalents ("the in-browser DSP engine", "an
isolated Python environment", "the precompute/retrain step", "a typed contract mirror", "the WDCNN + the
autoencoder as ONNX models"). Matches the ChargeCascade modal-prose standard; no behavior change.

## [0.37.002] — 2026-06-23

Honesty fix (patch) — removed the only two internal-path references in a user-facing string (ADR-0017 §3 "zero
internal references in any visible string"): the Methodology ML tab said the models are trained "(offline, in
data-pipeline/rotorlab)" → "(offline, in the precompute pipeline)" in both EN and ES. Surfaced while auditing
CutoffGrade against the same rule; the 0.37.000 audit's internal-refs check was not exhaustive over visible strings.

## [0.37.001] — 2026-06-23

Honesty fix (patch) — the Experiments datasets table and `docs/cases/README.md` claimed "only CWRU is integrated"
and marked **MFPT as `planned`**, but MFPT is in fact wired as a REAL dataset: `data-pipeline/rotorlab/io/fetch_mfpt.py`
downloads the MFPT Society set and `stages/cross_dataset.py` evaluates the CWRU-trained WDCNN on it (the Benchmark page
already shows it as "MFPT, real"). The Experiments page contradicted the Benchmark page + the code.

### Fixed
- **Experiments datasets table** (`Experiments.tsx`): added an explicit `appStatus` (`live` / `crosseval` / roadmap);
  CWRU → **LIVE + benchmarked**, **MFPT → cross-dataset (real)** (the held-out domain-shift test), the other six stay
  roadmap. The honest-status callout now states **two** real integrated sets (CWRU trained + MFPT cross-dataset), not one.
- **`docs/cases/README.md`**: line 20 said "Only CWRU is a live real dataset" while line 23 said "MFPT is wired … a
  second rig, live" — an internal contradiction; line 20 corrected to name both wired sets.
- Caught by Felipe by eye; the 0.37.000 adversarial audit verified algorithmic-constant consistency (gates/RUL/ISO)
  but did not cross the dataset-status table against the data-pipeline — a gap now folded into the audit checklist.

## [0.37.000] — 2026-06-23

At-bar pass — reference integrity, the docs/ wiki brought in sync with the shipped App, and release tags. No
behaviour change to the engine; this release closes the documentation/citation debt that an adversarial audit
(against the persisted plan + ADR-0016/0017/0056/0057/0058) flagged as keeping the product below bar.

### Reference integrity (ADR-0017 §4)
- **~76 inline `<Cite id paren />`** added across all five pages (Introduction 10 · Methodology 30 · Implementation
  21 · Experiments 14 · Benchmark 1): every technical claim now carries an inline citation that resolves to a
  **DOI/url link**, not just an end-of-section `<Refs>` list. All 25 ids resolve against `src/data/citations.ts` via
  `CitationsProvider` (verified: 0 `[id]` fallbacks rendered).

### Docs (the `docs/` wiki, ADR-0056 — authored to match the shipped App)
- **6 new method cards** for App tabs that shipped in 0.34–0.36 without a doc:
  `frameworks/09_cyclostationary` (Fast-SC + EES + Carter–Knapp–Nuttall significance), `10_band-selection-grams`
  (kurtogram/infogram/autogram/IESFOgram), `11_cepstrum`, `12_spectrogram`, `13_feature-embedding` (WDCNN 2-D PCA),
  and `architecture/09_leakage-demo` (T15 window-overlap, honest decomposition). Each carries provenance (DOIs) /
  what-it-is-and-isn't / equations / code-chain / data-contract+outliers / tool-usage-on-other-data / honest reading.
- **5 themed pipeline SVGs** copied into `docs/diagrams/` (with CSS-var colour fallbacks so they render on GitHub)
  and linked into the architecture markdowns (01_overview, 04_the-live-lane, 05_precompute-pipeline, 08_data-contracts).
- `frameworks/README.md` + `architecture/README.md` indexes updated to link every new card.

### Released
- **Annotated git tags** backfilled for the 0.10.000 → 0.36.000 release history (the "tag every release" archetype
  rule, ADR-0057 §1) so the CHANGELOG and the tag graph agree.

### Notes
- **Linked-brushing:** the meaningful coordinated views already exist (the spectrum **band-brush → SES** recompute,
  and the replay scrubber across SES/waterfall/RUL). A same-x-domain uPlot cursor sync was evaluated and **declined**:
  the spectrum and the SES live in different tabs (never co-mounted), so it would be a no-op — not shipped.
- **Deferred (not blockers):** a draggable snap-to-peak harmonic cursor on the SES (interactive-viz rubric Tier-B
  SHOULD) and additional curated case scenarios beyond the four presets + sliders.
- Screenshot-verified before release: 6 pages × light/dark × EN/ES + the ⓘ modal's 5 themed SVG tabs + the App
  workbench — **0 console errors**. `tsc` clean, prod build clean, 28/28 frontend DSP tests pass.

## [0.36.000] — 2026-06-23

Window-overlap leakage demonstration (T15) — an honesty feature that quantifies the documented CWRU window-overlap
trap (Hendriks, Dumond & Knox 2022) **two ways, deliberately kept apart so it does not overclaim**. Engine
`rotorlab 0.30.000` (new `stages/leakage.py`). The first build conflated overlap leakage with a load shift; an
adversarial review caught it and the demo was reworked into an honest decomposition before ship.

### Added
- **`stages/leakage.py`** — windows all 16 CWRU recordings into one frozen pool (WIN 2048 / HOP 1024, 50% overlap)
  and measures the leak two ways with REAL fitted models (FRESH WDCNN + SVM-RBF + Random Forest):
  - **(1) Isolated overlap leak — the clean number.** A purge/embargo control: on the SAME random test set (a
    4-load mix, so load and class are held constant), a with-overlap train is compared against a **purged** train
    with every order±1 same-recording neighbour of a test window removed. Removing windows can only HURT, so the
    residual gain isolates the overlap. Mean over 10 seeds: **+0.3 pts (SVM) / +1.6 pts (RF)** — small, near split
    noise, exactly as expected on this clean largely-separable 0.007″ pool.
  - **(2) Naive-vs-production — an UPPER BOUND.** The naive random split vs the production grouped split (held-out
    3 HP): RF **+5.9 / SVM +5.1 pts**. This is NOT pure leakage — the grouped arm also pays a 3 HP
    load-generalization penalty. The decomposition shows **most of the gap is the load penalty, not overlap**.
  - Wired into `pipeline.retrain` after the cross-dataset stage; emitted as the `leakage` block in
    `rv-learned-metrics.json`.
- **Four integrity controls** (so a plumbing bug surfaces, not a fake gap): a **shuffled-label plumbing check** (both
  arms collapse to ~chance — leaky 0.267 / honest 0.238, rules out an index/label bug; it does NOT by itself
  attribute the gap to overlap — the purge control does), a literal **overlap-window count** (random split 438
  shared train↔test, grouped 0), a **class-balance** check (matched within 0.024; its note states load still differs,
  hence the upper-bound framing), and a **production cross-check** (the honest-T15 WDCNN reproduces the production
  hold-out-3HP accuracy exactly — its confusions are byte-identical).
- **Benchmark — "Window-overlap leakage — isolated vs the naive-split upper bound"** (`LeakageBlock`): a horizontal
  **decomposition bar** splitting each model's naive-vs-production gap into {isolated overlap leak (red)} + {load
  penalty (amber)} + a table (production / random±std / gap / isolated overlap / healthy-recall) + the controls strip
  + an honest callout + the verified citation. The WDCNN saturates (1.0) and is shown as uninformative here, not as
  "hiding a leak".
- **Tests:** `tests/test_leakage.py` (7) lock the shipped block, the isolated-overlap clean number (≥ ~0, ≤ 20 pts),
  the upper-bound ordering (gap ≥ isolated overlap), all four controls, the verified DOI, and the overlap/purge
  bookkeeping. 29 Python tests pass; 28 frontend dsp tests pass.

### Honesty
- The two measurements are kept separate so the demo does not pass a load-confounded gap off as pure leakage. On this
  clean 0.007″ pool the demonstrable overlap leak is modest (~0–1.6 classical pts) — NOT the dramatic published
  collapse, which is driven by the deeper **bearing-identity** leak: even the production grouped split is
  leave-recording-out, NOT leave-bearing-out (CWRU reuses one physical bearing per condition across loads), so even
  the honest number is optimistic vs field data. Inflated numbers are do-not-cite; the headline diagnosis ALWAYS uses
  the production grouped split. The deep-AE (one-class) and envelope/SES (unsupervised) are leakage-immune by
  construction and excluded. Citation DOI verified (`10.1016/j.ymssp.2021.108732`).

## [0.35.000] — 2026-06-23

Learned-feature embedding (T14) — one picture that ties the whole learned story together. Engine `rotorlab
0.29.000` (the committed segments now carry the WDCNN embedding).

### Added
- **`WDCNN.embed`** — the model's 100-D penultimate LEARNED feature (after the ReLU, before the 4-class layer). The
  heavy lane now stores this `emb` per committed segment across all three sample sources (held-out CWRU baseline,
  cross-severity, MFPT), regenerated by `--retrain`.
- **Benchmark — "Learned feature space (WDCNN embedding)"** (`viz/EmbeddingPanel.tsx` + `dsp/pca.ts`): the 100-D
  learned features of every real committed segment projected to 2-D by PCA (power iteration; PC1+PC2 ≈ 85% of
  variance), an interactive scatter coloured by class, marked by provenance (filled = CWRU 0.007″, ring = unseen
  0.014″, dotted ring = unseen 0.021″, diamond = MFPT a different rig), with hover readout. It makes the learned
  geometry legible in one image, consistent with the cross-severity table: the in-distribution classes cluster; the
  unseen **0.014″** segments drift toward the wrong cluster (why the WDCNN misclassifies them — ~28% recall, T4)
  while the **0.021″** segments stay in the correct cluster (~99% recall); the MFPT segments sit apart (the domain
  shift — T13). Carries an illustrative-scope note (low N per group; PC1+PC2 ≈ 85% of variance).
- **Tests:** `pca2d` unit tests (two high-D clusters separate on PC1; degenerate input handled). 28 dsp tests pass.

### Note
- T11 (a learned CNN-BiLSTM RUL) is deferred: the real run-to-failure datasets (XJTU-SY / PRONOSTIA / IMS) are not
  cleanly fetchable here, and a model trained on synthetic trajectories would be a fake learned model — so it awaits
  a data-acquisition step rather than shipping something dishonest.

## [0.34.000] — 2026-06-23

IESFOgram (T10) — a defect-frequency-TARGETED band selector. Frontend only (engine `rotorlab 0.28.000`).

### Added
- **The IESFOgram** (Mauricio, Smith, Randall, Antoni & Gryllias 2020) as a 6th band-selection metric in
  `dsp/infogram.ts`: instead of scoring each band by general impulsiveness (kurtogram) or repetitiveness (infogram),
  it scores it by how strongly the band's squared-envelope spectrum shows the harmonic comb of the **diagnosed**
  fault frequency (BPFO/BPFI/2·BSF) — `combProminence` (median-normalized, spike-robust, on the SES amplitude scale)
  with a **targeted** mode and a **blind** shaft-order sweep (≥1.5×fr). `gramGrid` takes a backward-compatible
  `opts` 4th arg and shares one `sesPower(se)` per cell (the no-opts path is unchanged).
- **App integration:** a new "Auto (IESFOgram)" option in the T7 Demod-band control (targets the diagnosed fault,
  via a new band-INDEPENDENT `dx0` diagnosis that breaks the effBand→ses→dx→band cycle the panel flagged); the
  Infogram tab gains the IESFO + IESFO·b metrics and a "targeted at α₀" readout. The **spike demo** now shows the
  payoff: a non-fault Dirac makes the kurtogram's best cell jump while the targeted IESFOgram's stays identical.
- **Methodology:** the kurtogram tab gains the IESFOgram paragraph + equation + an honest callout (targeted needs
  the defect frequency; blind is weaker; the main simplification is that the paper integrates the cyclic spectral
  *coherence* over each band while this build scores the plain per-band SES comb; our median-normalized comb is a
  spike-robust surrogate of the paper's targeted feature; the dyadic paving ≠ the paper's filterbank) + the
  `mauricio2020iesfo` reference.
- **Tests:** 4 acceptance gates (targeted selects a band whose SES diagnoses the fault; **spike-robustness** — best
  cell unchanged while the kurtogram jumps; blind rejects the shaft order; backward-compat). 26 dsp tests pass.
- Designed via a 2-spec panel → synthesis (which caught the `dx0` acyclicity) per the ultracode process.

## [0.33.000] — 2026-06-22

Fast Spectral Correlation (T9) — a true phase-retaining cyclic coherence, replacing the magnitude-only CMS.
Frontend only (engine `rotorlab 0.28.000`).

### Added / Changed
- **`dsp/csc.ts` `fastSpectralCoherence`** — a genuine **Fast-SC** (Antoni, Xin & Hamzaoui 2017): AR prewhitening
  (Levinson-Durbin) removes the deterministic shaft/gear lines, then the **complex** STFT cross-spectrum
  `S(i,p)·S*(i,q)` is averaged over frames and FFT'd over the frame index → the cyclic frequency α (fine, Δα≈0.7 Hz),
  **retaining the cross-carrier phase the CMS threw away**. Normalized to the cyclic spectral coherence |γ|∈[0,1].
- **Exact Carter-Knapp-Nuttall significance mask** (`cohThreshold`, `overlapCorrectedK`): under H0 |γ|²~Beta(1,K_eff−1),
  threshold `1−p^{1/(K_eff−1)}` with K_eff overlap-corrected from the window autocorrelation — a real statistical
  test replacing the median+3·MAD heuristic.
- **Enhanced Envelope Spectrum (EES)** marginal `⟨|γ|⟩_f` + a new `viz/EesStrip.tsx` canvas subplot under the
  heatmap (shares the α axis; defect-frequency markers). The classical SES is its band-restricted special case.
- **`viz/CscPanel.tsx`**: swapped to Fast-SC, real CKN mask (default ON), EES strip; the note reports the live
  K_eff/|γ|²_thr. **Methodology**: the honest callout rewritten (it now DOES compute a spectral correlation),
  the CMS equation replaced by the Fast-SC + CKN + EES equations, symbols updated, Carter-Knapp-Nuttall 1973
  reference added.
- **Rigorously validated before shipping:** a design panel (3 expert specs → synthesis) flagged a de-aliasing
  error in the naive lag→α mapping; numerical harnesses then confirmed the clean estimator localizes planted
  cyclostationary content to the correct α (<1 Hz), and on the App's own signals outer→BPFO / inner→BPFI /
  ball→2·BSF ridges + harmonics appear while healthy shows none. An adversarial review then caught a real
  overlap-correction bug in K_eff (Bartlett taper over the wrong index) that inflated the false-alarm rate; fixed,
  the white-noise FAR is now a calibrated ~4–5% at nominal p=0.05, and the EES strip uses the proper carrier-mean
  significance floor (not the per-pixel threshold). 5 committed acceptance-gate tests (22 frontend dsp tests pass).

## [0.32.000] — 2026-06-22

Configurable analysis parameters (T7) — the analysis is now parametrised, not fixed. Frontend only (engine
`rotorlab 0.28.000`).

### Added
- **An "Analysis" control group in the App sidebar** (drives the always-visible diagnosis + the Envelope·SES / ISO
  trend / Recommendation tabs):
  - **Demod band** — Auto (kurtogram max-kurtosis band) · Fixed 2–4 kHz resonance · Manual (click a kurtogram cell
    or brush the spectrum; picking auto-switches to Manual). The envelope/SES + diagnosis react live.
  - **Envelope** — Magnitude envelope (the diagnosis gates are tuned on it) · **Squared (SES)** — squaring sharpens
    the cyclostationary comb (Randall & Antoni). `envelopeSpectrum(..., squared)`.
  - **Harmonics (comb)** — 3–8, the number of harmonics the comb prominence averages over; raising it widens the
    evidence and changes the severity index (e.g. 5→8 moved a case 13.6×→9.9×). `diagnose(..., nHarm)`.
  - **ISO scale** — ISO 10816-1 Class I (≤15 kW) · ISO 20816-3 Group 2 (15–300 kW) · Group 1 (>300 kW); changes the
    A/B/C/D zone boundaries in the ISO trend AND the T5 recommendation. `ISO_CLASSES` + `isoZoneOf(v, bounds)`.

### Changed
- `envelopeSpectrum`, `diagnose`, `recommend`/`isoZoneOf` and the ISO/Recommendation panels now take these
  parameters (all back-compatible defaults — existing behaviour unchanged until a control is moved).

## [0.31.000] — 2026-06-22

Bring-your-own-data ingest (T6) — run the real pipeline on YOUR signal. Frontend only (engine `rotorlab 0.28.000`).

### Added
- **A "Bring your own data" section on the Benchmark page** (`viz/IngestPanel.tsx`): paste or upload a vibration
  signal (CSV / one-number-per-line — the last numeric column is taken), set the sample rate, shaft rpm and bearing
  geometry, and it runs the REAL unsupervised pipeline on it — kurtogram auto-band → envelope/SES → diagnosis → the
  T5 recommendation — rendering the envelope spectrum with the BPFO/BPFI/2·BSF defect combs marked, the diagnosis,
  and the maintenance recommendation. A "Load real example" button (a committed real CWRU outer-race segment) makes
  it work with no file.
- **`dsp/parseSignal.ts`** (pure, tested): robust text parsing — per row takes the last numeric token (handles a
  single accel column AND `time,accel`), skips non-numeric headers, guards length ≥ 2048 / finite / not flatline.
- **Honest scope:** the unsupervised physics is rig-agnostic, so it runs on any bearing; the deep WDCNN is NOT
  applied to arbitrary data — it is CWRU-specific (12 kHz / 2048 / SKF 6205), and applying it to a different
  geometry/rate is exactly the domain-shift the MFPT cross-dataset section shows fails. Stated in the UI.
- **Tests:** 4 new `parseSignal` unit tests (single column, `time,accel` + header, too-short, flatline) — 17
  frontend dsp tests pass.

## [0.30.000] — 2026-06-22

Recommendation / decision engine + exportable report (T5) — the "what do I do about it?" surface. Frontend only
(engine unchanged at `rotorlab 0.28.000`).

### Added
- **A real condition-based-maintenance decision engine** (`dsp/recommend.ts`): fuses the envelope diagnosis, the
  **ISO 20816 / 10816-1 broadband-velocity severity zone** (A/B/C/D) and the **RUL** projection into one prioritised
  recommendation on the ladder **ok → watch → plan → alarm → trip** (trip only when a severe fault, Zone D and a
  short RUL all agree). Every factor is returned with its value + assessment — explainable, not a black box.
- **Honesty built in:** when the coarse broadband ISO screen looks calm (Zone A/B) but the envelope confirms a real
  bearing fault (its energy sits in the HF resonance OUTSIDE the 10–1000 Hz band), the engine **surfaces the
  disagreement and trusts the envelope** instead of hiding it — the textbook reason envelope analysis exists.
- **App tab "Recommendation · report"** (`viz/RecommendationPanel.tsx`, reacts to the selected case): a decision
  card (priority badge + action + next-inspection cadence + confidence), the honest-disagreement callout, the
  evidence/rationale table, and **exports** — a structured **JSON**, a human-readable **Markdown** report, and a
  **Print / Save-as-PDF** (clean print window) — the deliverable a technician attaches to the work order.
- **Tests:** 5 new `recommend()` unit tests (`test/dsp.test.ts`) across the priority ladder + the ISO zone
  boundaries + the honest-disagreement path (13 frontend dsp tests pass).

### Fixed
- **The footer version no longer drifts.** It was hardcoded (`0.26.001`, three releases stale); `vite.config` now
  injects the `package.json` version via `define: __APP_VERSION__`, so the displayed version is always the build's.

## [0.29.000] — 2026-06-22

Cross-DATASET generalization (T13) — a second real rig (MFPT). The domain-shift test that completes the
deep-vs-classical arc. Engine `rotorlab 0.28.000`.

### Added
- **MFPT as a real second dataset** (`io/fetch_mfpt.py`, `stages/cross_dataset.py`): the CWRU-trained WDCNN — which
  never saw a single MFPT sample — is run on the **MFPT** bearing set (NICE bearing, 48828/97656 Hz resampled to
  ~12 kHz, BPFO 3.245× / BPFI 4.755× vs CWRU 3.5848× / 5.4152×). Downloaded link-only from the MathWorks/MFPT
  mirror, never re-hosted (raw gitignored). A true held-out **domain-shift** test.
- **The honest result:** the deep WDCNN **collapses cross-rig** — ≈49% overall, **0% outer-race recall** (it calls
  MFPT outer faults `normal`) — while the unsupervised **envelope/SES transfers perfectly (100%)** because the comb
  physics, evaluated at the CORRECT MFPT defect frequencies (auto band), is rig-agnostic. The lesson, shown not
  claimed: **deep wins in-distribution (T12), physics wins cross-distribution (T13).**
- **Benchmark — cross-dataset section:** the CWRU-vs-MFPT rig/kinematics, the WDCNN-vs-physics recall table
  (overall + per class), the honest takeaway, and where the deep model sends the MFPT outer faults.
- **Live panel — MFPT group:** segments tagged "different rig"; running the live WDCNN on a real MFPT outer segment
  shows it predict `normal` ✗ — the domain-shift miss, demonstrated live (the deep-vs-classical SVM/RF block cleanly
  skips for MFPT, which carries no classical-ML feature vector).
- **Docs/tests:** `docs/cases` cross-dataset note + MFPT moved from roadmap to wired; `tests/test_cross_dataset.py`
  (the MFPT file set + the shipped `crossDataset` block + the MFPT sample contract; scipy-guarded for light CI).
  `crossDataset` block in `rv-learned-metrics.json`; MFPT segments (`dataset:"MFPT"`) in `rv-cwru-samples.json`.

## [0.28.000] — 2026-06-22

Cross-severity generalization (T4) — real held-out fault sizes, kills the "toy 4". Engine `rotorlab 0.27.000`.

### Added
- **Six REAL cross-severity cases** (`dx-{inner,ball,outer}-{014,021}-3hp`): the WDCNN / deep-AE / SVM-RBF /
  Random Forest are trained ONLY on 0.007″ faults (0/1/2 HP), then asked to diagnose UNSEEN 0.014″/0.021″ faults
  at the held-out 3 HP load (CWRU 172/212, 188/225, 200/237 — downloaded, never re-hosted). A true held-out
  severity+load generalization test. New `stages/cross_severity.py`; `fetch_cwru.SEVERITY_FILES`; the trace builder
  reuses the live WDCNN diagnosis path (a `sizeIn` param routes to the severity segments + the severity recall).
- **Benchmark — cross-severity generalization table + per-fault detail.** Accuracy by fault size for all four
  methods, colour-coded, plus a per-(fault,size) table showing **where each WDCNN miss lands**. The honest finding:
  the WDCNN nails 0.021″ spalls (98.9%) but **collapses on the intermediate 0.014″ (27.8%)** — and the unsupervised
  envelope/SES, which never trains, struggles on the SAME 0.014″ recordings, so the signatures are weaker/atypical
  (Smith & Randall 2015), not a model artefact. Shown, not hidden.
- **Live panel — unseen-size segments.** The real-diagnosis panel now groups segments by (class, fault size); the
  0.014″/0.021″ groups are tagged "unseen size" with an honest callout. Running the live WDCNN on e.g. inner-0.014″
  (#172) shows it predict `outer` ✗ — a real, visible generalization gap, framed honestly.
- **Docs/tests:** `docs/cases/` cross-severity row + honesty note; `tests/test_cross_severity.py` (the registry
  cases, the stage helpers, and the SHIPPED `crossSeverity` + severity-sample contract). `crossSeverity` block in
  `rv-learned-metrics.json`; severity segments (with `sizeIn`/`caseId`) in `rv-cwru-samples.json`.

### Fixed
- **onnxruntime-web "Session already started" race.** The WASM EP runs single-threaded (`numThreads=1`), so two
  `session.run()` overlapping — even on different models, e.g. SVM+RF via `Promise.all` — threw. `lib/ort.ts` now
  serialises every inference through a single global gate (zero perf cost; the runtime can only do one at a time).
  Also a `useRef` re-entrancy guard on the live panel. This latent race could intermittently break the deep-vs-
  classical block shipped in 0.27.000.

## [0.27.000] — 2026-06-22

Classical-ML supervised baselines (T12) — the deep-vs-classical comparison made real, not rhetorical. Engine
bumped to `rotorlab 0.26.000`.

### Added
- **Two classical-ML diagnosers trained on real CWRU and run LIVE in the browser** alongside the deep WDCNN: an
  **RBF-kernel SVM** and a **Random Forest**, both over a 10-D physics-informed feature vector (six scale-invariant
  time-domain shape factors — kurtosis/skewness/crest/impulse/shape/clearance — plus the envelope-spectrum comb
  prominence at BPFO/BPFI/2·BSF and the resonance-band spectral kurtosis). Same **leakage-safe split** as the WDCNN
  (hold out the entire 3 HP load), so their held-out accuracy is directly comparable. New `model/classical_ml.py`;
  wired through `preprocess` (per-window rpm arrays) → `retrain` → `export`.
- **skl2onnx export → live `ai.onnx.ml` inference.** `rv-svm.onnx` / `rv-rf.onnx` (SVMClassifier /
  TreeEnsembleClassifier, StandardScaler baked in) run on the onnxruntime-web WASM EP. `lib/ort.ts` gains
  `svmClassify`/`rfClassify`; `dsp/learned.ts` gains `classifyClassical`.
- **Benchmark — the deep-vs-classical-ML-vs-unsupervised comparison table** (held-out, real): WDCNN **100%** /
  Random Forest **85.6%** / SVM-RBF **85.6%** / envelope-SES **73.7%**, with a **healthy-recall column** that tells
  the honest story — the classical ML nails the faults but false-alarms on half the healthy windows (recall ~0.51),
  which is exactly the boundary the deep CNN learns. The live diagnosis panel now runs all three models on the same
  real segment (a real disagreement is visible: RF predicts `ball` on a healthy segment, marked ✗).
- **Methodology · ML/Deep-Learning tab** documents the classical-ML baseline concretely: the shape-factor equations,
  the 10-D feature vector, the honest result, and the new `widodo2007svm` reference (DOI-verified).
- **Docs:** `docs/frameworks/08_classical-ml/classical-ml.md` (the method card) + `tests/test_classical_ml.py`
  (train→evaluate→export→onnxruntime round-trip; ONNX ↔ sklearn label agreement; determinism).

### Changed
- Manifests now list `rv-svm.onnx` / `rv-rf.onnx` in `shared.models` and the engine `model` string names the
  classical-ML baselines; `rv-cwru-samples.json` carries `clsFeat` (the 10-D vector) per committed segment and
  `clsFeatures`; `rv-learned-metrics.json` carries a `classicalML` block (svm/rf accuracy + per-class + confusion).

### Fixed
- `export.export_models` — `len(train_out.get("trX", []) or [])` raised on a numpy array (ambiguous truth value);
  now `int(len(train_out["trX"])) if train_out.get("trX") is not None else 0`.

## [0.26.001] — 2026-06-21

### Fixed
- **Benchmark · Live diagnosis: the #1/#2/#3 segment buttons now show what each one is.** Each held-out segment is
  labelled with its source CWRU recording (the 3 HP held-out file per class: normal→#100, outer→#133, inner→#108,
  ball→#121), the load (3 HP), and the window number — on the class row, the button tooltip, and the selected-segment
  caption. `rv-cwru-samples.json` carries the provenance (`file`/`seg`/`loadHp`/`rpm`/`sourceFiles`), the offline
  export emits it, and `contract.types.ts` mirrors it. Previously the buttons were opaque (#1/#2/#3 with no meaning).

## [0.26.000] — 2026-06-21

App-page design fixes from review (content unchanged elsewhere; the offline pipeline + artifacts stay at 0.25.000).

### Changed
- **"Real diagnosis (WDCNN)" moved out of the App into the Benchmark page.** It is a cross-segment interactive
  panel that does NOT react to the App's left-sidebar synthetic scenario, so per the archetype rule (App = one
  selected case driven by the sidebar; cross-case/real-data views → Benchmark) it now sits at the top of Benchmark,
  above the held-out numbers it reproduces. The App's 12 tabs all react to the sidebar again.
- **"Replay degradation" scrubber scoped to the run-to-failure views it actually drives** (Envelope·SES, 3D
  waterfall, Prognostics·RUL) instead of a global top bar — it no longer appears above tabs it does not affect.
  Shared state is preserved, so the scrubber position persists across those three tabs.
- Cross-references updated (Experiments, Methodology) to point at Benchmark for the live diagnosis; stale
  `tools/ml` reference fixed to `data-pipeline/rotorlab`; app version display fixed (was a stale 0.24.000).

## [0.25.000] — 2026-06-21

Refactor onto the CAOS product-repo archetype (ADR-0057) — the science core is unchanged; the repo is now a
real, contract-bounded, staged offline pipeline + a frontend SPA.

### Changed
- **`tools/ml` + `tools/cwru-benchmark` → `data-pipeline/rotorlab/`** — the WDCNN, deep-AE, the 64-D spectral
  feature, and the unsupervised classical envelope/SES chain are split into `model/` + the six named stages
  (`preprocess → feature_extraction → train → infer → evaluate → export`). Bodies unchanged.
- **`src/` → `frontend/src/`**; `public/*.onnx` + metrics → **`data/derived/`** (the canonical artifact home).
  `frontend/copy-data.mjs` overlays them back into `public/` at build (the SPA's fetch paths are unchanged).
- The default pipeline is **numpy-only**: `python -m rotorlab.pipeline all` rebuilds every per-case replay trace +
  manifest from the committed artifacts (no torch, no CWRU download). `--retrain` regenerates the ONNX/metrics.

### Added
- **Two data contracts**: Contract 1 (`io/contract.py` — vibration-record schema + outlier policy + raw-signal
  guard) and Contract 2 (`core/manifest.py` `rotorvitals.manifest/v2` + `core/trace.py` `rotorvitals.trace/v1`),
  with a TS mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **Cases by category** (`cases/cwru_cases.py`): 15 cases / 5 categories (diagnosis · robustness · classical ·
  synthetic · prognostics), each with an expected band + a real/synthetic flag + a validation anchor.
- **The lane gate** (`core/gate.py`, client-side TS + onnxruntime-web), two venvs + per-lane requirements,
  cross-platform `scripts/` (setup/precompute/fetch-data/dev/smoke), `tests/` (contract/manifest/smoke),
  CI (`ci.yml` ruff+pytest+pipeline+check_artifacts+guards) + `deploy-pages.yml`, a `docs/` wiki (ADR-0056), and
  a dormant `app/` FastAPI + VPS deploy templates.
- Verified running: ruff clean · pytest 10/10 · pipeline 15 cases · CONTRACT 2 OK · deterministic re-run ·
  `tsc + vite build` green · DSP node tests 8/8.

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
