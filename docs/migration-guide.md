# リポジトリ移管ガイド

このドキュメントでは、Confluence Firebaseプロジェクトを他環境に移管する際の手順を説明します。

## 📋 移管前の準備

### 1. 必要なファイルの確認

#### 必須ファイル
- [ ] `package.json` - 依存関係とスクリプト
- [ ] `package-lock.json` - 依存関係のロックファイル
- [ ] `next.config.ts` - Next.js設定
- [ ] `tsconfig.json` - TypeScript設定
- [ ] `tailwind.config.ts` - Tailwind CSS設定
- [ ] `components.json` - UI コンポーネント設定
- [ ] `firebase.json` - Firebase設定
- [ ] `firestore.rules` - Firestoreルール
- [ ] `firestore.indexes.json` - Firestoreインデックス
- [ ] `.env.example` - 環境変数テンプレート

#### セットアップスクリプト
- [ ] `setup-network-share.sh` - Linux/macOS用セットアップ
- [ ] `setup-network-share.ps1` - Windows用セットアップ

#### ドキュメント
- [ ] `README.md` - プロジェクト概要
- [ ] `docs/` ディレクトリ内の全ファイル

### 2. 除外すべきファイル

#### 一時ファイル・テストファイル
- ルートディレクトリの `*.ts` ファイル（テストスクリプト）
- `*test*.ts` ファイル
- `debug-*.ts` ファイル
- `analyze-*.ts` ファイル
- `performance-*.json` ファイル
- `*.txt` ログファイル

#### データファイル
- `.lancedb/` ディレクトリ（データベース）
- `.cache/` ディレクトリ（キャッシュ）
- `logs/` ディレクトリ（ログファイル）
- `data/` ディレクトリ（同期データ）

#### 環境固有ファイル
- `.env` ファイル（実際の環境変数）
- `keys/` ディレクトリ（秘密鍵）

## 🚀 移管手順

### Step 1: クリーンアップ

```bash
# 一時ファイルの削除
rm -f *.ts
rm -f *.txt
rm -f *.json
rm -rf test-results/
rm -rf logs/

# データファイルの削除
rm -rf .lancedb/
rm -rf .cache/
rm -rf data/

# 環境固有ファイルの削除
rm -f .env
rm -rf keys/
```

### Step 2: リポジトリの準備

```bash
# Gitリポジトリの初期化
git init
git add .
git commit -m "Initial commit: Clean project structure"
```

### Step 3: 移管先でのセットアップ

```bash
# リポジトリのクローン
git clone <repository-url>
cd Confluence_firebase

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集

# データの同期
npm run sync:confluence:batch

# アプリケーションの起動
npm run dev
```

## 📁 推奨ディレクトリ構造

```
Confluence_firebase/
├── src/                    # ソースコード
├── docs/                   # ドキュメント
├── config/                 # 設定ファイル
├── .env.example           # 環境変数テンプレート
├── setup-network-share.*  # セットアップスクリプト
├── package.json           # 依存関係
├── README.md              # プロジェクト概要
└── docs/
    ├── migration-guide.md
    ├── network-sharing-guide.md
    └── deployment-guide.md
```

## ⚠️ 注意事項

### セキュリティ
- 秘密鍵やAPIトークンは含めない
- 環境変数は `.env.example` のみ
- 本番データは含めない

### パフォーマンス
- キャッシュファイルは再生成される
- データベースは再構築が必要
- 初回起動時は時間がかかる

### 互換性
- Node.js 18以上が必要
- 同じOS環境での移管を推奨
- 依存関係のバージョンに注意

## 🔧 トラブルシューティング

### よくある問題

#### 1. 依存関係エラー
```bash
# node_modulesを削除して再インストール
rm -rf node_modules
npm install
```

#### 2. 環境変数エラー
```bash
# .envファイルの確認
cat .env
# 必要な環境変数が設定されているか確認
```

#### 3. データベースエラー
```bash
# LanceDBデータの再構築
npm run sync:confluence:batch
```

## 📞 サポート

移管で問題が発生した場合は、以下を確認してください：

1. Node.js のバージョン（18以上）
2. 環境変数の設定
3. ネットワーク接続
4. 依存関係のインストール

詳細な情報は `docs/` ディレクトリ内のドキュメントを参照してください。
