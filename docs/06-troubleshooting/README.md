# トラブルシューティングガイド

**最終更新**: 2025-11-13  
**対象**: Confluence Firebase RAGシステム全体

## 📋 目次

1. [一般的な問題](#1-一般的な問題)
   - [1.4 `structured_tags`が本番で空](#14-structured_tagsが本番で空)
2. [Firebase App Hosting関連の問題](#2-firebase-app-hosting関連の問題)
3. [データ同期・LanceDB関連の問題](#3-データ同期lancedb関連の問題)
4. [検索・パフォーマンス関連の問題](#4-検索パフォーマンス関連の問題)
5. [環境変数関連の問題](#5-環境変数関連の問題)
6. [ビルド・デプロイ関連の問題](#6-ビルドデプロイ関連の問題)
7. [デバッグ手順](#7-デバッグ手順)
8. [エラーハンドリング仕様](#8-エラーハンドリング仕様)
9. [ログ確認方法](#9-ログ確認方法)
10. [本番環境確認方法](#10-本番環境確認方法)

## 1. 一般的な問題

### 1.1 デプロイ失敗

**症状**: Firebase App Hostingのビルドが失敗する

**確認ポイント**:
- Firebaseビルドログを確認
- ローカルで`npm run build`が成功するか確認

**対処**:
```bash
# ローカルでビルドテスト
npm run build

# エラーが発生した場合は修正
# ビルドが成功したら、Firebase Consoleで再デプロイ
```

### 1.2 検索が遅い

**症状**: 検索結果の取得に時間がかかる

**確認ポイント**:
- インデックスの有無
- `.cache`ダウンロードの状態
- LanceDB接続の状態

**対処**:
```bash
# インデックス確認
npm run check:lancedb-indexes

# インデックス作成
npm run create:lancedb-indexes

# キャッシュ確認
ls -la .cache/
```

### 1.3 StructuredLabelが反映されない

**症状**: FirestoreにStructuredLabelが存在するが、検索結果に反映されない

**確認ポイント**:
- FirestoreとLanceDBの同期状態
- GCS上のLanceDBデータの状態

**対処**:
```bash
# 1. StructuredLabelを生成
npm run generate:structured-labels

# 2. FirestoreからLanceDBに同期
npm run sync:labels-to-lancedb

# 3. 本番環境にアップロード（必須）
npx tsx scripts/upload-production-data.ts

# 4. 検証
npx tsx scripts/verify-production-readiness.ts
```

### 1.4 `structured_tags`が本番で空

**症状**: ローカル環境では`structured_tags`が正しく表示されるが、本番環境では`null`になる

**原因**:
- ローカル環境で`sync-firestore-labels-to-lancedb.ts`を実行したが、その後の`upload-production-data.ts`が実行されていない
- GCS上のLanceDBバンドルが古い（古いバージョンが残っている）
- App Hostingが古いLanceDBバンドルをキャッシュしている

**解決方法**:
1. ローカル環境で`sync-firestore-labels-to-lancedb.ts`を実行
2. **`upload-production-data.ts`を実行してGCSにアップロード**（必須）
   - **注意**: `upload-production-data.ts`は自動的に古いバージョンを削除してからアップロードします
   - 古いバージョンが残っている場合は、手動で`cleanup-lancedb-completely.ts --execute`を実行してからアップロードすることも可能
3. `verify-production-readiness.ts`で検証（すべての項目が合格することを確認）
4. `check-production-lancedb-page703594590.ts`で本番環境のLanceDBデータを確認
5. 必要に応じてApp Hostingの再デプロイ

**予防策**:
- ✅ デプロイ前チェックリストに「LanceDB同期後、GCSへのアップロードを確認」を追加（完了）
- ✅ `verify-production-readiness.ts`で検証を必須化（完了）
- ✅ `upload-production-data.ts`に自動クリーンアップ機能を追加（完了）
- ✅ バージョン管理のドキュメントを作成（完了）

### 1.5 古いバージョンがGCSに残る

**症状**: GCS上に古いLanceDBバージョンが残っている

**確認ポイント**:
- GCS上のファイル数を確認
- `upload-production-data.ts`の自動クリーンアップ機能が動作しているか確認

**対処**:
- `upload-production-data.ts`が自動的に削除（改善済み）
- 手動削除が必要な場合は`cleanup-lancedb-completely.ts --execute`を実行

### 1.6 BOM関連のエラー

**症状**: BOM文字（U+FEFF）が原因でエラーが発生する

**確認ポイント**:
- ログで`[BOM REMOVED]`が出ているか確認

**対処**:
```bash
# データを再同期
npm run sync:confluence:batch

# データを再アップロード
npx tsx scripts/upload-production-data.ts
```

## 2. Firebase App Hosting関連の問題

### 2.1 `FirebaseError: Firebase: Error (auth/invalid-api-key)`

**症状**:
```
Error occurred prerendering page "/login"
FirebaseError: Firebase: Error (auth/invalid-api-key)
```

**原因**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`環境変数が設定されていない
- 環境変数の値が間違っている
- ビルド時に環境変数が利用可能になっていない

**解決方法**:

1. **apphosting.yaml の確認**
   ```yaml
   env:
     - variable: NEXT_PUBLIC_FIREBASE_API_KEY
       value: AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI
       availability:
         - BUILD      # ← これが重要
         - RUNTIME
   ```

2. **ビルドログの確認**
   Firebase Consoleのビルドログで以下が表示されているか確認：
   ```
   env:
   - variable: NEXT_PUBLIC_FIREBASE_API_KEY
     value: AIzaSy...
   ```
   表示されていない場合は、YAML構造が間違っています。

3. **正しい構造に修正**
   ```yaml
   runConfig:
     cpu: 2
   
   env:              # ← runConfigと同じレベル
     - variable: NEXT_PUBLIC_FIREBASE_API_KEY
       value: your-api-key
       availability:
         - BUILD
         - RUNTIME
   ```

### 2.2 環境変数が適用されない

**症状**:
- ビルドログに`FIREBASE_CONFIG`と`FIREBASE_WEBAPP_CONFIG`のみが表示される
- カスタム環境変数（`NEXT_PUBLIC_*`）が表示されない

**原因**:
`env:`が`runConfig:`の**内部にネスト**されている

**解決方法**:

**間違った構造（❌）:**
```yaml
runConfig:
  cpu: 2
  env:            # ← runConfigの内部（間違い）
    - variable: NAME
      value: VALUE
```

**正しい構造（✅）:**
```yaml
runConfig:
  cpu: 2

env:              # ← runConfigと同じレベル（正しい）
  - variable: NAME
    value: VALUE
```

### 2.3 シークレットが見つからない

**症状**:
- ビルドが失敗する
- 環境変数が一切表示されない
- シークレット参照エラー

**原因**:
`apphosting.yaml`でシークレットを参照しているが、Secret Managerにシークレットが存在しない

**解決方法**:

1. **シークレットの存在確認**
   ```bash
   gcloud secrets list --project=confluence-copilot-ppjye
   ```

2. **シークレットの作成**
   ```powershell
   # PowerShell
   $env:GEMINI_API_KEY = "your-actual-key"
   $env:CONFLUENCE_API_TOKEN = "your-actual-token"
   .\scripts\setup-firebase-secrets.ps1
   ```

3. **apphosting.yaml の修正**
   
   シークレットが作成されるまで、一時的にシークレット参照を削除：
   ```yaml
   # シークレット作成前（一時的）
   env:
     - variable: NEXT_PUBLIC_FIREBASE_API_KEY
       value: your-value    # 直接指定
       availability:
         - BUILD
         - RUNTIME
   ```
   
   シークレット作成後：
   ```yaml
   # シークレット作成後
   env:
     - variable: GEMINI_API_KEY
       secret: gemini_api_key    # Secret Manager参照
       availability:
         - BUILD
         - RUNTIME
   ```

### 2.4 `/login`ページのプリレンダリングエラー

**症状**:
```
Error occurred prerendering page "/login"
Export encountered an error on /login/page: /login
```

**原因**:
Next.js 15で`/login`ページが静的生成されようとしているが、Firebase Authが初期化されてエラーになる

**解決方法**:

**src/app/login/page.tsx に追加:**
```typescript
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

**src/app/page.tsx にも追加:**
```typescript
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

### 2.5 `apphosting.yaml`が認識されない

**症状**:
- ビルドログにカスタム設定が表示されない
- デフォルト設定でビルドされる

**原因**:
`apphosting.yaml`がプロジェクトルートに配置されていない

**解決方法**:

1. **ファイルの配置確認**
   ```bash
   # プロジェクトルートに配置されているか確認
   ls apphosting.yaml
   ```

2. **配置されていない場合**
   ```bash
   # setup/ から移動
   cp setup/apphosting.yaml apphosting.yaml
   git add apphosting.yaml
   git commit -m "fix: move apphosting.yaml to project root"
   git push
   ```

## 3. データ同期・LanceDB関連の問題

### 3.1 LanceDB接続エラー

**症状**: LanceDBに接続できない

**確認ポイント**:
- ファイルシステムの状態
- ファイルパスの設定
- 権限の問題

**対処**:
```bash
# ローカル環境で確認
ls -la .lancedb/

# 本番環境のログを確認
# Cloud Loggingで以下を検索:
# "OptimizedLanceDBClient.*Connecting"
```

詳細は [本番環境確認ガイド](./production-environment-check-guide.md) を参照してください。

### 3.2 データ同期が失敗する

**症状**: FirestoreからLanceDBへの同期が失敗する

**確認ポイント**:
- Firestoreの接続状態
- データの整合性
- スクリプトの実行ログ

**対処**:
```bash
# 同期スクリプトを実行
npx tsx scripts/sync-firestore-labels-to-lancedb.ts

# エラーログを確認
# 必要に応じて再実行
```

### 3.3 スキーマの不一致

**症状**: スキーマが期待と異なる

**確認ポイント**:
- LanceDBのスキーマ定義
- Firestoreのデータ構造
- データ変換ロジック

**対処**:
```bash
# スキーマを確認
npx tsx scripts/check-lancedb-schema.ts

# スキーマを再作成
npx tsx scripts/create-lancedb-indexes.ts
```

## 4. 検索・パフォーマンス関連の問題

### 4.1 検索結果が正しくない

**症状**: 期待する検索結果が表示されない

**確認ポイント**:
- インデックスの状態
- 検索クエリの構文
- スコアリングロジック

**対処**:
```bash
# 検索結果をデバッグ
npx tsx scripts/debug-search-query.ts "検索クエリ"

# インデックスを再作成
npm run create:lancedb-indexes
```

### 4.2 検索が遅い

**症状**: 検索結果の取得に時間がかかる

**確認ポイント**:
- インデックスの有無
- データ量
- クエリの複雑さ

**対処**:
```bash
# インデックスを確認
npm run check:lancedb-indexes

# インデックスを作成
npm run create:lancedb-indexes

# パフォーマンスを測定
npx tsx scripts/measure-search-performance.ts
```

## 5. 環境変数関連の問題

### 5.1 GitHub ActionsでFirebaseクライアント側の環境変数エラーが発生する

**症状**:
```
Error: 必須環境変数が設定されていませんまたは無効です:
  - NEXT_PUBLIC_FIREBASE_API_KEY: Required
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Required
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID: Required
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: Required
  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: Required
  - NEXT_PUBLIC_FIREBASE_APP_ID: Required
```

**原因**:
- スクリプト実行時にFirebaseクライアント側の環境変数が必須として検証されている（古いバージョンの可能性）
- `src/config/app-config.ts` が最新でない

**解決方法**:
1. 最新のコードをプルして、`src/config/app-config.ts` が最新であることを確認
2. スクリプト実行時は `process.env.NEXT_RUNTIME` が未設定のため、Firebaseクライアント側の環境変数は自動的にオプションとして扱われます
3. GitHub Actionsワークフローでは、Firebaseクライアント側の環境変数を設定する必要はありません

**詳細**: [環境設定戦略](../01-architecture/01.04.01-environment-configuration-strategy.md) を参照してください。

### 5.2 スクリプト実行時にFirebase設定が空文字列になる

**症状**: スクリプト実行時に `appConfig.firebase.projectId` が空文字列になる

**原因**: これは正常な動作です。スクリプト実行時にはFirebaseクライアント側の環境変数がオプションのため、値が設定されていない場合は空文字列になります。

**対処方法**: 
- スクリプト実行時にFirebase設定が必要な場合は、環境変数を設定してください
- 通常、バッチスクリプトではFirebaseクライアント側の設定は不要です

**詳細**: [環境設定戦略](../01-architecture/01.04.01-environment-configuration-strategy.md) を参照してください。

---

## 6. ビルド・デプロイ関連の問題

### 6.1 ビルドが失敗する

**症状**: ローカルビルドまたはFirebase App Hostingのビルドが失敗する

**確認ポイント**:
- 環境変数の設定
- 依存関係のインストール
- TypeScriptのエラー

**対処**:
```bash
# ローカルでビルドテスト
npm run build

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScriptのエラーを確認
npm run typecheck
```

### 6.2 デプロイが失敗する

**症状**: Firebase App Hostingへのデプロイが失敗する

**確認ポイント**:
- ビルドログの確認
- 環境変数の設定
- `apphosting.yaml`の設定

**対処**:
```bash
# Firebase Consoleでビルドログを確認
# エラーメッセージを確認して修正

# 環境変数を確認
# apphosting.yamlの設定を確認
```

## 7. デバッグ手順

### 6.1 ローカルビルドテスト

```powershell
# 環境変数を設定
$env:NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="confluence-copilot-ppjye.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="confluence-copilot-ppjye"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="confluence-copilot-ppjye.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="122015916118"
$env:NEXT_PUBLIC_FIREBASE_APP_ID="1:122015916118:web:50d117434b1318f173dbf7"

# ビルド実行
npm run build
```

ローカルで成功すれば、環境変数は正しく設定されています。

### 6.2 apphosting.yaml の構文チェック

```bash
# ファイルの存在確認
ls apphosting.yaml

# 構造確認（最初の30行）
Get-Content apphosting.yaml -Head 30

# env: が runConfig: と同じレベルにあることを確認
```

### 6.3 Firebase CLI で設定確認

```bash
# ログイン状態確認
firebase login:list

# プロジェクト確認
firebase projects:list

# バックエンド確認
firebase apphosting:backends:list --project confluence-copilot-ppjye
```

### 6.4 Secret Manager 確認

```bash
# シークレット一覧
gcloud secrets list --project=confluence-copilot-ppjye

# 期待されるシークレット:
# - gemini_api_key
# - confluence_api_token
# - firebase_service_account_key
```

### 6.5 ビルドログの詳細確認

Firebase Console → App Hosting → `confluence-chat` → 最新ビルド → ログ

**確認ポイント:**
1. `env:`セクションが表示されているか
2. `NEXT_PUBLIC_*`変数が表示されているか
3. エラーメッセージの詳細

## 8. エラーハンドリング仕様

詳細は [エラーハンドリング仕様書](../implementation/error-handling.md) を参照してください。

### 7.1 主要エラーケース

| エラーケース | 発生トリガー | バックエンドの対応 | フロントエンドの対応 |
|------------|------------|-----------------|-------------------|
| 認証トークン無効 | IDトークンの有効期限切れ、不正なトークン | HTTP 401 Unauthorized | ログイン画面へリダイレクト |
| Confluence APIエラー | APIからのタイムアウト、メンテナンス | HTTP 503 Service Unavailable | エラーメッセージを表示 |
| LLM APIエラー | APIからのタイムアウト、コンテンツフィルタ | HTTP 503 Service Unavailable | エラーメッセージを表示 |
| ベクトル検索エラー | ベクトルDBの障害、インデックスの問題 | HTTP 500 Internal Server Error | 汎用エラーメッセージを表示 |
| DB書き込みエラー | Firestoreへの書き込み失敗 | HTTP 500 Internal Server Error | トーストメッセージを表示 |

### 7.2 リトライポリシー

| エラータイプ | 最大リトライ回数 | 初期待機時間 | バックオフ係数 | 最大待機時間 |
|------------|---------------|------------|------------|------------|
| 一時的なネットワークエラー | 5 | 1秒 | 2 | 32秒 |
| API制限エラー | 3 | 5秒 | 2 | 20秒 |
| ペイロードサイズエラー | 2 | 0秒 | - | - |
| 認証エラー | 0 | - | - | - |

## 9. ログ確認方法

詳細は [Cloud Logging確認コマンド集](./cloud-logging-check-commands.md) を参照してください。

### 8.1 Cloud Loggingにアクセス

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

### 8.2 主要なログクエリ

#### ベクトル検索エラーを確認
```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Vector Search.*Error"
timestamp>="2025-11-01T00:00:00Z"
```

#### LanceDB接続ログを確認
```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"OptimizedLanceDBClient.*Connecting"
timestamp>="2025-11-01T00:00:00Z"
```

#### すべてのエラーを確認
```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
severity>=ERROR
timestamp>="2025-11-01T00:00:00Z"
```

## 10. 本番環境確認方法

詳細は [本番環境確認ガイド](./production-environment-check-guide.md) を参照してください。

### 9.1 ファイルシステム確認

- `.lancedb/`ディレクトリが存在する
- `.lancedb/confluence.lance/`ディレクトリが存在する
- ファイルサイズが0バイトではない
- 必要な全ファイルが存在する

### 9.2 ライブラリバージョン確認

- `@lancedb/lancedb`がインストールされている
- バージョンが`0.22.1`である（ローカルと一致）
- `package-lock.json`と一致している

### 9.3 スキーマ確認

- テーブル`confluence`が存在する
- `vector`列が存在する
- ベクトル次元数が768である
- データレコード数が1,229件である

## 11. 問題が解決しない場合の対処

### 10.1 安定版に戻す

```bash
# タグから安定版をチェックアウト
git checkout v1.0.0-stable

# 確認
git log --oneline -1

# プッシュ
git push origin main --force
```

**⚠️ 注意**: `--force`は他の開発者に影響を与える可能性があります。

### 10.2 クリーンビルド

```bash
# ローカルのビルドキャッシュをクリア
npm run clean
rm -rf .next

# node_modules を再インストール
rm -rf node_modules
npm ci

# 再ビルド
npm run build
```

### 10.3 Firebase Console で手動デプロイ

1. Firebase Console → App Hosting
2. `confluence-chat`バックエンドを選択
3. 「設定」→「ビルドをトリガー」
4. ブランチを選択して再ビルド

## 12. トラブルシューティングチェックリスト

問題が発生したら、以下を順番に確認してください：

- [ ] `apphosting.yaml`がプロジェクトルートにある
- [ ] `env:`が`runConfig:`と同じレベル（トップレベル）にある
- [ ] `NEXT_PUBLIC_*`変数の`availability`に`BUILD`が含まれている
- [ ] シークレットがSecret Managerに存在している
- [ ] 認証ページに`export const dynamic = 'force-dynamic'`が設定されている
- [ ] ローカルビルドが成功する
- [ ] 最新のコミットがプッシュされている
- [ ] LanceDBデータがGCSに正しくアップロードされている
- [ ] インデックスが正しく作成されている
- [ ] ログにエラーが表示されていない

すべてチェックしても問題が解決しない場合は、安定版（v1.0.0-stable）に戻してください。

## 13. 関連ドキュメント

- [デプロイガイド](../04-operations/04.01-deployment-guide.md)
- [環境変数設定ガイド](../04-operations/04.13-environment-variables.md)
- [環境設定戦略](../01-architecture/01.04.01-environment-configuration-strategy.md)
- [エラーハンドリング仕様書](../implementation/error-handling.md)
- [Cloud Logging確認コマンド集](./cloud-logging-check-commands.md)
- [本番環境確認ガイド](./production-environment-check-guide.md)
- [Firebase App Hosting設定](../04-operations/04.01-deployment-guide.md#3-firebase-app-hosting設定)

## 14. サポート

### 公式ドキュメント
- [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)
- [構成ガイド](https://firebase.google.com/docs/app-hosting/configure?hl=ja)
- [Next.js ドキュメント](https://nextjs.org/docs)

### コミュニティサポート
- [Firebase サポート](https://firebase.google.com/support)
- [Stack Overflow (firebase タグ)](https://stackoverflow.com/questions/tagged/firebase)
- [Next.js GitHub](https://github.com/vercel/next.js)

---

**最終更新**: 2025-11-13

