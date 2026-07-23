#!/usr/bin/env python3
"""Regenerate the figures for the RotorVitals prognostics/diagnostics benchmark report, from the COMMITTED
derived artifacts (no recompute). Three figures:

  fig-diagnostics.pdf   - (a) the learned WDCNN cross-load accuracy vs SNR (noise robustness); (b) per-class
                          recall of the leakage-immune unsupervised envelope scorer vs the learned WDCNN (the
                          honest ball-fault gap).
  fig-rul-benchmark.pdf - (a) the alpha-lambda scatter of predicted vs true RUL at the Saxena-2010 checkpoints
                          over the 23 real run-to-failure trajectories, with the +-20% accuracy cone; (b) the
                          alpha-lambda accuracy and cumulative relative accuracy per model.
  fig-rul-method.pdf    - the first-passage RUL method on a controlled degradation (health indicator, onset,
                          exponential projection to the failure threshold), from the committed method trace.

Run:  python make_figs.py
Deps: matplotlib, numpy.  Reads ../../../data/derived/*.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]                        # repo root
DER = ROOT / "data" / "derived"

INK = "#1a1a2e"
GRID = "#d8d8e0"
LEARN = "#1b6ca8"
UNSUP = "#e07a3f"

plt.rcParams.update({
    "font.family": "serif", "font.size": 9.4, "axes.edgecolor": INK,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.linewidth": 0.8, "figure.dpi": 200,
})


def _load(name):
    return json.loads((DER / name).read_text(encoding="utf-8"))


def fig_diagnostics():
    lm = _load("rv-learned-metrics.json")
    cb = _load("cwru-benchmark.json")
    fig, (axa, axb) = plt.subplots(1, 2, figsize=(7.0, 3.0))

    # (a) WDCNN accuracy vs SNR
    snr = lm["wdcnn"]["snrCurve"]
    xs = [(-8 if c["snrDb"] is None else c["snrDb"]) for c in snr]   # clean -> place left of -4
    xs = [c["snrDb"] for c in snr if c["snrDb"] is not None]
    ys = [c["accuracy"] for c in snr if c["snrDb"] is not None]
    clean = [c["accuracy"] for c in snr if c["snrDb"] is None][0]
    axa.axhline(clean, color="#3fa34d", linewidth=1.1, linestyle="--", label=f"clean = {clean:.2f}")
    axa.plot(xs, ys, "o-", color=LEARN, linewidth=1.8, markersize=5, label="WDCNN (cross-load)")
    axa.set_xlabel("added noise SNR (dB)")
    axa.set_ylabel("test accuracy (held-out 3 HP load)")
    axa.set_ylim(0.3, 1.03)
    axa.invert_xaxis()
    axa.set_title("(a) learned diagnostics: noise robustness", fontsize=8.6)
    axa.grid(True, color=GRID, linewidth=0.7)
    axa.set_axisbelow(True)
    axa.legend(fontsize=7.6, frameon=True, facecolor="white", edgecolor=GRID, loc="lower left")
    for s in ("top", "right"):
        axa.spines[s].set_visible(False)

    # (b) per-class recall: best unsupervised envelope vs WDCNN
    classes = cb["classes"]
    env = cb["methods"]["Envelope-SES (resonance band 2–4 kHz)"]["rowRecall"]
    wd = [lm["wdcnn"]["perClass"][c] for c in classes]
    x = np.arange(len(classes)); w = 0.38
    axb.bar(x - w / 2, env, w, color=UNSUP, edgecolor=INK, linewidth=0.6, label="envelope comb (unsupervised)")
    axb.bar(x + w / 2, wd, w, color=LEARN, edgecolor=INK, linewidth=0.6, label="WDCNN (learned)")
    axb.set_xticks(x); axb.set_xticklabels(classes)
    axb.set_ylabel("per-class recall")
    axb.set_ylim(0, 1.14)
    axb.set_title("(b) the honest ball-fault gap", fontsize=8.6)
    axb.axvline(3, color="#b23a48", linewidth=0.8, linestyle=":", alpha=0.6)
    axb.annotate("envelope\nmisses ball", (3, 0.12), fontsize=7.0, ha="center", color="#b23a48")
    axb.grid(axis="y", color=GRID, linewidth=0.7)
    axb.set_axisbelow(True)
    axb.legend(fontsize=7.0, frameon=True, facecolor="white", edgecolor=GRID, loc="upper center", ncol=1)
    for s in ("top", "right"):
        axb.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-diagnostics.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_rul_benchmark():
    b = _load("rv-rul-benchmark.json")
    S = b["summary"]
    models = [("exponential", "#1b6ca8", "o"), ("pf", "#e07a3f", "s"), ("gp", "#3fa34d", "^")]
    fig, (axa, axb) = plt.subplots(1, 2, figsize=(7.0, 3.0), gridspec_kw={"width_ratios": [1.2, 1]})

    # (a) alpha-lambda scatter
    tmax = 0.0
    for m, col, mk in models:
        pts = [(c["true_rul_h"], c[f"{m}_rul_h"]) for tr in b["trajectories"] for c in tr["checkpoints"]
               if c.get("true_rul_h") is not None and c.get(f"{m}_rul_h") is not None]
        if not pts:
            continue
        tv, pv = zip(*pts)
        tmax = max(tmax, max(tv), min(max(pv), 12))
        axa.scatter(tv, np.clip(pv, 0, 12), s=22, color=col, marker=mk, edgecolor=INK, linewidth=0.4,
                    alpha=0.8, label=f"{m} (n={len(pts)})", zorder=3)
    lim = 8.0
    xs = np.linspace(0, lim, 50)
    axa.plot(xs, xs, color="#555", linewidth=1.0, zorder=1)
    axa.fill_between(xs, 0.8 * xs, 1.2 * xs, color="#999", alpha=0.18, zorder=0, label="+-20% ($\\alpha$) cone")
    axa.set_xlim(0, lim); axa.set_ylim(0, lim)
    axa.set_xlabel("true RUL (h)"); axa.set_ylabel("predicted RUL (h)")
    axa.set_title("(a) $\\alpha$-$\\lambda$ scatter: 23 real run-to-failure\ntrajectories (XJTU-SY + FEMTO + IMS)", fontsize=8.2)
    axa.grid(True, color=GRID, linewidth=0.7)
    axa.set_axisbelow(True)
    axa.legend(fontsize=6.9, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    for s in ("top", "right"):
        axa.spines[s].set_visible(False)

    # (b) alpha-lambda accuracy + CRA per model
    names = [m for m, _, _ in models]
    ala = [S["models"][m]["alpha_lambda_accuracy"] for m in names]
    cra = [S["models"][m]["cra"] for m in names]
    x = np.arange(len(names)); w = 0.38
    axb.bar(x - w / 2, ala, w, color="#1b6ca8", edgecolor=INK, linewidth=0.6, label="$\\alpha$-$\\lambda$ accuracy")
    axb.bar(x + w / 2, cra, w, color="#7d5ba6", edgecolor=INK, linewidth=0.6, label="cumulative rel. accuracy")
    for xi, a, c in zip(x, ala, cra):
        axb.text(xi - w / 2, a + 0.004, f"{a:.3f}", ha="center", va="bottom", fontsize=6.8)
        axb.text(xi + w / 2, c + 0.004, f"{c:.2f}", ha="center", va="bottom", fontsize=6.8)
    axb.set_xticks(x); axb.set_xticklabels(names)
    axb.set_ylabel("score")
    axb.set_ylim(0, max(max(ala), max(cra)) * 1.35 + 0.02)
    axb.set_title("(b) RUL is hard: low $\\alpha$-$\\lambda$ accuracy\n(the honest record)", fontsize=8.2)
    axb.grid(axis="y", color=GRID, linewidth=0.7)
    axb.set_axisbelow(True)
    axb.legend(fontsize=7.0, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    for s in ("top", "right"):
        axb.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-rul-benchmark.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_rul_method():
    tr = _load("rul-inner/trace.json")
    p = tr["payload"]
    t = np.asarray(p["t"]); hi = np.asarray(p["hi"])
    onset = p["onset"]; t_fail = p["t_fail_est"]; true_fail = p["true_fail_norm"]
    fig, ax = plt.subplots(figsize=(6.2, 3.0))
    ax.plot(t, hi, "-", color=LEARN, linewidth=1.8, label="health indicator (RMS-type)")
    ax.axvline(onset, color="#3fa34d", linewidth=1.3, linestyle="--", label=f"onset (sustained 4$\\sigma$) = {onset:.2f}")
    thr = float(hi.max())
    ax.axhline(thr, color="#b23a48", linewidth=1.0, linestyle=":", label="failure threshold")
    # exponential projection on post-onset points
    mask = (t >= onset) & (hi > 0)
    if mask.sum() >= 2:
        b, lna = np.polyfit(t[mask], np.log(hi[mask]), 1)
        tp = np.linspace(onset, t_fail + 0.05, 40)
        ax.plot(tp, np.exp(lna + b * tp), color="#e07a3f", linewidth=1.4, linestyle="-.",
                label="exponential fit -> first-passage")
    ax.axvline(true_fail, color=INK, linewidth=1.1, label=f"true failure = {true_fail:.2f}")
    ax.plot([t_fail], [thr], "*", color="#e07a3f", markersize=13, markeredgecolor="k", markeredgewidth=0.5, zorder=6)
    ax.set_xlabel("normalized operating time")
    ax.set_ylabel("health indicator")
    ax.set_title("first-passage RUL on a controlled degradation (method illustration)", fontsize=8.8)
    ax.grid(True, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    ax.legend(fontsize=7.2, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    fig.tight_layout()
    fig.savefig(HERE / "fig-rul-method.pdf", bbox_inches="tight")
    plt.close(fig)


def main():
    fig_diagnostics()
    fig_rul_benchmark()
    fig_rul_method()
    print("wrote fig-diagnostics.pdf, fig-rul-benchmark.pdf, fig-rul-method.pdf")


if __name__ == "__main__":
    main()
