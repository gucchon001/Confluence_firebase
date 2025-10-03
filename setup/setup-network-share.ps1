# ネットワーク共有セットアップスクリプト（Windows用）
# 他環境でのローカル環境共有を簡単にするためのPowerShellスクリプト

Write-Host "🌐 ネットワーク共有セットアップ開始" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# 1. 現在のIPアドレスを取得
Write-Host "📡 現在のIPアドレスを取得中..." -ForegroundColor Yellow
try {
    $LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress
    Write-Host "✅ ローカルIPアドレス: $LocalIP" -ForegroundColor Green
} catch {
    Write-Host "❌ IPアドレスの取得に失敗しました" -ForegroundColor Red
    $LocalIP = "192.168.x.x"
}

# 2. 必要なポートが開いているかチェック
Write-Host "🔍 ポート9003の確認中..." -ForegroundColor Yellow
$PortCheck = Get-NetTCPConnection -LocalPort 9003 -ErrorAction SilentlyContinue
if ($PortCheck) {
    Write-Host "⚠️  ポート9003は既に使用されています" -ForegroundColor Yellow
    Write-Host "   使用中のプロセス:" -ForegroundColor Yellow
    $PortCheck | Format-Table -AutoSize
} else {
    Write-Host "✅ ポート9003は利用可能です" -ForegroundColor Green
}

# 3. 環境変数ファイルの確認
Write-Host "📝 環境変数ファイルの確認中..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ .envファイルが見つかりません" -ForegroundColor Red
    Write-Host "   .env.exampleをコピーして設定してください:" -ForegroundColor Yellow
    Write-Host "   Copy-Item .env.example .env" -ForegroundColor Cyan
    Write-Host "   その後、必要な環境変数を設定してください" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ .envファイルが見つかりました" -ForegroundColor Green
}

# 4. 依存関係の確認
Write-Host "📦 依存関係の確認中..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "📥 node_modulesが見つかりません。インストールを開始します..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 依存関係のインストールが完了しました" -ForegroundColor Green
    } else {
        Write-Host "❌ 依存関係のインストールに失敗しました" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ 依存関係は既にインストールされています" -ForegroundColor Green
}

# 5. LanceDBデータの確認
Write-Host "🗄️  LanceDBデータの確認中..." -ForegroundColor Yellow
if (-not (Test-Path ".lancedb")) {
    Write-Host "⚠️  .lancedbディレクトリが見つかりません" -ForegroundColor Yellow
    Write-Host "   データ同期を実行してください:" -ForegroundColor Yellow
    Write-Host "   npm run sync:confluence:batch" -ForegroundColor Cyan
} else {
    Write-Host "✅ LanceDBデータが見つかりました" -ForegroundColor Green
}

# 6. キャッシュディレクトリの確認
Write-Host "💾 キャッシュディレクトリの確認中..." -ForegroundColor Yellow
if (-not (Test-Path ".cache")) {
    Write-Host "📁 .cacheディレクトリを作成中..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path ".cache" -Force | Out-Null
    Write-Host "✅ .cacheディレクトリを作成しました" -ForegroundColor Green
} else {
    Write-Host "✅ .cacheディレクトリが見つかりました" -ForegroundColor Green
}

# 7. ネットワークアクセス情報の表示
Write-Host ""
Write-Host "🎯 ネットワーク共有設定完了！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "📍 アクセスURL:" -ForegroundColor Cyan
Write-Host "   ローカル: http://localhost:9003" -ForegroundColor White
Write-Host "   ネットワーク: http://$LocalIP:9003" -ForegroundColor White
Write-Host ""
Write-Host "🔧 起動方法:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🌐 他の環境からアクセスする場合:" -ForegroundColor Cyan
Write-Host "   1. 同じネットワークに接続" -ForegroundColor White
Write-Host "   2. ブラウザで http://$LocalIP:9003 にアクセス" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  注意事項:" -ForegroundColor Yellow
Write-Host "   - ファイアウォールでポート9003を開放してください" -ForegroundColor White
Write-Host "   - セキュリティ上、信頼できるネットワークでのみ使用してください" -ForegroundColor White
Write-Host ""

# 8. Windowsファイアウォール設定の案内
Write-Host "🛡️  Windowsファイアウォール設定:" -ForegroundColor Cyan
Write-Host "   netsh advfirewall firewall add rule name=\"Confluence App\" dir=in action=allow protocol=TCP localport=9003" -ForegroundColor White
Write-Host ""
Write-Host "   または、管理者権限でPowerShellを実行して以下を実行:" -ForegroundColor Yellow
Write-Host "   New-NetFirewallRule -DisplayName \"Confluence App\" -Direction Inbound -Protocol TCP -LocalPort 9003 -Action Allow" -ForegroundColor White
Write-Host ""

Write-Host "✅ セットアップ完了！" -ForegroundColor Green
