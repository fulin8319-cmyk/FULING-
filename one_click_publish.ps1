# one_click_publish.ps1
# Replaces the missing legacy FB/IG launcher with the current social scheduler API.
# Usage:
#   .\one_click_publish.ps1
#   .\one_click_publish.ps1 -SiteUrl "https://www.fulinfabric.com" -SyncInventory
#   .\one_click_publish.ps1 -DryRun

param(
    [string]$SiteUrl = "",
    [switch]$SyncInventory,
    [switch]$DryRun,
    [string]$Platforms = "facebook"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$ReportFile = Join-Path $Root "publish_report_latest.json"
$OutboxFile = Join-Path $Root "outbox.json"
$ManualOutboxFile = Join-Path $Root "outbox_manual_once.json"
$ReadyPayloadFile = Join-Path $Root "fb_ig_ready.json"
$StartedAt = Get-Date

function Load-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if (-not [string]::IsNullOrWhiteSpace($name)) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
}

function Write-Report {
    param(
        [string]$Status,
        [string]$Message,
        [hashtable]$Extra = @{}
    )
    $report = [ordered]@{
        run_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        started_at = $StartedAt.ToString("yyyy-MM-ddTHH:mm:ss")
        status = $Status
        message = $Message
        platform = $Platforms
        payload_file = $ReadyPayloadFile
    }
    foreach ($key in $Extra.Keys) {
        $report[$key] = $Extra[$key]
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -Path $ReportFile -Encoding UTF8
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    $params = @{
        Method = $Method
        Uri = $Url
        Headers = $Headers
        SessionVariable = "session"
        UseBasicParsing = $true
    }
    if ($Body -ne $null) {
        $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
        $params.ContentType = "application/json"
    }
    return Invoke-WebRequest @params
}

Load-DotEnv (Join-Path $Root ".env")

if (-not $SiteUrl) {
    if ($env:PUBLIC_BASE_URL) {
        $SiteUrl = $env:PUBLIC_BASE_URL
    } else {
        $SiteUrl = "http://127.0.0.1:3000"
    }
}
if ($SiteUrl -notmatch '^https?://') {
    $SiteUrl = "https://$SiteUrl"
}
$SiteUrl = $SiteUrl.TrimEnd("/")

if ($SyncInventory) {
    Write-Host "Syncing inventory outbox..." -ForegroundColor Cyan
    & python (Join-Path $Root "sync_inventory.py")
    if ($LASTEXITCODE -ne 0) {
        Write-Report -Status "FAILED" -Message "sync_inventory.py failed."
        exit 1
    }
}

$outbox = if (Test-Path $OutboxFile) {
    Get-Content $OutboxFile -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $null
}

$item = $null
if ($outbox -and $outbox.items -and $outbox.items.Count -gt 0) {
    $item = $outbox.items[0]
} elseif (Test-Path $ManualOutboxFile) {
    $manual = Get-Content $ManualOutboxFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manual.items -and $manual.items.Count -gt 0) {
        $item = $manual.items[0]
    }
}

if (-not $item) {
    Write-Report -Status "FAILED" -Message "No publish item found in outbox.json or outbox_manual_once.json."
    Write-Host "No publish item found. Run sync_inventory.py or fill outbox_manual_once.json first." -ForegroundColor Red
    exit 1
}

$payload = [ordered]@{
    generated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    item_id = $item.id
    item_name = $item.name
    image_url = $item.image_url
    post_text = $item.post_text
    platforms = ($Platforms -split '[,\s]+' | Where-Object { $_ })
}
$payload | ConvertTo-Json -Depth 6 | Set-Content -Path $ReadyPayloadFile -Encoding UTF8

if ($DryRun) {
    Write-Report -Status "DRY_RUN" -Message "Prepared publish payload only." -Extra @{
        item_id = $item.id
        item_name = $item.name
        image_url = $item.image_url
    }
    Write-Host "Dry run complete. Payload written to $ReadyPayloadFile" -ForegroundColor Green
    exit 0
}

$adminUser = $env:ADMIN_USER
$adminPass = $env:ADMIN_PASS
if (-not $adminUser -or -not $adminPass) {
    Write-Report -Status "FAILED" -Message "ADMIN_USER / ADMIN_PASS not configured."
    Write-Host "Set ADMIN_USER and ADMIN_PASS in .env before publishing." -ForegroundColor Red
    exit 1
}

$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $login = Invoke-WebRequest -Method POST -Uri "$SiteUrl/api/login" `
        -Body (@{ username = $adminUser; password = $adminPass } | ConvertTo-Json -Compress) `
        -ContentType "application/json" `
        -WebSession $webSession `
        -UseBasicParsing
    $loginData = $login.Content | ConvertFrom-Json
    if (-not $loginData.ok) {
        throw "Login failed."
    }

    $media = @()
    if ($item.image_url) {
        $media += @{ url = $item.image_url; type = "image"; name = "$($item.id).jpg" }
    }

    $createBody = @{
        platforms = $payload.platforms
        content = $item.post_text
        media = $media
        scheduledAt = ""
    }
    $create = Invoke-WebRequest -Method POST -Uri "$SiteUrl/api/admin/social/posts" `
        -Body ($createBody | ConvertTo-Json -Depth 8 -Compress) `
        -ContentType "application/json" `
        -WebSession $webSession `
        -UseBasicParsing
    $createData = $create.Content | ConvertFrom-Json
    if (-not $createData.ok) {
        $createError = if ($createData.message) { $createData.message } else { "Create post failed." }
        throw $createError
    }

    $postId = $createData.post.id
    $publish = Invoke-WebRequest -Method POST -Uri "$SiteUrl/api/admin/social/posts/$postId/publish" `
        -Body "{}" `
        -ContentType "application/json" `
        -WebSession $webSession `
        -UseBasicParsing
    $publishData = $publish.Content | ConvertFrom-Json
    if (-not $publishData.ok) {
        $resultText = ($publishData.results.PSObject.Properties | ForEach-Object { "$($_.Name): $($_.Value.message)" }) -join " / "
        $publishError = if ($resultText) { $resultText } else { "Publish failed." }
        throw $publishError
    }

    Write-Report -Status "SUCCESS" -Message "Published via social scheduler API." -Extra @{
        item_id = $item.id
        item_name = $item.name
        image_url = $item.image_url
        post_id = $postId
        results = $publishData.results
    }
    Write-Host "Publish complete. Report: $ReportFile" -ForegroundColor Green
    exit 0
}
catch {
    Write-Report -Status "FAILED" -Message $_.Exception.Message -Extra @{
        item_id = $item.id
        item_name = $item.name
        image_url = $item.image_url
    }
    Write-Host "Publish failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}