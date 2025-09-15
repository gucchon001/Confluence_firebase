# Confluence Firebase

Confluence のコンテンツを Firebase と LanceDB を使って検索・チャットできるアプリケーション

## 機能

- Confluence ページのベクトル検索
- RAG (Retrieval Augmented Generation) によるチャット応答
- ローカル開発環境のサポート
- Google アカウントによる認証とドメイン制限

## セットアップ

### 前提条件

- Node.js 18 以上
- Firebase CLI
- Firebase プロジェクト
- Confluence API トークン

### 環境変数

`.env` ファイルを作成し、以下の変数を設定:

```
# Firebase設定
FIREBASE_PROJECT_ID=confluence-copilot-xxxx

# 埋め込み設定
EMBEDDINGS_PROVIDER=local  # local / vertex

# Confluence API設定
CONFLUENCE_BASE_URL=https://<your-domain>.atlassian.net
CONFLUENCE_USER_EMAIL=<your-email>
CONFLUENCE_API_TOKEN=<your-api-token>
CONFLUENCE_SPACE_KEY=<your-space-key>

# Vertex AI設定（EMBEDDINGS_PROVIDER=vertex の場合のみ使用）
VERTEX_AI_PROJECT_ID=confluence-copilot-xxxx
VERTEX_AI_LOCATION=asia-northeast1
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004
```

### インストール

```bash
# 依存関係のインストール
npm install

# Firebase 設定
firebase login
firebase use <your-project-id>

# 開発サーバー起動
npm run dev
```

## データ同期

### Confluence データの取得と埋め込み

```bash
# 全データ同期
npm run sync:confluence:batch

# 差分同期
npm run sync:confluence:differential
```

### LanceDB データベースの構築

```bash
# 既存の埋め込みデータをLanceDBに投入
npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
```

## 開発

### ローカル開発サーバー

```bash
npm run dev
```

### テスト

```bash
# 単体テスト
npm test

# E2Eテスト
npm run test:e2e
```

### ビルド

```bash
npm run build
```

## デプロイ

### Firebase へのデプロイ

```bash
# プレビューチャネルへのデプロイ
firebase hosting:channel:deploy preview

# 本番環境へのデプロイ
firebase deploy
```

## アーキテクチャ

### コンポーネント

- **Next.js**: フロントエンド・API
- **Firebase Authentication**: ユーザー認証
- **Firestore**: メタデータ・アクセス制御
- **LanceDB**: ローカルベクトルデータベース
- **GenKit**: 埋め込み生成・LLM統合

### データフロー

1. Confluence API からデータ取得
2. テキスト抽出・チャンク分割
3. 埋め込みベクトル生成（ローカルまたはVertex AI）
4. LanceDB へのベクトル保存
5. Firestore へのメタデータ保存
6. クエリ時にLanceDBで近傍検索→Firestoreでメタデータ取得

## ライセンス

Copyright (c) 2025 Your Company