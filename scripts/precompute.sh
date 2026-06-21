#!/usr/bin/env bash
# Run the offline pipeline (pass-through args). E.g.:
#   ./scripts/precompute.sh                 # rebuild all replay traces + manifests from committed artifacts
#   ./scripts/precompute.sh dx-inner-3hp    # one case
#   ./scripts/precompute.sh all --retrain   # regenerate the ONNX/metrics from raw CWRU (needs --precompute setup)
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-pipeline/bin/python"; [ -x "$VP" ] || VP=".venv-pipeline/Scripts/python.exe"
"$VP" -m rotorlab.pipeline "$@"
