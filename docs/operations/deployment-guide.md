# デプロイガイド

**最終更新**: 2025-11-13  
**統合済みドキュメント**: 
- `production-deployment-checklist.md` - デプロイチェックリスト
- `production-schema-verification-guide.md` - スキーマ確認ガイド
- `production-deployment-after-db-rebuild.md` - DB再構築後手順
- `firebase-app-hosting-configuration.md` - Firebase App Hosting設定
- `firebase-app-hosting-troubleshooting.md` - Firebase App Hostingトラブルシューティング
- `required-environment-variables.md` - 必須環境変数一覧
- `build-optimization-guide.md` - ビルド最適化ガイド

このドキュメントは Confluence 仕様書要約チャットボットの本番デプロイ手順を集約したものです。従来のチェックリストやスキーマ確認ガイド、DB再構築後手順、Firebase App Hosting設定、トラブルシューティングガイド、環境変数一覧、ビルド最適化ガイドはすべて本ドキュメントに統合しました。

**注意**: 上記の統合済みドキュメントは履歴目的で保持されていますが、最新の情報は本ドキュメントを参照してください。

---

## 1. 前提条件

- Node.js v20 以上
- Firebase CLI / gcloud CLI が利用可能
- Firebase Project（`confluence-copilot-ppjye`）へのアクセス権
- Google Cloud Storage バケット `confluence-copilot-data`
- サービスアカウントキー（`keys/firebase-adminsdk-key.json`）
- 必要データ（LanceDB、StructuredLabel、ドメイン知識、Lunrキャッシュ）がローカルに存在

---

## 2. 必須の環境変数

### 2.1 環境変数の分類

環境変数は、**ビルド時（BUILD）**と**ランタイム（RUNTIME）**で必要なものに分かれます。

| 分類 | タイミング | 説明 |
|------|-----------|------|
| **BUILD** | ビルド時のみ | Next.jsのビルド時に必要。ビルド結果に静的に埋め込まれる |
| **RUNTIME** | ランタイムのみ | アプリケーション実行時に必要。ビルド時には不要 |
| **BUILD + RUNTIME** | 両方 | ビルド時とランタイムの両方で必要 |

### 2.2 Firebase（クライアント） - BUILD + RUNTIME

**重要**: `NEXT_PUBLIC_*` 変数は、クライアントサイドで使用されるため、**BUILD と RUNTIME 両方**で利用可能にする必要があります。

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=confluence-copilot-ppjye.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=confluence-copilot-ppjye
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=confluence-copilot-ppjye.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=122015916118
NEXT_PUBLIC_FIREBASE_APP_ID=1:122015916118:web:50d117434b1318f173dbf7
NEXT_PUBLIC_USE_MOCK_DATA=false
```

### 2.3 Google Cloud - BUILD + RUNTIME

```bash
GOOGLE_CLOUD_PROJECT=confluence-copilot-ppjye
```

### 2.4 Confluence API - RUNTIME のみ

```bash
CONFLUENCE_BASE_URL=https://giginc.atlassian.net
CONFLUENCE_USER_EMAIL=kanri@jukust.jp
CONFLUENCE_API_TOKEN=your_api_token  # Secret Managerから取得
CONFLUENCE_SPACE_KEY=CLIENTTOMO
```

### 2.5 Gemini API - BUILD + RUNTIME

```bash
GEMINI_API_KEY=your_gemini_api_key  # Secret Managerから取得
```

### 2.6 その他 - RUNTIME のみ

```bash
USE_LLM_EXPANSION=true
SKIP_DATA_DOWNLOAD=false  # ビルド最適化: false = ビルド時にダウンロード, true = 実行時に読み込み
```

### 2.7 シークレット（Secret Manager）

機密情報は Secret Manager で管理します。

| シークレット名 | 環境変数名 | 用途 | availability |
|--------------|----------|------|--------------|
| `gemini_api_key` | `GEMINI_API_KEY` | Gemini API の認証 | BUILD + RUNTIME |
| `confluence_api_token` | `CONFLUENCE_API_TOKEN` | Confluence API の認証 | RUNTIME |

**シークレットの作成方法**:

```bash
# PowerShell（Windows）
$env:GEMINI_API_KEY = "your-actual-gemini-api-key"
$env:CONFLUENCE_API_TOKEN = "your-actual-confluence-token"
.\scripts\setup-firebase-secrets.ps1

# Bash（Linux/Mac）
export GEMINI_API_KEY="your-actual-gemini-api-key"
export CONFLUENCE_API_TOKEN="your-actual-confluence-token"
./scripts/setup-firebase-secrets.sh

# gcloud CLI（直接）
echo "your-gemini-api-key" | gcloud secrets create gemini_api_key \
  --project=confluence-copilot-ppjye \
  --data-file=-

echo "your-confluence-token" | gcloud secrets create confluence_api_token \
  --project=confluence-copilot-ppjye \
  --data-file=-
```

**シークレットの確認**:
```bash
gcloud secrets list --project=confluence-copilot-ppjye
```

### 2.8 注意事項

1. **`NEXT_PUBLIC_*`環境変数はビルド時に必要**：
   - Next.jsはビルド時にこれらをバンドルに埋め込みます
   - `availability: BUILD`を必ず設定してください

2. **シークレットは別途Secret Managerで管理**：
   - `GEMINI_API_KEY`と`CONFLUENCE_API_TOKEN`はSecret Managerに保存済み
   - 環境変数でシークレット名を参照します

3. **注意: EMBEDDINGS_PROVIDERは削除済み**（2025-10-28移行）
   - 現在はGemini Embeddings API (text-embedding-004) を直接使用
   - 設定は `src/config/ai-models-config.ts` で一元管理（provider: 'api'）

---

## 3. Firebase App Hosting設定

### 3.1 apphosting.yaml の構成

**重要**: `apphosting.yaml` は**プロジェクトルート**に配置する必要があります。

```yaml
# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  # インスタンス設定（パフォーマンス最適化 2025-10-20）
  # コールドスタート完全回避のため2インスタンス維持
  minInstances: 2  # 1→2に増強（冗長性とパフォーマンス向上）
  maxInstances: 4
  
  # メモリ設定（Gemini Embeddings API使用 + 複数同時リクエスト対応）
  memoryMiB: 4096
  
  # CPU設定
  cpu: 2
  
  # コンカレンシー設定（安定性優先）
  # 1インスタンスで1リクエスト処理（リソース競合回避）
  concurrency: 1
  
  # タイムアウト設定（検索処理時間を考慮）
  timeoutSeconds: 300  # 5分（デフォルト60秒から延長）
  
  # Phase 0A-4 ROLLBACK: Gen1に戻す（Gen2で問題発生）
  # 理由: Gen2では Kuromoji辞書ファイルやデータファイルの配置に問題
  # executionEnvironment: gen2  ← コメントアウト（Gen1がデフォルト）

# 環境変数（runConfigと同じレベル）
env:
  # Next.js Public環境変数（ビルド時とランタイム時に必要）
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI
    availability:
      - BUILD
      - RUNTIME
  
  # ... その他の環境変数（セクション2を参照）
  
  # シークレット参照
  - variable: GEMINI_API_KEY
    secret: gemini_api_key    # Secret Manager のシークレット名
    availability:
      - BUILD
      - RUNTIME
  
  - variable: CONFLUENCE_API_TOKEN
    secret: confluence_api_token
    availability:
      - RUNTIME
  
  # ビルド最適化: データダウンロードをスキップ（実行時にCloud Storageから直接読み込む）
  - variable: SKIP_DATA_DOWNLOAD
    value: "false"
    availability:
      - BUILD
      - RUNTIME
```

### 3.2 重要なYAML構造ルール

#### ✅ 正しい構造
```yaml
runConfig:
  cpu: 2
  memoryMiB: 4096

env:              # ← runConfigと同じレベル（トップレベル）
  - variable: NAME
    value: VALUE
```

#### ❌ 間違った構造
```yaml
runConfig:
  cpu: 2
  memoryMiB: 4096
  env:            # ← runConfigの内部（間違い）
    - variable: NAME
      value: VALUE
```

### 3.3 環境変数の availability 設定

- **BUILD**: ビルド時に必要な環境変数
- **RUNTIME**: ランタイム（実行時）に必要な環境変数

#### Next.js の NEXT_PUBLIC_* 変数
```yaml
- variable: NEXT_PUBLIC_FIREBASE_API_KEY
  value: your-value
  availability:
    - BUILD      # ビルド時に必要（静的に埋め込まれる）
    - RUNTIME    # ランタイムでも必要（クライアントサイドで使用）
```

**重要**: `NEXT_PUBLIC_*` 変数は、クライアントサイドで使用されるため、`BUILD` と `RUNTIME` **両方**で利用可能にする必要があります。

#### シークレット参照
```yaml
- variable: GEMINI_API_KEY
  secret: gemini_api_key    # Secret Manager のシークレット名
  availability:
    - BUILD
    - RUNTIME
```

**注意**: シークレットを参照する前に、Secret Manager にシークレットが存在している必要があります。

### 3.4 認証ページの動的レンダリング

Next.js 15 では、クライアントコンポーネント（`'use client'`）でもビルド時に静的生成が試行されます。
Firebase Auth を使用するページでは、以下の設定が必要です：

```typescript
// src/app/login/page.tsx
'use client';

// 静的生成を無効化
export const dynamic = 'force-dynamic';

// ... 残りのコード
```

**対象ページ**:
- `/login` - ログインページ
- `/` - メインページ（認証チェックあり）

### 3.5 ビルド最適化設定

**SKIP_DATA_DOWNLOAD**環境変数で、ビルド時のデータダウンロードを制御できます。

| 値 | 動作 | 用途 |
|----|------|------|
| `false` | ビルド時にデータをダウンロード | 初回セットアップ、データ更新後 |
| `true` | データダウンロードをスキップ | 通常の開発・デプロイ（推奨） |
| 未設定 | ローカルキャッシュの存在で判断 | デフォルト動作 |

**最適化効果**:
- ローカルビルド: 3-6分 → 46秒（**75-90%短縮**）
- Firebase App Hosting デプロイ: 7-15分 → 2-3分（**70-80%短縮**）

**注意**: データは実行時にCloud Storageから直接読み込まれます。

---

## 4. 事前準備（データ & スキーマ）

### 4.1 StructuredLabel の更新（⚠️ 全手順を順次実行）

**重要**: 以下の手順は**必ず順番に実行**してください。手順をスキップすると、本番環境にデータが反映されません。

```bash
# Step 1: FirestoreにStructuredLabelを生成
npx tsx scripts/generate-structured-labels.ts 5000

# Step 2: ローカルLanceDBに同期
npx tsx scripts/sync-firestore-labels-to-lancedb.ts

# Step 3: インデックスを作成（Step 2の後に実行）
npx tsx scripts/create-lancedb-indexes.ts

# Step 4: GCSにアップロード（Step 2の後に必須で実行）
npx tsx scripts/upload-production-data.ts
```

**⚠️ 重要な注意事項**:
- `sync-firestore-labels-to-lancedb.ts`を実行しただけでは、**本番環境には反映されません**
- **必ず**`upload-production-data.ts`を実行してGCSにアップロードしてください
- アップロード後、`verify-production-readiness.ts`で検証することを推奨します

**🔄 バージョン管理について**:
- `upload-production-data.ts`は、アップロード前に**古いLanceDBバージョンを自動的に削除**します
- これにより、GCSには常に最新バージョンのみが保持され、古いデータが残ることを防ぎます
- クリーンアップを無効化する場合は、環境変数 `CLEANUP_OLD_VERSIONS=false` を設定してください
- **注意**: 古いバージョンを削除すると、過去のバージョンに戻れなくなります（ロールバック不可）
- 詳細な分析: [GCSバージョン管理問題の分析と改善案](../analysis/gcs-version-management-issue-analysis.md)

**データフロー**:
```
Firestore (StructuredLabel)
    ↓ generate-structured-labels.ts
Firestore (更新)
    ↓ sync-firestore-labels-to-lancedb.ts
ローカルLanceDB (同期)
    ↓ upload-production-data.ts
GCS (Cloud Storage)
    ↓ App Hostingがダウンロード
本番環境 (反映)
```

### 4.2 LanceDB / インデックス

**注意**: インデックス作成は`sync-firestore-labels-to-lancedb.ts`の**後**に実行してください。

```bash
# ベクトル・スカラーインデックスの状態確認と作成
npx tsx scripts/check-lancedb-indexes.ts
npx tsx scripts/create-lancedb-indexes.ts
```

### 4.3 ドメイン知識 & キャッシュ
- `data/domain-knowledge-v2/*.json` が最新であることを確認
- Lunr インデックス再生成（必要に応じて）
  ```bash
  npx tsx src/scripts/generate-lunr-index.ts
  ```

### 4.4 スキーマ検証（任意）
本番バケットのスキーマが最新拡張スキーマと一致するかを確認。
```bash
npm run check:production-lancedb-schema
```

---

## 5. デプロイ前チェックリスト

### 5.1 必須チェック項目

| カテゴリ | 項目 | 確認方法 | 状態 |
|----------|------|----------|------|
| コード品質 | `npx tsc --noEmit` / `npm run build` が通る | ビルドエラーがないことを確認 | ☐ |
| テスト | 主要動作確認（検索・チャット・ログイン） | ローカル環境で動作確認 | ☐ |
| StructuredLabel | 1233ページ全件ラベル生成（成功件数・失敗0件を確認） | `generate-structured-labels.ts`の出力を確認 | ☐ |
| **LanceDB同期** | **`sync-firestore-labels-to-lancedb.ts`を実行** | 同期結果の統計を確認 | ☐ |
| **GCSアップロード** | **`upload-production-data.ts`を実行しアップロード成功** | ファイル数とサイズを確認 | ☐ |
| **最終検証** | **`verify-production-readiness.ts`で全項目が合格** | すべての検証項目が✅ OKであることを確認 | ☐ |
| LanceDB | ベクトルインデックス (IVF_PQ)・`page_id`/`id` スカラーインデックス作成済み | `check-lancedb-indexes.ts`で確認 | ☐ |
| データ同期 | `.lancedb`, `data/domain-knowledge-v2`, `.cache` が最新 | ファイルの更新日時を確認 | ☐ |
| Git | `main` に最新コミットを push（自動デプロイ対象） | `git status`で確認 | ☐ |

### 5.2 推奨チェック項目（デプロイ後）

| カテゴリ | 項目 | 確認方法 | 状態 |
|----------|------|----------|------|
| **本番データ検証** | **`check-production-lancedb-page703594590.ts`でサンプルページの`structured_tags`を確認** | ローカル環境と本番環境のタグが一致しているか確認 | ☐ |
| スキーマ確認 | 本番環境のLanceDBスキーマが最新拡張スキーマと一致 | `check-production-lancedb-schema.ts`で確認 | ☐ |
| 動作確認 | 代表クエリで検索結果が正しく表示される | 本番UIで検索を実行 | ☐ |

### 5.3 よくあるミスと予防策

| ミス | 影響 | 予防策 |
|------|------|--------|
| `sync-firestore-labels-to-lancedb.ts`のみ実行 | ローカル環境には反映されるが、本番環境には反映されない | **必ず**`upload-production-data.ts`も実行 |
| `upload-production-data.ts`をスキップ | 本番環境で`structured_tags`が空になる | チェックリストで確認 |
| 古いバージョンがGCSに残る | 本番環境が古いデータをダウンロードし、`structured_tags`が空になる | ✅ `upload-production-data.ts`が自動的に古いバージョンを削除（改善済み） |
| 検証をスキップ | 本番環境で問題が発生する | `verify-production-readiness.ts`を実行 |
| インデックス作成をスキップ | 検索パフォーマンスが低下 | `create-lancedb-indexes.ts`を実行 |

---

## 6. デプロイフロー

### 6.1 依存関係のインストール & ビルド

```bash
npm install
npm run build
```

**ビルド最適化について**:
- デフォルトでは、ローカルに `.lancedb` キャッシュが存在する場合、データダウンロードをスキップします
- これにより、ビルド時間が **75-90%短縮**されます
- データは実行時にCloud Storageから直接読み込まれます

**初回セットアップ時**:
```bash
# データをダウンロードしてビルド
SKIP_DATA_DOWNLOAD=false npm run build
```

**通常の開発・デプロイ時**:
```bash
# データダウンロードをスキップ（デフォルト）
npm run build
```

### 6.2 データ同期（⚠️ 全手順を順次実行、スキップ禁止）

**重要**: 以下の手順は**必ず順番に実行**してください。手順をスキップすると、本番環境にデータが反映されません。

```bash
# Step 1: FirestoreにStructuredLabelを生成
npx tsx scripts/generate-structured-labels.ts 5000

# Step 2: ローカルLanceDBに同期
npx tsx scripts/sync-firestore-labels-to-lancedb.ts

# Step 3: インデックスを作成（Step 2の後に実行）
npx tsx scripts/create-lancedb-indexes.ts

# Step 4: GCSにアップロード（Step 2の後に必須で実行）
npx tsx scripts/upload-production-data.ts
```

**各手順の確認ポイント**:
- Step 1: 生成されたラベル数が期待どおりか確認
- Step 2: 同期結果の統計（ラベルあり/なしの件数）を確認
- Step 3: インデックスが作成されたことを確認
- Step 4: 
  - **古いバージョンの削除**: クリーンアップが正常に完了したことを確認
  - **アップロード結果**: ファイル数と合計サイズが期待どおりか確認（最新実績: 3-12 ファイル / 約 50 MB）
  - **注意**: `upload-production-data.ts`は自動的に古いバージョンを削除してからアップロードします

### 6.3 アップロード前の最終検証（必須）

```bash
npx tsx scripts/verify-production-readiness.ts
```

- インデックス、StructuredLabel、Firestore同期の状態を確認
- **すべての検証項目が合格することを確認**（不合格の場合は修正してから再実行）
- サンプルページ（`pageId=703594590`）の`structured_tags`が正しく同期されていることを確認

### 6.4 コードのプッシュ

```bash
git push origin main
```

- Firebase App Hosting が自動ビルド・デプロイを開始
- `main`ブランチへのpushで自動デプロイが開始されます

### 6.5 ビルド監視

- Firebase Console → App Hosting → `confluence-chat`
- 所要時間: ビルド 2〜3 分 / デプロイ 1〜2 分（ビルド最適化により大幅短縮）

**ビルド最適化の効果**:
- 最適化前: ビルド 5-8分、合計 7-15分
- 最適化後: ビルド 1-2分、合計 2-3分（**70-80%短縮**）

---

## 7. デプロイ後の確認（本番環境での検証）

**重要**: デプロイ後、本番環境のLanceDBデータが正しく反映されているか確認してください。

```bash
# 本番環境のLanceDBデータをダウンロードして確認
npx tsx scripts/check-production-lancedb-page703594590.ts
```

- サンプルページ（`pageId=703594590`）の`structured_tags`が正しく反映されているか確認
- ローカル環境と本番環境のタグが一致しているか確認

## 8. デプロイ後の確認（動作確認）

1. **スモークテスト**
   - ログイン → チャット表示 → 初期応答が即時ストリーミングされる
   - 代表クエリ:  
     - 「退会した会員が同じアドレス使ったらどんな表示がでますか」  
     - 「教室削除ができないのは何が原因ですか」  
     - 「自動オファー機能の仕様は？」
   - 検索結果が仕様書優先で表示され、メールテンプレートが過剰に上位に来ないことを確認

2. **スキーマ・インデックス確認**
   ```bash
   npm run check:production-lancedb-schema
   npx tsx scripts/check-lancedb-indexes.ts
   ```
   - `StructuredLabel` フィールド存在、`structured_feature` が埋まっていること
   - ベクトル / スカラー各インデックスの存在

3. **ログ監視（初回30分 / 24時間）**
   - Firebase Console → App Hosting → ログ
   - 例外、BOM削除ログ、Lunr再構築ログなどを確認

4. **パフォーマンス指標**
   - 目標: TTFB < 100ms、総処理 < 30s、エラー率 < 1%

---

## 9. トラブルシューティング

トラブルシューティングについては、専用のガイドを参照してください：

**[📚 トラブルシューティングガイド](../troubleshooting/README.md)**

このガイドには以下が含まれています：
- 一般的な問題の解決方法
- Firebase App Hosting関連の問題
- データ同期・LanceDB関連の問題
- 検索・パフォーマンス関連の問題
- ビルド・デプロイ関連の問題
- デバッグ手順
- エラーハンドリング仕様
- ログ確認方法
- 本番環境確認方法

### 9.1 クイックリファレンス

| 現象 | 解決方法 |
|------|---------|
| デプロイ失敗 | [トラブルシューティングガイド - ビルド・デプロイ関連の問題](../troubleshooting/README.md#5-ビルドデプロイ関連の問題) |
| 検索が遅い | [トラブルシューティングガイド - 検索・パフォーマンス関連の問題](../troubleshooting/README.md#4-検索パフォーマンス関連の問題) |
| `structured_tags`が本番で空 | [トラブルシューティングガイド - 一般的な問題](../troubleshooting/README.md#14-structured_tagsが本番で空) |
| Firebase App Hostingエラー | [トラブルシューティングガイド - Firebase App Hosting関連の問題](../troubleshooting/README.md#2-firebase-app-hosting関連の問題) |
| ログ確認 | [トラブルシューティングガイド - ログ確認方法](../troubleshooting/README.md#8-ログ確認方法) |

---

## 10. 運用フロー（StructuredLabel / テンプレート減衰）

テンプレートカテゴリ（`structured_category: template`）の減衰が本番で無効化された場合は、以下の手順で原因調査と復旧を行う。

1. **データバンドルの整合性確認**  
   - 最新データを取得: `npm run migrate:download`（CI や検証端末で使用）  
   - ローカルと GCS を比較: `npx tsx scripts/compare-local-production-data.ts`  
   - 差分があれば `npx tsx scripts/upload-production-data.ts` で再アップロードし、App Hosting の再ビルドを実施

2. **StructuredLabel の確認**  
   - Firestore の状態確認: `npx tsx scripts/check-firestore-structured-labels.ts --page 814415873`（ページ ID やタイトル指定が可能）  
   - LanceDB の値確認: `npx tsx scripts/debug-lancedb-data-query.ts --page 814415873 --fields structured_category,structured_label` で `template` 判定を確認  
   - **本番環境のLanceDBデータ確認: `npx tsx scripts/check-production-lancedb-page703594590.ts`で`structured_tags`を確認**  
   - 不一致がある場合は `npx tsx scripts/sync-firestore-labels-to-lancedb.ts` を実行 → **`npx tsx scripts/upload-production-data.ts`を実行**

3. **本番ログの追跡**  
   - StructuredLabel 補完が行われているかを Cloud Logging で確認  
     ```bash
     gcloud logging read \
       'resource.type="run_revision" AND resource.labels.service_name="confluence-chat-backend"' \
       --project=confluence-copilot-ppjye \
       --limit=50 \
       --format="value(timestamp,textPayload)" \
       --freshness=1h
     ```  
   - `[StructuredLabel]`, `[CompositeScoring]` などのログに `structured_category: template` が含まれているか、例外が無いかを確認

4. **検索結果の確認**  
   - ローカル検証: `npx tsx src/scripts/lancedb-search.ts "退会した会員が同じアドレス使ったらどんな表示がでますか"`  
   - 本番 UI で同一クエリを実施し、テンプレート記事が減衰しているか確認  
   - 乖離が続く場合は `src/lib/composite-scoring-service.ts` のデプロイバージョンを `git rev-parse HEAD` と `firebase apphosting:releases:list` で確認し、古いリビジョンが残っていないかをチェック

5. **運用ドキュメント更新と自動化**  
   - 上記手順をチェックリスト化し、`docs/operations/production-schema-verification-guide.md` と連携  
   - 差分比較やログ取得コマンドを GitHub Actions などの自動化ジョブに組み込み、乖離検知を自動通知化する

### 10.1 データ同期手順の一括実行（推奨）

複数の手順を連続して実行する場合、以下の一括実行スクリプトの使用を推奨します：

```bash
# 一括実行スクリプト
npm run deploy:data
```

このコマンドで以下を順次実行します：
1. `generate-structured-labels.ts 5000`
2. `sync-firestore-labels-to-lancedb.ts`
3. `create-lancedb-indexes.ts`
4. `upload-production-data.ts`
5. `verify-production-readiness.ts`（検証）

**注意**: 各ステップでエラーが発生した場合は、そのステップを修正してから再実行してください。

詳細は [トラブルシューティングガイド - データ同期・LanceDB関連の問題](../troubleshooting/README.md#3-データ同期lancedb関連の問題) も参照してください。

---

## 11. 参考リンク

- [トラブルシューティングガイド](../troubleshooting/README.md) - トラブルシューティングの包括的なガイド
- [Next.js 15 アップグレードガイド](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Firebase Hosting ドキュメント](https://firebase.google.com/docs/hosting)
- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [LanceDB ドキュメント](https://lancedb.github.io/lancedb/)
- [GCSバージョン管理問題の分析と改善案](../analysis/gcs-version-management-issue-analysis.md)
