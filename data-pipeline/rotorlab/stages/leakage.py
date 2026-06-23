"""Stage — leakage demonstration (heavy lane, T15): how much held-out accuracy is inflated by WINDOW-OVERLAP leakage,
quantified two ways on ONE frozen 16-recording CWRU pool (the documented CWRU leakage trap, Hendriks, Dumond & Knox
2022, MSSP 169:108732). Every number is a REAL fitted-model output — nothing is hand-typed.

Two measurements, deliberately separated so the demo does NOT overclaim:
  1. ISOLATED overlap leak (the clean number) — a purge/embargo decomposition. On the SAME random test set (a 4-load
     mix, so load and class are held constant vs its own training pool), compare a with-overlap train against a
     PURGED train that drops every order±1 same-recording neighbour of any test window. Removing windows can only
     HURT the purged arm, so any residual with-overlap gain is attributable to the overlap leak alone. Multi-seed.
  2. Naive-vs-production (an UPPER BOUND) — the naive random split vs the production grouped split-by-recording. This
     gap is NOT pure leakage: the grouped (honest) arm also holds out the entire 3 HP load, so it pays a
     load-generalization penalty the leaky arm does not. We report it honestly as overlap-leak + load-penalty.

Ships integrity controls (a shuffled-label plumbing check, a literal overlap-window count, a class-balance check, a
production cross-check). Requires torch + scipy + sklearn; imported only by the --retrain orchestrator."""
from __future__ import annotations

import statistics
from pathlib import Path

import numpy as np

from ..io.fetch_cwru import FILES
from ..io.schema import HOP, WIN
from ..model.features import window_signal

# The grouped (honest) test = the four 3 HP recordings (one per class). Fixed/deterministic so all 4 classes are
# present and there is no recording-cherry-pick surface. Equals the PRODUCTION hold-out-3HP split → a free
# consistency cross-check. NOTE: because it is a held-out LOAD, the naive-vs-production gap is an upper bound that
# also includes a load-generalization penalty — which is exactly why the ISOLATED purge measurement below exists.
HONEST_TEST_REC = (100, 108, 121, 133)   # normal / inner / ball / outer @ 3 HP
SEED_SPLIT = 15                          # base split seed (disclosed); distinct from the model seed (0). No seed-shopping.
N_SEEDS = 10                             # random-split repeats → a mean ± std interval, so the gap beats split noise.
# test fraction matched to the honest WINDOW fraction (≈ 471/1821 = 25.9%); recordings differ in length so this is
# NOT exactly 4/16 = 0.25.
LEAKY_TEST_SIZE = 0.259


def _load_de(raw: Path, n: int) -> np.ndarray:
    from scipy.io import loadmat
    from scipy.signal import decimate
    m = loadmat(str(raw / f"{n}.mat"))
    key = next((k for k in m if k.endswith("DE_time")), None)
    x = np.asarray(m[key]).squeeze().astype(np.float64)
    if len(x) > 240000:                                   # 48 kHz Normal files -> decimate x4 -> 12 kHz (as preprocess)
        x = decimate(x, 4, ftype="fir", zero_phase=True)
    return x


def _build_pool(raw: Path, classes: list[str]) -> dict:
    """Window all 16 recordings into one pool; tag each window with class, recording id, within-recording order (for
    the overlap/purge bookkeeping) and shaft rpm (for the classical-ML physics features)."""
    X, y, rec, order, rpm = [], [], [], [], []
    for n, (cls, _load, r) in FILES.items():
        if not (raw / f"{n}.mat").exists():
            continue
        ws = window_signal(_load_de(raw, n), win=WIN, hop=HOP)
        ci = classes.index(cls)
        X += ws
        y += [ci] * len(ws)
        rec += [n] * len(ws)
        order += list(range(len(ws)))                     # 0,1,2,… within this recording — adjacent ⇒ 50% overlap
        rpm += [r] * len(ws)
    return {"X": np.array(X, np.float32), "y": np.array(y, np.int64), "rec": np.array(rec, np.int64),
            "order": np.array(order, np.int64), "rpm": np.array(rpm, np.int64)}


def _scores(pred: np.ndarray, teY: np.ndarray, classes: list[str]) -> dict:
    acc = float((pred == teY).mean())
    conf = np.zeros((4, 4), int)
    for t, p in zip(teY, pred):
        conf[t, p] += 1
    per = {classes[c]: round(float((pred[teY == c] == c).mean()), 4) if (teY == c).any() else None
           for c in range(4)}
    return {"accuracy": round(acc, 4), "perClass": per, "confusion": conf.tolist()}


def _fit_eval_wdcnn(trX, trY, teX, teY, classes) -> np.ndarray:
    """Train a FRESH WDCNN (exact production hyperparams + seed) on the arm's train split, return test predictions."""
    import torch
    import torch.nn as nn

    from ..model.wdcnn import WDCNN
    torch.manual_seed(0)
    np.random.seed(0)
    net = WDCNN()
    opt = torch.optim.Adam(net.parameters(), 1e-3, weight_decay=1e-4)
    Xt, Yt = torch.tensor(trX).unsqueeze(1), torch.tensor(trY)
    idx = np.arange(len(Xt))
    for _ep in range(25):
        np.random.shuffle(idx)
        for i in range(0, len(idx), 128):
            b = idx[i:i + 128]
            opt.zero_grad()
            nn.functional.cross_entropy(net(Xt[b]), Yt[b]).backward()
            opt.step()
    net.eval()
    with torch.no_grad():
        return net(torch.tensor(teX).unsqueeze(1)).argmax(1).numpy()


def _neighbours(rec, order, te_idx) -> set:
    """The (recording, order) keys of every window that order-overlaps a test window — i.e. the test windows
    themselves plus their order±1 same-recording neighbours (win/hop = 2 ⇒ only immediate neighbours overlap)."""
    keys = set()
    for i in te_idx:
        rk, ok = int(rec[i]), int(order[i])
        keys.update({(rk, ok), (rk, ok - 1), (rk, ok + 1)})
    return keys


def _overlap_shared(rec, order, tr_idx, te_idx) -> int:
    """COUNT test windows that physically overlap a TRAIN window from the same recording (order±1)."""
    train_pos = {(int(rec[i]), int(order[i])) for i in tr_idx}
    return sum((int(rec[i]), int(order[i]) - 1) in train_pos or (int(rec[i]), int(order[i]) + 1) in train_pos
               for i in te_idx)


def _purge_train(rec, order, tr_idx, te_idx) -> np.ndarray:
    """The EMBARGOED train set: tr_idx minus any window that order-overlaps a test window (same recording, order±1).
    Same test set, same loads — removing the overlapping neighbours can only REMOVE information, so any residual
    with-overlap gain isolates the window-overlap leak."""
    bad = _neighbours(rec, order, te_idx)
    keep = [i for i in tr_idx if (int(rec[i]), int(order[i])) not in bad]
    return np.array(keep, dtype=tr_idx.dtype)


def _test_class_frac(teY, classes) -> dict:
    return {classes[c]: round(float((teY == c).mean()), 4) for c in range(4)}


def _ms(xs) -> dict:
    return {"mean": round(statistics.fmean(xs), 4), "std": round(statistics.pstdev(xs), 4)}


def run(raw_dir: str, classes: list[str], prod_holdout_acc: float, fs: int = 12000) -> dict:
    """Build the leakage demonstration block. `prod_holdout_acc` is this retrain's production hold-out-3HP WDCNN
    accuracy, used only for the honest-vs-production consistency cross-check."""
    from sklearn.model_selection import StratifiedShuffleSplit

    from ..model import classical_ml

    raw = Path(raw_dir)
    pool = _build_pool(raw, classes)
    X, y, rec, order, rpm = pool["X"], pool["y"], pool["rec"], pool["order"], pool["rpm"]
    n = len(y)
    seeds = list(range(SEED_SPLIT, SEED_SPLIT + N_SEEDS))

    def cml(tr, te):
        models = classical_ml.train(X[tr], y[tr], rpm[tr], fs)
        return classical_ml.evaluate(models, X[te], y[te], rpm[te], classes, fs)

    # ---- random (leaky) splits, multi-seed: the with-overlap arm AND its purged/embargoed counterpart ----
    # Both arms of the ISOLATED measurement share the SAME random test set per seed (a 4-load mix), so load, class and
    # test set are held constant — only the order±1 overlapping neighbours are removed from the purged train.
    acc = {"leaky": {"svm": [], "rf": []}, "purged": {"svm": [], "rf": []}}
    rep = {}                                              # the seed-SEED_SPLIT split, kept for confusions/perClass
    for s in seeds:
        tr, te = next(StratifiedShuffleSplit(1, test_size=LEAKY_TEST_SIZE, random_state=s).split(np.zeros(n), y))
        ptr = _purge_train(rec, order, tr, te)
        ev_l, ev_p = cml(tr, te), cml(ptr, te)
        for mdl in ("svm", "rf"):
            acc["leaky"][mdl].append(ev_l[mdl]["accuracy"])
            acc["purged"][mdl].append(ev_p[mdl]["accuracy"])
        if s == SEED_SPLIT:
            rep = {"tr": tr, "te": te, "ptr": ptr, "leaky": ev_l, "purged": ev_p}
    leaky_tr, leaky_te, purge_tr = rep["tr"], rep["te"], rep["ptr"]

    # ---- production grouped (honest) arm: deterministic, whole 3 HP recordings held out ----
    honest_te = np.where(np.isin(rec, HONEST_TEST_REC))[0]
    honest_tr = np.where(~np.isin(rec, HONEST_TEST_REC))[0]
    honest_cml = cml(honest_tr, honest_te)

    # ---- WDCNN (single seed; it saturates on this clean pool so it is uninformative here, but shown for completeness) ----
    wd_leaky = _scores(_fit_eval_wdcnn(X[leaky_tr], y[leaky_tr], X[leaky_te], y[leaky_te], classes), y[leaky_te], classes)
    wd_purged = _scores(_fit_eval_wdcnn(X[purge_tr], y[purge_tr], X[leaky_te], y[leaky_te], classes), y[leaky_te], classes)
    wd_honest = _scores(_fit_eval_wdcnn(X[honest_tr], y[honest_tr], X[honest_te], y[honest_te], classes), y[honest_te], classes)

    # ---- integrity controls ----
    # (1) shuffled-label PLUMBING check: permute y at the WINDOW level (overlapping windows get INDEPENDENT random
    #     labels) before both splits; both arms must collapse to ~chance 0.25. This rules out an index/label bug — it
    #     does NOT by itself attribute the gap to overlap (the purge decomposition does that).
    y_shuf = np.random.RandomState(SEED_SPLIT).permutation(y)
    sh = {
        "leaky": float((_fit_eval_wdcnn(X[leaky_tr], y_shuf[leaky_tr], X[leaky_te], y_shuf[leaky_te], classes) == y_shuf[leaky_te]).mean()),
        "honest": float((_fit_eval_wdcnn(X[honest_tr], y_shuf[honest_tr], X[honest_te], y_shuf[honest_te], classes) == y_shuf[honest_te]).mean()),
    }
    shuffle_pass = bool(abs(sh["leaky"] - 0.25) < 0.12 and abs(sh["honest"] - 0.25) < 0.12)

    ov = {"leaky": _overlap_shared(rec, order, leaky_tr, leaky_te), "honest": _overlap_shared(rec, order, honest_tr, honest_te)}
    leaky_frac, honest_frac = _test_class_frac(y[leaky_te], classes), _test_class_frac(y[honest_te], classes)
    max_abs = round(max(abs(leaky_frac[c] - honest_frac[c]) for c in classes), 4)
    delta_prod = round(100.0 * (wd_honest["accuracy"] - prod_holdout_acc), 1)

    def iso(mdl: str) -> dict:
        wo, pu = _ms(acc["leaky"][mdl]), _ms(acc["purged"][mdl])
        return {"withOverlapAcc": wo["mean"], "withOverlapStd": wo["std"], "purgedAcc": pu["mean"],
                "purgedStd": pu["std"], "isolatedPts": round(100.0 * (wo["mean"] - pu["mean"]), 1),
                "withOverlapPerClass": rep["leaky"][mdl]["perClass"], "purgedPerClass": rep["purged"][mdl]["perClass"]}

    def naive(mdl: str) -> dict:
        lk = _ms(acc["leaky"][mdl])
        h = honest_cml[mdl]["accuracy"]
        return {"leakyAcc": lk["mean"], "leakyStd": lk["std"], "honestAcc": h,
                "gapPts": round(100.0 * (lk["mean"] - h), 1),
                "leakyPerClass": rep["leaky"][mdl]["perClass"], "honestPerClass": honest_cml[mdl]["perClass"],
                "leakyConfusion": rep["leaky"][mdl]["confusion"], "honestConfusion": honest_cml[mdl]["confusion"]}

    wd_iso = round(100.0 * (wd_leaky["accuracy"] - wd_purged["accuracy"]), 1)
    return {
        "purpose": "Quantify WINDOW-OVERLAP leakage two ways on ONE frozen 16-recording CWRU pool: (1) the ISOLATED "
                   "overlap leak via a purge/embargo control (same random test set + loads; overlapping train "
                   "neighbours removed) — the clean number; (2) the naive random split vs the production grouped "
                   "split — an UPPER BOUND that also includes a 3 HP load-generalization penalty, reported as such.",
        "pool": "all 16 CWRU recordings (4 classes x 0/1/2/3 HP, 0.007in faults + Normal), 12 kHz DE, "
                f"WIN {WIN} / HOP {HOP} (50% overlap)",
        "nWindows": int(n), "win": WIN, "hop": HOP, "overlapPct": round(100 * (1 - HOP / WIN)),
        "classes": classes, "seedSplit": SEED_SPLIT, "seedModel": 0, "nSeeds": N_SEEDS, "testFractionPct": 25.9,
        # PRIMARY clean result — isolated window-overlap leak (load + class + test set all held constant)
        "overlapIsolated": {
            "method": f"purge/embargo: same random test set ({int(len(leaky_te))} windows, a 4-load mix), with-overlap "
                      f"train vs a train with every order±1 same-recording neighbour of a test window removed; "
                      f"mean over {N_SEEDS} seeds. Removing windows can only hurt, so the gain isolates the leak.",
            "nTest": int(len(leaky_te)), "nSeeds": N_SEEDS,
            "svm": iso("svm"), "rf": iso("rf"),
            "wdcnn": {"withOverlapAcc": wd_leaky["accuracy"], "purgedAcc": wd_purged["accuracy"], "isolatedPts": wd_iso,
                      "saturates": bool(wd_leaky["accuracy"] >= 0.995 and wd_purged["accuracy"] >= 0.995)},
        },
        # SECONDARY — naive random split vs production grouped split: an UPPER BOUND (overlap leak + 3 HP load penalty)
        "naiveVsProduction": {
            "note": "Upper bound, NOT pure leakage: the grouped (honest) arm also holds out the entire 3 HP load, so "
                    "it pays a load-generalization penalty the leaky arm does not. The isolated overlap leak above is "
                    "the part attributable to window overlap; the remainder is the load penalty.",
            "splits": {
                "leaky": {"name": "random window split (StratifiedShuffleSplit, stratify=class only)", "grouped": False,
                          "ratio": f"{round(100*(1-LEAKY_TEST_SIZE))}/{round(100*LEAKY_TEST_SIZE)}", "nSeeds": N_SEEDS,
                          "nTrain": int(len(leaky_tr)), "nTest": int(len(leaky_te))},
                "honest": {"name": "grouped split-by-recording (whole recordings held out) = production hold-out-3HP",
                           "grouped": True, "heldOutRecordings": list(HONEST_TEST_REC), "heldOutLoadHp": 3,
                           "nTrain": int(len(honest_tr)), "nTest": int(len(honest_te))},
            },
            "svm": naive("svm"), "rf": naive("rf"),
            "wdcnn": {"leakyAcc": wd_leaky["accuracy"], "honestAcc": wd_honest["accuracy"],
                      "gapPts": round(100.0 * (wd_leaky["accuracy"] - wd_honest["accuracy"]), 1),
                      "saturatesHonest": bool(wd_honest["accuracy"] >= 0.995),
                      "leakyPerClass": wd_leaky["perClass"], "honestPerClass": wd_honest["perClass"],
                      "leakyConfusion": wd_leaky["confusion"], "honestConfusion": wd_honest["confusion"]},
        },
        "controls": {
            "shuffledLabelPlumbing": {"seed": SEED_SPLIT, "leakyWdcnn": round(sh["leaky"], 4),
                                      "honestWdcnn": round(sh["honest"], 4), "expectChance": 0.25, "pass": shuffle_pass,
                                      "note": "rules out an index/label bug; does NOT attribute the gap to overlap (the purge control does)"},
            "overlapWindowsSharedTrainTest": {"leaky": ov["leaky"], "honest": ov["honest"]},
            "classBalance": {"leakyTestClassFrac": leaky_frac, "honestTestClassFrac": honest_frac,
                             "maxAbsDiff": max_abs, "balancedOk": bool(max_abs < 0.1),
                             "note": "checks class balance only — load distribution still differs between arms (hence the upper-bound framing)"},
            "honestVsProduction": {"productionHoldout3HP": round(float(prod_holdout_acc), 4),
                                   "honestT15Wdcnn": wd_honest["accuracy"], "deltaPts": delta_prod,
                                   "consistent": bool(abs(delta_prod) < 5.0)},
        },
        "note": "Window overlap (hop 1024 < win 2048 ⇒ adjacent windows share half their samples) lets a naive random "
                "split scatter near-identical windows from one recording across train and test, so a classifier "
                "memorizes recording-specific noise. The ISOLATED purge control (load + test set held constant) "
                "measures the pure overlap leak; the naive-vs-production gap is larger because it ALSO charges the "
                "grouped arm a 3 HP load-generalization penalty — the two are reported separately on purpose.",
        "caveat": "Inflated numbers are do-not-cite; RotorVitals' headline diagnosis ALWAYS uses the production "
                  "grouped split. The deep-AE (one-class) and envelope/SES (unsupervised) never train on a supervised "
                  "window split and are leakage-immune by construction — they are NOT in this demo, so it must not be "
                  "read as 'all methods inflate'. On this clean, largely-separable 0.007in pool the demonstrable "
                  "overlap inflation is modest (a few classical points) — NOT the dramatic published collapses, which "
                  "are driven by the deeper BEARING-IDENTITY leak: even the production grouped split here is "
                  "leave-recording-out, NOT leave-bearing-out (CWRU reuses one physical bearing per condition across "
                  "loads, Hendriks et al. 2022), so even the honest number is optimistic vs field data.",
        "refs": [
            {"label": "Hendriks, Dumond & Knox 2022 - Towards better benchmarking using the CWRU bearing fault dataset "
                      "(its bearing-identity leak survives our load-grouped split)",
             "doi": "10.1016/j.ymssp.2021.108732"},
            {"label": "Smith & Randall 2015 - Rolling element bearing diagnostics using the CWRU data",
             "doi": "10.1016/j.ymssp.2015.04.021"},
        ],
    }
