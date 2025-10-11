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

### Firebase App Hosting

**推奨**: Firebase App Hosting を使用した自動デプロイ

詳細は以下のドキュメントを参照：
- [Firebase App Hosting 構成ガイド](./docs/operations/firebase-app-hosting-configuration.md)
- [トラブルシューティング](./docs/operations/firebase-app-hosting-troubleshooting.md)

**クイックスタート:**
```bash
# 1. apphosting.yaml がプロジェクトルートにあることを確認
ls apphosting.yaml

# 2. シークレットの作成
.\scripts\setup-firebase-secrets.ps1

# 3. Git push で自動デプロイ
git push
```

### Firebase Hosting（従来の方法）

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

## 📚 ドキュメント

### 🚀 将来計画
- [**基盤強化優先戦略**](./docs/architecture/foundation-first-strategy.md) 🔥 **推奨** - ラベル拡張+Knowledge Graph構築（横断拡張の前に）
- [**Genkit移行と拡張ロードマップ**](./docs/architecture/genkit-migration-and-expansion-roadmap.md) ⭐ - 6.5ヶ月計画（Jira・マニュアル・BigQuery連携）

### 運用ガイド
- [データ同期戦略と定期実行スケジュール](./docs/operations/data-synchronization-strategy.md) - 自動同期の設定と更新戦略
- [Firebase App Hosting 構成ガイド](./docs/operations/firebase-app-hosting-configuration.md) - App Hostingの正しい構成方法
- [必須環境変数一覧](./docs/operations/required-environment-variables.md) - 環境変数の完全なリスト
- [トラブルシューティング](./docs/operations/firebase-app-hosting-troubleshooting.md) - よくあるエラーと解決方法

### アーキテクチャ
- [アーキテクチャドキュメント](./docs/architecture/) - システム設計とコンポーネント

### 実装ガイド
- [実装ドキュメント](./docs/implementation/) - 各機能の実装詳細

### テスト
- [テストドキュメント](./docs/testing/) - テスト戦略とテストケース

## 🏷️ 安定版情報

**現在の安定版**: v1.0.0-stable  
**コミット**: a54662bf  
**リリース日**: 2025-10-10

問題が発生した場合は、この安定版に戻すことができます：
```bash
git checkout v1.0.0-stable
```

## ライセンス

Copyright (c) 2025 Your Company