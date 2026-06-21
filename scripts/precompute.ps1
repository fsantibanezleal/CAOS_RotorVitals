# Run the offline pipeline (pass-through args). E.g.:
#   ./scripts/precompute.ps1                 # rebuild all replay traces + manifests from committed artifacts
#   ./scripts/precompute.ps1 dx-inner-3hp    # one case
#   ./scripts/precompute.ps1 all --retrain   # regenerate the ONNX/metrics from raw CWRU (needs -Precompute setup)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-pipeline" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv-pipeline" "bin/python" }
& $vp -m rotorlab.pipeline @args
