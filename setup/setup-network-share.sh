#!/bin/bash

# ネットワーク共有セットアップスクリプト
# 他環境でのローカル環境共有を簡単にするためのスクリプト

echo "🌐 ネットワーク共有セットアップ開始"
echo "======================================"

# 1. 現在のIPアドレスを取得
echo "📡 現在のIPアドレスを取得中..."
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "✅ ローカルIPアドレス: $LOCAL_IP"

# 2. 必要なポートが開いているかチェック
echo "🔍 ポート9003の確認中..."
if lsof -i :9003 > /dev/null 2>&1; then
    echo "⚠️  ポート9003は既に使用されています"
    echo "   使用中のプロセス:"
    lsof -i :9003
else
    echo "✅ ポート9003は利用可能です"
fi

# 3. 環境変数ファイルの確認
echo "📝 環境変数ファイルの確認中..."
if [ ! -f ".env" ]; then
    echo "❌ .envファイルが見つかりません"
    echo "   .env.exampleをコピーして設定してください:"
    echo "   cp .env.example .env"
    echo "   その後、必要な環境変数を設定してください"
    exit 1
else
    echo "✅ .envファイルが見つかりました"
fi

# 4. 依存関係の確認
echo "📦 依存関係の確認中..."
if [ ! -d "node_modules" ]; then
    echo "📥 node_modulesが見つかりません。インストールを開始します..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ 依存関係のインストールが完了しました"
    else
        echo "❌ 依存関係のインストールに失敗しました"
        exit 1
    fi
else
    echo "✅ 依存関係は既にインストールされています"
fi

# 5. LanceDBデータの確認
echo "🗄️  LanceDBデータの確認中..."
if [ ! -d ".lancedb" ]; then
    echo "⚠️  .lancedbディレクトリが見つかりません"
    echo "   データ同期を実行してください:"
    echo "   npm run sync:confluence:batch"
else
    echo "✅ LanceDBデータが見つかりました"
fi

# 6. キャッシュディレクトリの確認
echo "💾 キャッシュディレクトリの確認中..."
if [ ! -d ".cache" ]; then
    echo "📁 .cacheディレクトリを作成中..."
    mkdir -p .cache
    echo "✅ .cacheディレクトリを作成しました"
else
    echo "✅ .cacheディレクトリが見つかりました"
fi

# 7. ネットワークアクセス情報の表示
echo ""
echo "🎯 ネットワーク共有設定完了！"
echo "======================================"
echo "📍 アクセスURL:"
echo "   ローカル: http://localhost:9003"
echo "   ネットワーク: http://$LOCAL_IP:9003"
echo ""
echo "🔧 起動方法:"
echo "   npm run dev"
echo ""
echo "🌐 他の環境からアクセスする場合:"
echo "   1. 同じネットワークに接続"
echo "   2. ブラウザで http://$LOCAL_IP:9003 にアクセス"
echo ""
echo "⚠️  注意事項:"
echo "   - ファイアウォールでポート9003を開放してください"
echo "   - セキュリティ上、信頼できるネットワークでのみ使用してください"
echo ""

# 8. ファイアウォール設定の案内（Ubuntu/Debian）
if command -v ufw > /dev/null 2>&1; then
    echo "🛡️  ファイアウォール設定（Ubuntu/Debian）:"
    echo "   sudo ufw allow 9003"
    echo ""
fi

# 9. Windowsファイアウォール設定の案内
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "🛡️  Windowsファイアウォール設定:"
    echo "   netsh advfirewall firewall add rule name=\"Confluence App\" dir=in action=allow protocol=TCP localport=9003"
    echo ""
fi

echo "✅ セットアップ完了！"
