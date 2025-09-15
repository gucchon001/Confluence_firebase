# LanceDB ベクトル検索設計仕様書

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

環境変数 `EMBEDDINGS_PROVIDER` に基づいて埋め込みプロバイダを選択：

1. `local`: @xenova/transformers を使用したローカル埋め込み（デフォルト）
2. `vertex`: Vertex AI Embedding API（googleai/text-embedding-004）

```typescript
// 埋め込みモデル設定
const embeddingConfig = {
  provider: process.env.EMBEDDINGS_PROVIDER || 'local',
  localModel: 'Xenova/all-MiniLM-L6-v2',
  vertexModel: 'googleai/text-embedding-004',
  dimension: provider === 'local' ? 384 : 768
};
```

## 3. ファイル形式設計

### 3.1 中間ファイル形式（JSON）

ローカルファイルシステムに埋め込みJSONファイルを保存。

```json
{"id":"pageId-0","embedding":[0.1,0.2,...],"space_key":"CLIENTTOMO","title":"ページタイトル","labels":["ラベル1","ラベル2"]}
{"id":"pageId-1","embedding":[0.3,0.4,...],"space_key":"CLIENTTOMO","title":"ページタイトル","labels":["ラベル1","ラベル2"]}
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

## 4. LanceDB 連携設計

### 4.1 LanceDB テーブル設定

```typescript
const lancedbConfig = {
  dbPath: '.lancedb',
  tableName: 'confluence',
  schema: {
    id: 'utf8',
    vector: { 
      type: 'fixed_size_list', 
      listSize: embeddingConfig.dimension, 
      field: { type: 'float32' } 
    },
    space_key: 'utf8',
    title: 'utf8',
    labels: { type: 'list', field: { type: 'utf8' } }
  }
};
```

### 4.2 データロードプロセス

1. JSONファイルからデータ読み込み
2. LanceDBテーブル作成または更新
3. データの一括追加またはマージ

```typescript
// LanceDB データロード
const db = await lancedb.connect(lancedbConfig.dbPath);
const exists = (await db.tableNames()).includes(lancedbConfig.tableName);

const tbl = exists
  ? await db.openTable(lancedbConfig.tableName)
  : await db.createTable(lancedbConfig.tableName, data.slice(0, 0), { schema: lancedbConfig.schema });

if (!exists) {
  await tbl.add(data);
} else {
  // upsert by id
  await tbl.mergeInsert(data, ['id']);
}
```

### 4.3 クエリ設計

```typescript
// LanceDB 検索クエリ
const searchQuery = async (queryVector, filters, limit = 5) => {
  const db = await lancedb.connect(lancedbConfig.dbPath);
  const tbl = await db.openTable(lancedbConfig.tableName);
  
  let query = tbl.search(queryVector).limit(limit);
  
  if (filters) {
    const clauses = [];
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        clauses.push(`${key} IN (${value.map(x => `'${x}'`).join(',')})`);
      } else {
        clauses.push(`${key} = '${value}'`);
      }
    }
    if (clauses.length) {
      query = query.where(clauses.join(' AND '));
    }
  }
  
  return await query.execute();
};
```

### 4.4 レスポンス解析とFirestore連携

```typescript
// 検索結果とFirestoreメタデータ結合
const enrichSearchResults = async (lanceResults) => {
  const ids = lanceResults.map(r => r.id);
  
  const docs = await Promise.all(
    ids.map(async (id) => {
      const snap = await admin.firestore().collection('chunks').doc(id).get();
      return { 
        id, 
        distance: lanceResults.find(r => r.id === id)._distance, 
        ...(snap.exists ? snap.data() : {}) 
      };
    })
  );
  
  return docs;
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

### 5.2 LanceDB エラー処理

```typescript
try {
  const results = await searchQuery(queryVector, filters, limit);
  return await enrichSearchResults(results);
} catch (error) {
  console.error('LanceDB search error:', error);
  
  // データベース接続エラー
  if (error.message.includes('ENOENT') || error.message.includes('not found')) {
    throw new Error('Vector database not initialized. Please run data import first.');
  }
  
  // クエリ構文エラー
  if (error.message.includes('syntax error')) {
    console.error('Invalid query filter:', filters);
    throw new Error(`Invalid search filter: ${error.message}`);
  }
  
  throw error;
}
```

## 6. 実装改善点

### 6.1 埋め込みプロバイダの抽象化

```typescript
// src/lib/embeddings.ts
export const getEmbeddings = async (text: string): Promise<number[]> => {
  const provider = process.env.EMBEDDINGS_PROVIDER || 'local';
  
  if (provider === 'local') {
    return await getLocalEmbeddings(text);
  } else if (provider === 'vertex') {
    return await getVertexEmbeddings(text);
  }
  
  throw new Error(`Unknown embeddings provider: ${provider}`);
};
```

### 6.2 メタデータフィルタリング強化

1. ラベル情報をLanceDBテーブルに追加
   ```typescript
   const data = rows.map((r) => ({
     id: r.id,
     vector: r.embedding,
     space_key: r.space_key || r.spaceKey,
     title: r.title,
     labels: r.labels || [],
   }));
   ```

2. 複合フィルタリングのサポート
   ```typescript
   // 複数条件のフィルタリング例
   const filters = {
     space_key: 'CLIENTTOMO',
     labels: ['重要', '仕様書']
   };
   ```

### 6.3 バッチ処理の最適化

1. 差分更新の実装
   - 最終更新日時を記録
   - 更新されたページのみを処理

2. 大規模データの分割処理
   - 最大1000ページ単位でバッチ処理
   - メモリ使用量を監視し、必要に応じて処理を分割

### 6.4 短期で有効な精度改善方針

1. チャンク設計の見直し
   - チャンクサイズ/オーバーラップの最適化（例: 800–1200文字、オーバーラップ 100–200 文字）
   - セクション境界優先のスプリッタ採用（見出し・段落・リスト単位での分割を優先）
   - コードブロック/表などは塊として保持し、文脈の断絶を防止

2. メタデータ強化と正規化
   - ラベルの正規化（大文字小文字統一・重複除去・不要語除外）
   - `space_key`/`labels` をクエリ側フィルタに活用（検索空間を縮小）
   - 重要メタ（タイトル/スペース/更新日時）を常に保持し再ランクに活用

3. 品質評価ループ（RAG評価）
   - 質問-正解ペアで再現率/適合率を測定し、Top-k を最適化
   - 評価セットは代表クエリ（カテゴリ/難易度/長さ）を網羅し、定期回帰テストに組み込み
   - フィードバックに基づき、チャンク設計・フィルタ条件・メタ正規化ルールを更新

## 7. 監視とロギング

### 7.1 監視指標

1. データ同期ステータス
   - 同期開始/完了時間
   - 処理ページ数
   - エラー数

2. 検索パフォーマンス
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

## 8. ローカル開発と運用

### 8.1 開発環境セットアップ

```bash
# 依存関係のインストール
npm i @lancedb/lancedb @lancedb/lancedb-node

# ローカル埋め込みを使用する場合
npm i @xenova/transformers
```

### 8.2 データロード

```bash
# 既存の埋め込みJSONをLanceDBにロード
npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
```

### 8.3 環境変数

```
# 埋め込みプロバイダ設定
EMBEDDINGS_PROVIDER=local  # local / vertex

# Firebaseプロジェクト設定
FIREBASE_PROJECT_ID=confluence-copilot-ppjye

# Confluence API設定
CONFLUENCE_BASE_URL=https://<your-domain>.atlassian.net
CONFLUENCE_USER_EMAIL=<your-email>
CONFLUENCE_API_TOKEN=<your-api-token>
CONFLUENCE_SPACE_KEY=<your-space-key>
```

### 8.4 運用指針

- ローカル開発: `npm run dev` でNext.jsアプリを起動
- テスト: `npm test` で単体テストとE2Eテストを実行
- デプロイ: `firebase deploy` でHostingとFunctionsをデプロイ
- ドメイン制限: Firestore Rulesでドメイン制限を実装
