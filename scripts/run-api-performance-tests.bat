@echo off
REM パフォーマンステスト実行スクリプト
REM 05.04-performance-tests.md のテストを実行

echo ========================================
echo パフォーマンステスト実行
echo ========================================
echo.
echo このスクリプトは、05.04-performance-tests.md のパフォーマンステストを実行します。
echo 詳細: docs/05-testing/05.04-performance-tests.md
echo.

call npm run test:api-performance

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo ❌ パフォーマンステストが失敗しました
    echo ========================================
    exit /b 1
)

echo.
echo ========================================
echo ✅ パフォーマンステストが正常に完了しました
echo ========================================
exit /b 0

