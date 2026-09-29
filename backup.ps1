<#
  Yard Stock - full backup
  ---------------------------------------------------------------
  Pulls every table out of Supabase, plus every product photo, into
  a timestamped folder under backups\. Nothing is ever deleted or
  written back - this script only reads.

  Double-click backup.bat, or run:  powershell -File backup.ps1

  It reads the project URL and key straight out of config.js, so it
  cannot drift out of date when those change.

  A backup that quietly writes empty files is worse than no backup
  at all, because it looks like it worked. So this checks what came
  back, compares it against the last run, and refuses to call itself
  a success if a table came back empty or noticeably smaller.

  Keep this file plain ASCII: Windows PowerShell reads .ps1 as ANSI,
  and a stray dash or quote from a word processor will not parse.
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Every table the app writes to. Add to this list if the schema grows.
$TABLES = @(
  'products', 'movements', 'people', 'clients',
  'profiles', 'pick_lists', 'pick_list_items', 'reorder_cards'
)

# ---------------------------------------------------------------
# Where to read from
# ---------------------------------------------------------------
$cfg = Get-Content (Join-Path $root 'config.js') -Raw
$url = [regex]::Match($cfg, "SUPABASE_URL:\s*'([^']+)'").Groups[1].Value
$key = [regex]::Match($cfg, "SUPABASE_ANON_KEY:\s*'([^']+)'").Groups[1].Value

if (-not $url) { throw 'Could not find SUPABASE_URL in config.js' }

# The anon key can read everything today. Once the client cutover is
# run it will not be able to, and this script would start writing
# empty files. Drop a service_role key into backup-key.txt (it is
# gitignored, and it must never be committed) and it gets used instead.
$keyFile = Join-Path $root 'backup-key.txt'
if (Test-Path $keyFile) {
  $fromFile = (Get-Content $keyFile -Raw).Trim()
  if ($fromFile) { $key = $fromFile; Write-Host 'Using the key from backup-key.txt' -ForegroundColor DarkGray }
}
if (-not $key) { throw 'No API key: config.js has none and backup-key.txt is missing or empty' }

$headers = @{ 'apikey' = $key; 'Authorization' = "Bearer $key" }

# ---------------------------------------------------------------
# What the last run found, so this one can be compared against it
# ---------------------------------------------------------------
$backupRoot = Join-Path $root 'backups'
if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory $backupRoot | Out-Null }

$previous = $null
$lastDir = Get-ChildItem $backupRoot -Directory -ErrorAction SilentlyContinue |
           Sort-Object Name | Select-Object -Last 1
if ($lastDir) {
  $lastManifest = Join-Path $lastDir.FullName '_manifest.json'
  if (Test-Path $lastManifest) {
    try { $previous = (Get-Content $lastManifest -Raw | ConvertFrom-Json).rows } catch { }
  }
}

# Seconds included: two runs in the same minute would otherwise land in
# the same folder, and the second would quietly overwrite the first.
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$out = Join-Path $backupRoot "yard-stock-full-$stamp"
New-Item -ItemType Directory $out -Force | Out-Null

Write-Host ''
Write-Host "Yard Stock backup -> backups\yard-stock-full-$stamp" -ForegroundColor Cyan
Write-Host ''

# ---------------------------------------------------------------
# The tables
# ---------------------------------------------------------------
$counts = @{}
$warnings = @()

foreach ($t in $TABLES) {
  try {
    $res = Invoke-WebRequest -Uri "$url/rest/v1/$($t)?select=*" -Headers $headers -UseBasicParsing
    $body = $res.Content
  } catch {
    $warnings += "$t : could not be read ($($_.Exception.Message))"
    Write-Host ('  {0,-18} FAILED' -f $t) -ForegroundColor Red
    continue
  }

  [IO.File]::WriteAllText((Join-Path $out "$t.json"), $body, (New-Object Text.UTF8Encoding $false))

  # Assign before counting. Piping into @(...) would collect a single
  # item, because ConvertFrom-Json hands the whole array down the
  # pipeline as one object - every table would report 1 row.
  $n = 0
  try {
    $parsed = ConvertFrom-Json -InputObject $body
    $n = @($parsed).Count
  } catch { }
  $counts[$t] = $n

  # Did this table shrink since last time? Rows going backwards is
  # either a broken backup or real data loss. Either way, say so.
  $was = $null
  if ($previous -and ($previous.PSObject.Properties.Name -contains $t)) { $was = $previous.$t }

  $note = ''
  $colour = 'Gray'
  if ($n -eq 0) {
    $note = '   ** EMPTY **'
    $colour = 'Red'
    $warnings += "$t : came back with no rows"
  } elseif ($null -ne $was -and $n -lt $was) {
    $note = "   ** was $was **"
    $colour = 'Yellow'
    $warnings += "$t : $was rows last time, $n now"
  }
  Write-Host ('  {0,-18} {1,5} rows{2}' -f $t, $n, $note) -ForegroundColor $colour
}

# ---------------------------------------------------------------
# The photos, which live in storage and are in no table dump
# ---------------------------------------------------------------
$photoDir = Join-Path $out 'photos'
New-Item -ItemType Directory $photoDir -Force | Out-Null

$productsJson = Join-Path $out 'products.json'
$photoCount = 0
$photoFailed = 0
if (Test-Path $productsJson) {
  $urls = [regex]::Matches((Get-Content $productsJson -Raw), 'https://[^"]*?/product-photos/[^"]+') |
          ForEach-Object { $_.Value } | Sort-Object -Unique
  foreach ($u in $urls) {
    $name = ($u -split '/product-photos/')[-1] -replace '/', '_'
    try {
      Invoke-WebRequest -Uri $u -OutFile (Join-Path $photoDir $name) -UseBasicParsing
      $photoCount++
    } catch {
      $photoFailed++
      $warnings += "photo $name : could not be downloaded"
    }
  }
}
Write-Host ('  {0,-18} {1,5} files' -f 'photos', $photoCount) -ForegroundColor Gray

# ---------------------------------------------------------------
# Leave a manifest so the next run has something to compare against
# ---------------------------------------------------------------
$manifest = [ordered]@{
  taken_at     = (Get-Date).ToString('o')
  project      = $url
  rows         = $counts
  photos       = $photoCount
  photo_failed = $photoFailed
  warnings     = $warnings
}
$manifest | ConvertTo-Json -Depth 4 |
  Out-File (Join-Path $out '_manifest.json') -Encoding utf8

$size = '{0:N1} MB' -f ((Get-ChildItem $out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)

Write-Host ''
if ($warnings.Count -gt 0) {
  Write-Host 'BACKUP FINISHED WITH WARNINGS' -ForegroundColor Red
  foreach ($w in $warnings) { Write-Host "  - $w" -ForegroundColor Yellow }
  Write-Host ''
  Write-Host 'Do not trust this one until you know why.' -ForegroundColor Yellow
  exit 1
}

Write-Host "Backup good - $size in backups\yard-stock-full-$stamp" -ForegroundColor Green
Write-Host ''
