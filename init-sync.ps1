param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$example = Join-Path $root "config.example.json"
$config = Join-Path $root "config.json"

if (!(Test-Path $example)) {
  Write-Error "找不到 config.example.json"
}

if ((Test-Path $config) -and -not $Force) {
  Write-Host "config.json 已存在，未覆蓋。可用 -Force 強制重建。"
} else {
  Copy-Item $example $config -Force
  Write-Host "已建立 config.json"
}

Write-Host "初始化完成。下一步可執行："
Write-Host "python .\sync_inventory.py"

