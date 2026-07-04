# Method, WDCNN (Wide-kernel Deep CNN)

**Provenance:** Zhang, Peng, Li, Chen & Zhang (2017), *A New Deep Learning Model for Fault Diagnosis with Good
Anti-Noise and Domain Adaptation Ability on Raw Vibration Signals*, Sensors 17(2):425. DOI 10.3390/s17020425.

**What:** a 1-D convolutional network whose **first kernel is wide** (64 samples, stride 16) so the first layer acts
as a learned wide band-pass over the raw waveform, suppressing high-frequency noise before the deeper narrow-kernel
layers extract fault features. Input: a raw **2048-sample** z-scored window. Output: 4 class logits (normal / outer /
inner / ball).

## Architecture (as implemented, `model/wdcnn.py`)

```
Conv1d(1→16, k=64, s=16, p=24) → BN → ReLU → MaxPool(2)     # wide first-layer kernel
[Conv1d(·→·, k=3, s=1, p=1) → BN → ReLU → MaxPool(2)] × 4   # 16→32→64→64→64 channels
Flatten → Linear(256→100) → ReLU → Linear(100→4)
```
2048 → 64 → 32 → 16 → 8 → 4 along the length; 64 channels × 4 = 256 into the head.

## Training

Adam (lr 1e-3, weight-decay 1e-4), cross-entropy, 25 epochs, batch 128, seeded. Trained on the leakage-safe split
(loads 0/1/2 HP; 3 HP held out). The "anti-noise" claim is verified by the **SNR-robustness curve**, not assumed.

## Why it fits

Raw-waveform CNNs avoid hand-tuned feature pipelines and are the SOTA baseline for CWRU-style diagnosis; the wide
first kernel is the specific ingredient that gives the noise robustness RotorVitals reports honestly.
