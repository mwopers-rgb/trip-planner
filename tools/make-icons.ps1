# Renders site/icons/icon.svg to the PNG sizes the manifest and iPhone need, using headless Edge.
# Run from the repo root after changing the SVG:
#   powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$icons = Join-Path $root "site\icons"
$svg = [IO.File]::ReadAllText((Join-Path $icons "icon.svg"))

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found" }

$profileDir = Join-Path $env:TEMP "trip-icon-profile"
$work = Join-Path $env:TEMP "trip-icon-work"
New-Item -ItemType Directory -Force $work | Out-Null

foreach ($size in 192, 512, 180) {
  $name = if ($size -eq 180) { "apple-touch-icon.png" } else { "icon-$size.png" }
  $page = Join-Path $work "icon-$size.html"
  $html = "<!doctype html><html><head><style>html,body{margin:0;overflow:hidden;background:#4e1a16}svg{display:block;width:${size}px;height:${size}px}</style></head><body>$svg</body></html>"
  [IO.File]::WriteAllText($page, $html)
  $out = Join-Path $icons $name
  if (Test-Path $out) { Remove-Item $out }
  $url = "file:///" + ($page -replace "\\", "/")
  Start-Process -FilePath $edge -Wait -WindowStyle Hidden -ArgumentList @(
    "--headless", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--user-data-dir=`"$profileDir`"", "--window-size=$size,$size", "`"--screenshot=$out`"", "`"$url`""
  )
  if (-not (Test-Path $out)) { throw "Edge did not produce $name" }
  Write-Host ("Built {0} ({1:N0} KB)" -f $name, ((Get-Item $out).Length / 1KB))
}
