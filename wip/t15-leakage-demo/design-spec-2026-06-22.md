# T15 — CWRU window-overlap leakage demonstration (design spec)

Status: design, ready to implement. Author lens: CWRU data-leakage benchmarking specialist.
Date: 2026-06-22.

## Goal
Show, with REAL retrained models, how much the headline accuracy INFLATES under a naive/leaky
window split vs an honest grouped (by-recording) split, on the SAME data pool — to teach the
documented CWRU pitfall (Hendriks, Dumond & Knox 2022, MSSP 169:108732; arXiv 2509.22267;
Smith & Randall 2015). Output: a `leakageDemo` block in `rv-learned-metrics.json`, rendered by a
new panel on the Benchmark page.

## The data pool (the apples-to-apples invariant)
ONLY the 12 train-eligible recordings participate: 4 classes × {0,1,2 HP} = 12 files
(normal 97/98/99, inner 105/106/107, ball 118/119/120, outer 130/131/132). The held-out 3 HP
recordings (100/108/121/133) and all SEVERITY_FILES are NOT touched here — those stay reserved
for T1/T4. Both splits draw from the SAME 12 recordings, the SAME windows (WIN=2048, HOP=1024).
The ONLY thing that differs between the two arms is whether windows from a given recording may
appear in BOTH train and test. Load distribution is held fixed in both arms ⇒ leakage is isolated
from load-shift.

## Split A — LEAKY (naive, the wrong-but-common way)
Window every one of the 12 recordings → one big pool with a per-window `recording_id`. Random
70/30 stratified-by-CLASS split with a fixed seed (np.random.RandomState(15), stratify on y only,
NOT on recording). Because hop=1024 < win=2048 (50% overlap), adjacent windows are 50% physically
identical AND windows from one recording scatter across both sets ⇒ the test window at index i and
a train window at i±1 share half their samples. The net memorizes recording-specific noise.

## Split B — HONEST (grouped by recording, GroupShuffleSplit on recording_id)
Same 12 recordings, same windows. Split is GROUPED by `recording_id`: an entire recording goes
to train OR to test, never both. Per CLASS (4 windows-worth of recordings per class across the 3
loads), hold out ONE recording (the 2 HP load) for test, train on the other two (0/1 HP). Test set
= 4 recordings (one per class, all 2 HP); train = 8 recordings (0/1 HP). No window from a test
recording — and none of its 50%-overlapping neighbors — is ever in train. This is the
sklearn GroupShuffleSplit / "split by recording" standard the literature accepts.

KEY: both arms have the SAME total windows from the SAME 12 recordings and the SAME class balance;
load is balanced 0/1/2 in train-pool both ways. The gap A−B is leakage, not load-shift.

## What to (re)train
- WDCNN: retrain TWICE (once per split), same hyperparams as `stages/train.py` (Adam 1e-3, wd 1e-4,
  25 ep, seed 0). ~minutes CPU each. The whole point — a high-capacity net is what memorizes.
- classical-ML (SVM-RBF + RF over the 10 physics features): retrain TWICE too (seconds). Expected
  to inflate FAR LESS than the WDCNN — low-capacity + physics features can't memorize per-window
  noise. That contrast is itself a teaching result, so include it.
- NOT the deep-AE (one-class, no supervised split) and NOT the envelope/SES (unsupervised,
  leakage-immune by construction — it never trains). State that immunity in the caveat.
Cost: 2× WDCNN (~minutes) + 4× classical (~seconds). Acceptable, runs inside `--retrain`.

## Determinism
Window pool order is deterministic (FILES dict order). Leaky split: RandomState(15). Grouped split:
deterministic (2 HP = test, fixed). torch.manual_seed(0)/np.random.seed(0) inside each train call,
re-seeded per arm so the two WDCNNs are independently reproducible.

## Metrics block (`leakageDemo` key in rv-learned-metrics.json)
```json
"leakageDemo": {
  "pool": "12 train-eligible CWRU recordings (4 classes x 0/1/2 HP); 3 HP + severity untouched",
  "nRecordings": 12, "nWindows": <int>, "win": 2048, "hop": 1024, "overlapPct": 50,
  "splits": {
    "leaky":  { "name": "naive random window split (stratified by class)",
                "ratio": "70/30", "seed": 15, "grouped": false,
                "nTrain": <int>, "nTest": <int> },
    "honest": { "name": "grouped by recording (hold out the 2 HP recording per class)",
                "grouped": true, "heldOutLoadHp": 2,
                "nTrain": <int>, "nTest": <int> }
  },
  "wdcnn":     { "leakyAcc": <f>, "honestAcc": <f>, "inflationPts": <f>,
                 "leakyPerClass": {..}, "honestPerClass": {..},
                 "leakyConfusion": [[..]], "honestConfusion": [[..]] },
  "classicalML": { "svm": { "leakyAcc": <f>, "honestAcc": <f>, "inflationPts": <f> },
                   "rf":  { "leakyAcc": <f>, "honestAcc": <f>, "inflationPts": <f> } },
  "note": "...", "caveat": "...",
  "refs": [ {"label":"Hendriks, Dumond & Knox 2022","doi":"10.1016/j.ymssp.2021.108732"},
            {"label":"Smith & Randall 2015","doi":"10.1016/j.ymssp.2015.04.021"} ]
}
```
inflationPts = round(100*(leakyAcc − honestAcc), 1).

## Implementation surface (files)
- NEW `data-pipeline/rotorlab/stages/leakage_demo.py` — `run(raw_dir, classes, seed=15) -> dict`.
  Mirrors `cross_severity.py`: windows the 12 files, builds both splits, retrains WDCNN+SVM+RF per
  arm, returns the block above. Lazy torch/sklearn imports.
- `pipeline.py retrain()` — add `xleak = leakage_demo.run(str(RAW_CWRU), pre["classes"])` and pass
  `leakage_demo=xleak` to `export.export_models`; print a one-line summary.
- `export.py export_models(...)` — accept `leakage_demo` kwarg, write `metrics["leakageDemo"] = ...`.
- `frontend/src/lib/contract.types.ts` — add optional `leakageDemo?` to `Metrics`.
- `frontend/src/pages/Benchmark.tsx` — new `<LeakageDemoBlock>` rendered after CrossDataset:
  grouped bar/table leaky-vs-honest per model, the inflation delta highlighted, the caveat callout.

## Honest expected result (sanity bounds)
WDCNN leaky ≈ 0.98–1.00, honest ≈ 0.80–0.95 → inflation ~5–18 pts (CWRU 0.007" faults are
largely separable even honestly, so don't expect the 95→53 collapse from Hendriks' by-fault-size
split — that confounds severity; ours isolates window overlap at fixed severity, a smaller but
clean gap). SVM/RF inflation noticeably smaller. BROKEN if: honest > leaky (sign flip), leaky < 0.9
(net failed to fit), or |inflation| absurd (>40 pts on this easy pool) ⇒ split confounded.

## Honesty pitfalls to avoid
1. Don't let load-shift sneak in — both arms must use the SAME recordings/loads; only window
   assignment differs. (If honest held out a *load* the leaky arm trained on, the gap = leakage +
   covariate shift, confounded. Here both arms see 0/1/2 in their pool; honest just groups by
   recording.) The 2 HP-as-test choice keeps test load present in the leaky train too.
2. Don't shrink train size as the "leak" — keep nTrain comparable across arms (70/30 ≈ grouped
   8-of-12-recordings ≈ 67/33); report both n so the reader sees it's a load/grouping effect, not a
   sample-size effect.
3. Report it as a CAUTIONARY number, never as RotorVitals' headline accuracy. The site's real
   headline stays the honest hold-out-3HP number (T1). Label the leaky number "inflated / do-not-cite".
4. Don't fabricate the collapse — if 0.007" faults are too easy to show a big WDCNN gap, report the
   small honest gap and say so (and note SVM/RF show it even less). The lesson is the SIGN and the
   per-model contrast, not a dramatic magnitude.
5. Stratify the leaky split by CLASS only (not by recording) — stratifying by recording would
   accidentally make it grouped. The leak must be allowed to happen.
