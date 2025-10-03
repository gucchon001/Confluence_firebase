# リポジトリ移管用クリーンアップスクリプト（Windows用）
# 一時ファイルやテストファイルを削除し、移管に適した状態にする

Write-Host "🧹 リポジトリ移管用クリーンアップ開始" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# 1. 一時ファイルの削除
Write-Host "🗑️  一時ファイルの削除中..." -ForegroundColor Yellow
Remove-Item -Path "*.ts" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.txt" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.json" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.js" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.md" -Force -ErrorAction SilentlyContinue

# 2. テスト結果ディレクトリの削除
Write-Host "📁 テスト結果ディレクトリの削除中..." -ForegroundColor Yellow
Remove-Item -Path "test-results\" -Recurse -Force -ErrorAction SilentlyContinue

# 3. ログディレクトリの削除
Write-Host "📋 ログディレクトリの削除中..." -ForegroundColor Yellow
Remove-Item -Path "logs\" -Recurse -Force -ErrorAction SilentlyContinue

# 4. データディレクトリの削除
Write-Host "💾 データディレクトリの削除中..." -ForegroundColor Yellow
Remove-Item -Path ".lancedb\" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".cache\" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "data\" -Recurse -Force -ErrorAction SilentlyContinue

# 5. 環境固有ファイルの削除
Write-Host "🔐 環境固有ファイルの削除中..." -ForegroundColor Yellow
Remove-Item -Path ".env" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "keys\" -Recurse -Force -ErrorAction SilentlyContinue

# 6. 必要なファイルの復元
Write-Host "📝 必要なファイルの復元中..." -ForegroundColor Yellow
git checkout HEAD -- src/
git checkout HEAD -- docs/
git checkout HEAD -- config/
git checkout HEAD -- package.json
git checkout HEAD -- package-lock.json
git checkout HEAD -- next.config.ts
git checkout HEAD -- tsconfig.json
git checkout HEAD -- tailwind.config.ts
git checkout HEAD -- components.json
git checkout HEAD -- firebase.json
git checkout HEAD -- firestore.rules
git checkout HEAD -- firestore.indexes.json
git checkout HEAD -- README.md
git checkout HEAD -- .env.example
git checkout HEAD -- setup-network-share.*
git checkout HEAD -- docs/migration-guide.md

# 7. 最終確認
Write-Host "✅ クリーンアップ完了" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "📋 残っているファイル:" -ForegroundColor Cyan
Get-ChildItem -Path . -Name | Where-Object { $_ -match "\.(json|ts|md|sh|ps1)$|^[A-Z]" }

Write-Host ""
Write-Host "🎯 移管準備完了！" -ForegroundColor Green
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "1. git add ." -ForegroundColor White
Write-Host "2. git commit -m 'Clean repository for migration'" -ForegroundColor White
Write-Host "3. git push" -ForegroundColor White
