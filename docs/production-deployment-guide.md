# 本番環境デプロイガイド

## 概要

Confluence Firebase アプリケーションを本番環境にデプロイする手順を説明します。

## 前提条件

### 1. 環境準備
- Firebase CLI がインストール済み
- Firebase プロジェクトが作成済み
- サービスアカウントキーが準備済み
- 本番環境用の環境変数が設定済み

### 2. 必要な権限
- Firebase プロジェクトの管理者権限
- Cloud Functions のデプロイ権限
- Cloud Storage のアクセス権限

## デプロイ手順

### 1. 事前チェック

#### ビルド確認
```bash
# TypeScript の型チェック
npm run typecheck

# Next.js アプリケーションのビルド
npm run build

# Functions のビルド
cd functions
npm run build
cd ..
```

#### 環境変数確認
```bash
# 本番環境用の環境変数が設定されているか確認
firebase functions:config:get
```

### 2. Firebase の設定

#### プロジェクトの選択
```bash
# 本番環境のプロジェクトを選択
firebase use production-project-id

# 設定の確認
firebase projects:list
```

#### 環境変数の設定
```bash
# Functions の環境変数を設定
firebase functions:config:set \
  confluence.base_url="https://your-domain.atlassian.net" \
  confluence.user_email="your-email@example.com" \
  confluence.api_token="your-api-token" \
  confluence.space_key="your-space-key" \
  gemini.api_key="your-gemini-api-key" \
  embeddings.provider="local" \
  app.use_llm_expansion="true"
```

### 3. デプロイ実行

#### Functions のデプロイ
```bash
cd functions
npm ci
npm run deploy
cd ..
```

#### Hosting のデプロイ
```bash
firebase deploy --only hosting
```

#### 全体デプロイ（推奨）
```bash
firebase deploy
```

### 4. デプロイ後の確認

#### アプリケーションの動作確認
1. 本番URLにアクセス
2. ログイン機能のテスト
3. 検索機能のテスト
4. RAG機能のテスト

#### ログの確認
```bash
# Functions のログを確認
firebase functions:log

# リアルタイムログの監視
firebase functions:log --follow
```

## 本番環境の設定

### 1. 環境変数

#### 必須設定
```env
# Firebase設定
FIREBASE_PROJECT_ID=production-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@production-project-id.iam.gserviceaccount.com

# Confluence API設定
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=your-space-key

# LLM設定
GEMINI_API_KEY=your-gemini-api-key
USE_LLM_EXPANSION=true

# 埋め込み設定
EMBEDDINGS_PROVIDER=local
```

#### 推奨設定
```env
# パフォーマンス設定
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# セキュリティ設定
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-production-domain.com
```

### 2. データベース設定

#### LanceDB の永続化
- Cloud Storage にベクトルデータを保存
- 定期的なバックアップの設定
- データの整合性チェック

#### Firestore の設定
- セキュリティルールの適用
- インデックスの最適化
- バックアップの設定

### 3. セキュリティ設定

#### 認証設定
- ドメイン制限の適用
- セッション有効期限の設定
- 不正アクセスの監視

#### API 制限
- レート制限の設定
- IP制限の適用
- ログ監視の設定

## 監視・運用

### 1. パフォーマンス監視

#### メトリクス
- レスポンス時間
- エラー率
- スループット
- リソース使用量

#### アラート設定
- エラー率の閾値
- レスポンス時間の閾値
- リソース使用量の閾値

### 2. ログ監視

#### アプリケーションログ
- 検索クエリのログ
- エラーログ
- パフォーマンスログ

#### システムログ
- Firebase Functions のログ
- Cloud Storage のログ
- ネットワークログ

### 3. バックアップ・復旧

#### データバックアップ
- 日次バックアップの設定
- ベクトルデータのバックアップ
- 設定ファイルのバックアップ

#### 復旧手順
- データベースの復旧
- アプリケーションの復旧
- 設定の復旧

## トラブルシューティング

### よくある問題

#### 1. デプロイエラー
- 権限不足
- 環境変数の設定ミス
- ビルドエラー

#### 2. 動作エラー
- 環境変数の未設定
- データベース接続エラー
- API キーの無効

#### 3. パフォーマンス問題
- メモリ不足
- データベースの負荷
- ネットワーク遅延

### 解決手順

1. ログの確認
2. 環境変数の再確認
3. 権限の確認
4. リソースの確認
5. 設定の再適用

## ロールバック手順

### 緊急時のロールバック

```bash
# 前のバージョンにロールバック
firebase hosting:channel:deploy previous-version

# Functions のロールバック
firebase functions:rollback
```

### 段階的ロールバック

1. トラフィックの段階的移行
2. 機能の無効化
3. データの復旧
4. 設定の復旧

## メンテナンス

### 定期メンテナンス

#### 週次
- ログの確認
- パフォーマンスの確認
- エラーの確認

#### 月次
- セキュリティの確認
- バックアップの確認
- 依存関係の更新

#### 四半期
- アーキテクチャの見直し
- パフォーマンスの最適化
- セキュリティの強化

## 参考資料

- [Firebase デプロイガイド](https://firebase.google.com/docs/hosting/quickstart)
- [Cloud Functions デプロイガイド](https://firebase.google.com/docs/functions/manage-functions)
- [セキュリティガイド](https://firebase.google.com/docs/security)
- [監視ガイド](https://firebase.google.com/docs/monitoring)
