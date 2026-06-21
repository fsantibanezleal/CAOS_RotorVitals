# Stage the REAL CWRU 12 kHz drive-end recordings into data/raw/cwru/ (git-ignored, link-only, never re-hosted).
# Needed only for the heavy `pipeline --retrain` lane (the committed ONNX/metrics already replay without this).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-pipeline" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv-pipeline" "bin/python" }
if (-not (Test-Path $vp)) { $vp = if ($env:PYTHON) { $env:PYTHON } else { "python" } }
& $vp -m rotorlab.io.fetch_cwru --dst data/raw/cwru
