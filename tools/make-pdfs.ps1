# Rebuilds site/trip-en.pdf and site/trip-zh.pdf from site/index.html with headless Edge.
# Run again after every itinerary edit:
#   powershell -ExecutionPolicy Bypass -File tools\make-pdfs.ps1
# (ASCII only: Windows PowerShell 5.1 misreads other characters in a .ps1 saved without a BOM.)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$site = Join-Path $root "site"
$page = "file:///" + ((Join-Path $site "index.html") -replace "\\", "/" -replace " ", "%20")

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found" }

# Separate throwaway profile so an open Edge window doesn't swallow the job
$profileDir = Join-Path $env:TEMP "trip-pdf-profile"

foreach ($lang in "en", "zh") {
  $out = Join-Path $site "trip-$lang.pdf"
  if (Test-Path $out) { Remove-Item $out }
  $pdfArg = "--print-to-pdf=" + $out
  $proc = Start-Process -FilePath $edge -Wait -PassThru -WindowStyle Hidden -ArgumentList @(
    "--headless", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
    "--user-data-dir=`"$profileDir`"", "--virtual-time-budget=8000",
    "`"$pdfArg`"", "`"$page`?lang=$lang`""
  )
  if (-not (Test-Path $out)) { throw "Edge did not produce $out (exit $($proc.ExitCode))" }
  Write-Host ("Built {0} ({1:N0} KB)" -f $out, ((Get-Item $out).Length / 1KB))
}
