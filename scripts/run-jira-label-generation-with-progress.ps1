# Jira課題用StructuredLabel生成を実行し、進捗を表示するスクリプト

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Jira課題用StructuredLabel生成" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd $PSScriptRoot\..

$logFile = "jira-label-generation.log"

Write-Host "処理を開始します..." -ForegroundColor Yellow
Write-Host "進捗は '$logFile' にも記録されます" -ForegroundColor Gray
Write-Host ""

# 既存のログファイルを削除
if (Test-Path $logFile) {
    Remove-Item $logFile -Force
}

# 処理を開始（ログファイルにも出力）
& npx tsx scripts/generate-jira-structured-labels.ts 10000 2>&1 | Tee-Object -FilePath $logFile

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  処理完了" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

