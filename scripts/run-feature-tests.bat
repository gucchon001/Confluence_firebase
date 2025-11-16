@echo off
echo ========================================
echo 機能テスト実行（05.02-feature-tests.md）
echo ========================================
echo.
echo このスクリプトは、05.02-feature-tests.md の機能テストを実行します。
echo 詳細: docs/05-testing/05.02-feature-tests.md
echo.

call npx tsx src/tests/runners/feature-tests-runner.ts

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ 機能テストが失敗しました
    exit /b 1
)

echo.
echo ========================================
echo 🎉 全機能テスト成功！
echo ========================================

