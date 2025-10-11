# Confluence データの自動同期

**最終更新日**: 2025-10-10  
**バージョン**: v1.0.0

## 📋 概要

Confluence APIから定期的にデータを取得し、LanceDBとFirestoreを最新の状態に保つ自動化フローです。

## 🏗️ アーキテクチャ

```
Cloud Scheduler (定期実行)
    ↓
Cloud Functions (データ取得・処理)
    ↓
Confluence API (データ取得)
    ↓
LanceDB (ベクトル化・保存)
    ↓
Cloud Storage (データバックアップ)
    ↓
Firebase App Hosting (自動再デプロイ)
```

## 🚀 実装方法

### オプションA: Cloud Scheduler + Cloud Functions（推奨）

#### 1. Cloud Function の作成

**functions/scheduled-sync/index.ts**
```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { execSync } from 'child_process';
import * as logger from 'firebase-functions/logger';

// 毎日午前2時に実行（JST）
export const scheduledSync = onSchedule({
  schedule: '0 2 * * *',  // cron形式: 毎日午前2時（UTC）
  timeZone: 'Asia/Tokyo',
  timeoutSeconds: 3600,    // 1時間
  memory: '2GiB',          // メモリを増やす
  region: 'asia-northeast1'
}, async (event) => {
  logger.info('Starting scheduled Confluence sync', { time: event.scheduleTime });

  try {
    // 差分同期を実行
    logger.info('Running differential sync...');
    execSync('npm run sync:confluence:differential', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    // データをCloud Storageにアップロード
    logger.info('Uploading data to Cloud Storage...');
    execSync('npm run upload:production-data', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    logger.info('Scheduled sync completed successfully');
    return { success: true, timestamp: new Date().toISOString() };

  } catch (error) {
    logger.error('Scheduled sync failed', { error });
    throw error;
  }
});

// 手動トリガー用（HTTPエンドポイント）
export const manualSync = onRequest({
  region: 'asia-northeast1',
  timeoutSeconds: 3600,
  memory: '2GiB'
}, async (req, res) => {
  // 認証チェック
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    res.status(401).send('Unauthorized');
    return;
  }

  try {
    logger.info('Starting manual sync...');
    
    execSync('npm run sync:confluence:differential', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    execSync('npm run upload:production-data', {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Manual sync failed', { error });
    res.status(500).json({ error: 'Sync failed' });
  }
});
```

#### 2. デプロイスクリプト

**scripts/deploy-scheduled-function.sh**
```bash
#!/bin/bash

# Cloud Function をデプロイ
firebase deploy --only functions:scheduledSync

# 手動トリガー用もデプロイ
firebase deploy --only functions:manualSync

echo "✅ Scheduled sync function deployed"
echo "📅 Schedule: Every day at 2:00 AM JST"
echo "🔗 Manual trigger: https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/manualSync"
```

#### 3. 環境変数の設定

```bash
# Cloud Functions の環境変数を設定
firebase functions:config:set \
  confluence.api_token="${CONFLUENCE_API_TOKEN}" \
  confluence.base_url="https://giginc.atlassian.net" \
  confluence.user_email="kanri@jukust.jp" \
  confluence.space_key="CLIENTTOMO" \
  gemini.api_key="${GEMINI_API_KEY}" \
  sync.secret="${SYNC_SECRET}"

# デプロイ
firebase deploy --only functions
```

### オプションB: GitHub Actions

#### .github/workflows/scheduled-sync.yml

```yaml
name: Scheduled Confluence Sync

on:
  schedule:
    # 毎日午前2時（UTC）に実行
    - cron: '0 17 * * *'  # JST 2:00 AM = UTC 17:00
  workflow_dispatch:  # 手動実行も可能

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2
      
      - name: Run differential sync
        env:
          CONFLUENCE_API_TOKEN: ${{ secrets.CONFLUENCE_API_TOKEN }}
          CONFLUENCE_BASE_URL: https://giginc.atlassian.net
          CONFLUENCE_USER_EMAIL: kanri@jukust.jp
          CONFLUENCE_SPACE_KEY: CLIENTTOMO
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GOOGLE_CLOUD_PROJECT: confluence-copilot-ppjye
        run: |
          npm run sync:confluence:differential
      
      - name: Upload to Cloud Storage
        run: |
          npm run upload:production-data
      
      - name: Notify on success
        if: success()
        run: |
          echo "✅ Sync completed successfully at $(date)"
      
      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Scheduled Confluence sync failed',
              body: `Sync failed at ${new Date().toISOString()}\n\nCheck the workflow logs for details.`,
              labels: ['sync-failure', 'automated']
            })
```

#### GitHub Secrets の設定

```bash
# GitHub リポジトリの Settings → Secrets and variables → Actions

必要なシークレット:
- CONFLUENCE_API_TOKEN
- GEMINI_API_KEY
- GCP_SA_KEY (Service Account JSON)
```

### オプションC: Cloud Run Jobs

#### Dockerfile.sync

```dockerfile
FROM node:22-slim

WORKDIR /app

# 依存関係をコピー
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# 同期スクリプトを実行
CMD ["npm", "run", "sync:confluence:differential"]
```

#### Cloud Run Job の作成

```bash
# Docker イメージをビルド
docker build -f Dockerfile.sync -t gcr.io/confluence-copilot-ppjye/confluence-sync:latest .

# Google Container Registry にプッシュ
docker push gcr.io/confluence-copilot-ppjye/confluence-sync:latest

# Cloud Run Job を作成
gcloud run jobs create confluence-sync \
  --image gcr.io/confluence-copilot-ppjye/confluence-sync:latest \
  --region asia-northeast1 \
  --memory 2Gi \
  --cpu 1 \
  --max-retries 3 \
  --task-timeout 3600s \
  --set-env-vars "CONFLUENCE_BASE_URL=https://giginc.atlassian.net,CONFLUENCE_USER_EMAIL=kanri@jukust.jp,CONFLUENCE_SPACE_KEY=CLIENTTOMO" \
  --set-secrets "CONFLUENCE_API_TOKEN=confluence_api_token:latest,GEMINI_API_KEY=gemini_api_key:latest"

# Cloud Scheduler で定期実行
gcloud scheduler jobs create http confluence-sync-scheduler \
  --location asia-northeast1 \
  --schedule "0 2 * * *" \
  --time-zone "Asia/Tokyo" \
  --uri "https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/confluence-copilot-ppjye/jobs/confluence-sync:run" \
  --http-method POST \
  --oauth-service-account-email "confluence-sync@confluence-copilot-ppjye.iam.gserviceaccount.com"
```

## 📊 同期戦略

### 差分同期（推奨）

**メリット:**
- ✅ 高速
- ✅ API呼び出しが少ない
- ✅ コスト効率が良い

**実行頻度:** 毎日1回

```bash
npm run sync:confluence:differential
```

### 完全同期

**メリット:**
- ✅ データの整合性が保証される
- ✅ 欠損データを補完

**実行頻度:** 週1回（日曜日）

```bash
npm run sync:confluence:batch
```

### 混合戦略（推奨）

```yaml
# GitHub Actions
on:
  schedule:
    # 毎日午前2時: 差分同期
    - cron: '0 17 * * *'
    # 毎週日曜午前3時: 完全同期
    - cron: '0 18 * * 0'
```

## 🔧 データアップロードスクリプト

**scripts/upload-production-data.ts**
```typescript
import { Storage } from '@google-cloud/storage';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const storage = new Storage({
  projectId: 'confluence-copilot-ppjye'
});

const bucket = storage.bucket('confluence-copilot-data');

async function uploadDirectory(localPath: string, bucketPath: string) {
  const files = readdirSync(localPath);
  
  for (const file of files) {
    const localFilePath = join(localPath, file);
    const stat = statSync(localFilePath);
    
    if (stat.isDirectory()) {
      await uploadDirectory(localFilePath, `${bucketPath}/${file}`);
    } else {
      const destination = `${bucketPath}/${file}`;
      console.log(`📤 Uploading ${localFilePath} -> ${destination}`);
      
      await bucket.upload(localFilePath, {
        destination,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });
      
      console.log(`✅ Uploaded ${destination}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting data upload...');
  
  // LanceDB データをアップロード
  await uploadDirectory('.lancedb', 'lancedb');
  
  // ドメイン知識をアップロード
  await uploadDirectory('data/domain-knowledge-v2', 'domain-knowledge-v2');
  
  // キャッシュをアップロード
  await uploadDirectory('.cache', '.cache');
  
  console.log('🎉 Upload completed!');
}

main().catch(console.error);
```

**package.json に追加:**
```json
{
  "scripts": {
    "upload:production-data": "tsx scripts/upload-production-data.ts",
    "sync:and:upload": "npm run sync:confluence:differential && npm run upload:production-data"
  }
}
```

## 📈 モニタリング

### Cloud Functions ログの確認

```bash
# リアルタイムログ
firebase functions:log --only scheduledSync

# 特定の時間範囲
gcloud logging read \
  "resource.type=cloud_function AND resource.labels.function_name=scheduledSync" \
  --limit 50 \
  --format json
```

### アラート設定

**Cloud Monitoring アラートポリシー:**

```yaml
displayName: "Confluence Sync Failure Alert"
conditions:
  - displayName: "Sync function error rate"
    conditionThreshold:
      filter: |
        resource.type="cloud_function"
        resource.labels.function_name="scheduledSync"
        severity="ERROR"
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 60s
notificationChannels:
  - projects/confluence-copilot-ppjye/notificationChannels/EMAIL
```

### Slack 通知

**functions/notify-slack.ts**
```typescript
import { logger } from 'firebase-functions';
import fetch from 'node-fetch';

export async function notifySlack(message: string, isError: boolean = false) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not set');
    return;
  }

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

// 使用例
await notifySlack('✅ Confluence sync completed successfully');
```

## 🔐 セキュリティ

### Service Account の作成

```bash
# Service Account を作成
gcloud iam service-accounts create confluence-sync \
  --display-name "Confluence Sync Service Account"

# 必要な権限を付与
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:confluence-sync@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:confluence-sync@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/datastore.user"

# シークレットへのアクセス権限
gcloud secrets add-iam-policy-binding confluence_api_token \
  --member "serviceAccount:confluence-sync@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"
```

## 📋 チェックリスト

同期フローをセットアップする前に：

- [ ] Confluence API トークンが有効
- [ ] Cloud Storage バケットが存在
- [ ] Secret Manager にシークレットが登録済み
- [ ] Service Account に適切な権限
- [ ] 同期スクリプトがローカルで動作確認済み
- [ ] アラート設定完了
- [ ] ドキュメント更新

## 🚨 トラブルシューティング

### 同期が失敗する

**確認事項:**
1. Confluence API トークンの有効期限
2. API レート制限
3. ネットワーク接続
4. メモリ不足

**解決方法:**
```bash
# 手動で同期を実行して詳細ログを確認
npm run sync:confluence:differential --verbose

# Cloud Function のログを確認
firebase functions:log --only scheduledSync
```

### データがアップロードされない

**確認事項:**
1. Cloud Storage の権限
2. ファイルパス
3. ディスク容量

**解決方法:**
```bash
# 手動でアップロード
npm run upload:production-data

# gsutil で確認
gsutil ls gs://confluence-copilot-data/
```

## 📚 参考リンク

- [Cloud Scheduler ドキュメント](https://cloud.google.com/scheduler/docs)
- [Cloud Functions ドキュメント](https://firebase.google.com/docs/functions)
- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
- [Cloud Run Jobs ドキュメント](https://cloud.google.com/run/docs/create-jobs)

