# 09, The window-overlap leakage demo (T15)

**Provenance:** Hendriks, Dumond & Knox (2022), *Towards better benchmarking using the CWRU bearing fault dataset*,
MSSP 169:108732 (DOI 10.1016/j.ymssp.2021.108732); Smith & Randall (2015), the CWRU benchmark study (DOI
10.1016/j.ymssp.2015.04.021).

**Code:** `data-pipeline/rotorlab/stages/leakage.py` (offline) → metrics in `rv-learned-metrics.json` → rendered by
the `LeakageBlock` in `frontend/src/pages/Benchmark.tsx`. Shipped in **v0.36.000**.

## What this demo proves

CWRU is one long recording per fault class, cut into many overlapping windows. A naïve **random per-window** split
puts windows from the *same* recording in both train and test, so the classifier learns the recording's fingerprint,
not the fault physics, and reports near-100 % accuracy that collapses on any new bearing. This page **quantifies**
that leak, honestly, on one frozen pool, decomposed so the demo cannot overclaim.

## The honest decomposition

The naïve-vs-production accuracy gap has **two** causes, and the demo separates them rather than blaming it all on
overlap:

1. **Isolated overlap leak**, a purge/embargo control. On the **same** random test set (load and class held
   constant), a with-overlap train is compared against a train with every `order ± 1` neighbour of a test window
   removed. Removing data can only *hurt*, so the residual gain isolates the pure overlap leak (mean over `nSeeds`).
2. **Load penalty (the remainder)**, the production split additionally holds out the **entire 3 HP load**, paying a
   real generalization cost to an unseen operating point. That cost is *not* leakage and is charged to a separate
   bar.

```
naive-vs-production gap  =  isolated overlap leak  +  load penalty
```

On this clean `0.007"` pool the overlap leak is **modest**, not the dramatic published collapse, which is driven by
the deeper **bearing-identity** leak (sharing a bearing across train/test), a different and larger effect. Stating
that is the point: the demo shows a small, correctly-measured overlap leak, not an inflated headline.

## Integrity controls (why the number is trustworthy)

* **Shuffled-label plumbing**, permute `y` at the window level before both splits; both arms must collapse to
  ~chance (0.25 for 4 classes). This rules out an index/label bug; it deliberately does **not** attribute the gap to
  overlap (the purge control does).
* **Literal overlap-window count**, count windows shared train↔test under each split (random ≫ grouped 0).
* **Honest-T15 vs production consistency**, the demo's own honest number must match the production held-out number.
* The deep **WDCNN saturates** (1.0) on this clean pool → uninformative here, so the legible story is carried by the
  two classical models (RF, SVM-RBF), whose accuracy moves enough to read.

## What it is not

* **Not a claim that CWRU is unusable**, it is the field benchmark; the demo shows *how to split it honestly*.
* **Not the bearing-identity leak**, this isolates window-overlap only; the larger identity leak is named but not
  the subject of this panel.
* **Not free of the load penalty**, the production number itself still pays a (real, non-leakage) cross-load cost,
  so even the honest number is optimistic vs field data. The page says so.

## Data contract

* **Input:** one frozen pool of `nWindows` windows from 16 CWRU recordings, with `overlapPct` set by `HOP < WIN`.
* **Output:** per-model `{production (grouped), random (leaky), gap (upper bound), isolated overlap, healthy-recall
  prod→leaky}` + the integrity-control verdicts, all rendered with the stacked-bar decomposition.

## Honest reading

This is the suite's anti-self-deception panel: it takes the most common way a bearing classifier lies (overlap
leakage) and measures it under controls, separating it from the honest load-generalization cost. The accuracies and
control verdicts are real computed numbers on real CWRU windows; nothing here is illustrative. The lesson it
encodes, *report the split, decompose the gap, name the residual leak that was not measured*, is the standard every
Benchmark page in the suite is held to.
