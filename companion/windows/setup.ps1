# Guided Desktop setup; keep the existing entrypoint for installers and support.
param([switch]$NoShow)
. (Join-Path $PSScriptRoot 'desktop-setup.ps1') -NoShow:$NoShow
