# Attribution, data & methods

## Dataset

**Case Western Reserve University Bearing Data Center**, 12 kHz drive-end bearing recordings (SKF 6205-2RS JEM,
0.007″ faults + Normal baseline). https://engineering.case.edu/bearingdatacenter
**Redistribution: link-only.** The raw `.mat` files are downloaded on demand into `data/raw/cwru/` (git-ignored)
and are **never committed or re-hosted**. Only the compact derived artifacts (the trained ONNX, the held-out
sample segments, the metrics) are committed under `data/derived/`.

## Methods (DOI-verified, see `frontend/src/data/citations.ts` for the full 28)

| Method | Reference |
|---|---|
| WDCNN (wide-kernel 1-D CNN) | Zhang et al. 2017, Sensors 17(2):425, 10.3390/s17020425 |
| Deep-AE health indicator | González-Muñiz et al. 2022, RESS 224:108482, 10.1016/j.ress.2022.108482 |
| Envelope/SES bearing diagnostics | Randall & Antoni 2011, MSSP 25:485–520, 10.1016/j.ymssp.2010.07.017 |
| Kurtogram / fast kurtogram | Antoni 2006/2007, 10.1016/j.ymssp.2005.12.002 |
| CWRU benchmark study / leakage caveats | Smith & Randall 2015, MSSP 64-65:100–131, 10.1016/j.ymssp.2015.04.021 |

## Honesty

The learned + classical tiers are evaluated on the **real CWRU** data with a leakage-safe held-out-load split. The
synthetic damped-resonance demo signal and the run-to-failure / RUL trends are **labelled synthetic** (the
XJTU-SY/FEMTO/IMS/Paderborn/MFPT/Ottawa-TVS real datasets are roadmap, not yet wired). Kinematic fault frequencies
and DSP outputs are exact. No fabricated benchmark numbers.
