"""The classical, UNSUPERVISED envelope/SES diagnosis chain (Randall & Antoni 2011), the leakage-immune baseline.
Moved verbatim from the original tools/cwru-benchmark/run.py: bandpass -> Hilbert envelope -> squared-envelope
spectrum -> per-harmonic comb prominence with amplitude-modulation sidebands, plus the kurtogram band pick and the
raw-spectrum control. Requires numpy + scipy (the heavy precompute lane); never imported by the light pipeline.

Refs: Randall & Antoni 2011 (MSSP 25:485-520); Antoni 2006/2007 (the kurtogram); Smith & Randall 2015 (the CWRU
difficulty/leakage caveats). SKF 6205-2RS JEM multipliers: BPFO 3.5848, BPFI 5.4152, BSF 2.3568, FTF 0.3983.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import hilbert

CLASSES = ["normal", "outer", "inner", "ball"]
MULT = {"outer": 3.5848, "inner": 5.4152, "ball": 2 * 2.3568}      # ball diagnosed at 2*BSF
SIDEBAND = {"outer": 0.0, "inner": 1.0, "ball": 0.3983}            # AM sideband spacing (x shaft rate)
ABS_GATE, REL_GATE = 4.5, 1.7
RESBAND = (2000, 4000)                                             # documented CWRU drive-end resonance band


def bandpass(x, fs, f1, f2):
    n = len(x)
    N = 1 << (n - 1).bit_length()
    X = np.fft.fft(x, N)
    freqs = np.fft.fftfreq(N, 1 / fs)
    X[(np.abs(freqs) < f1) | (np.abs(freqs) > f2)] = 0
    return np.real(np.fft.ifft(X))[:n]


def mag_spectrum(x, fs):
    n = len(x)
    w = np.hanning(n)
    xw = (x - x.mean()) * w
    N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(xw, N)
    mag = np.abs(X) * 2 / w.sum()
    freq = np.fft.rfftfreq(N, 1 / fs)
    return freq, mag


def env_spectrum(x, fs, band):
    e = np.abs(hilbert(bandpass(x, fs, band[0], band[1])))
    return mag_spectrum(e, fs)


def kurtosis(x):
    m = x - x.mean()
    m2 = np.mean(m ** 2)
    return float(np.mean(m ** 4) / (m2 * m2) - 3) if m2 > 0 else 0.0


def kurtogram_band(x, fs, maxlevel=4):
    nyq = fs / 2
    best = (-1e9, 0.02 * fs, nyq)
    for lvl in range(1, maxlevel + 1):
        nb = 2 ** lvl
        bw = nyq / nb
        for b in range(nb):
            f1, f2 = b * bw, (b + 1) * bw
            lo = max(f1, 0.02 * fs)
            if lo >= f2:
                continue
            k = kurtosis(np.abs(hilbert(bandpass(x, fs, lo, f2))))
            if k > best[0]:
                best = (k, lo, f2)
    return best[1], best[2]


def _peak(freq, mag, fc, tol):
    sel = mag[(freq >= fc - tol) & (freq <= fc + tol)]
    return sel.max() if sel.size else 0.0


def prominence(freq, mag, f0, nharm=5, sideband=0.0):
    """Per-harmonic peak-to-local-median over the envelope spectrum. For amplitude-modulated faults (inner race,
    rolling element) the defect line carries +/- sidebands, so the score takes the strongest of the fundamental and
    its two sidebands. sideband=0 (outer race) reduces to the plain comb."""
    if f0 <= 0:
        return 0.0
    df = freq[1] - freq[0]
    fmax = freq[-1]
    tol = max(2 * df, 0.015 * f0)
    W = max(12 * df, 0.12 * f0)
    tot = 0.0
    used = 0
    for k in range(1, nharm + 1):
        fk = k * f0
        if fk + W + sideband > fmax:
            break
        centers = [fk] + ([fk - sideband, fk + sideband] if sideband > 0 else [])
        peak = max(_peak(freq, mag, c, tol) for c in centers)
        around = mag[(freq >= fk - W) & (freq <= fk + W) & ((freq < fk - tol) | (freq > fk + tol))]
        if peak <= 0 or around.size == 0:
            continue
        med = np.median(around) or 1e-12
        tot += peak / med
        used += 1
    return tot / used if used else 0.0


def diagnose(x, fs, rpm, band):
    fr = rpm / 60
    freq, mag = env_spectrum(x, fs, band)
    scores = {c: prominence(freq, mag, MULT[c] * fr, sideband=SIDEBAND[c] * fr) for c in ("outer", "inner", "ball")}
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top, second = ranked[0], (ranked[1][1] or 1e-9)
    healthy = top[1] < ABS_GATE or top[1] / second < REL_GATE
    return "normal" if healthy else top[0]


def run_pipeline(x, fs, rpm, win_s=1.0, max_win=6, fixed_band=None):
    """Predict per ~1 s window; return list of predicted classes (file-level independent)."""
    w = int(win_s * fs)
    preds = []
    band = fixed_band or kurtogram_band(x, fs)
    for i in range(0, len(x) - w, w):
        if len(preds) >= max_win:
            break
        preds.append(diagnose(x[i:i + w], fs, rpm, band))
    return preds


def raw_comb_predict(x, fs, rpm, win_s=1.0, max_win=6):
    """Baseline: score the kinematic combs directly on the RAW spectrum (no envelope demodulation)."""
    w = int(win_s * fs)
    preds = []
    fr = rpm / 60
    for i in range(0, len(x) - w, w):
        if len(preds) >= max_win:
            break
        freq, mag = mag_spectrum(x[i:i + w], fs)
        scores = {c: prominence(freq, mag, MULT[c] * fr, sideband=SIDEBAND[c] * fr) for c in ("outer", "inner", "ball")}
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        healthy = ranked[0][1] < ABS_GATE or ranked[0][1] / (ranked[1][1] or 1e-9) < REL_GATE
        preds.append("normal" if healthy else ranked[0][0])
    return preds


def confusion(pairs):
    idx = {c: i for i, c in enumerate(CLASSES)}
    M = np.zeros((4, 4), int)
    for tru, pred in pairs:
        M[idx[tru]][idx[pred]] += 1
    return M


def metrics_from(pairs):
    M = confusion(pairs)
    total = M.sum()
    correct = np.trace(M)
    recall = [float(M[i][i] / M[i].sum()) if M[i].sum() else 0.0 for i in range(4)]
    return {
        "confusion": M.tolist(),
        "rowRecall": recall,
        "accuracy": float(correct / total) if total else 0.0,
        "n": int(total),
    }
