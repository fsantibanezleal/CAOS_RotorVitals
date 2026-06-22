"""rotorlab — the offline+live engine for RotorVitals (instantiated from the CAOS product-repo archetype, ADR-0057).

The CORE is real and SOTA-pinned: a WDCNN (Zhang et al. 2017) 4-class fault diagnoser + a deep autoencoder
health indicator (González-Muñiz et al. 2022), both trained OFFLINE on the real CWRU 12 kHz drive-end bearing
data and exported to ONNX for live in-browser inference; plus the unsupervised classical envelope/SES chain
(Randall & Antoni 2011) as a leakage-immune baseline. The base around it (the two data contracts, the staged
pipeline, the lane gate, the manifest/trace, the cases-by-category registry) is the FROZEN archetype —
instantiated here, not redesigned. The supervised classical-ML baselines (SVM-RBF + Random Forest over physics
features, `model/classical_ml.py`) are the deep-vs-classical counterpoint, exported to ONNX and run live too.
"""

__version__ = "0.28.000"  # display X.XX.XXX; PEP 440 form in pyproject.toml (0.28.0)
