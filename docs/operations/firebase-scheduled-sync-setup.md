# Firebase Cloud Functions による自動同期セットアップ

**最終更新日**: 2025-10-10  
**推奨方法**: Firebase統合による完全自動化

## 📋 概要

Firebase Cloud Functions を使って、Confluence データを定期的に同期します。
GitHub Actions不要で、Firebase環境内で完結します。

## 🏗️ アーキテクチャ

```
Cloud Scheduler (Firebase管理)
    ↓
Cloud Functions (Firebase)
    ↓
Confluence API
    ↓
データ処理・埋め込み生成
    ↓
Cloud Storage
    ↓
Firebase App Hosting（自動ダウンロード）
```

## 🚀 セットアップ手順

### ステップ1: Secret Manager にシークレットを登録

```bash
# Confluence API Token
echo "your-confluence-token" | gcloud secrets create CONFLUENCE_API_TOKEN \
  --project=confluence-copilot-ppjye \
  --replication-policy=automatic \
  --data-file=-

# Gemini API Key
echo "your-gemini-key" | gcloud secrets create GEMINI_API_KEY \
  --project=confluence-copilot-ppjye \
  --replication-policy=automatic \
  --data-file=-

# 手動同期用の認証シークレット（ランダム生成）
openssl rand -base64 32 | gcloud secrets create SYNC_SECRET \
  --project=confluence-copilot-ppjye \
  --replication-policy=automatic \
  --data-file=-

# シークレットの確認
gcloud secrets list --project=confluence-copilot-ppjye
```

### ステップ2: Cloud Functions に権限を付与

```bash
# Cloud Functions のサービスアカウントを確認
PROJECT_NUMBER=$(gcloud projects describe confluence-copilot-ppjye --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Secret Managerの読み取り権限
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Storageの読み書き権限
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"

# Firestoreの読み書き権限（既に付与されている可能性あり）
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"
```

### ステップ3: Functions をビルド・デプロイ

```bash
# functionsディレクトリに移動
cd functions

# 依存関係をインストール
npm install

# TypeScriptをビルド
npm run build

# Firebaseにデプロイ
firebase deploy --only functions

# 特定の関数のみデプロイ
firebase deploy --only functions:dailyDifferentialSync
firebase deploy --only functions:weeklyFullSync
firebase deploy --only functions:manualSync
firebase deploy --only functions:syncStatus
```

## 📅 デプロイされる関数

### 1. dailyDifferentialSync
- **スケジュール**: 毎日 午前2時（JST）
- **処理**: 差分同期
- **タイムアウト**: 1時間
- **メモリ**: 2GiB

### 2. weeklyFullSync
- **スケジュール**: 毎週日曜 午前3時（JST）
- **処理**: 完全同期
- **タイムアウト**: 2時間
- **メモリ**: 4GiB

### 3. manualSync (HTTP)
- **URL**: `https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/manualSync`
- **メソッド**: POST
- **認証**: Bearer トークン
- **パラメータ**: `{ "syncType": "differential" | "full" }`

### 4. syncStatus (HTTP)
- **URL**: `https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/syncStatus`
- **メソッド**: GET
- **認証**: 不要
- **レスポンス**: 最終同期日時と状態

## 🔧 動作確認

### ログの確認

```bash
# リアルタイムログ
firebase functions:log --only dailyDifferentialSync

# 直近100件のログ
gcloud logging read \
  "resource.type=cloud_function AND resource.labels.function_name=dailyDifferentialSync" \
  --limit 100 \
  --format json
```

### 手動実行

```bash
# SYNC_SECRETを取得
SYNC_SECRET=$(gcloud secrets versions access latest --secret=SYNC_SECRET --project=confluence-copilot-ppjye)

# 差分同期を実行
curl -X POST \
  -H "Authorization: Bearer ${SYNC_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"syncType": "differential"}' \
  https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/manualSync

# 完全同期を実行
curl -X POST \
  -H "Authorization: Bearer ${SYNC_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"syncType": "full"}' \
  https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/manualSync
```

### 同期ステータスの確認

```bash
curl https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/syncStatus
```

## 📊 モニタリング

### Firebase Console でログを確認

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクト選択: `confluence-copilot-ppjye`
3. **Functions** → 関数を選択
4. **ログ** タブでログを確認

### Cloud Monitoring でアラート設定

```bash
# アラートポリシーを作成
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Confluence Sync Failure Alert" \
  --condition-display-name="Function Error Rate" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s
```

### Slack 通知の追加（オプション）

`functions/src/scheduled-sync.ts` に以下を追加：

```typescript
async function notifySlack(message: string, isError: boolean = false) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
      attachments: [{
        color: isError ? 'danger' : 'good',
        text: message,
        footer: 'Confluence Sync',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  });
}

// 使用例（各関数のtry-catch内）
await notifySlack('✅ Daily sync completed successfully');
```

## 🔄 スケジュール変更

### cron 式の変更

`functions/src/scheduled-sync.ts` を編集：

```typescript
// 例: 毎日午前3時に変更
export const dailyDifferentialSync = onSchedule({
  schedule: '0 3 * * *',  // ← ここを変更
  timeZone: 'Asia/Tokyo',
  // ...
});
```

### 再デプロイ

```bash
cd functions
npm run build
firebase deploy --only functions:dailyDifferentialSync
```

## 💰 コスト見積もり

### Cloud Functions 料金（月額）

**前提条件:**
- 毎日1回の差分同期（2GiB, 10分）: 30回/月
- 毎週1回の完全同期（4GiB, 30分）: 4回/月

**計算:**
```
差分同期: 30回 × 10分 × 2GiB = 600 GiB-分
完全同期: 4回 × 30分 × 4GiB = 480 GiB-分
合計: 1,080 GiB-分

料金: 約 $0.50 - $1.00 / 月（無料枠含む）
```

### Cloud Storage 料金

```
データサイズ: 約 5GB
料金: 約 $0.10 / 月
```

### 合計概算

```
月額: 約 $0.60 - $1.10
```

## 🛠️ トラブルシューティング

### エラー: タイムアウト

**原因**: 処理時間が設定したタイムアウトを超えた

**解決方法**:
```typescript
// タイムアウトを延長
export const dailyDifferentialSync = onSchedule({
  timeoutSeconds: 7200,  // 2時間に延長
  // ...
});
```

### エラー: メモリ不足

**原因**: メモリが不足

**解決方法**:
```typescript
// メモリを増やす
export const dailyDifferentialSync = onSchedule({
  memory: '4GiB',  // 4GiBに増やす
  // ...
});
```

### エラー: シークレットが見つからない

**原因**: Secret Managerにシークレットが登録されていない

**解決方法**:
```bash
# シークレットの存在確認
gcloud secrets list --project=confluence-copilot-ppjye

# 再作成
echo "your-token" | gcloud secrets create CONFLUENCE_API_TOKEN \
  --project=confluence-copilot-ppjye \
  --replication-policy=automatic \
  --data-file=-
```

### エラー: 権限不足

**原因**: Service Accountに必要な権限がない

**解決方法**:
```bash
# 権限を確認
gcloud projects get-iam-policy confluence-copilot-ppjye \
  --flatten="bindings[].members" \
  --filter="bindings.members:${SERVICE_ACCOUNT}"

# 必要な権限を付与（上記「権限を付与」セクション参照）
```

## 📈 GitHub Actions との比較

| 項目 | Cloud Functions | GitHub Actions |
|------|----------------|----------------|
| **セットアップ** | やや複雑 | 簡単 |
| **統合** | Firebase完全統合 | 外部サービス |
| **コスト** | 使用量課金 | 無料枠あり |
| **実行時間制限** | 最大9分（拡張可能） | 最大6時間 |
| **メモリ** | 最大32GiB | 7GB |
| **ログ** | Cloud Logging | GitHub Actions |
| **モニタリング** | Cloud Monitoring | GitHub通知 |
| **推奨** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

## 🎯 推奨事項

1. **本番環境**: Cloud Functions を使用
   - Firebase完全統合
   - 高度なモニタリング
   - スケーラブル

2. **開発/テスト**: GitHub Actions を使用
   - セットアップが簡単
   - デバッグしやすい
   - 無料枠が大きい

## 📚 関連ドキュメント

- [Cloud Functions ドキュメント](https://firebase.google.com/docs/functions)
- [Cloud Scheduler ドキュメント](https://cloud.google.com/scheduler/docs)
- [Secret Manager ドキュメント](https://cloud.google.com/secret-manager/docs)
- [Confluence データの自動同期](./automated-data-sync.md)

## ✅ チェックリスト

セットアップ完了後、以下を確認してください：

- [ ] Secret Manager にシークレットを登録済み
- [ ] Cloud Functions に権限を付与済み
- [ ] Functions をビルド・デプロイ済み
- [ ] 手動実行で動作確認済み
- [ ] ログで正常に実行されることを確認
- [ ] Cloud Monitoring でアラート設定済み
- [ ] 翌日の自動実行を確認

