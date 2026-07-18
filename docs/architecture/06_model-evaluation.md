# 06, Model evaluation (the leakage-safe protocol)

## The split

CWRU reuses **one physical bearing per fault type across the four loads**, so a true bearing-independent split is
impossible with this dataset (stated openly, Smith & Randall 2015). RotorVitals instead holds out an **entire load
condition** (3 HP) for test and trains on 0/1/2 HP, so no window from a test recording is ever seen in training;
this defeats the adjacent-window leakage that a random-window split would introduce. The split rule is **frozen** in
`stages/preprocess.py` and documented in every manifest (`split`).

## The honest deliverable: the SNR curve, not the bare accuracy

The 0.007″ CWRU faults are large and largely separable, so clean accuracy (WDCNN ≈ 100% held-out) is optimistic vs
field data. The honest headline is the **SNR-robustness curve**: additive noise at unit signal power (the windows
are z-scored), accuracy measured at SNR ∈ {clean, 10, 6, 2, 0, −2, −4} dB. It degrades monotonically (≈100% clean →
~chance at −4 dB), `wdcnn.snrCurve` in `rv-learned-metrics.json`, replayed by the `robust-snr-sweep` case.

## The deep-AE health indicator (one-class novelty)

The AE trains on the **all-load healthy baseline** (every load's normal windows), a novelty detector's baseline is
all known-healthy operation, and the FAULTS are the held-out unknown it must flag. The threshold is the **p99** over
that healthy baseline. Reported: fault-vs-healthy **AUC** (the real task) and the held-out **healthy false-flag
rate**. Training the AE on a single load would spuriously flag a healthy-but-load-shifted window, hence the
all-load baseline (distinct from the WDCNN's strict per-load held-out split).

## Negative controls (must stay)

* the **raw-spectrum comb** baseline (no envelope demodulation) sits near chance, proving the envelope demodulation
  does the work;
* competing-fault prominence scores (a real fault stands above the others; noise lifts all ≈ equally);
* the held-out healthy false-flag rate for the AE.
