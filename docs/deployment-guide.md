# デプロイガイド

このドキュメントでは、Confluence仕様書要約チャットボットのデプロイ手順について説明します。

## 前提条件

- Node.js v20以上
- Firebase CLIがインストールされていること
- Firebase Projectが設定されていること
- 必要なデータファイルが準備されていること（後述の「データ準備」セクション参照）

## 必要な環境変数

### Firebase関連（必須）
```bash
# Firebase設定（クライアント側）
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=confluence-copilot-ppjye
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK（サーバー側）
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### Confluence API関連（必須）
```bash
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net
CONFLUENCE_USER_EMAIL=your_email@example.com
CONFLUENCE_API_TOKEN=your_api_token
CONFLUENCE_SPACE_KEY=CLIENTTOMO
```

### Google AI API関連（必須）
```bash
GEMINI_API_KEY=your_gemini_api_key
# または
GOOGLE_API_KEY=your_google_api_key
```

### その他
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-deployed-app.web.app
```

## データ準備

### 1. ドメイン知識データの準備

ドメイン知識ファイルは検索機能に必須です：

```bash
# ドメイン知識ディレクトリの確認
ls -la data/domain-knowledge-v2/
# 以下のファイルが必要：
# - final-domain-knowledge-v2.json
# - keyword-lists-v2.json
```

### 2. LanceDBデータの準備

LanceDBはベクトル検索の中核となるため、事前準備が重要です：

```bash
# LanceDBディレクトリの作成
mkdir -p .lancedb

# 既存の埋め込みデータをLanceDBに投入
npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json

# または、Confluenceから直接同期
npm run sync:confluence:batch
```

### 3. Lunr検索インデックスの準備

```bash
# キャッシュディレクトリの作成
mkdir -p .cache

# Lunrインデックスの生成（オプション）
npx tsx src/scripts/generate-lunr-index.ts
```

## ビルド手順

1. 依存関係をインストール
```bash
npm install
```

2. プロダクションビルドを実行
```bash
npm run build
```

## デプロイ手順

### 1. 環境変数の設定

Firebase App Hostingで環境変数を設定：

```bash
# Firebase Console → App Hosting → 環境変数で設定
# または、firebase functions:config:setコマンド使用

firebase functions:config:set \
  confluence.base_url="https://your-domain.atlassian.net" \
  confluence.user_email="your_email@example.com" \
  confluence.api_token="your_api_token" \
  confluence.space_key="CLIENTTOMO" \
  gemini.api_key="your_gemini_api_key"
```

### 2. デプロイ実行

#### App Hostingを使用する場合（推奨）

```bash
# 全体的なデプロイ
firebase deploy

# または、Hostingのみ
firebase deploy --only hosting
```

#### 従来のHostingを使用する場合

```bash
firebase deploy --only hosting
```

**注意**: 現在、Firebase Functionsのデプロイには問題があります。`functions.region is not a function`というエラーが発生します。これはFirebase SDKのバージョンの問題である可能性があります。

## アクセスURL

デプロイ後、以下のURLでアプリケーションにアクセスできます：

- **本番環境**: https://confluence-copilot-ppjye.web.app

## デプロイ後の確認事項

### 1. データの同期確認

```bash
# Confluenceデータの同期テスト
npm run test:confluence

# LanceDB検索のテスト
npx tsx src/scripts/lancedb-search.ts "テストクエリ" --table confluence
```

### 2. 認証の確認

- Google認証が正常に動作するか
- Firestoreへのアクセス権限が正しく設定されているか

### 3. 検索機能の確認

- LanceDBからの検索結果が正常に返されるか
- 埋め込みベクトルの生成が正常に動作するか
- ドメイン知識によるキーワード抽出が動作するか

## 重要な注意点

### 1. LanceDBの永続化

- LanceDBはローカルファイルシステムベースのため、Firebase App Hostingでは**一時的なストレージ**として動作
- 本格運用では、Cloud StorageやCloud SQLへの移行を検討

### 2. メモリ使用量

- 埋め込みモデル（@xenova/transformers）は大量のメモリを使用
- `apphosting.yaml`で`maxInstances`を適切に設定

### 3. セキュリティ

- APIキーは環境変数で管理し、ソースコードに直接記述しない
- サービスアカウントキーは適切に保護

## トラブルシューティング

### 1. データファイル関連のエラー

#### ドメイン知識ファイルが見つからない
```bash
# エラー: Cannot find module 'data/domain-knowledge-v2/keyword-lists-v2.json'
# 解決策: データ準備セクションを参照してファイルを準備
```

#### LanceDBテーブルが見つからない
```bash
# エラー: Table 'confluence' not found
# 解決策: LanceDBデータの準備を実行
npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
```

### 2. Next.js 15の動的ルートパラメータの問題

Next.js 15では、動的ルートパラメータの扱い方が変更されました。ルートハンドラーでは、`params`が`Promise`型として扱われるようになり、`await`で非同期に取得する必要があります。

```typescript
// Before
export async function POST(
  req: NextRequest,
  { params }: { params: { flow: string } }
) {
  const flow = params.flow;
}

// After
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) {
  const params = await context.params;
  const flow = params.flow;
}
```

### 3. Firebase Functionsのデプロイエラー

Firebase Functionsのデプロイ時に`functions.region is not a function`というエラーが発生する場合は、以下の点を確認してください：

1. Firebase Admin SDKとFirebase Functionsのバージョンが互換性があるか
2. `functions/package.json`のFirebase Functionsのバージョンを確認
3. 必要に応じてFirebase Functionsのバージョンをアップデート

### 4. よくある問題と解決策

1. **認証エラー**: Firebase設定の確認
2. **権限エラー**: セキュリティルールの確認
3. **クエリエラー**: インデックスの確認
4. **接続エラー**: ネットワーク設定の確認
5. **メモリ不足**: インスタンス数の調整

### 5. ログ確認

```bash
# Firebase App Hostingのログを確認
firebase functions:log

# アプリケーションのログを確認
# Firebase Console → App Hosting → ログ
```

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
