# ネットワーク共有ガイド

このドキュメントでは、Confluence Firebaseアプリケーションをネットワーク内で共有するための手順を説明します。

## 🌐 概要

ローカル開発環境を他の環境からアクセス可能にすることで、チーム内での開発・テスト・デモを効率化できます。

## 📋 前提条件

### ホスト側（サーバー側）
- Node.js 18以上
- 必要な環境変数が設定済み
- 依存関係がインストール済み
- LanceDBデータが準備済み

### クライアント側（アクセス側）
- 同じネットワークに接続
- ブラウザ（Chrome、Firefox、Safari、Edgeなど）

## 🚀 セットアップ手順

### Step 1: 自動セットアップ（推奨）

#### Linux/macOS
```bash
chmod +x setup-network-share.sh
./setup-network-share.sh
```

#### Windows
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-network-share.ps1
```

### Step 2: 手動セットアップ

#### 1. ネットワーク設定の変更
```bash
# package.jsonのdevスクリプトを確認
# "dev": "next dev -p 9003 -H 0.0.0.0" になっていることを確認
```

#### 2. 環境変数の設定
```bash
# .envファイルを作成
cp .env.example .env

# 必要な環境変数を設定
# - Firebase設定
# - Confluence API設定
# - Google AI API設定
```

#### 3. 依存関係のインストール
```bash
npm install
```

#### 4. データの準備
```bash
# Confluenceデータの同期
npm run sync:confluence:batch

# または差分同期
npm run sync:confluence:differential
```

## 🔧 起動とアクセス

### 1. アプリケーションの起動
```bash
npm run dev
```

### 2. アクセスURL
- **ローカルアクセス**: `http://localhost:9003`
- **ネットワークアクセス**: `http://<IPアドレス>:9003`

### 3. IPアドレスの確認方法

#### Linux/macOS
```bash
hostname -I
# または
ip addr show
```

#### Windows
```powershell
ipconfig
```

## 🛡️ セキュリティ設定

### ファイアウォール設定

#### Ubuntu/Debian
```bash
sudo ufw allow 9003
```

#### CentOS/RHEL
```bash
sudo firewall-cmd --permanent --add-port=9003/tcp
sudo firewall-cmd --reload
```

#### Windows
```powershell
# 管理者権限で実行
netsh advfirewall firewall add rule name="Confluence App" dir=in action=allow protocol=TCP localport=9003
```

### セキュリティ考慮事項

1. **信頼できるネットワークのみで使用**
2. **VPN経由でのアクセス推奨**
3. **本番環境での使用は避ける**
4. **定期的なアクセスログの確認**

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 1. アクセスできない
**症状**: ブラウザでアクセスできない

**解決方法**:
```bash
# ポートが開いているか確認
netstat -tulpn | grep 9003
# または
lsof -i :9003
```

#### 2. ファイアウォールエラー
**症状**: 接続がタイムアウトする

**解決方法**:
- ファイアウォール設定を確認
- ポート9003が開放されているか確認

#### 3. 環境変数エラー
**症状**: アプリケーションが起動しない

**解決方法**:
```bash
# .envファイルの存在確認
ls -la .env

# 環境変数の確認
cat .env
```

#### 4. データベースエラー
**症状**: 検索機能が動作しない

**解決方法**:
```bash
# LanceDBデータの確認
ls -la .lancedb/

# データの再同期
npm run sync:confluence:batch
```

## 📊 パフォーマンス最適化

### キャッシュの活用
- 埋め込みベクトルキャッシュ
- キーワード抽出キャッシュ
- LanceDB接続最適化

### ネットワーク最適化
- 有線接続の使用
- 5GHz Wi-Fiの使用
- ネットワーク帯域の確保

## 🔄 開発ワークフロー

### 1. 開発者A（ホスト）
```bash
# アプリケーションを起動
npm run dev

# 他の開発者にIPアドレスを共有
hostname -I
```

### 2. 開発者B（クライアント）
```bash
# ブラウザでアクセス
http://<開発者AのIP>:9003
```

### 3. 協力開発
- リアルタイムでの画面共有
- 同時テスト実行
- デバッグ情報の共有

## 📱 モバイルアクセス

### スマートフォン・タブレットでのアクセス
1. 同じWi-Fiネットワークに接続
2. ブラウザで `http://<IPアドレス>:9003` にアクセス
3. レスポンシブデザインで最適表示

## 🎯 ベストプラクティス

### 開発環境での使用
- ✅ チーム内での開発・テスト
- ✅ デモンストレーション
- ✅ プロトタイプの共有

### 避けるべき使用場面
- ❌ 本番環境での使用
- ❌ パブリックネットワークでの使用
- ❌ 機密データの取り扱い

## 📞 サポート

### ログの確認
```bash
# アプリケーションログ
npm run dev

# システムログ（Linux）
journalctl -f

# システムログ（Windows）
Get-EventLog -LogName Application -Newest 10
```

### デバッグ情報の収集
```bash
# システム情報
uname -a
node --version
npm --version

# ネットワーク情報
ip addr show
netstat -tulpn
```

## 🔗 関連リンク

- [README.md](../README.md) - 基本的なセットアップ
- [deployment-guide.md](deployment-guide.md) - 本番環境デプロイ
- [performance-optimization.md](performance-optimization.md) - パフォーマンス最適化
