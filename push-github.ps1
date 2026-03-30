param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  [string]$Branch = "main"
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "This folder is not initialized as a git repository yet."
}

$hasOrigin = $false
try {
  git remote get-url origin | Out-Null
  $hasOrigin = $true
} catch {
  $hasOrigin = $false
}

if ($hasOrigin) {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

git branch -M $Branch
git push -u origin $Branch
