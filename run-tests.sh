#!/bin/bash

echo "========================================"
echo "データ関連テスト - 個別実行"
echo "========================================"
echo ""

echo "[1/8] LanceDBスキーマ検証..."
npx tsx src/tests/check-lancedb-schema.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト1が失敗しました"
    exit 1
fi
echo "✅ テスト1成功"
echo ""

echo "[2/8] Firestoreラベル統合テスト..."
npx tsx src/tests/test-firestore-labels-integration.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト2が失敗しました"
    exit 1
fi
echo "✅ テスト2成功"
echo ""

echo "[3/8] LanceDBインデックステスト..."
npx tsx src/tests/test-lancedb-indexes.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト3が失敗しました"
    exit 1
fi
echo "✅ テスト3成功"
echo ""

echo "[4/8] Lunrインデックステスト..."
npx tsx src/tests/test-lunr-index.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト4が失敗しました"
    exit 1
fi
echo "✅ テスト4成功"
echo ""

echo "[5/8] Confluence同期テスト..."
npx tsx src/tests/test-confluence-sync.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト5が失敗しました"
    exit 1
fi
echo "✅ テスト5成功"
echo ""

echo "[6/8] Jira同期テスト..."
npx tsx src/tests/test-jira-sync.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト6が失敗しました"
    exit 1
fi
echo "✅ テスト6成功"
echo ""

echo "[7/8] ラベル生成テスト..."
npx tsx src/tests/test-label-generation.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト7が失敗しました"
    exit 1
fi
echo "✅ テスト7成功"
echo ""

echo "[8/8] ラベルフィルタリングテスト..."
npx tsx src/tests/test-label-filtering.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ テスト8が失敗しました"
    exit 1
fi
echo "✅ テスト8成功"
echo ""

echo "========================================"
echo "✅ 全個別テスト成功！"
echo "========================================"
echo ""
echo "一括テストを実行します..."
echo ""

npx tsx src/tests/test-data-validation-all.ts
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 一括テストが失敗しました"
    exit 1
fi

echo ""
echo "========================================"
echo "🎉 全テスト成功！"
echo "========================================"

