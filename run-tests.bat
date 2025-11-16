@echo off
REM このファイルは scripts/run-data-validation-tests.bat に移動しました
REM 後方互換性のため、新しい場所にリダイレクトします

echo ========================================
echo データ検証テスト - リダイレクト
echo ========================================
echo.
echo このスクリプトは scripts/run-data-validation-tests.bat に移動しました。
echo 新しい場所から実行します...
echo.

call scripts\run-data-validation-tests.bat
exit /b %ERRORLEVEL%
