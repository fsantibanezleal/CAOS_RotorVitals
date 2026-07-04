# Frameworks & methods

The research made binding: every engine RotorVitals depends on is pinned (`requirements-precompute.txt` /
`frontend/package.json`) and documented here, no toy substitute. Engine cards cover what/why/install/use; method
cards cover the algorithm + its provenance.

## Engines

| Card | Pin | Lane |
|---|---|---|
| [PyTorch](01_pytorch/pytorch.md) | `torch==2.12.1` (CPU) | offline (train) |
| [ONNX / onnxruntime / onnxruntime-web](02_onnx-onnxruntime/onnx.md) | `onnx==1.22.0`, `onnxruntime==1.27.0`, `onnxruntime-web^1.27.0` | offline export + live inference |
| [SciPy](03_scipy/scipy.md) | `scipy==1.18.0` | offline (decimate, hilbert, loadmat) |
| [NumPy](04_numpy/numpy.md) | `numpy==2.4.6` | both lanes |

## Methods

| Card | Provenance |
|---|---|
| [WDCNN](05_wdcnn/wdcnn.md) | Zhang et al. 2017, Sensors 17(2):425 |
| [Deep-AE health indicator](06_deep-ae/deep-ae.md) | González-Muñiz et al. 2022, RESS 224:108482 |
| [Classical envelope/SES](07_classical-envelope-ses/classical.md) | Randall & Antoni 2011, MSSP 25:485–520; Antoni 2006/2007 (kurtogram); Smith & Randall 2015 |
| [Classical-ML baselines (SVM-RBF + RandomForest)](08_classical-ml/classical-ml.md) | Widodo & Yang 2007, MSSP 21(6):2560–2574; ISO 13373 condition indicators; Smith & Randall 2015 split |
| [Cyclostationary, Fast-SC & enhanced envelope spectrum](09_cyclostationary/cyclostationary.md) | Antoni 2007 (JSV 304); Antoni, Xin & Hamzaoui 2017, MSSP 92:248–277; Carter, Knapp & Nuttall 1973 |
| [Band-selection grams (kurtogram · infogram · autogram · IESFOgram)](10_band-selection-grams/band-selection-grams.md) | Antoni 2006/2007/2016; Moshrefzadeh & Fasana 2018; Mauricio et al. 2020, MSSP 144:106891 |
| [Real cepstrum](11_cepstrum/cepstrum.md) | Randall & Antoni 2011; Borghesani et al. 2013, MSSP 36:370–384 |
| [STFT spectrogram](12_spectrogram/spectrogram.md) | Randall & Antoni 2011 (time-frequency view) |
| [Learned-feature embedding (WDCNN 2-D PCA)](13_feature-embedding/feature-embedding.md) | representation analysis of the WDCNN; Smith & Randall 2015 (eval) |
| [Prognostics / RUL + ISO 20816 severity zones](14_prognostics-rul/prognostics-rul.md) | Lei et al. 2018; Wang et al. 2020 (XJTU); Saxena et al. 2010 (α-λ); ISO 20816-1/-3, ISO 10816-1 |
| [Diagnosis decision rule (harmonic prominence + two gates 4.5/1.7)](15_diagnosis-decision/diagnosis-decision.md) | Randall & Antoni 2011; Smith & Randall 2015 |

Architecture-level method docs: the [window-overlap leakage demo](../architecture/09_leakage-demo.md) (T15, Hendriks
et al. 2022).

All DOI-verified references are in `frontend/src/data/citations.ts` and surfaced in the Methodology page.
