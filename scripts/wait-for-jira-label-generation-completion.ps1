# Jira課題用StructuredLabel生成の完了を待つスクリプト
# 使い方: .\scripts\wait-for-jira-label-generation-completion.ps1

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Jira課題用StructuredLabel生成の完了待機" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd $PSScriptRoot\..

$checkInterval = 30 # 秒
$expectedCount = 5430 # 期待される件数

Write-Host "監視間隔: ${checkInterval}秒" -ForegroundColor Yellow
Write-Host "期待される件数: ${expectedCount}件" -ForegroundColor Yellow
Write-Host ""

$lastCount = 0
$noProgressCount = 0
$maxNoProgressChecks = 6 # 6回（3分）進捗がなければ警告

while ($true) {
    try {
        # 進捗確認スクリプトを実行
        $output = & npx tsx scripts/check-jira-label-generation-progress.ts 2>&1
        
        # 進捗率を抽出
        $progressLine = $output | Select-String -Pattern "進捗率: (\d+\.\d+)%" 
        if ($progressLine) {
            $progressPercent = [double]($progressLine.Matches.Groups[1].Value)
            $currentCount = [int]($progressPercent * $expectedCount / 100)
            
            # 進捗が進んでいるかチェック
            if ($currentCount -gt $lastCount) {
                $noProgressCount = 0
                $lastCount = $currentCount
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 進捗更新: $currentCount / $expectedCount 件 ($($progressPercent.ToString('F1'))%)" -ForegroundColor Green
            } else {
                $noProgressCount++
                if ($noProgressCount -ge $maxNoProgressChecks) {
                    Write-Host ""
                    Write-Host "⚠️  警告: ${maxNoProgressChecks}回（$($checkInterval * $maxNoProgressChecks / 60)分）進捗がありません" -ForegroundColor Yellow
                    Write-Host "   処理が停止している可能性があります。確認してください。" -ForegroundColor Yellow
                    Write-Host ""
                    $noProgressCount = 0
                }
            }
            
            # 完了チェック
            if ($currentCount -ge $expectedCount) {
                Write-Host ""
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host "  ✅ 全件の生成が完了しました！" -ForegroundColor Green
                Write-Host "========================================" -ForegroundColor Cyan
                Write-Host ""
                
                # 最終統計を表示
                & npx tsx scripts/check-jira-label-generation-progress.ts
                break
            }
        }
        
        Start-Sleep -Seconds $checkInterval
        
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] エラー: $($_.Exception.Message)" -ForegroundColor Red
        Start-Sleep -Seconds $checkInterval
    }
}

