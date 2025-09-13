# バッチ更新設計書

## 1. 概要

本ドキュメントは、Confluence仕様書要約チャットボットにおける、Vector Search インデックスの1日1回のバッチ更新プロセスの設計を定義します。

## 2. バッチ更新の流れ

### 2.1 全体フロー

1. **Cloud Scheduler** が毎日深夜（例：午前1時）に実行をトリガー
2. **Cloud Functions** が起動し、以下の処理を実行:
   - Confluenceからデータを取得
   - テキスト処理（HTML解析、チャンク分割）
   - 埋め込みベクトル生成
   - JSONファイル生成
   - GCSへのアップロード
   - Firestoreへのメタデータ保存
3. **Vertex AI API** を使用して自動でVector Searchインデックスを更新
   - GCSのJSONファイルをソースにバッチ更新を実行

### 2.2 自動化部分

- Confluenceデータ取得 → GCSアップロードまでを自動化
- Cloud Schedulerで定期実行（毎日深夜）

### 2.3 自動更新

- Cloud Functions から Vertex AI IndexService を呼び出してバッチ更新

## 3. 実装詳細

### 3.1 Cloud Scheduler設定

```yaml
name: projects/confluence-copilot-ppjye/locations/asia-northeast1/jobs/daily-confluence-sync
schedule: "0 1 * * *"  # 毎日午前1時に実行
timeZone: "Asia/Tokyo"
target:
  httpTarget:
    uri: "https://asia-northeast1-confluence-copilot-ppjye.cloudfunctions.net/syncConfluenceData"
    httpMethod: POST
    headers:
      Content-Type: application/json
    body: "{}"
```

### 3.2 Cloud Functions実装

`syncConfluenceData` 関数の実装:

```typescript
export const syncConfluenceData = functions.https.onRequest(async (req, res) => {
  try {
    console.log('[syncConfluenceData] Starting Confluence data sync');
    
    // 同期開始ログを保存
    await firestoreService.saveSyncLog('start', {
      message: 'Confluence data sync started'
    });
    
    // Confluenceからデータを取得
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY || config.confluence?.space_key;
    const pages = await confluenceService.getAllSpaceContent(spaceKey);
    console.log(`[syncConfluenceData] Retrieved ${pages.length} pages from Confluence`);
    
    // データを処理
    let allRecords = [];
    for (const page of pages) {
      try {
        const records = confluenceService.processConfluencePage(page);
        allRecords = allRecords.concat(records);
      } catch (error) {
        console.error(`[syncConfluenceData] Error processing page ${page.id}: ${error.message}`);
      }
    }
    console.log(`[syncConfluenceData] Generated ${allRecords.length} records`);
    
    // 埋め込みベクトルを生成
    const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
    console.log(`[syncConfluenceData] Generated embeddings for ${recordsWithEmbeddings.length}/${allRecords.length} records`);
    
    // GCSにアップロード
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || config.vertexai?.storage_bucket;
    const filename = await gcsService.uploadToGCS(recordsWithEmbeddings, bucketName);
    console.log(`[syncConfluenceData] Uploaded file to gs://${bucketName}/${filename}`);
    
    // Firestoreにメタデータを保存
    await firestoreService.saveMetadataToFirestore(recordsWithEmbeddings);
    console.log(`[syncConfluenceData] Saved metadata to Firestore`);
    
    // 同期完了ログを保存
    await firestoreService.saveSyncLog('complete', {
      message: 'Confluence data sync completed successfully',
      pagesProcessed: pages.length,
      recordsProcessed: recordsWithEmbeddings.length,
      filename
    });
    
    res.status(200).send({
      status: 'success',
      message: 'Confluence data sync completed successfully',
      details: {
        pagesProcessed: pages.length,
        recordsProcessed: recordsWithEmbeddings.length,
        filename
      }
    });
  } catch (error) {
    console.error(`[syncConfluenceData] Error: ${error.message}`);
    
    // エラーログを保存
    await firestoreService.saveSyncLog('error', {
      message: `Confluence data sync failed: ${error.message}`
    });
    
    res.status(500).send({
      status: 'error',
      message: `Confluence data sync failed: ${error.message}`
    });
  }
});
```

### 3.3 バッチ更新API呼び出し

- IndexService（Vertex AI）を用いて、GCSのJSONファイルを指定して更新
- 例: `contentsDeltaUri` またはバッチ更新リクエストに `gs://.../*.json` を指定

```typescript
// Vertex AI Index のバッチ更新（DOT_PRODUCT_DISTANCE + UNIT_L2_NORM 前提）
import {v1 as aiplatform} from '@google-cloud/aiplatform';

const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
const indexId = process.env.VERTEX_AI_INDEX_ID || 'confluence-vector-index';
const bucket = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
const filename = 'vector-search-data-YYYY-MM-DDThh-mm-ss.json';

async function batchUpdateIndex() {
  const client = new aiplatform.IndexServiceClient({apiEndpoint: `${location}-aiplatform.googleapis.com`});

  const name = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
  const contentsDeltaUri = `gs://${bucket}/${filename}`; // もしくはバケットルート/複数ファイル

  // UpdateIndex: contentsDeltaUri を指定してインデックスに取り込み
  const [operation] = await client.updateIndex({
    index: {
      name,
      metadata: {contentsDeltaUri},
    },
  });

  // 完了待ち
  const [response] = await operation.promise();
  console.log('Index updated:', response.name);
}

batchUpdateIndex().catch(console.error);
```

## 4. 運用手順

### 4.1 日次更新の確認

1. Cloud Functionsのログを確認
   - 成功: `Confluence data sync completed successfully`
   - エラー: エラーメッセージを確認

2. Firestoreの `syncLogs` コレクションを確認
   - 最新の同期ログのステータスを確認

3. GCSバケットを確認
   - 新しいJSONファイルが作成されていることを確認

### 4.2 自動インポートの確認

1. Cloud Functions のログで更新完了を確認
2. Vertex AI > Vector Search のインデックスで `vectorsCount` などの統計を確認

### 4.3 エラー対応

- Cloud Functionsのエラー:
  - ログを確認して原因を特定
  - 必要に応じて手動で再実行

- 手動インポートのエラー:
  - インポートログを確認
  - GCSのJSONファイルの形式を確認

## 5. 将来の改善点

1. **APIエンドポイントの調査**
   - Vector Search APIの更新情報を定期的に確認
   - 将来的にインポートAPIが利用可能になった場合は自動化

2. **エラーハンドリングの強化**
   - 部分的な失敗からの回復メカニズム
   - 自動リトライの実装

3. **差分更新の実装**
   - 変更されたページのみを処理する最適化
   - 更新日時に基づくフィルタリング

4. **監視とアラート**
   - 同期失敗時のメール通知
   - ダッシュボードによる視覚化
