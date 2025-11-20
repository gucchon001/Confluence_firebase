# Jira課題用StructuredLabel生成の進捗を監視するスクリプト
# 使い方: .\scripts\monitor-jira-label-generation.ps1

$logFile = "jira-label-generation.log"
$checkInterval = 5 # 秒

Write-Host "=== Jira課題用StructuredLabel生成の進捗を監視します ===" -ForegroundColor Green
Write-Host "ログファイル: $logFile" -ForegroundColor Yellow
Write-Host "更新間隔: $checkInterval秒" -ForegroundColor Yellow
Write-Host "終了するには Ctrl+C を押してください" -ForegroundColor Yellow
Write-Host ""

$lastLines = 0

while ($true) {
    if (Test-Path $logFile) {
        $currentLines = (Get-Content $logFile -ErrorAction SilentlyContinue).Count
        
        if ($currentLines -gt $lastLines) {
            Clear-Host
            Write-Host "=== 現在の進捗 (最終更新: $(Get-Date -Format 'HH:mm:ss')) ===" -ForegroundColor Cyan
            Write-Host ""
            Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
            Write-Host ""
            Write-Host "総行数: $currentLines" -ForegroundColor Gray
            $lastLines = $currentLines
        } else {
            Write-Host "待機中... ($(Get-Date -Format 'HH:mm:ss'))" -ForegroundColor Gray
        }
    } else {
        Write-Host "ログファイルが見つかりません。処理を待機しています..." -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds $checkInterval
}

