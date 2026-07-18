# Method, The diagnosis decision rule: harmonic prominence + two gates

**Provenance:** Randall & Antoni (2011), *Rolling element bearing diagnostics, a tutorial*, MSSP 25:485–520 (DOI
10.1016/j.ymssp.2010.07.017); Smith & Randall (2015), the CWRU benchmark study, MSSP 64:100–131 (DOI
10.1016/j.ymssp.2015.04.021).

**Code:** `frontend/src/dsp/diagnose.ts` (live) · consumed by the App diagnosis panel and the `rec` tab. This is the
**decision layer** the classical envelope/SES chain feeds; it is also the rule the web Experiments and Methodology
pages describe, so its constants live here too (not only in the code and the page).

## What it is

The verdict is not a black box and not "pick the tallest peak". For each candidate fault (outer → BPFO, inner → BPFI,
ball → 2·BSF) the engine scores the **prominence** of that line's harmonic comb in the envelope spectrum, then applies
**two gates** so it can correctly stay silent on a healthy bearing.

### 1. Per-harmonic prominence

For a candidate fundamental `f₀`, walk the first **`K = 5`** harmonics. At each harmonic take the local peak inside a
tolerance window and divide it by the **median** of the surrounding bins (a robust local baseline that excludes the
peak window, so a line cannot inflate its own baseline). Average the per-harmonic ratios.

```
P(f₀) = (1/K) Σ_{k=1..K}  max_{|f−k f₀| ≤ tol} S(f)  /  median_{|f−k f₀| ≤ W, |f−k f₀| > tol} S(f)

K = 5,   tol = max(2·Δf, 0.015·f₀),   W = max(12·Δf, 0.12·f₀)      [diagnose.ts:20-28]
```

`P ≈ 1–3` for pure noise (all three combs lift about equally, the competing faults act as mutual **negative
controls**); a genuine fault lifts its own comb far above that. The windows scale with `f₀`, so the test tolerates the
1–2 % slip drift that smears bearing lines.

### 2. The two gates (the constants the docs must carry)

The class is `argmax_c P(f_c)` over `c ∈ {BPFO, BPFI, 2·BSF}`, but winning the argmax is **not** sufficient. The top
candidate must clear **both** gates, both fixed in `diagnose.ts`:

| Gate | Constant | Meaning |
|---|---|---|
| **Absolute** `ABS_GATE` | **4.5** | the top prominence must be ≥ 4.5× its local baseline to be a fault *at all* |
| **Relative** `REL_GATE` | **1.7** | the top must beat the next-best fault (the negative control) by ≥ 1.7× |

```
verdict = healthy   if   P_top < 4.5   OR   P_top / P_2nd < 1.7
        = argmax fault   otherwise                                     [diagnose.ts:20-21,64-65]
```

If either gate fails, the line is not high enough above its own floor, or not separated enough from the best
competing fault, the verdict is **healthy**, not a forced choice among faults. This is what turns "always pick
something" into a test that can correctly say nothing is wrong.

### 3. Confidence

```
sep = 1 − P_2nd/P_top,   abs = clamp₀₁((P_top − 4.5)/4.5)
confidence = clamp₀₁(0.5·sep + 0.5·abs)        if a fault is declared
           = clamp₀₁(1 − max(sep, abs))         if healthy            [diagnose.ts:64-70]
```

A marginal, ambiguous spectrum honestly reports **low** confidence rather than false certainty.

## What it is not

* **Not a learned classifier.** This is the explainable physics decision; the WDCNN/AE learned tier
  (`docs/frameworks/05_wdcnn`, `06_deep-ae`) is a separate, measured-against baseline. The two gates make the
  classical verdict auditable line-by-line.
* **Not tuned per dataset.** The gates 4.5/1.7 are fixed constants, not fitted to CWRU; that is why the rule can be
  applied unchanged to any record and why a clean 100 % on a benchmark is a leakage red flag, not a win (Smith &
  Randall 2015).
* **Not a severity scale.** Prominence answers *which* fault and *how confidently*; severity/RUL and the ISO zone are
  separate evidence (see `docs/frameworks/14_prognostics-rul`).

## Data contract & outliers

* **Input:** the envelope-spectrum magnitude `S(f)` + the kinematic candidate frequencies (BPFO/BPFI/2·BSF, from
  geometry) + the bin spacing `Δf`.
* **Outlier behaviour:** a single strong non-harmonic line does **not** produce a comb, so it fails the absolute
  gate; two faults of similar prominence fail the relative gate → reported healthy (the rule prefers a false negative
  to a confident wrong call). The median baseline makes the score robust to a neighbouring strong line.

## Using it on other data

Any envelope-spectrum diagnosis with known candidate frequencies: supply `S(f)`, the candidate `f₀`s, and `Δf`. The
gates 4.5/1.7 are a sensible default for the median-normalized prominence; re-validate them if the noise floor of a
new sensor/rig differs markedly, and report the gate values used.

## Honest reading

The decision rule is the suite's anti-overclaim mechanism: it can return "healthy" on an ambiguous record instead of
forcing a fault. The prominence statistic and the gates are exact, transferable logic; only the demo signal they run
on is synthetic and labelled.
