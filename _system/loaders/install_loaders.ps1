# Installs the panel loaders from this folder into After Effects' ScriptUI Panels.
# Default: newest AE version found in %APPDATA%. Use -All for every version, or -Version 26.3 for one.
# An existing loader that differs is kept as <name>.bak before it is replaced.
param([switch]$All, [string]$Version)
$aeRoot = Join-Path $env:APPDATA 'Adobe\After Effects'
$vers = Get-ChildItem $aeRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending
if (-not $vers) { Write-Host "No After Effects folders in $aeRoot - start AE once, then rerun." -ForegroundColor Red; exit 1 }
if ($Version) { $vers = $vers | Where-Object { $_.Name -eq $Version } } elseif (-not $All) { $vers = $vers | Select-Object -First 1 }
foreach ($v in $vers) {
    $target = Join-Path $v.FullName 'Scripts\ScriptUI Panels'
    New-Item -ItemType Directory -Force $target | Out-Null
    foreach ($f in Get-ChildItem $PSScriptRoot -Filter *.jsx -File) {
        $dest = Join-Path $target $f.Name
        if ((Test-Path $dest) -and ((Get-FileHash $dest).Hash -eq (Get-FileHash $f.FullName).Hash)) { "OK       $dest"; continue }
        if (Test-Path $dest) { Copy-Item $dest "$dest.bak" -Force; "BACKUP   $dest.bak" }
        Copy-Item $f.FullName $dest -Force
        "INSTALL  $dest"
    }
}
Write-Host 'Restart After Effects, then open the panels from the Window menu.'