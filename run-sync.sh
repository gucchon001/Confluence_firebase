#!/bin/bash

echo "========================================"
echo "LanceDB同期バッチプログラム実行"
echo "========================================"
echo

# 環境変数の確認
echo "1. 環境変数の確認..."
if [ ! -f ".env" ]; then
    echo "エラー: .envファイルが見つかりません"
    echo "sensitive-files.zipを解凍して.envファイルを配置してください"
    exit 1
fi

if [ ! -f "keys/firebase-adminsdk-key.json" ]; then
    echo "エラー: Firebase認証ファイルが見つかりません"
    echo "sensitive-files.zipを解凍してkeysフォルダを配置してください"
    exit 1
fi

echo "環境変数ファイル: OK"
echo "Firebase認証ファイル: OK"
echo

# 依存関係の確認
echo "2. 依存関係の確認..."
if [ ! -d "node_modules" ]; then
    echo "依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo "エラー: npm installに失敗しました"
        exit 1
    fi
fi

echo "依存関係: OK"
echo

# メニュー表示
echo "3. 実行する同期タイプを選択してください:"
echo
echo "[1] 軽量同期 (10ページ)"
echo "[2] バッチ同期 (全ページ)"
echo "[3] 差分同期"
echo "[4] 軽量パイプライン"
echo "[5] 完全パイプライン"
echo "[6] データベース状態確認"
echo "[7] 終了"
echo

read -p "選択 (1-7): " choice

case $choice in
    1)
        echo
        echo "軽量同期を実行中..."
        npx tsx src/scripts/unified-confluence-sync.ts
        ;;
    2)
        echo
        echo "バッチ同期を実行中..."
        npm run sync:confluence:batch
        ;;
    3)
        echo
        echo "差分同期を実行中..."
        npm run sync:confluence:differential
        ;;
    4)
        echo
        echo "軽量パイプラインを実行中..."
        npm run lightweight-pipeline
        ;;
    5)
        echo
        echo "完全パイプラインを実行中..."
        npm run complete-pipeline
        ;;
    6)
        echo
        echo "データベース状態を確認中..."
        npx tsx src/scripts/check-data-basic.ts
        ;;
    7)
        echo "終了します"
        exit 0
        ;;
    *)
        echo "無効な選択です"
        ;;
esac

echo
echo "実行完了"
