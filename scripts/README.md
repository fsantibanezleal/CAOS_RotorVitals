# scripts/, cross-platform task runners (.sh + .ps1 parity)

Felipe runs PowerShell on Windows; every script ships a `.ps1` and a `.sh` twin with identical behaviour.

| Script | What it does |
|---|---|
| `setup.{sh,ps1}` | create `.venv-pipeline` (default pipeline + tests + lint) and `.venv` (live-thin) + editable install. Pass `--precompute` / `-Precompute` to also install torch/scipy/onnx for `--retrain`. |
| `fetch-data.{sh,ps1}` | stage the real CWRU `.mat` recordings into `data/raw/cwru/` (git-ignored, link-only). Needed only for `--retrain`. |
| `precompute.{sh,ps1}` | run `python -m rotorlab.pipeline` (pass-through args). Default rebuilds the replay layer; `all --retrain` regenerates the ONNX/metrics. |
| `dev.{sh,ps1}` | local dev: copy data into the SPA and start the Vite dev server (+ the API only if `app/` is activated). |
| `smoke.{sh,ps1}` | validate CONTRACT 2 on disk (`check_artifacts.py`: index → manifests → traces consistent). |
| `check_artifacts.py` | the mechanical CONTRACT-2 guard (stdlib only; used by `smoke` + CI). |

Typical first run: `./scripts/setup.sh` → `./scripts/precompute.sh` → `./scripts/dev.sh`.
Regenerate the models: `./scripts/setup.sh --precompute` → `./scripts/fetch-data.sh` → `./scripts/precompute.sh all --retrain`.
