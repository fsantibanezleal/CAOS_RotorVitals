#!/usr/bin/env bash
# Stage the REAL CWRU 12 kHz drive-end recordings into data/raw/cwru/ (git-ignored, link-only, never re-hosted).
# Needed only for the heavy `pipeline --retrain` lane (the committed ONNX/metrics already replay without this).
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-pipeline/bin/python"; [ -x "$VP" ] || VP=".venv-pipeline/Scripts/python.exe"
[ -x "$VP" ] || VP="${PYTHON:-python}"
"$VP" -m rotorlab.io.fetch_cwru --dst data/raw/cwru
