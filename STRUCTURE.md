# STRUCTURE — RotorVitals on the CAOS product-repo archetype (ADR-0057)

```
CAOS_RotorVitals/
├─ README.md · CHANGELOG.md (X.XX.XXX) · LICENSE · LICENSES.md · ATTRIBUTION.md · STRUCTURE.md
├─ pyproject.toml (rotorlab) · .env.example · .gitignore · .gitattributes · .vscode/
├─ requirements.txt (live-thin numpy) · -dev · -precompute (torch/scipy/onnx) · -gpu (dormant) · -api (dormant)
├─ data-pipeline/
│  ├─ README.md
│  └─ rotorlab/                     # the offline engine + staged pipeline
│     ├─ __init__.py (version) · pipeline.py (orchestrator+CLI) · registry.py (cases by CATEGORY) · live.py (dormant)
│     ├─ io/      contract.py (CONTRACT 1) · schema.py · formats.py · fetch_cwru.py (link-only downloader)
│     ├─ core/    rng.py · trace.py (CONTRACT 2 trace) · manifest.py (CONTRACT 2) · gate.py (lane gate)
│     ├─ model/   wdcnn.py · deep_ae.py (torch) · features.py (numpy) · classical.py (envelope/SES, scipy)
│     ├─ stages/  preprocess · feature_extraction · train · infer · evaluate · export
│     └─ cases/   cwru_cases.py (15 cases, 5 categories)
├─ data/
│  ├─ raw/cwru/ (git-ignored — link-only CWRU .mat) · examples/records.csv (passes CONTRACT 1)
│  ├─ derived/  models/*.onnx · rv-cwru-samples.json · rv-learned-metrics.json · cwru-benchmark.json
│  │            <case>/trace.json · manifests/<case>.json + index.json   (CONTRACT 2, committed)
│  └─ README.md (the data contract)
├─ frontend/                        # the React/Vite SPA
│  ├─ index.html · package.json · vite.config.ts · tsconfig.json · copy-data.mjs
│  ├─ public/ (CNAME · favicon; the data overlay is git-ignored)
│  ├─ test/dsp.test.ts (node --test)
│  └─ src/  pages/ (App/Introduction/Methodology/Implementation/Experiments/Benchmark) · dsp/ · viz/ ·
│           lib/ort.ts (onnxruntime-web) · lib/contract.types.ts (CONTRACT-2 mirror) · api/artifacts.ts · data/
├─ app/                             # OPTIONAL FastAPI backend — DORMANT (static-first)
├─ scripts/  setup · precompute · fetch-data · dev · smoke {.sh,.ps1} · check_artifacts.py
├─ deploy/   pages.md (default) · fasl-slug.service · domain.nginx (VPS, dormant)
├─ docs/     README · architecture/ · frameworks/ · cases/ · guides/   (the wiki, ADR-0056)
├─ tests/    test_contract · test_manifest · test_pipeline_smoke · conftest
└─ .github/workflows/  ci.yml (ruff+pytest+pipeline+check_artifacts+guards) · deploy-pages.yml
```

**The base is frozen** — edits land only in the CORE (the models/algorithms in `model/` + `stages/`, the
visualizations in `frontend/src/`, and the cases/content), never in the structure, contracts, env, or deploy.
