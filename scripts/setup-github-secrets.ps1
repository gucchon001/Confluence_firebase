# GitHub Secrets設定スクリプト (PowerShell版)
# 
# 使用方法:
#   .\scripts\setup-github-secrets.ps1
#
# 注意: .env.localファイルが存在することを前提としています

$ErrorActionPreference = "Stop"

Write-Host "🔐 GitHub Secrets設定スクリプト" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# .env.localファイルの存在確認
if (-not (Test-Path ".env.local")) {
    Write-Host "❌ .env.localファイルが見つかりません" -ForegroundColor Red
    exit 1
}

# GitHub CLIのインストール確認
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) がインストールされていません" -ForegroundColor Red
    Write-Host ""
    Write-Host "インストール方法:" -ForegroundColor Yellow
    Write-Host "  1. wingetを使用: winget install --id GitHub.cli" -ForegroundColor Yellow
    Write-Host "  2. Chocolateyを使用: choco install gh" -ForegroundColor Yellow
    Write-Host "  3. Scoopを使用: scoop install gh" -ForegroundColor Yellow
    Write-Host "  4. 手動インストール: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "インストール後、PowerShellを再起動してください" -ForegroundColor Yellow
    exit 1
}

# GitHub認証確認
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Not authenticated"
    }
} catch {
    Write-Host "⚠️  GitHub CLIにログインしていません" -ForegroundColor Yellow
    Write-Host "ログインコマンド: gh auth login" -ForegroundColor Yellow
    exit 1
}

# .env.localから値を読み込む関数
function Get-EnvValue {
    param([string]$Key)
    $line = Get-Content ".env.local" | Where-Object { $_ -match "^${Key}=" }
    if ($line) {
        $value = $line -replace "^${Key}=", ""
        # クォートを削除
        $value = $value -replace '^"', '' -replace '"$', ''
        return $value
    }
    return $null
}

Write-Host "📋 必須のSecretsを設定します..." -ForegroundColor Green
Write-Host ""

# 必須のSecrets
Write-Host "1. JIRA_PROJECT_KEY" -ForegroundColor Green
$jiraProjectKey = Get-EnvValue "JIRA_PROJECT_KEY"
if ([string]::IsNullOrEmpty($jiraProjectKey)) {
    Write-Host "   ❌ JIRA_PROJECT_KEYが見つかりません" -ForegroundColor Red
    exit 1
}
gh secret set JIRA_PROJECT_KEY --body $jiraProjectKey
Write-Host "   ✅ 設定完了" -ForegroundColor Green
Write-Host ""

Write-Host "2. GEMINI_API_KEY" -ForegroundColor Green
$geminiApiKey = Get-EnvValue "GEMINI_API_KEY"
if ([string]::IsNullOrEmpty($geminiApiKey)) {
    Write-Host "   ❌ GEMINI_API_KEYが見つかりません" -ForegroundColor Red
    exit 1
}
gh secret set GEMINI_API_KEY --body $geminiApiKey
Write-Host "   ✅ 設定完了" -ForegroundColor Green
Write-Host ""

Write-Host "3. GOOGLE_CLOUD_CREDENTIALS" -ForegroundColor Green
$googleAppCredentials = Get-EnvValue "GOOGLE_APPLICATION_CREDENTIALS"
if ([string]::IsNullOrEmpty($googleAppCredentials)) {
    Write-Host "   ❌ GOOGLE_APPLICATION_CREDENTIALSが見つかりません" -ForegroundColor Red
    exit 1
}

# パスを正規化（./ を削除）
$credentialsFile = $googleAppCredentials -replace '^\./', ''
if (-not (Test-Path $credentialsFile)) {
    Write-Host "   ❌ 認証情報ファイルが見つかりません: $credentialsFile" -ForegroundColor Red
    exit 1
}

Get-Content $credentialsFile | gh secret set GOOGLE_CLOUD_CREDENTIALS
Write-Host "   ✅ 設定完了" -ForegroundColor Green
Write-Host ""

Write-Host "📋 オプションのSecretsを設定します（Confluence設定をフォールバックとして使用）..." -ForegroundColor Yellow
Write-Host ""

# オプションのSecrets（Jira専用が設定されていない場合のみ）
Write-Host "4. JIRA_BASE_URL (オプション)" -ForegroundColor Yellow
$confluenceBaseUrl = Get-EnvValue "CONFLUENCE_BASE_URL"
if (-not [string]::IsNullOrEmpty($confluenceBaseUrl)) {
    $response = Read-Host "   JIRA_BASE_URLを設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set JIRA_BASE_URL --body $confluenceBaseUrl
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    } else {
        Write-Host "   ⏩ スキップ（CONFLUENCE_BASE_URLがフォールバックとして使用されます）" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⏩ CONFLUENCE_BASE_URLが見つかりません" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "5. JIRA_USER_EMAIL (オプション)" -ForegroundColor Yellow
$confluenceUserEmail = Get-EnvValue "CONFLUENCE_USER_EMAIL"
if (-not [string]::IsNullOrEmpty($confluenceUserEmail)) {
    $response = Read-Host "   JIRA_USER_EMAILを設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set JIRA_USER_EMAIL --body $confluenceUserEmail
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    } else {
        Write-Host "   ⏩ スキップ（CONFLUENCE_USER_EMAILがフォールバックとして使用されます）" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⏩ CONFLUENCE_USER_EMAILが見つかりません" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "6. JIRA_API_TOKEN (オプション)" -ForegroundColor Yellow
$confluenceApiToken = Get-EnvValue "CONFLUENCE_API_TOKEN"
if (-not [string]::IsNullOrEmpty($confluenceApiToken)) {
    $response = Read-Host "   JIRA_API_TOKENを設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set JIRA_API_TOKEN --body $confluenceApiToken
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    } else {
        Write-Host "   ⏩ スキップ（CONFLUENCE_API_TOKENがフォールバックとして使用されます）" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⏩ CONFLUENCE_API_TOKENが見つかりません" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "📋 Confluenceワークフロー用のSecretsを確認します..." -ForegroundColor Green
Write-Host ""

# Confluence用のSecrets（既に設定されている可能性がある）
$confluenceBaseUrl = Get-EnvValue "CONFLUENCE_BASE_URL"
$confluenceUserEmail = Get-EnvValue "CONFLUENCE_USER_EMAIL"
$confluenceApiToken = Get-EnvValue "CONFLUENCE_API_TOKEN"
$confluenceSpaceKey = Get-EnvValue "CONFLUENCE_SPACE_KEY"

if (-not [string]::IsNullOrEmpty($confluenceBaseUrl)) {
    Write-Host "7. CONFLUENCE_BASE_URL" -ForegroundColor Green
    $response = Read-Host "   設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set CONFLUENCE_BASE_URL --body $confluenceBaseUrl
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    }
    Write-Host ""
}

if (-not [string]::IsNullOrEmpty($confluenceUserEmail)) {
    Write-Host "8. CONFLUENCE_USER_EMAIL" -ForegroundColor Green
    $response = Read-Host "   設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set CONFLUENCE_USER_EMAIL --body $confluenceUserEmail
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    }
    Write-Host ""
}

if (-not [string]::IsNullOrEmpty($confluenceApiToken)) {
    Write-Host "9. CONFLUENCE_API_TOKEN" -ForegroundColor Green
    $response = Read-Host "   設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set CONFLUENCE_API_TOKEN --body $confluenceApiToken
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    }
    Write-Host ""
}

if (-not [string]::IsNullOrEmpty($confluenceSpaceKey)) {
    Write-Host "10. CONFLUENCE_SPACE_KEY" -ForegroundColor Green
    $response = Read-Host "    設定しますか？ (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        gh secret set CONFLUENCE_SPACE_KEY --body $confluenceSpaceKey
        Write-Host "   ✅ 設定完了" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ GitHub Secrets設定が完了しました" -ForegroundColor Green
Write-Host ""
Write-Host "設定されたSecretsを確認するには:" -ForegroundColor Cyan
Write-Host "  gh secret list" -ForegroundColor Cyan
Write-Host ""

