# Method, Learned-feature embedding (WDCNN penultimate-layer 2-D PCA)

**Provenance:** the embedding visualization is standard representation-analysis practice; the underlying classifier
is the WDCNN (see `docs/frameworks/05_wdcnn/`), evaluated on the CWRU benchmark (Smith & Randall 2015, DOI
10.1016/j.ymssp.2015.04.021).

**Code:** `frontend/src/dsp/pca.ts` (the 2-D projection, live) · panels `viz/EmbeddingPanel.tsx`,
`viz/FeatureSpacePanel.tsx` · App tab **`feat`** (Feature space) + the Benchmark embedding section. Shipped in
**v0.35.000** (T14).

## What it is

The trained WDCNN's **penultimate-layer activations** are a learned, high-dimensional feature vector (≈100-D) for
each input window, the representation the final linear classifier actually separates. This view projects those
vectors to **2-D by PCA** and scatters them, coloured by true class, so the model's learned geometry is visible:
well-separated class clusters mean the representation is doing the work; overlapping clusters mean the classifier is
relying on a thin margin.

`pca2d(X)` computes the top-2 principal components by **orthogonal power iteration** on the covariance
(`cov·v = (1/n)·Cᵀ(C v)`, with `C` the centred feature matrix), deterministically seeded. For the embedding
(`n ≈ 33` segments, `d = 100` WDCNN features) it is instant. It returns each row's 2-D projection **and the fraction
of total variance each PC explains**, so the scatter is never read without its own honesty number.

## Why it matters

It turns "the model gets 100 % held-out" into something inspectable: *why*. If the healthy and ball clusters sit
apart in the embedding, the accuracy is structural, not luck. It is also where **domain shift** becomes visible, a
cross-dataset (e.g. MFPT) point cloud that lands *outside* the CWRU-trained clusters explains, geometrically, why the
deep model collapses off-distribution while the physics baseline transfers (see `docs/architecture/06_model-evaluation.md`).

## What it is not

* **Not the classifier's decision.** PCA is a *linear* shadow of a non-linear representation; two classes can be
  linearly mixed in 2-D yet cleanly separable by the full network. Read separation as suggestive, non-separation as a
  prompt to check the higher-D margin, not as the verdict.
* **Not UMAP/t-SNE.** This build uses PCA (deterministic, variance-explained reportable, reproducible) rather than a
  stochastic neighbour embedding, by design, the scatter must be the same on every reload.
* **Not a fault-frequency tool.** It visualizes the *learned* features, not the kinematic comb.

## Data contract & outliers

* **Input:** the WDCNN penultimate-layer feature matrix `X ∈ ℝ^{n×100}` over the held-out segments (precomputed
  offline, shipped in the metrics artifact).
* **Variance reported:** `varExpl = [PC1, PC2]` accompanies every scatter, a low pair (e.g. PC1+PC2 ≪ 1) warns that
  2-D under-represents the true geometry.
* **Outlier behaviour:** a point far from every cluster is either a genuinely atypical segment or an off-distribution
  (cross-dataset) sample, the marking distinguishes the two; never silently drop it.

## Using it on other data

Any trained classifier whose penultimate features you can export: scatter them by class to audit separability, or
overlay a new domain's points to see domain shift before trusting transfer. Swap `X` for the new feature matrix;
`pca2d` is dataset-agnostic.

## Honest reading

This is a *diagnostic of the diagnoser*, it makes the learned model's competence and its off-distribution
brittleness legible rather than asserted. The features and the 2-D projection are real, computed quantities; the
variance-explained pair is reported so the scatter is never over-read.
