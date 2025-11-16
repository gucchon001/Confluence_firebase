@echo off
REM デプロイ・整合性・Phase 0A-4 テスト実行スクリプト
REM 05.03-deployment-integration.md + 05.05-phase-0a-4-test-criteria.md のテストを統合実行

echo ========================================
echo デプロイ・整合性・Phase 0A-4 テスト実行
echo ========================================
echo.

call npm run test:deployment-integration

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ========================================
    echo テストが失敗しました
    echo ========================================
    exit /b 1
)

echo.
echo ========================================
echo テストが正常に完了しました
echo ========================================
exit /b 0

