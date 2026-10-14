# Rebuilds data\library.js from games\*\game.json. Run via REBUILD-LIBRARY.bat.
$root = Split-Path -Parent $PSScriptRoot
$games = Join-Path $root 'games'
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$entries = @()

Get-ChildItem -LiteralPath $games -Directory | Where-Object { $_.Name -notmatch '^[_.]' } | Sort-Object Name | ForEach-Object {
  $name = $_.Name
  $file = Join-Path $_.FullName 'game.json'
  if (-not (Test-Path -LiteralPath (Join-Path $_.FullName 'index.html'))) { Write-Host "  SKIPPED $name : no index.html" -ForegroundColor Yellow; return }
  if (-not (Test-Path -LiteralPath $file)) { Write-Host "  SKIPPED $name : no game.json" -ForegroundColor Yellow; return }
  $raw = [IO.File]::ReadAllText($file).Trim()
  try { $json = $raw | ConvertFrom-Json } catch { Write-Host "  SKIPPED $name : game.json is not valid JSON (check commas and quotes)" -ForegroundColor Yellow; return }
  $id = $name | ConvertTo-Json
  $entries += "{""id"":$id,""game"":$raw}"
  Write-Host "  $($json.title)  ($name)"
}

$js = "window.LIBRARY = [`r`n" + ($entries -join ",`r`n") + "`r`n];`r`n"
[IO.File]::WriteAllText((Join-Path $data 'library.js'), $js)
Write-Host ""
Write-Host "Done: $($entries.Count) games. Reload START.html (F5)." -ForegroundColor Green
