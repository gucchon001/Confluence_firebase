# PowerShellのパスをリフレッシュするスクリプト
# GitHub CLIなどの新しくインストールされたコマンドを使用する前に実行してください

Write-Host "🔄 PowerShellのパスをリフレッシュ中..." -ForegroundColor Cyan

# システムとユーザーの環境変数からパスを再読み込み
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "✅ パスをリフレッシュしました" -ForegroundColor Green
Write-Host ""

# GitHub CLIが利用可能か確認
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "✅ GitHub CLI (gh) が利用可能です" -ForegroundColor Green
    gh --version
} else {
    Write-Host "❌ GitHub CLI (gh) が見つかりません" -ForegroundColor Red
    Write-Host ""
    Write-Host "以下のいずれかを試してください:" -ForegroundColor Yellow
    Write-Host "  1. PowerShellを再起動する" -ForegroundColor Yellow
    Write-Host "  2. このスクリプトを実行: .\scripts\refresh-path.ps1" -ForegroundColor Yellow
    Write-Host "  3. 手動でパスをリフレッシュ: `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')" -ForegroundColor Yellow
}

