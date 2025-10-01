@echo off
echo ========================================
echo LanceDB同期バッチプログラム実行
echo ========================================
echo.

REM 環境変数の確認
echo 1. 環境変数の確認...
if not exist .env (
    echo エラー: .envファイルが見つかりません
    echo sensitive-files.zipを解凍して.envファイルを配置してください
    pause
    exit /b 1
)

if not exist keys\firebase-adminsdk-key.json (
    echo エラー: Firebase認証ファイルが見つかりません
    echo sensitive-files.zipを解凍してkeysフォルダを配置してください
    pause
    exit /b 1
)

echo 環境変数ファイル: OK
echo Firebase認証ファイル: OK
echo.

REM 依存関係の確認
echo 2. 依存関係の確認...
if not exist node_modules (
    echo 依存関係をインストール中...
    npm install
    if errorlevel 1 (
        echo エラー: npm installに失敗しました
        pause
        exit /b 1
    )
)

echo 依存関係: OK
echo.

REM メニュー表示
echo 3. 実行する同期タイプを選択してください:
echo.
echo [1] 軽量同期 (10ページ)
echo [2] バッチ同期 (全ページ)
echo [3] 差分同期
echo [4] 軽量パイプライン
echo [5] 完全パイプライン
echo [6] データベース状態確認
echo [7] 終了
echo.

set /p choice="選択 (1-7): "

if "%choice%"=="1" (
    echo.
    echo 軽量同期を実行中...
    npx tsx src/scripts/unified-confluence-sync.ts
) else if "%choice%"=="2" (
    echo.
    echo バッチ同期を実行中...
    npm run sync:confluence:batch
) else if "%choice%"=="3" (
    echo.
    echo 差分同期を実行中...
    npm run sync:confluence:differential
) else if "%choice%"=="4" (
    echo.
    echo 軽量パイプラインを実行中...
    npm run lightweight-pipeline
) else if "%choice%"=="5" (
    echo.
    echo 完全パイプラインを実行中...
    npm run complete-pipeline
) else if "%choice%"=="6" (
    echo.
    echo データベース状態を確認中...
    npx tsx src/scripts/check-data-basic.ts
) else if "%choice%"=="7" (
    echo 終了します
    exit /b 0
) else (
    echo 無効な選択です
)

echo.
echo 実行完了
pause
