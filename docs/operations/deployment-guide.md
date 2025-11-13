# デプロイガイド

このドキュメントは Confluence 仕様書要約チャットボットの本番デプロイ手順を集約したものです。従来のチェックリストやスキーマ確認ガイド、DB再構築後手順はすべて本ドキュメントに統合しました。

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

### Firebase（クライアント）
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=confluence-copilot-ppjye
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_API_BASE_URL=https://confluence-copilot-ppjye.web.app
```

### Firebase Admin / Google Cloud
```bash
GOOGLE_APPLICATION_CREDENTIALS=keys/firebase-adminsdk-key.json
GOOGLE_CLOUD_PROJECT=confluence-copilot-ppjye
STORAGE_BUCKET=confluence-copilot-data
```

### Confluence / Gemini
```bash
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER_EMAIL=your_email@example.com
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_SPACE_KEY=CLIENTTOMO

GEMINI_API_KEY=your_gemini_api_key  # or GOOGLE_API_KEY
```

---

## 3. 事前準備（データ & スキーマ）

### 3.1 StructuredLabel の更新（⚠️ 全手順を順次実行）

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

### 3.2 LanceDB / インデックス

**注意**: インデックス作成は`sync-firestore-labels-to-lancedb.ts`の**後**に実行してください。

```bash
# ベクトル・スカラーインデックスの状態確認と作成
npx tsx scripts/check-lancedb-indexes.ts
npx tsx scripts/create-lancedb-indexes.ts
```

### 3.3 ドメイン知識 & キャッシュ
- `data/domain-knowledge-v2/*.json` が最新であることを確認
- Lunr インデックス再生成（必要に応じて）
  ```bash
  npx tsx src/scripts/generate-lunr-index.ts
  ```

### 3.4 スキーマ検証（任意）
本番バケットのスキーマが最新拡張スキーマと一致するかを確認。
```bash
npm run check:production-lancedb-schema
```

---

## 4. デプロイ前チェックリスト

### 4.1 必須チェック項目

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

### 4.2 推奨チェック項目（デプロイ後）

| カテゴリ | 項目 | 確認方法 | 状態 |
|----------|------|----------|------|
| **本番データ検証** | **`check-production-lancedb-page703594590.ts`でサンプルページの`structured_tags`を確認** | ローカル環境と本番環境のタグが一致しているか確認 | ☐ |
| スキーマ確認 | 本番環境のLanceDBスキーマが最新拡張スキーマと一致 | `check-production-lancedb-schema.ts`で確認 | ☐ |
| 動作確認 | 代表クエリで検索結果が正しく表示される | 本番UIで検索を実行 | ☐ |

### 4.3 よくあるミスと予防策

| ミス | 影響 | 予防策 |
|------|------|--------|
| `sync-firestore-labels-to-lancedb.ts`のみ実行 | ローカル環境には反映されるが、本番環境には反映されない | **必ず**`upload-production-data.ts`も実行 |
| `upload-production-data.ts`をスキップ | 本番環境で`structured_tags`が空になる | チェックリストで確認 |
| 検証をスキップ | 本番環境で問題が発生する | `verify-production-readiness.ts`を実行 |
| インデックス作成をスキップ | 検索パフォーマンスが低下 | `create-lancedb-indexes.ts`を実行 |

---

## 5. デプロイフロー

1. **依存関係のインストール & ビルド**
   ```bash
   npm install
   npm run build
   ```

2. **データ同期（⚠️ 全手順を順次実行、スキップ禁止）**

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
   - Step 4: アップロード結果（ファイル数と合計サイズ）が期待どおりか確認（最新実績: 24 ファイル / 約 52 MB）
   
3. **アップロード前の最終検証（必須）**
   ```bash
   npx tsx scripts/verify-production-readiness.ts
   ```
   - インデックス、StructuredLabel、Firestore同期の状態を確認
   - **すべての検証項目が合格することを確認**（不合格の場合は修正してから再実行）
   - サンプルページ（`pageId=703594590`）の`structured_tags`が正しく同期されていることを確認

4. **コードのプッシュ**
   ```bash
   git push origin main
   ```
   - Firebase App Hosting が自動ビルド・デプロイを開始

5. **ビルド監視**
   - Firebase Console → App Hosting → `confluence-chat`
   - 所要時間: ビルド 2〜3 分 / デプロイ 1〜2 分

---

## 6. デプロイ後の確認（本番環境での検証）

**重要**: デプロイ後、本番環境のLanceDBデータが正しく反映されているか確認してください。

```bash
# 本番環境のLanceDBデータをダウンロードして確認
npx tsx scripts/check-production-lancedb-page703594590.ts
```

- サンプルページ（`pageId=703594590`）の`structured_tags`が正しく反映されているか確認
- ローカル環境と本番環境のタグが一致しているか確認

## 7. デプロイ後の確認（動作確認）

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

## 8. トラブルシューティング

| 現象 | 確認ポイント | 対処 |
|------|--------------|------|
| デプロイ失敗 | Firebase ビルドログ | `npm run build` で再現 → 修正 |
| 検索が遅い | インデックス有無 / `.cache` ダウンロード | `check-lancedb-indexes` → `create-lancedb-indexes` |
| StructuredLabel が反映されない | Firestore / LanceDB 同期 | `generate-structured-labels` → `sync-firestore-labels-to-lancedb` → **`upload-production-data`** |
| **`structured_tags`が本番で空** | **GCS上のLanceDBデータを確認** | **`check-production-lancedb-page703594590.ts`で確認 → `sync-firestore-labels-to-lancedb` → `upload-production-data`** |
| BOM 関連のエラー | ログで `[BOM REMOVED]` が出ているか | 再同期 → データ再アップロード |

ロールバックが必要な場合は、Cloud Storage バックアップを保持しておき、`gsutil cp` で復旧する。

---

## 9. 運用フロー（StructuredLabel / テンプレート減衰）

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

---

## 10. よくある問題と解決方法

### 10.1 `structured_tags`が本番環境で空になる問題

**症状**: ローカル環境では`structured_tags`が正しく表示されるが、本番環境では`null`になる

**原因**: 
- ローカル環境で`sync-firestore-labels-to-lancedb.ts`を実行したが、その後の`upload-production-data.ts`が実行されていない
- GCS上のLanceDBバンドルが古い
- App Hostingが古いLanceDBバンドルをキャッシュしている

**解決方法**:
1. ローカル環境で`sync-firestore-labels-to-lancedb.ts`を実行
2. **`upload-production-data.ts`を実行してGCSにアップロード**（必須）
3. `verify-production-readiness.ts`で検証（すべての項目が合格することを確認）
4. `check-production-lancedb-page703594590.ts`で本番環境のLanceDBデータを確認
5. 必要に応じてApp Hostingの再デプロイ

**予防策**:
- ✅ デプロイ前チェックリストに「LanceDB同期後、GCSへのアップロードを確認」を追加（完了）
- ✅ `verify-production-readiness.ts`で検証を必須化（完了）
- ⏳ `sync-firestore-labels-to-lancedb.ts`実行後に自動で`upload-production-data.ts`を実行するスクリプトを作成（推奨）

### 10.2 データ同期手順の一括実行（推奨）

複数の手順を連続して実行する場合、以下の一括実行スクリプトの使用を推奨します：

```bash
# 一括実行スクリプト（作成推奨）
npm run deploy:data
```

このスクリプトで以下を順次実行：
1. `generate-structured-labels.ts`
2. `sync-firestore-labels-to-lancedb.ts`
3. `create-lancedb-indexes.ts`
4. `upload-production-data.ts`
5. `verify-production-readiness.ts`（検証）

**実装済み**（`package.json`に追加済み）:
```bash
npm run deploy:data
```

このコマンドで以下を順次実行します：
1. `generate-structured-labels.ts 5000`
2. `sync-firestore-labels-to-lancedb.ts`
3. `create-lancedb-indexes.ts`
4. `upload-production-data.ts`
5. `verify-production-readiness.ts`（検証）

**注意**: 各ステップでエラーが発生した場合は、そのステップを修正してから再実行してください。

---

## 11. 参考リンク

- [Next.js 15 アップグレードガイド](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Firebase Hosting ドキュメント](https://firebase.google.com/docs/hosting)
- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [LanceDB ドキュメント](https://lancedb.github.io/lancedb/)
