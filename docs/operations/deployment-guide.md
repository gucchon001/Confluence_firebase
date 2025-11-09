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

### 3.1 StructuredLabel の更新
```bash
npx tsx scripts/generate-structured-labels.ts 5000
npx tsx scripts/sync-firestore-labels-to-lancedb.ts
```

### 3.2 LanceDB / インデックス
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

| カテゴリ | 項目 | 状態 |
|----------|------|------|
| コード品質 | `npx tsc --noEmit` / `npm run build` が通る | ☐ |
| テスト | 主要動作確認（検索・チャット・ログイン） | ☐ |
| StructuredLabel | 1233ページ全件ラベル生成（成功件数・失敗0件を確認） | ☐ |
| LanceDB | ベクトルインデックス (IVF_PQ)・`page_id`/`id`/`title` スカラーインデックス作成済み | ☐ |
| データ同期 | `.lancedb`, `data/domain-knowledge-v2`, `.cache` が最新 | ☐ |
| Cloud Storage | `npx tsx scripts/upload-production-data.ts` を実行しアップロード成功 | ☐ |
| Git | `main` に最新コミットを push（自動デプロイ対象） | ☐ |

---

## 5. デプロイフロー

1. **依存関係のインストール & ビルド**
   ```bash
   npm install
   npm run build
   ```

2. **データ同期**
   ```bash
   npx tsx scripts/generate-structured-labels.ts 5000
   npx tsx scripts/sync-firestore-labels-to-lancedb.ts
   npx tsx scripts/create-lancedb-indexes.ts
   npx tsx scripts/upload-production-data.ts
   ```
   - アップロード結果（ファイル数と合計サイズ）が期待どおりか確認（最新実績: 40 ファイル / 約 50 MB）

3. **コードのプッシュ**
   ```bash
   git push origin main
   ```
   - Firebase App Hosting が自動ビルド・デプロイを開始

4. **ビルド監視**
   - Firebase Console → App Hosting → `confluence-chat`
   - 所要時間: ビルド 2〜3 分 / デプロイ 1〜2 分

---

## 6. デプロイ後の確認

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

## 7. トラブルシューティング

| 現象 | 確認ポイント | 対処 |
|------|--------------|------|
| デプロイ失敗 | Firebase ビルドログ | `npm run build` で再現 → 修正 |
| 検索が遅い | インデックス有無 / `.cache` ダウンロード | `check-lancedb-indexes` → `create-lancedb-indexes` |
| StructuredLabel が反映されない | Firestore / LanceDB 同期 | `generate-structured-labels` → `sync-firestore-labels-to-lancedb` |
| BOM 関連のエラー | ログで `[BOM REMOVED]` が出ているか | 再同期 → データ再アップロード |

ロールバックが必要な場合は、Cloud Storage バックアップを保持しておき、`gsutil cp` で復旧する。

---

## 8. 参考スクリプト一覧

| コマンド | 説明 |
|----------|------|
| `npx tsx scripts/generate-structured-labels.ts 5000` | StructuredLabel を全ページ再生成 |
| `npx tsx scripts/sync-firestore-labels-to-lancedb.ts` | Firestore → LanceDB ラベル同期 |
| `npx tsx scripts/check-lancedb-indexes.ts` | インデックス状態の確認 |
| `npx tsx scripts/create-lancedb-indexes.ts` | ベクトル / スカラーインデックス作成 |
| `npx tsx scripts/upload-production-data.ts` | `.lancedb` / ドメイン知識 / .cache を Cloud Storage へアップロード |
| `npm run check:production-lancedb-schema` | 本番バケットのスキーマ検証 |
| `npx tsx src/scripts/lancedb-search.ts "クエリ"` | ローカルでの検索テスト |

---

## 9. 自動化／GitHub Actions（任意）
Cloud Storage からデータをダウンロードしてビルドするフローを自動化する場合は `npm run migrate:download` を活用する。詳細は本ファイル末尾の「Cloud Storage への移行自動化」を参照。

---

## Cloud Storageへの移行自動化

### 1. 必要なパッケージのインストール

```bash
npm install @google-cloud/storage
npm install --save-dev @types/google-cloud__storage
```

### 2. 環境変数の設定

```bash
# .env.local
CLOUD_STORAGE_BUCKET=confluence-copilot-data
GOOGLE_CLOUD_PROJECT=confluence-copilot-ppjye
GOOGLE_APPLICATION_CREDENTIALS=keys/firebase-adminsdk-key.json
```

### 3. 自動化スクリプトの作成

#### 3.1 TypeScript版（推奨）

`src/scripts/cloud-storage-migration.ts`を作成：

```typescript
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';

interface MigrationConfig {
  bucketName: string;
  projectId: string;
  region: string;
  localPaths: {
    lancedb: string;
    domainKnowledge: string;
    lunrCache: string;
  };
}

export class CloudStorageMigration {
  private storage: Storage;
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.storage = new Storage({
      projectId: config.projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
  }

  /**
   * バケットを作成（存在しない場合）
   */
  async createBucketIfNotExists(): Promise<void> {
    try {
      const [bucket] = await this.storage.bucket(this.config.bucketName).get();
      if (bucket) {
        console.log(`Bucket ${this.config.bucketName} already exists`);
        return;
      }
    } catch (error) {
      // バケットが存在しない場合は作成
    }

    try {
      await this.storage.createBucket(this.config.bucketName, {
        location: this.config.region,
        storageClass: 'STANDARD'
      });
      console.log(`Created bucket ${this.config.bucketName}`);
    } catch (error) {
      console.error('Failed to create bucket:', error);
      throw error;
    }
  }

  /**
   * ディレクトリを再帰的にアップロード
   */
  async uploadDirectory(localPath: string, remotePath: string): Promise<void> {
    if (!fs.existsSync(localPath)) {
      console.warn(`Local path does not exist: ${localPath}`);
      return;
    }

    const files = this.getFilesRecursively(localPath);
    
    for (const file of files) {
      const relativePath = path.relative(localPath, file);
      const remoteFilePath = path.join(remotePath, relativePath).replace(/\\/g, '/');
      
      try {
        await this.storage.bucket(this.config.bucketName).upload(file, {
          destination: remoteFilePath,
          metadata: {
            cacheControl: 'public, max-age=3600'
          }
        });
        console.log(`Uploaded: ${relativePath}`);
      } catch (error) {
        console.error(`Failed to upload ${relativePath}:`, error);
      }
    }
  }

  /**
   * 再帰的にファイル一覧を取得
   */
  private getFilesRecursively(dir: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * 全データを移行
   */
  async migrateAll(): Promise<void> {
    console.log('Starting Cloud Storage migration...');
    
    try {
      // バケット作成
      await this.createBucketIfNotExists();
      
      // LanceDBデータの移行
      console.log('Migrating LanceDB data...');
      await this.uploadDirectory(
        this.config.localPaths.lancedb,
        'lancedb'
      );
      
      // ドメイン知識データの移行
      console.log('Migrating domain knowledge data...');
      await this.uploadDirectory(
        this.config.localPaths.domainKnowledge,
        'domain-knowledge'
      );
      
      // Lunrキャッシュの移行
      console.log('Migrating Lunr cache...');
      await this.uploadDirectory(
        this.config.localPaths.lunrCache,
        'lunr-cache'
      );
      
      console.log('Migration completed successfully!');
      
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * データをダウンロード（デプロイ時）
   */
  async downloadData(): Promise<void> {
    console.log('Downloading data from Cloud Storage...');
    
    try {
      const bucket = this.storage.bucket(this.config.bucketName);
      
      // LanceDBデータのダウンロード
      await this.downloadDirectory(bucket, 'lancedb', this.config.localPaths.lancedb);
      
      // ドメイン知識データのダウンロード
      await this.downloadDirectory(bucket, 'domain-knowledge', this.config.localPaths.domainKnowledge);
      
      // Lunrキャッシュのダウンロード
      await this.downloadDirectory(bucket, 'lunr-cache', this.config.localPaths.lunrCache);
      
      console.log('Data download completed!');
      
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  /**
   * ディレクトリを再帰的にダウンロード
   */
  private async downloadDirectory(bucket: any, remotePath: string, localPath: string): Promise<void> {
    const [files] = await bucket.getFiles({ prefix: remotePath });
    
    for (const file of files) {
      const fileName = file.name.replace(`${remotePath}/`, '');
      const localFilePath = path.join(localPath, fileName);
      const localDir = path.dirname(localFilePath);
      
      // ディレクトリを作成
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      
      await file.download({ destination: localFilePath });
      console.log(`Downloaded: ${fileName}`);
    }
  }
}

// 実行スクリプト
async function main() {
  const config: MigrationConfig = {
    bucketName: process.env.CLOUD_STORAGE_BUCKET || 'confluence-copilot-data',
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye',
    region: 'asia-northeast1',
    localPaths: {
      lancedb: '.lancedb',
      domainKnowledge: 'data/domain-knowledge-v2',
      lunrCache: '.cache'
    }
  };

  const migration = new CloudStorageMigration(config);
  
  const command = process.argv[2];
  
  if (command === 'upload') {
    await migration.migrateAll();
  } else if (command === 'download') {
    await migration.downloadData();
  } else {
    console.log('Usage: npm run migrate:upload or npm run migrate:download');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 3.2 Bash版（シンプル）

`scripts/cloud-storage-migration.sh`を作成：

```bash
#!/bin/bash
# cloud-storage-migration.sh

# 設定
BUCKET_NAME="confluence-copilot-data"
REGION="asia-northeast1"
PROJECT_ID="confluence-copilot-ppjye"

# プロジェクト設定
gcloud config set project $PROJECT_ID

# バケット作成（存在しない場合）
gsutil mb -l $REGION gs://$BUCKET_NAME 2>/dev/null || echo "Bucket already exists"

# LanceDBデータのアップロード
echo "Uploading LanceDB data..."
gsutil -m cp -r .lancedb gs://$BUCKET_NAME/

# ドメイン知識データのアップロード
echo "Uploading domain knowledge data..."
gsutil -m cp -r data/domain-knowledge-v2 gs://$BUCKET_NAME/

# Lunrキャッシュのアップロード
echo "Uploading Lunr cache..."
gsutil -m cp -r .cache gs://$BUCKET_NAME/

echo "Migration completed!"
```

### 4. package.json にスクリプトを追加

```json
{
  "scripts": {
    "migrate:upload": "tsx src/scripts/cloud-storage-migration.ts upload",
    "migrate:download": "tsx src/scripts/cloud-storage-migration.ts download",
    "migrate:gcloud": "bash scripts/cloud-storage-migration.sh"
  }
}
```

### 5. 使用方法

```bash
# データをCloud Storageにアップロード
npm run migrate:upload

# デプロイ時にデータをダウンロード
npm run migrate:download

# gcloud CLIを使用
npm run migrate:gcloud
```

### 6. GitHub Actions での自動化

`.github/workflows/deploy.yml`を作成：

```yaml
name: Deploy to Firebase App Hosting

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm install
        
      - name: Download data from Cloud Storage
        run: npm run migrate:download
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.GOOGLE_APPLICATION_CREDENTIALS }}
          CLOUD_STORAGE_BUCKET: ${{ secrets.CLOUD_STORAGE_BUCKET }}
          
      - name: Build application
        run: npm run build
        
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: confluence-copilot-ppjye
```

## 本格運用での改善案

### 1. データの永続化

- **Cloud Storage**: LanceDBデータをCloud Storageに保存（上記の自動化スクリプト使用）
- **Cloud SQL**: ドメイン知識をCloud SQLに移行
- **Firestore**: メタデータをFirestoreに保存

### 2. 初期化の最適化

- **遅延読み込み**: 必要時のみデータを読み込み
- **キャッシュ**: メモリ内キャッシュの活用
- **並列初期化**: 複数サービスの並列初期化

### 3. 緊急時のフォールバック

```typescript
// ファイルが見つからない場合のフォールバック
try {
  const data = readFileSync(path, 'utf8');
  return JSON.parse(data);
} catch (error) {
  console.warn('ファイル読み込み失敗、デフォルト値を使用:', error);
  return getDefaultKeywordLists();
}
```

## 参考リンク

- [Next.js 15 アップグレードガイド](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Firebase Hosting ドキュメント](https://firebase.google.com/docs/hosting)
- [Firebase Functions ドキュメント](https://firebase.google.com/docs/functions)
- [Firebase App Hosting ドキュメント](https://firebase.google.com/docs/app-hosting)
- [LanceDB ドキュメント](https://lancedb.github.io/lancedb/)
