# Method — Classical-ML supervised baselines (SVM-RBF + Random Forest)

**Provenance:** Widodo & Yang (2007), *Support vector machine in machine condition monitoring and fault diagnosis*,
MSSP 21(6):2560–2574 (DOI 10.1016/j.ymssp.2006.12.007); the time-domain condition indicators are the classical
ISO-13373 machine-condition set; the envelope-comb features are Randall & Antoni (2011) (DOI
10.1016/j.ymssp.2010.07.017); evaluated on the Smith & Randall (2015) CWRU benchmark split (DOI
10.1016/j.ymssp.2015.04.021).

**What:** the *supervised* classical counterpoint to the deep WDCNN — the thing bearing diagnosis did for decades:
a small vector of **physics-informed hand-crafted features** fed to a generic classifier. Two are shipped (an
**RBF-kernel SVM** and a **Random Forest**), trained on the IDENTICAL leakage-safe split (hold out the entire 3 HP
load) so their held-out accuracy is directly comparable to the WDCNN's and to the unsupervised envelope-SES
benchmark. Exported to ONNX (skl2onnx) and run **live in the browser** on the same committed real CWRU held-out
segments — the deep-vs-classical comparison is real, not rhetorical.

## The feature vector (`model/classical_ml.py`, 10-D, the single source of truth)

The browser builds the SAME vector before the ONNX call (`FEATURE_NAMES` is mirrored in the frontend). All features
are **scale-invariant**: the windows are z-scored, so amplitude features are constant — only SHAPE informs.

1. **Time-domain condition indicators (6):** kurtosis, skewness, crest, impulse, shape, clearance — the
   impulsiveness / peakedness signature of a localized defect.
2. **Frequency-domain physics features (4):** the squared-envelope-spectrum harmonic-comb prominence `P(f₀)` at the
   outer (BPFO), inner (BPFI + sidebands) and rolling-element (2·BSF) defect frequencies — the SAME statistic the
   white-box diagnoser thresholds — plus the resonance-band spectral kurtosis.

```
v = [κ, γ, crest, impulse, shape, clearance, P(BPFO), P(BPFI), P(2·BSF), κ_res] ∈ ℝ¹⁰
      ──────── time-domain shape ────────   ─────── envelope-comb physics ──────
                       │
                  StandardScaler (baked into the ONNX)
                       │
            ┌──────────┴──────────┐
        SVC(rbf, C=10)     RandomForest(300, depth 14)
```

## Pipeline & export

- **Train** (`train`): `make_pipeline(StandardScaler(), SVC(kernel="rbf", C=10, probability=True, random_state=0))`
  and `make_pipeline(StandardScaler(), RandomForestClassifier(300, max_depth=14, random_state=0))`. Pinned
  `random_state` → deterministic.
- **Evaluate** (`evaluate`): held-out accuracy + 4×4 confusion + per-class recall, same split as the WDCNN.
- **Export** (`export_onnx`): `to_onnx(pipeline, target_opset=17, options={zipmap:False})` → `rv-svm.onnx`,
  `rv-rf.onnx`. The ML ops (`SVMClassifier` / `TreeEnsembleClassifier`, **ai.onnx.ml** domain) run on the
  onnxruntime-web WASM EP; input is the RAW 10-D vector (the StandardScaler is inside the graph).

## Honest reading (held-out, 3 HP load out)

| Model | Accuracy | Healthy recall | Type |
|---|---|---|---|
| WDCNN (1-D CNN, raw signal) | **100.0%** | 100% | deep learned |
| Random Forest (10 physics features) | 85.6% | 51% | classical ML |
| SVM-RBF (10 physics features) | 85.6% | 53% | classical ML |
| envelope/SES (resonance band) | 73.7% | 100% | unsupervised |

The story is in the **healthy-recall** column: the classical ML nails the faults (outer/inner ~100%, ball ~90%) but
false-alarms on half the healthy windows — the hand-crafted comb prominences also fire on healthy signals carrying
transients. The deep CNN learns the healthy/fault boundary the fixed features cannot. The split is identical, all
three run live on the same segments, and the number is reported as it lands — no fabricated win. This is the
supervised baseline the learned tier is measured against (the unsupervised envelope/SES is the training-free one).

## Reproduce

```
python -m rotorlab.pipeline --retrain   # regenerates rv-svm.onnx / rv-rf.onnx + the classicalML block in
                                         # rv-learned-metrics.json + clsFeat per committed sample
pytest tests/test_classical_ml.py        # train→evaluate→export→onnxruntime round-trip (ONNX ↔ sklearn agree)
```

Requires `scikit-learn` + `skl2onnx` (the heavy precompute lane only — `requirements-precompute.txt`).
