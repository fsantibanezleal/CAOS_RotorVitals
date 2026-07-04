# Method, Deep autoencoder health indicator

**Provenance:** González-Muñiz, Nieves, Fernández-Getino García, et al. (2022), *Health indicator for machine
condition monitoring built in the latent space of a deep autoencoder*, Reliability Engineering & System Safety
224:108482. DOI 10.1016/j.ress.2022.108482.

**What:** an autoencoder trained on **healthy** windows only; its reconstruction error is a **novelty / health
indicator**, a faulty window reconstructs poorly → high HI. This is the unsupervised, label-free complement to the
supervised WDCNN: it flags "something is off" without needing fault labels.

## Architecture (`model/deep_ae.py`)

```
encoder: Linear(64→32) → ReLU → Linear(32→8)
decoder: Linear(8→32)  → ReLU → Linear(32→64)
```
Input: the 64-D log-binned magnitude-spectrum summary (`model/features.spectral_feat`), standardized by the scaler
shipped in `rv-learned-metrics.json` (`aeScaler.mean/std`), the browser applies the same scaler.

## Training & threshold

Adam (lr 1e-3, weight-decay 1e-5), MSE, 150 epochs, seeded. The baseline is the **all-load** healthy set (every
load's normal windows) so a load shift on a healthy window is not mistaken for a fault. The decision threshold is the
**p99** of the reconstruction error over that healthy baseline; reported metrics: fault-vs-healthy **AUC** and the
held-out **healthy false-flag rate**.

## Why it fits

A one-class novelty detector generalizes to fault types never seen in training and gives a continuous health score
(the input to prognostics), which a fixed 4-class classifier cannot.
