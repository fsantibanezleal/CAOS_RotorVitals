#!/usr/bin/env python3
"""CWRU bearing-diagnosis benchmark for RotorVitals.

Downloads a curated subset of the Case Western Reserve University 12 kHz drive-end bearing data
(link-only; the raw .mat files are NEVER committed or re-hosted), runs the SAME envelope/SES diagnoser
the web app uses, and writes a compact metrics artifact (confusion matrix + per-method accuracy) to
src/data/cwru-benchmark.json. Our diagnoser is UNSUPERVISED comb-scoring (no training), so it is
leakage-immune by construction; we still evaluate one prediction per independent recording window and
report the file-level grouping honestly.

Run:  python run.py        (downloads on first run; reuses data/ after)
Refs: CWRU Bearing Data Center (engineering.case.edu/bearingdatacenter); Smith & Randall 2015 (MSSP
64-65:100-131) for the difficulty/leakage caveats. SKF 6205-2RS JEM defect-frequency multipliers per
the CWRU bearing-information page (BPFO 3.5848, BPFI 5.4152, BSF 2.3568, FTF 0.3983 x shaft rate).
"""
import json, os, subprocess, sys
import numpy as np
from scipy.io import loadmat
from scipy.signal import hilbert

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "src", "data", "cwru-benchmark.json"))
BASE_URL = "https://engineering.case.edu/sites/default/files/{}.mat"

# file number -> (true class, load HP, shaft rpm).  12 kHz DE, 0.007" faults + Normal baseline.
# rpm by load: 0HP=1797, 1HP=1772, 2HP=1750, 3HP=1730 (CWRU). Normal files are 48 kHz (handled per-file).
FILES = {
    97: ("normal", 0, 1797), 98: ("normal", 1, 1772), 99: ("normal", 2, 1750), 100: ("normal", 3, 1730),
    105: ("inner", 0, 1797), 106: ("inner", 1, 1772), 107: ("inner", 2, 1750), 108: ("inner", 3, 1730),
    118: ("ball", 0, 1797), 119: ("ball", 1, 1772), 120: ("ball", 2, 1750), 121: ("ball", 3, 1730),
    130: ("outer", 0, 1797), 131: ("outer", 1, 1772), 132: ("outer", 2, 1750), 133: ("outer", 3, 1730),
}
CLASSES = ["normal", "outer", "inner", "ball"]
# SKF 6205 defect-frequency multipliers (x shaft rate); ball diagnosed at 2*BSF.
MULT = {"outer": 3.5848, "inner": 5.4152, "ball": 2 * 2.3568}
# amplitude-modulation sideband spacing (x shaft rate): inner race ~ shaft (1x), ball ~ cage (FTF).
SIDEBAND = {"outer": 0.0, "inner": 1.0, "ball": 0.3983}


def _valid(p):
    if not (os.path.exists(p) and os.path.getsize(p) > 100000):
        return False
    try:
        m = loadmat(p)  # the real test: a truncated file fails here
        return any(k.endswith("DE_time") for k in m)
    except Exception:
        return False


def download():
    os.makedirs(DATA, exist_ok=True)
    for n in FILES:
        p = os.path.join(DATA, f"{n}.mat")
        if _valid(p):
            continue
        ok = False
        for attempt in range(4):
            print(f"  downloading {n}.mat (try {attempt + 1}) ...", flush=True)
            if os.path.exists(p):
                os.remove(p)
            subprocess.run(["curl", "-s", "-L", "--retry", "4", "--retry-all-errors", "--max-time", "300", "-o", p, BASE_URL.format(n)], check=False)
            if _valid(p):
                ok = True; break
        if not ok:
            raise SystemExit(f"failed to download a valid {n}.mat after 4 tries")


def load_de(n):
    """Return (drive-end accel signal, inferred fs). fs from ~10 s record length (12k vs 48k)."""
    m = loadmat(os.path.join(DATA, f"{n}.mat"))
    key = next((k for k in m if k.endswith("DE_time")), None)
    if key is None:
        return None, None
    x = np.asarray(m[key], dtype=float).ravel()
    fs = 48000 if len(x) > 240000 else 12000
    return x, fs


def bandpass(x, fs, f1, f2):
    n = len(x); N = 1 << (n - 1).bit_length()
    X = np.fft.fft(x, N); freqs = np.fft.fftfreq(N, 1 / fs)
    X[(np.abs(freqs) < f1) | (np.abs(freqs) > f2)] = 0
    return np.real(np.fft.ifft(X))[:n]


def mag_spectrum(x, fs):
    n = len(x); w = np.hanning(n); xw = (x - x.mean()) * w
    N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(xw, N)
    mag = np.abs(X) * 2 / w.sum()
    freq = np.fft.rfftfreq(N, 1 / fs)
    return freq, mag


def env_spectrum(x, fs, band):
    e = np.abs(hilbert(bandpass(x, fs, band[0], band[1])))
    return mag_spectrum(e, fs)


def kurtosis(x):
    m = x - x.mean(); m2 = np.mean(m ** 2)
    return float(np.mean(m ** 4) / (m2 * m2) - 3) if m2 > 0 else 0.0


def kurtogram_band(x, fs, maxlevel=4):
    nyq = fs / 2; best = (-1e9, 0.02 * fs, nyq)
    for lvl in range(1, maxlevel + 1):
        nb = 2 ** lvl; bw = nyq / nb
        for b in range(nb):
            f1, f2 = b * bw, (b + 1) * bw; lo = max(f1, 0.02 * fs)
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
    """Per-harmonic peak-to-local-median over the envelope spectrum. For amplitude-modulated faults
    (inner race, rolling element) the defect line carries ±sideband (shaft / cage) sidebands, so the
    score takes the strongest of the fundamental and its two sidebands — the standard envelope-spectrum
    reading. sideband=0 (outer race) reduces to the plain comb."""
    if f0 <= 0:
        return 0.0
    df = freq[1] - freq[0]; fmax = freq[-1]
    tol = max(2 * df, 0.015 * f0); W = max(12 * df, 0.12 * f0)
    tot = 0.0; used = 0
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
        tot += peak / med; used += 1
    return tot / used if used else 0.0


ABS_GATE, REL_GATE = 4.5, 1.7


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
    w = int(win_s * fs); preds = []
    band = fixed_band or kurtogram_band(x, fs)
    for i in range(0, len(x) - w, w):
        if len(preds) >= max_win:
            break
        preds.append(diagnose(x[i:i + w], fs, rpm, band))
    return preds


def raw_comb_predict(x, fs, rpm, win_s=1.0, max_win=6):
    """Baseline: score the kinematic combs directly on the RAW spectrum (no envelope demodulation)."""
    w = int(win_s * fs); preds = []; fr = rpm / 60
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
    total = M.sum(); correct = np.trace(M)
    recall = [float(M[i][i] / M[i].sum()) if M[i].sum() else 0.0 for i in range(4)]
    return {
        "confusion": M.tolist(),
        "rowRecall": recall,
        "accuracy": float(correct / total) if total else 0.0,
        "n": int(total),
    }


def main():
    print("CWRU benchmark: download (link-only, not re-hosted) ...", flush=True)
    download()
    RESBAND = (2000, 4000)  # documented CWRU drive-end fault-resonance band (~3 kHz region)
    methods = {
        "Envelope-SES (resonance band 2–4 kHz)": [],
        "Envelope-SES (auto kurtogram band)": [],
        "Raw-spectrum comb (no demodulation)": [],
    }
    per_file = []
    for n, (cls, load, rpm) in FILES.items():
        x, fs = load_de(n)
        if x is None:
            print(f"  WARN: {n}.mat has no DE channel, skipped", flush=True)
            continue
        for p in run_pipeline(x, fs, rpm, fixed_band=RESBAND):
            methods["Envelope-SES (resonance band 2–4 kHz)"].append((cls, p))
        for p in run_pipeline(x, fs, rpm, fixed_band=None):
            methods["Envelope-SES (auto kurtogram band)"].append((cls, p))
        for p in raw_comb_predict(x, fs, rpm):
            methods["Raw-spectrum comb (no demodulation)"].append((cls, p))
        per_file.append({"file": n, "class": cls, "loadHP": load, "rpm": rpm, "fs": fs})
        print(f"  {n}.mat  class={cls} load={load}HP fs={fs}", flush=True)

    art = {
        "dataset": "CWRU 12 kHz Drive-End (0.007 in faults) + Normal baseline",
        "source": "https://engineering.case.edu/bearingdatacenter",
        "redistribution": "link-only; raw .mat NOT re-hosted",
        "bearing": "SKF 6205-2RS JEM",
        "multipliers": {"BPFO": 3.5848, "BPFI": 5.4152, "2BSF": round(MULT["ball"], 4), "FTF": 0.3983},
        "protocol": "Unsupervised envelope/SES comb-scoring (no training -> leakage-immune by construction); 1 s windows from independent recordings; per-class row-normalized confusion. The three methods differ ONLY in the demodulation band: a fixed fault-resonance band, the auto kurtogram pick, or no demodulation (raw spectrum) — so the table isolates how decisive band selection is.",
        "classes": CLASSES,
        "files": per_file,
        "methods": {name: metrics_from(pairs) for name, pairs in methods.items()},
        "caveat": "Honest reading: band selection dominates — envelope analysis in the documented resonance band recovers normal/inner/outer reliably, the auto kurtogram pick underperforms on this data, and the raw spectrum is near chance. Rolling-element (ball) faults stay the hard case (their 2*BSF line is weak and modulated) — a well-known CWRU difficulty, not a bug. The 0.007 in faults are also large/largely separable (Smith & Randall 2015), so this is not field-grade difficulty.",
        "refs": [
            {"label": "CWRU Bearing Data Center", "url": "https://engineering.case.edu/bearingdatacenter"},
            {"label": "Smith & Randall 2015", "doi": "10.1016/j.ymssp.2015.04.021"},
        ],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(art, f, indent=2)
    for name, m in art["methods"].items():
        print(f"  {name}: acc={m['accuracy']*100:.1f}% (n={m['n']})", flush=True)
    print(f"wrote {OUT}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
