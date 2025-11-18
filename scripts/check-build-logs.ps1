# Firebase App Hostingビルドログ確認スクリプト
# 
# 使用方法:
#   .\scripts\check-build-logs.ps1

$PROJECT_ID = "confluence-copilot-ppjye"

Write-Host "🔍 Firebase App Hostingビルドログ確認" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 最新のビルドを取得
Write-Host "最新のビルドを取得中..." -ForegroundColor Yellow
$builds = gcloud builds list --project=$PROJECT_ID --limit=5 --format="json" | ConvertFrom-Json

if ($builds.Count -eq 0) {
    Write-Host "❌ ビルドが見つかりません" -ForegroundColor Red
    exit 1
}

$latestBuild = $builds[0]
Write-Host "✅ 最新ビルドID: $($latestBuild.id)" -ForegroundColor Green
Write-Host "   ステータス: $($latestBuild.status)" -ForegroundColor $(if ($latestBuild.status -eq "SUCCESS") { "Green" } else { "Red" })
Write-Host "   作成日時: $($latestBuild.createTime)" -ForegroundColor White
Write-Host ""

# copy-kuromoji-dict.jsのログを検索
Write-Host "📋 copy-kuromoji-dict.jsの実行ログを検索中..." -ForegroundColor Yellow
$logs = gcloud builds log $latestBuild.id --project=$PROJECT_ID 2>&1 | Select-String "copy-kuromoji-dict"

if ($logs) {
    Write-Host "✅ copy-kuromoji-dict.jsのログが見つかりました:" -ForegroundColor Green
    $logs | ForEach-Object {
        Write-Host "   $_" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  copy-kuromoji-dict.jsのログが見つかりませんでした" -ForegroundColor Yellow
    Write-Host "   ビルドログ全体を確認してください" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 ビルドログ全体を確認するには:" -ForegroundColor Cyan
Write-Host "   gcloud builds log $($latestBuild.id) --project=$PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "📋 Firebase Consoleから確認するには:" -ForegroundColor Cyan
Write-Host "   https://console.firebase.google.com/project/$PROJECT_ID/apphosting" -ForegroundColor White

