# GitHub Actions実行状況確認スクリプト
# 
# このスクリプトは、GitHub Actionsのワークフロー実行状況を確認します。

Write-Host "GitHub Actions実行状況確認" -ForegroundColor Cyan
Write-Host ""

# GitHub CLIが利用可能か確認
try {
    $null = gh --version 2>&1
    Write-Host "GitHub CLI is available" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "GitHub CLI is not available. Please install it first." -ForegroundColor Red
    Write-Host "   Install: winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# 認証状態を確認
try {
    $null = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Not authenticated. Please run: gh auth login" -ForegroundColor Red
        exit 1
    }
    Write-Host "Authenticated" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Authentication check failed" -ForegroundColor Red
    exit 1
}

# ワークフロー一覧を表示
Write-Host "ワークフロー一覧:" -ForegroundColor Cyan
gh workflow list
Write-Host ""

# Confluence同期ワークフローの実行履歴
Write-Host "Confluence同期ワークフロー:" -ForegroundColor Cyan
Write-Host "----------------------------------------"
$confluenceRuns = gh run list --workflow=sync-confluence.yml --limit 5 --json status,conclusion,createdAt,displayTitle 2>&1
if ($confluenceRuns -and $LASTEXITCODE -eq 0) {
    $confluenceRuns | ConvertFrom-Json | ForEach-Object {
        $status = $_.status
        $conclusion = $_.conclusion
        $date = $_.createdAt
        $title = $_.displayTitle
        
        $statusColor = if ($conclusion -eq "success") { "Green" } elseif ($conclusion -eq "failure") { "Red" } else { "Yellow" }
        Write-Host "  [$conclusion] $date - $title" -ForegroundColor $statusColor
    }
} else {
    Write-Host "  実行履歴が見つかりません" -ForegroundColor Yellow
}
Write-Host ""

# 週次完全同期ワークフローの実行履歴
Write-Host "週次完全同期ワークフロー:" -ForegroundColor Cyan
Write-Host "----------------------------------------"
$weeklyRuns = gh run list --workflow=weekly-full-sync.yml --limit 5 --json status,conclusion,createdAt,displayTitle 2>&1
if ($weeklyRuns -and $LASTEXITCODE -eq 0) {
    $weeklyRuns | ConvertFrom-Json | ForEach-Object {
        $status = $_.status
        $conclusion = $_.conclusion
        $date = $_.createdAt
        $title = $_.displayTitle
        
        $statusColor = if ($conclusion -eq "success") { "Green" } elseif ($conclusion -eq "failure") { "Red" } else { "Yellow" }
        Write-Host "  [$conclusion] $date - $title" -ForegroundColor $statusColor
    }
} else {
    Write-Host "  実行履歴が見つかりません" -ForegroundColor Yellow
}
Write-Host ""

# Jira同期ワークフローの実行履歴
Write-Host "Jira同期ワークフロー:" -ForegroundColor Cyan
Write-Host "----------------------------------------"
$jiraRuns = gh run list --workflow=sync-jira.yml --limit 5 --json status,conclusion,createdAt,displayTitle 2>&1
if ($jiraRuns -and $LASTEXITCODE -eq 0) {
    $jiraRuns | ConvertFrom-Json | ForEach-Object {
        $status = $_.status
        $conclusion = $_.conclusion
        $date = $_.createdAt
        $title = $_.displayTitle
        
        $statusColor = if ($conclusion -eq "success") { "Green" } elseif ($conclusion -eq "failure") { "Red" } else { "Yellow" }
        Write-Host "  [$conclusion] $date - $title" -ForegroundColor $statusColor
    }
} else {
    Write-Host "  実行履歴が見つかりません" -ForegroundColor Yellow
}
Write-Host ""

# 失敗した実行のサマリー
Write-Host "失敗した実行（直近10件）:" -ForegroundColor Cyan
Write-Host "----------------------------------------"
$failedRuns = gh run list --limit 10 --status failure --json workflowName,conclusion,createdAt,displayTitle 2>&1
if ($failedRuns -and $LASTEXITCODE -eq 0) {
    $failedRuns | ConvertFrom-Json | ForEach-Object {
        Write-Host "  [$($_.workflowName)] $($_.createdAt) - $($_.displayTitle)" -ForegroundColor Red
    }
} else {
    Write-Host "  失敗した実行はありません" -ForegroundColor Green
}
Write-Host ""

Write-Host "確認完了" -ForegroundColor Green
