# ローカル開発環境ガイド

## 概要

このドキュメントでは、Confluence Firebase アプリケーションをローカル環境で起動・開発する手順を説明します。

## 前提条件

- Node.js 18 以上
- npm または yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Git

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd Confluence_firebase
```

### 2. 依存関係のインストール

```bash
# ルートディレクトリ
npm install

# Functions ディレクトリ（必要に応じて）
cd functions
npm install
cd ..
```

### 3. 環境変数の設定

`.env.local` ファイルを作成し、以下の変数を設定：

```env
# Firebase設定
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# 埋め込み設定
EMBEDDINGS_PROVIDER=local  # local または vertex

# Confluence API設定
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=your-space-key

# LLM設定（RAG機能用）
GEMINI_API_KEY=your-gemini-api-key
USE_LLM_EXPANSION=true

# Vertex AI設定（EMBEDDINGS_PROVIDER=vertex の場合）
VERTEX_AI_PROJECT_ID=your-project-id
VERTEX_AI_LOCATION=asia-northeast1
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004
```

### 4. Firebase の設定

```bash
# Firebase CLI にログイン
firebase login

# プロジェクトを選択
firebase use your-project-id

# サービスアカウントキーを配置
# keys/firebase-adminsdk-key.json に配置
```

## ローカル起動手順

### 1. 開発サーバーの起動

```bash
# Next.js 開発サーバー（ポート 9003）
npm run dev

# または GenKit 開発サーバー（RAG機能用）
npm run genkit:dev
```

### 2. データの準備

#### Confluence データの同期

```bash
# 全データ同期
npm run sync:confluence:batch

# 差分同期
npm run sync:confluence:differential
```

#### LanceDB の初期化

```bash
# 既存の埋め込みデータをLanceDBに投入
npx tsx src/scripts/lancedb-load-simple.ts
```

### 3. 動作確認

#### 基本的な検索テスト

```bash
# ハイブリッド検索のテスト
npx tsx src/scripts/test-hybrid-search.ts

# RAG機能のテスト
npx tsx src/scripts/run-rag.ts "教室管理の仕様は"
```

#### ブラウザでの確認

1. http://localhost:9003 にアクセス
2. ログイン機能をテスト
3. 検索機能をテスト

## 開発用スクリプト

### 検索・RAG関連

```bash
# キーワード抽出のテスト
npx tsx src/scripts/test-llm-extract.ts

# ベクトル検索のテスト
npx tsx src/scripts/test-vector-search.ts

# RAG機能のテスト
npx tsx src/scripts/test-rag.ts

# 特定クエリでのRAG実行
npx tsx src/scripts/run-rag.ts "急募機能の詳細"
```

### デバッグ用

```bash
# 教室管理関連ページの検索デバッグ
npx tsx src/scripts/debug-classroom-search.ts

# 特定ページの詳細分析
npx tsx src/scripts/debug-512-page.ts

# BM25検索のデバッグ
npx tsx src/scripts/debug-bm25-search.ts
```

### データ同期関連

```bash
# 特定ページの同期
npx tsx src/scripts/sync-specific-page.ts

# バッチ同期の実行
npx tsx src/scripts/batch-sync-confluence.ts
```

## トラブルシューティング

### よくある問題

#### 1. 型エラーが発生する

```bash
# 型チェックを実行
npm run typecheck

# ビルドを実行して詳細なエラーを確認
npm run build
```

#### 2. LanceDB の接続エラー

- `.lancedb` ディレクトリが存在することを確認
- データが正しく同期されていることを確認

#### 3. Confluence API エラー

- API トークンが有効であることを確認
- ネットワーク接続を確認
- レート制限に引っかかっていないか確認

#### 4. LLM 機能が動作しない

- `GEMINI_API_KEY` が正しく設定されているか確認
- `USE_LLM_EXPANSION=true` が設定されているか確認

### ログの確認

```bash
# アプリケーションログ
npm run dev

# Firebase Functions ログ
firebase functions:log

# 同期ログ
ls logs/
```

## 開発時の注意点

### 1. データベース

- LanceDB はローカルファイルベースです
- `.lancedb` ディレクトリは Git に含めないでください
- 開発時は定期的にデータを同期してください

### 2. 環境変数

- `.env.local` は Git に含めないでください
- 本番環境では適切な環境変数を設定してください

### 3. 依存関係

- `tiny-segmenter` は日本語形態素解析に必要です
- `kuromoji` はより高度な日本語解析に使用されます

### 4. パフォーマンス

- 大量のデータを同期する場合は時間がかかります
- 開発時は差分同期を使用することを推奨します

## 次のステップ

ローカル環境での動作確認が完了したら、以下を検討してください：

1. **本番環境へのデプロイ**: `docs/deployment-guide.md` を参照
2. **パフォーマンスチューニング**: `docs/search-tuning-plan.md` を参照
3. **機能拡張**: 新しい検索機能やRAG機能の追加

## 参考資料

- [Next.js ドキュメント](https://nextjs.org/docs)
- [Firebase ドキュメント](https://firebase.google.com/docs)
- [LanceDB ドキュメント](https://lancedb.github.io/lancedb/)
- [GenKit ドキュメント](https://firebase.google.com/docs/genkit)
