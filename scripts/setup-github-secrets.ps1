# GitHub Secrets設定スクリプト（PowerShell版）
# 
# 使用方法:
#   .\scripts\setup-github-secrets.ps1
#
# 注意: .env.localファイルが存在することを前提としています

$ErrorActionPreference = "Stop"

Write-Host "GitHub Secrets設定スクリプト" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# .env.localファイルの存在確認
if (-not (Test-Path ".env.local")) {
    Write-Host ".env.localファイルが見つかりません" -ForegroundColor Red
    exit 1
}

# GitHub CLIのインストール確認
try {
    $null = gh --version 2>$null
} catch {
    Write-Host "GitHub CLI (gh) がインストールされていません" -ForegroundColor Red
    Write-Host "インストール方法: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# GitHub認証確認
try {
    gh auth status 2>$null | Out-Null
} catch {
    Write-Host "GitHub CLIにログインしていません" -ForegroundColor Yellow
    Write-Host "ログインコマンド: gh auth login" -ForegroundColor Yellow
    exit 1
}

# .env.localから値を読み込む関数
function Get-EnvValue {
    param([string]$Key)
    
    $line = Get-Content ".env.local" | Where-Object { $_ -match "^${Key}=" }
    if ($line) {
        $value = $line -replace "^${Key}=", ""
        # 引用符を削除
        $value = $value -replace '^"', '' -replace '"$', ''
        return $value
    }
    return $null
}

Write-Host "必須のSecretsを設定します..." -ForegroundColor Cyan
Write-Host ""

# 必須のSecrets
Write-Host "1. JIRA_PROJECT_KEY" -ForegroundColor Green
$JIRA_PROJECT_KEY = Get-EnvValue "JIRA_PROJECT_KEY"
if ([string]::IsNullOrEmpty($JIRA_PROJECT_KEY)) {
    Write-Host "   JIRA_PROJECT_KEYが見つかりません" -ForegroundColor Red
    exit 1
}
gh secret set JIRA_PROJECT_KEY --body "$JIRA_PROJECT_KEY"
Write-Host "   設定完了" -ForegroundColor Green
Write-Host ""

Write-Host "2. GEMINI_API_KEY" -ForegroundColor Green
$GEMINI_API_KEY = Get-EnvValue "GEMINI_API_KEY"
if ([string]::IsNullOrEmpty($GEMINI_API_KEY)) {
    Write-Host "   GEMINI_API_KEYが見つかりません" -ForegroundColor Red
    exit 1
}
gh secret set GEMINI_API_KEY --body "$GEMINI_API_KEY"
Write-Host "   設定完了（新しいキー: $($GEMINI_API_KEY.Substring(0, 10))...）" -ForegroundColor Green
Write-Host ""

Write-Host "3. GOOGLE_CLOUD_CREDENTIALS" -ForegroundColor Green
$GOOGLE_APPLICATION_CREDENTIALS = Get-EnvValue "GOOGLE_APPLICATION_CREDENTIALS"
if ([string]::IsNullOrEmpty($GOOGLE_APPLICATION_CREDENTIALS)) {
    Write-Host "   GOOGLE_APPLICATION_CREDENTIALSが見つかりません" -ForegroundColor Yellow
    Write-Host "   スキップします" -ForegroundColor Yellow
} else {
    if (Test-Path $GOOGLE_APPLICATION_CREDENTIALS) {
        $credentialsContent = Get-Content $GOOGLE_APPLICATION_CREDENTIALS -Raw
        gh secret set GOOGLE_CLOUD_CREDENTIALS --body "$credentialsContent"
        Write-Host "   設定完了" -ForegroundColor Green
    } else {
        Write-Host "   ファイルが見つかりません: $GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Yellow
        Write-Host "   スキップします" -ForegroundColor Yellow
    }
}
Write-Host ""

# オプションのSecrets（Jira専用）
Write-Host "オプションのSecrets（Jira専用）を設定します..." -ForegroundColor Cyan
Write-Host ""

$JIRA_BASE_URL = Get-EnvValue "JIRA_BASE_URL"
if (-not [string]::IsNullOrEmpty($JIRA_BASE_URL)) {
    Write-Host "4. JIRA_BASE_URL" -ForegroundColor Green
    gh secret set JIRA_BASE_URL --body "$JIRA_BASE_URL"
    Write-Host "   設定完了" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "4. JIRA_BASE_URL" -ForegroundColor Yellow
    Write-Host "   JIRA_BASE_URLが見つかりません（スキップ）" -ForegroundColor Yellow
    Write-Host ""
}

$JIRA_USER_EMAIL = Get-EnvValue "JIRA_USER_EMAIL"
if (-not [string]::IsNullOrEmpty($JIRA_USER_EMAIL)) {
    Write-Host "5. JIRA_USER_EMAIL" -ForegroundColor Green
    gh secret set JIRA_USER_EMAIL --body "$JIRA_USER_EMAIL"
    Write-Host "   設定完了" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "5. JIRA_USER_EMAIL" -ForegroundColor Yellow
    Write-Host "   JIRA_USER_EMAILが見つかりません（スキップ）" -ForegroundColor Yellow
    Write-Host ""
}

$JIRA_API_TOKEN = Get-EnvValue "JIRA_API_TOKEN"
if (-not [string]::IsNullOrEmpty($JIRA_API_TOKEN)) {
    Write-Host "6. JIRA_API_TOKEN" -ForegroundColor Green
    gh secret set JIRA_API_TOKEN --body "$JIRA_API_TOKEN"
    Write-Host "   設定完了" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "6. JIRA_API_TOKEN" -ForegroundColor Yellow
    Write-Host "   JIRA_API_TOKENが見つかりません（スキップ）" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "GitHub Secretsの設定が完了しました！" -ForegroundColor Green
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Cyan
Write-Host "1. 設定を確認: gh secret list" -ForegroundColor White
Write-Host "2. Run GitHub Actions workflow to verify" -ForegroundColor White
