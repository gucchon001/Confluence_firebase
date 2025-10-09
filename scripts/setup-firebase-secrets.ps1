# Firebase Secret Managerにシークレットを設定するスクリプト（PowerShell版）

# 使用方法:
# 1. .env.localから環境変数を読み込む
# 2. Firebase CLIにログイン: firebase login
# 3. このスクリプトを実行: .\scripts\setup-firebase-secrets.ps1

$PROJECT_ID = "confluence-copilot-ppjye"

# 環境変数から読み込む
if (-not $env:CONFLUENCE_API_TOKEN) {
    Write-Host "⚠️  CONFLUENCE_API_TOKEN environment variable not set!" -ForegroundColor Red
    Write-Host "Please set it from .env.local or run:" -ForegroundColor Yellow
    Write-Host '$env:CONFLUENCE_API_TOKEN = "YOUR_TOKEN_HERE"' -ForegroundColor Yellow
    exit 1
}

$CONFLUENCE_API_TOKEN = $env:CONFLUENCE_API_TOKEN

Write-Host "🔐 Setting up Firebase secrets for project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

# 1. Confluence API Token
Write-Host "Setting up Confluence API Token..." -ForegroundColor Yellow

try {
    # シークレットを作成（既存の場合はエラー）
    echo $CONFLUENCE_API_TOKEN | gcloud secrets create confluence_api_token `
        --project=$PROJECT_ID `
        --data-file=- 2>$null
    Write-Host "✅ Confluence API Token created" -ForegroundColor Green
} catch {
    # 既存の場合は新しいバージョンを追加
    Write-Host "Secret already exists, updating..." -ForegroundColor Yellow
    echo $CONFLUENCE_API_TOKEN | gcloud secrets versions add confluence_api_token `
        --project=$PROJECT_ID `
        --data-file=-
    Write-Host "✅ Confluence API Token updated" -ForegroundColor Green
}

Write-Host ""

# 2. Firebase Service Account Key
Write-Host "Setting up Firebase Service Account Key..." -ForegroundColor Yellow

if (Test-Path "keys\firebase-adminsdk-key.json") {
    try {
        gcloud secrets create firebase_service_account_key `
            --project=$PROJECT_ID `
            --data-file="keys\firebase-adminsdk-key.json" 2>$null
        Write-Host "✅ Firebase Service Account Key created" -ForegroundColor Green
    } catch {
        Write-Host "Secret already exists, updating..." -ForegroundColor Yellow
        gcloud secrets versions add firebase_service_account_key `
            --project=$PROJECT_ID `
            --data-file="keys\firebase-adminsdk-key.json"
        Write-Host "✅ Firebase Service Account Key updated" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  keys\firebase-adminsdk-key.json not found, skipping" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 All secrets configured!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify secrets: gcloud secrets list --project=$PROJECT_ID"
Write-Host "2. Deploy your app: firebase deploy"

