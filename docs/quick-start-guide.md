# クイックスタートガイド

## 5分でローカル環境を起動

このガイドでは、Confluence Firebase アプリケーションを最短時間でローカル環境で起動する手順を説明します。

## 前提条件

- Node.js 18 以上
- Firebase CLI
- Git

## 手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd Confluence_firebase
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルを作成：

```env
# 最小限の設定
FIREBASE_PROJECT_ID=your-project-id
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=your-space-key
GEMINI_API_KEY=your-gemini-api-key
USE_LLM_EXPANSION=true
```

### 4. Firebase の設定

```bash
firebase login
firebase use your-project-id
```

### 5. データの準備

```bash
# Confluence データの同期
npm run sync:confluence:batch

# LanceDB の初期化
npx tsx src/scripts/lancedb-load-simple.ts
```

### 6. アプリケーションの起動

```bash
npm run dev
```

### 7. ブラウザで確認

http://localhost:9003 にアクセス

## 動作確認

### 基本的な検索テスト

```bash
# RAG機能のテスト
npx tsx src/scripts/run-rag.ts "教室管理の仕様は"
```

### ブラウザでのテスト

1. ログイン機能
2. 検索機能
3. RAG機能

## トラブルシューティング

### よくある問題

#### 1. 環境変数エラー
- `.env.local` ファイルが正しく作成されているか確認
- 必要な環境変数がすべて設定されているか確認

#### 2. Firebase エラー
- `firebase login` が完了しているか確認
- プロジェクトIDが正しいか確認

#### 3. Confluence API エラー
- API トークンが有効か確認
- ネットワーク接続を確認

#### 4. LanceDB エラー
- データが正しく同期されているか確認
- `.lancedb` ディレクトリが存在するか確認

## 次のステップ

ローカル環境での動作確認が完了したら：

1. [ローカル開発ガイド](local-development-guide.md) を参照
2. [実装状況](current-implementation-status.md) を確認
3. 本番環境へのデプロイを検討

## サポート

問題が発生した場合：

1. ログを確認
2. 環境変数を再確認
3. 依存関係を再インストール
4. ドキュメントを参照

詳細な情報は [ローカル開発ガイド](local-development-guide.md) を参照してください。
