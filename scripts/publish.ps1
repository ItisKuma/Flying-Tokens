param(
  [Parameter(Position = 0)]
  [string]$Message
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host "==> $Label"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Get-AutoCommitMessage {
  $lines = git status --short
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $paths = @()

  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $entry = $line.Substring(3).Trim()
    if ($entry -like "* -> *") {
      $entry = ($entry -split " -> ", 2)[1].Trim()
    }

    $paths += $entry
  }

  $uniquePaths = $paths | Select-Object -Unique
  if (-not $uniquePaths -or $uniquePaths.Count -eq 0) {
    return "Update project"
  }

  $labels = @()
  foreach ($path in $uniquePaths | Select-Object -First 3) {
    $labels += [System.IO.Path]::GetFileName($path)
  }

  if ($uniquePaths.Count -le 3) {
    return "Update " + ($labels -join ", ")
  }

  return "Update " + ($labels -join ", ") + " and more"
}

Invoke-Step "Build" { npm.cmd run build }

$statusBefore = git status --short
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ([string]::IsNullOrWhiteSpace(($statusBefore | Out-String))) {
  Write-Host "No changes to publish."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = Get-AutoCommitMessage
}

Write-Host "Commit message: $Message"

Invoke-Step "Stage changes" { git add . }

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Nothing staged after git add."
  exit 0
}

Invoke-Step "Commit" { git commit -m $Message }
Invoke-Step "Push" { git push origin main }

Write-Host "Publish complete."
