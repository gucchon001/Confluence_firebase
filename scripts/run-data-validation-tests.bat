@echo off
echo ========================================
echo データ検証テスト - 個別実行（Confluenceのみ）
echo ========================================
echo.
echo このスクリプトは、05.01-data-validation.md のテストを実行します。
echo 詳細: docs/05-testing/05.01-data-validation.md
echo.

echo [1/7] LanceDBスキーマ検証（Confluence）...
call npx tsx src/tests/check-lancedb-schema.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト1が失敗しました
    exit /b 1
)
echo ✅ テスト1成功
echo.

echo [2/7] Firestoreラベル統合テスト（Confluence）...
call npx tsx src/tests/test-firestore-labels-integration.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト2が失敗しました
    exit /b 1
)
echo ✅ テスト2成功
echo.

echo [3/7] LanceDBインデックステスト（Confluence）...
call npx tsx src/tests/test-lancedb-indexes.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト3が失敗しました
    exit /b 1
)
echo ✅ テスト3成功
echo.

echo [4/7] Lunrインデックステスト（Confluence）...
call npx tsx src/tests/test-lunr-index.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト4が失敗しました
    exit /b 1
)
echo ✅ テスト4成功
echo.

echo [5/7] Confluence同期テスト...
call npx tsx src/tests/test-confluence-sync.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト5が失敗しました
    exit /b 1
)
echo ✅ テスト5成功
echo.

echo [6/7] ラベル生成テスト...
call npx tsx src/tests/test-label-generation.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト6が失敗しました
    exit /b 1
)
echo ✅ テスト6成功
echo.

echo [7/7] ラベルフィルタリングテスト...
call npx tsx src/tests/test-label-filtering.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ テスト7が失敗しました
    exit /b 1
)
echo ✅ テスト7成功
echo.

echo ========================================
echo ✅ 全個別テスト成功！
echo ========================================
echo.
echo 一括テストを実行します...
echo.

call npx tsx src/tests/test-data-validation-all.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ 一括テストが失敗しました
    exit /b 1
)

echo.
echo ========================================
echo 🎉 全テスト成功！
echo ========================================

