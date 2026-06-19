# RotorVitals — bearing fault diagnosis by envelope analysis

Open, explainable diagnosis of **rolling-element bearing faults** from a vibration signal — running
entirely in the browser, showing its working. Part of the **[Faena](https://faena.fasl-work.com)**
mining-analytics hub.

> Bearings are the most common failure point of crushers, conveyors, pumps and fans. RotorVitals
> computes the bearing's kinematic defect frequencies, demodulates the resonance a defect excites, and
> reads the **envelope spectrum** for energy at those exact lines (BPFO / BPFI / 2·BSF). Field-standard
> method, calibrated to the public **CWRU** bearing benchmark.

## How it works

`signal → band-pass → Hilbert envelope → envelope spectrum → harmonic scoring → diagnosis`

- **Kinematics** — BPFO/BPFI/BSF/FTF from bearing geometry and shaft speed (Randall & Antoni 2011).
- **Envelope analysis** — band-pass around the structural resonance, analytic signal via the Hilbert
  transform, magnitude, then its spectrum. A fault appears as a line at its kinematic frequency.
- **Decision** — each fault is scored by summed peak energy at its first 5 harmonics, normalized by the
  noise floor; the top score wins above a floor gate, else "healthy". Every number traces to a computed
  line — no black box.
- **Synthetic data** — a deterministic, seeded generator builds a physically-grounded signal (impulse
  train at the fault frequency, each impulse ringing a damped resonance, slip jitter, amplitude
  modulation, shaft harmonics, noise at a target SNR; McFadden & Smith 1984). The four demo scenarios
  double as a **self-validation set** — the engine recovers the fault frequency that generated each.

## Data

No dataset is shipped or required: the engine is closed-form DSP and the demo signals are generated
on-device from published physics. The bearing geometries (SKF 6205/6203) match the open **CWRU Bearing
Data Center** rig, so the same pipeline reads real CWRU recordings unchanged.

## Stack

Vite + React 19 + TypeScript, all DSP in TypeScript (FFT, Hilbert, envelope), KaTeX for equations, i18n
EN/ES, light/dark. Static — deploys to **GitHub Pages** (`rotorvitals.fasl-work.com`).

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # DSP unit + pipeline self-validation tests
npm run build     # static → dist/
```

## Honest limits

A single localized defect at steady speed is the easy case; real machines bring variable speed,
multiple faults, smearing and electrical interference, and absolute severity here is synthetic. The
**frequency relationships are exact** and transfer directly to real recordings.

---

Built by [Felipe Santibáñez-Leal](https://fasl-work.com) · part of [Faena](https://faena.fasl-work.com).
