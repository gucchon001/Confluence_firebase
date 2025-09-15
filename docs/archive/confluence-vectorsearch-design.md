# Confluence Vector Search 設計仕様書

## 1. データ取得設計

### 1.1 Confluenceから取得する情報

| 項目 | 説明 | 用途 |
|------|------|------|
| `id` | ページの一意識別子 | データ識別、更新検出 |
| `title` | ページタイトル | 検索結果表示、メタデータフィルタリング |
| `space.key` | スペースキー | スペース単位での検索フィルタリング |
| `space.name` | スペース名 | 検索結果表示 |
| `body.storage.value` | ページ本文（HTML形式） | テキスト抽出、チャンク分割、埋め込みベクトル生成 |
| `version.number` | バージョン番号 | 更新検出 |
| `version.when` | 更新日時 | 更新検出、検索結果表示 |
| `metadata.labels` | ラベル情報 | メタデータフィルタリング |

### 1.2 データ取得API設定

```typescript
// Confluenceからのデータ取得設定
const confluenceApiConfig = {
  baseUrl: 'https://giginc.atlassian.net',
  apiPath: '/wiki/rest/api/content',
  auth: {
    username: process.env.CONFLUENCE_USER_EMAIL,
    password: process.env.CONFLUENCE_API_TOKEN
  },
  params: {
    spaceKey: process.env.CONFLUENCE_SPACE_KEY,
    expand: 'body.storage,metadata.labels,version,space',
    limit: 100
  }
};
```

### 1.3 データ取得頻度

Cloud Schedulerを使用して1日1回、夜間に自動実行する。

```
cron: "0 2 * * *"  // 毎日午前2時に実行
```

## 2. データ処理パイプライン

### 2.1 テキスト抽出・チャンク分割

1. HTMLからプレーンテキストを抽出
2. テキストを意味のある単位で分割（チャンク化）
   - チャンクサイズ: 最大1000文字
   - オーバーラップ: 100文字

```typescript
// チャンク分割設定
const chunkConfig = {
  chunkSize: 1000,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '. ', '。']
};
```

### 2.2 メタデータ付与

各チャンクに以下のメタデータを付与：

```typescript
const metadata = {
  pageId: page.id,
  title: page.title,
  spaceKey: page.space.key,
  spaceName: page.space.name,
  url: `${baseUrl}/wiki/spaces/${page.space.key}/pages/${page.id}`,
  lastUpdated: page.version.when,
  chunkIndex: index,
  labels: page.metadata?.labels?.results?.map((label: any) => label.name) || []
};
```

### 2.3 埋め込みベクトル生成

Vertex AI Embedding API（googleai/text-embedding-004）を使用して各チャンクの埋め込みベクトルを生成。

```typescript
// 埋め込みモデル設定
const embeddingConfig = {
  model: 'googleai/text-embedding-004',
  dimension: 768
};
```

## 3. ファイル形式設計

### 3.1 中間ファイル形式（JSON）

Google Cloud Storage (GCS) にバッチ更新用のJSONファイルを保存。

```json
{"id":"pageId-0","embedding":[0.1,0.2,...],"restricts":[{"namespace":"title","allow_list":["ページタイトル"]},{"namespace":"space_key","allow_list":["CLIENTTOMO"]},{"namespace":"content_type","allow_list":["confluence_page"]},{"namespace":"label","allow_list":["ラベル1","ラベル2"]}],"crowding_tag":"pageId"}
{"id":"pageId-1","embedding":[0.3,0.4,...],"restricts":[{"namespace":"title","allow_list":["ページタイトル"]},{"namespace":"space_key","allow_list":["CLIENTTOMO"]},{"namespace":"content_type","allow_list":["confluence_page"]},{"namespace":"label","allow_list":["ラベル1","ラベル2"]}],"crowding_tag":"pageId"}
```

### 3.2 メタデータ保存形式（Firestore）

検索結果表示用にFirestoreにメタデータを保存。

```typescript
interface ChunkMetadata {
  pageId: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  url: string;
  lastUpdated: string;
  chunkIndex: number;
  content: string;
  labels: string[];
}
```

## 4. Vertex AI Vector Search 連携設計

### 4.1 インデックス設定

```typescript
const vectorSearchConfig = {
  projectId: process.env.VERTEX_AI_PROJECT_ID,
  location: 'asia-northeast1',
  indexId: 'confluence-vector-index',
  dimensions: 768,
  approximateNeighborsCount: 20,
  distanceMeasureType: 'DOT_PRODUCT_DISTANCE',
  algorithm: 'TREE_AH',
  featureNormType: 'UNIT_L2_NORM'
};
```

### 4.2 バッチ更新プロセス

1. GCSバケット作成（存在確認）
2. JSONファイル生成・アップロード
3. Vector Searchバッチ更新API呼び出し

```typescript
// GCSバケット名
const bucketName = `${projectId}-vector-search`;

// バッチ更新リクエスト
const batchUpdateRequest = {
  gcsSource: {
    uris: [`gs://${bucketName}/${filename}`]
  }
};
```

### 4.3 クエリ設計

```typescript
// Vector Search クエリ
const searchRequest = {
  deployedIndexId: deployedIndexId,
  queries: [{
    datapoint: {
      featureVector: embeddingVector.map(Number),
    },
    neighborCount: 20,
    distanceThreshold: 0.0,
  }],
};
```

### 4.4 レスポンス解析

```typescript
// レスポンス解析
const parseSearchResponse = (response: any) => {
  const matches = response.data.nearestNeighbors[0].neighbors;
  return matches.map((match: any) => {
    const id = match.datapoint.datapointId;
    const [pageId, chunkIndex] = id.split('-');
    
    // restrictsからタイトルとラベルを抽出
    const titleRestrict = match.datapoint.restricts?.find(
      (r: any) => r.namespace === 'title'
    );
    const labelRestricts = match.datapoint.restricts?.find(
      (r: any) => r.namespace === 'label'
    );
    
    return {
      id,
      pageId,
      chunkIndex: parseInt(chunkIndex),
      distance: match.distance,
      title: titleRestrict?.allow_list[0] || '',
      labels: labelRestricts?.allow_list || []
    };
  });
};
```

## 5. エラーハンドリングと再試行戦略

### 5.1 Confluence API エラー処理

```typescript
try {
  const response = await axios.get(endpoint, {
    params,
    auth,
    timeout: 30000 // 30秒タイムアウト
  });
  return response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 429) {
      // レート制限エラー - 指数バックオフで再試行
      await exponentialBackoff(retryCount);
      return fetchConfluenceData(params, retryCount + 1);
    } else if (error.response?.status >= 500) {
      // サーバーエラー - 再試行
      if (retryCount < MAX_RETRIES) {
        await delay(2000);
        return fetchConfluenceData(params, retryCount + 1);
      }
    }
  }
  throw new Error(`Confluence API error: ${error.message}`);
}
```

### 5.2 Vector Search バッチ更新エラー処理

```typescript
try {
  const operation = await indexEndpoint.batchUpdateDatapoints(batchUpdateRequest);
  return await operation.promise();
} catch (error) {
  console.error('Vector Search batch update error:', error);
  
  // 特定のエラーに対する処理
  if (error.message.includes('INVALID_ARGUMENT')) {
    // データ形式エラー - ログ出力とエラーレポート
    await logErrorDetails(error, filename);
    throw new Error(`Invalid data format: ${error.message}`);
  } else if (error.message.includes('RESOURCE_EXHAUSTED')) {
    // リソース制限エラー - 分割アップロード
    await splitAndUploadBatch(jsonData, bucketName);
  } else {
    throw error;
  }
}
```

## 6. 実装改善点

### 6.1 フィールド名の統一

1. 埋め込みベクトルフィールド名を統一
   - JSON生成時: `featureVector`を使用（`embedding`ではなく）
   - 検索クエリ時: `featureVector`を使用

2. ID命名規則の統一
   - データポイントID: `${pageId}-${chunkIndex}`
   - クエリレスポンス解析で`datapointId`または`id`の両方に対応

### 6.2 メタデータフィルタリング強化

1. ラベル情報を`restricts`に追加
   ```typescript
   if (metadata.labels && metadata.labels.length > 0) {
     restricts.push({
       namespace: "label",
       allow_list: metadata.labels
     });
   }
   ```

2. スペースキーを`restricts`に追加
   ```typescript
   restricts.push({
     namespace: "space_key",
     allow_list: [metadata.spaceKey]
   });
   ```

### 6.3 バッチ処理の最適化

1. 差分更新の実装
   - 最終更新日時を記録
   - 更新されたページのみを処理

2. 大規模データの分割処理
   - 最大1000ページ単位でバッチ処理
   - 1ファイルあたり最大10MBのJSONファイル

### 6.4 短期で有効な精度改善方針（補足）

1. チャンク設計の見直し
   - チャンクサイズ/オーバーラップの最適化（例: 800–1200文字、オーバーラップ 100–200 文字）
   - セクション境界優先のスプリッタ採用（見出し・段落・リスト単位での分割を優先）
   - コードブロック/表などは塊として保持し、文脈の断絶を防止

2. メタデータ強化と正規化
   - ラベルの正規化（大文字小文字統一・重複除去・不要語除外）
   - `space_key`/`label` をクエリ側 `restricts` に活用（フィルタで検索空間を縮小）
   - 重要メタ（タイトル/スペース/更新日時）を常に保持し再ランクに活用

3. 品質評価ループ（RAG評価）
   - 質問-正解ペアで再現率/適合率を測定し、Top-k と `distanceThreshold` を最適化
   - 評価セットは代表クエリ（カテゴリ/難易度/長さ）を網羅し、定期回帰テストに組み込み
   - フィードバックに基づき、チャンク設計・restrictsの条件・メタ正規化ルールを更新

## 7. 監視とロギング

### 7.1 監視指標

1. データ同期ステータス
   - 同期開始/完了時間
   - 処理ページ数
   - エラー数

2. Vector Search パフォーマンス
   - クエリレイテンシ
   - 検索結果の品質スコア

### 7.2 ロギング設計

```typescript
// 構造化ログ
const logSyncStatus = async (status: 'start' | 'complete' | 'error', details: any) => {
  const log = {
    timestamp: new Date().toISOString(),
    operation: 'confluence_sync',
    status,
    details
  };
  
  console.log(JSON.stringify(log));
  
  // Firestoreにも記録
  await admin.firestore().collection('syncLogs').add(log);
};
```
