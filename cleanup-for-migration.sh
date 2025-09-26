#!/bin/bash

# リポジトリ移管用クリーンアップスクリプト
# 一時ファイルやテストファイルを削除し、移管に適した状態にする

echo "🧹 リポジトリ移管用クリーンアップ開始"
echo "======================================"

# 1. 一時ファイルの削除
echo "🗑️  一時ファイルの削除中..."
rm -f *.ts
rm -f *.txt
rm -f *.json
rm -f *.js
rm -f *.md

# 2. テスト結果ディレクトリの削除
echo "📁 テスト結果ディレクトリの削除中..."
rm -rf test-results/

# 3. ログディレクトリの削除
echo "📋 ログディレクトリの削除中..."
rm -rf logs/

# 4. データディレクトリの削除
echo "💾 データディレクトリの削除中..."
rm -rf .lancedb/
rm -rf .cache/
rm -rf data/

# 5. 環境固有ファイルの削除
echo "🔐 環境固有ファイルの削除中..."
rm -f .env
rm -rf keys/

# 6. 必要なファイルの復元
echo "📝 必要なファイルの復元中..."
git checkout HEAD -- src/
git checkout HEAD -- docs/
git checkout HEAD -- config/
git checkout HEAD -- package.json
git checkout HEAD -- package-lock.json
git checkout HEAD -- next.config.ts
git checkout HEAD -- tsconfig.json
git checkout HEAD -- tailwind.config.ts
git checkout HEAD -- components.json
git checkout HEAD -- firebase.json
git checkout HEAD -- firestore.rules
git checkout HEAD -- firestore.indexes.json
git checkout HEAD -- README.md
git checkout HEAD -- .env.example
git checkout HEAD -- setup-network-share.*
git checkout HEAD -- docs/migration-guide.md

# 7. 最終確認
echo "✅ クリーンアップ完了"
echo "======================================"
echo "📋 残っているファイル:"
ls -la | grep -E "\.(json|ts|md|sh|ps1)$|^[A-Z]"

echo ""
echo "🎯 移管準備完了！"
echo "次のステップ:"
echo "1. git add ."
echo "2. git commit -m 'Clean repository for migration'"
echo "3. git push"
