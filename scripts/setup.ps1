# Create the venvs + install per-lane requirements + the editable package. Idempotent. No global installs.
# .ps1 parity of setup.sh (Felipe runs PowerShell on Windows).
#   .venv-pipeline = runs the DEFAULT pipeline + tests + lint (numpy + dev + editable pkg)
#   .venv          = runtime/live-thin lane (requirements.txt)
# Pass -Precompute to ALSO install the heavy SOTA engines (torch/scipy/onnx) for `pipeline --retrain`.
param([switch]$Precompute)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$py = if ($env:PYTHON) { $env:PYTHON } else { "python" }

function Get-VenvPy($dir) {
  $p = Join-Path $dir "Scripts\python.exe"
  if (-not (Test-Path $p)) { $p = Join-Path $dir "bin/python" }
  return $p
}

Write-Host "[setup] .venv-pipeline (default pipeline + tests + lint)..."
if (-not (Test-Path ".venv-pipeline")) { & $py -m venv .venv-pipeline }
$vp = Get-VenvPy ".venv-pipeline"
& $vp -m pip install --upgrade pip -q
& $vp -m pip install -q -r requirements.txt -r requirements-dev.txt
& $vp -m pip install -q -e .
if ($Precompute) {
  Write-Host "[setup] + heavy precompute engines (torch/scipy/onnx) -- for --retrain..."
  & $vp -m pip install -q torch==2.12.1 --index-url https://download.pytorch.org/whl/cpu
  & $vp -m pip install -q -r requirements-precompute.txt
}
Write-Host "[setup] .venv-pipeline ready."

Write-Host "[setup] .venv (runtime/live-thin lane)..."
if (-not (Test-Path ".venv")) { & $py -m venv .venv }
$vr = Get-VenvPy ".venv"
& $vr -m pip install --upgrade pip -q
& $vr -m pip install -q -r requirements.txt
Write-Host "[setup] .venv ready."

Write-Host "[setup] done. Next:  ./scripts/precompute.ps1   then   ./scripts/dev.ps1"
