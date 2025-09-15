# LanceDBとFirestoreの統合ガイド [アーカイブ]

> **注意**: このドキュメントは古い設計に基づいており、現在は使用されていません。現在の実装ではLanceDBのみを使用し、Firestoreとの統合は行っていません。このドキュメントは参考のために保存されています。

## 1. 概要

このドキュメントでは、LanceDBとFirestoreを統合して、効率的なベクトル検索とメタデータ管理を実現する方法について説明します。この統合アプローチでは、LanceDBをベクトル検索エンジンとして使用し、Firestoreを構造化メタデータのストレージとして使用します。

## 2. アーキテクチャ

### 2.1 ハイブリッドアーキテクチャの概要

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Confluence │────▶│  埋め込み   │────▶│   LanceDB   │
│    API      │     │  生成処理   │     │ (ベクトル)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Firestore  │
                                        │ (メタデータ) │
                                        └─────────────┘
                                               ▲
                                               │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   検索UI    │◀───▶│  検索API   │◀────│  検索結果   │
│             │     │            │     │  統合処理   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 2.2 データフロー

1. Confluenceからデータを取得
2. テキストデータから埋め込みベクトルを生成
3. ベクトルデータをLanceDBに保存
4. メタデータをFirestoreに保存
5. 検索時にLanceDBでベクトル検索を実行
6. 検索結果のIDを使用してFirestoreからメタデータを取得
7. 結果を統合してクライアントに返す

## 3. データモデル

### 3.1 LanceDBのデータモデル

```typescript
interface LanceDBRecord {
  id: string;           // ドキュメントID（Firestoreと共通）
  vector: number[];     // 埋め込みベクトル
  title: string;        // タイトル（検索用）
  content: string;      // コンテンツ（検索用）
  space_key: string;    // スペースキー（フィルタリング用）
  labels: string[];     // ラベル（フィルタリング用）
}
```

### 3.2 Firestoreのデータモデル

```typescript
interface FirestoreRecord {
  id: string;           // ドキュメントID（LanceDBと共通）
  pageId: string;       // 元のページID
  title: string;        // タイトル
  spaceKey: string;     // スペースキー
  url: string;          // URL
  content: string;      // コンテンツ
  labels: string[];     // ラベル
  chunkIndex: number;   // チャンクインデックス
  lastUpdated: string;  // 最終更新日時
  // 追加のメタデータフィールド
}
```

## 4. 実装手順

### 4.1 データ同期の実装

```typescript
import * as admin from 'firebase-admin';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const serviceAccount = require(path.resolve(serviceAccountPath));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

async function syncDataToLanceDBAndFirestore(records) {
  // LanceDBに接続
  const dbPath = path.resolve('.lancedb');
  const db = await lancedb.connect(dbPath);
  const tableName = 'confluence';
  
  // テーブルが存在するか確認
  const tableExists = (await db.tableNames()).includes(tableName);
  let tbl;
  
  if (!tableExists) {
    // テーブルを作成
    tbl = await db.createTable(tableName, []);
  } else {
    // 既存のテーブルを開く
    tbl = await db.openTable(tableName);
  }
  
  // Firestoreへの参照
  const firestore = admin.firestore();
  const chunksCollection = firestore.collection('chunks');
  
  // バッチ処理
  const batchSize = 10;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    // LanceDBレコードとFirestoreレコードの準備
    const lancedbRecords = [];
    const firestorePromises = [];
    
    for (const record of batch) {
      // 埋め込みベクトルを生成
      const vector = await getEmbeddings(record.content);
      
      // LanceDBレコード
      lancedbRecords.push({
        id: record.id,
        vector: vector,
        title: record.title,
        content: record.content,
        space_key: record.spaceKey,
        labels: record.labels || []
      });
      
      // Firestoreレコード
      firestorePromises.push(
        chunksCollection.doc(record.id).set({
          pageId: record.pageId,
          title: record.title,
          spaceKey: record.spaceKey,
          url: record.url,
          content: record.content,
          labels: record.labels || [],
          chunkIndex: record.chunkIndex,
          lastUpdated: record.lastUpdated || new Date().toISOString()
        })
      );
    }
    
    // LanceDBに保存
    await tbl.add(lancedbRecords);
    
    // Firestoreに保存
    await Promise.all(firestorePromises);
    
    console.log(`バッチ処理完了: ${i + 1}〜${Math.min(i + batchSize, records.length)}/${records.length}`);
  }
  
  console.log('同期完了');
}
```

### 4.2 検索APIの実装

```typescript
import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../../../../keys/firebase-adminsdk-key.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin初期化エラー:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const filters: Record<string, string | string[]> | undefined = body?.filters;
    
    if (!query) return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });

    // 1. クエリを埋め込みベクトルに変換
    const vec = await getEmbeddings(query);
    
    // 2. LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // 3. 検索クエリを構築
    let q = tbl.search(vec).limit(topK);
    
    // フィルタリングを適用
    if (filters) {
      const clauses: string[] = [];
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) {
          if (v.length > 0) {
            clauses.push(`${k} IN (${v.map((x) => `'${x}'`).join(',')})`);
          }
        } else if (v) {
          clauses.push(`${k} = '${v}'`);
        }
      }
      if (clauses.length) {
        q = q.where(clauses.join(' AND '));
      }
    }
    
    // 4. 検索実行
    const results = await q.toArray();
    
    // 5. Firestoreからメタデータを取得
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const id = result.id;
        
        try {
          const doc = await admin.firestore().collection('chunks').doc(id).get();
          
          if (doc.exists) {
            // Firestoreのデータと結合
            return {
              ...result,
              ...doc.data(),
              distance: result._distance
            };
          } else {
            // Firestoreにデータがない場合はLanceDBのデータのみを返す
            return {
              ...result,
              distance: result._distance
            };
          }
        } catch (error) {
          console.error(`Firestoreからのデータ取得エラー (ID: ${id}):`, error);
          return {
            ...result,
            distance: result._distance
          };
        }
      })
    );
    
    // 6. レスポンス返却
    return new Response(JSON.stringify({ results: enrichedResults }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
```

## 5. データ同期戦略

### 5.1 完全同期

すべてのデータを一度に同期する方法です。初期ロードや完全リフレッシュに適しています。

```typescript
async function fullSync() {
  // Confluenceからすべてのデータを取得
  const allPages = await fetchAllConfluencePages();
  
  // ページをチャンクに分割
  const chunks = [];
  for (const page of allPages) {
    const pageChunks = splitPageIntoChunks(page);
    chunks.push(...pageChunks);
  }
  
  // LanceDBとFirestoreに同期
  await syncDataToLanceDBAndFirestore(chunks);
}
```

### 5.2 差分同期

前回の同期以降に変更されたデータのみを同期する方法です。定期的な更新に適しています。

```typescript
async function differentialSync() {
  // 前回の同期日時を取得
  const lastSyncDoc = await admin.firestore().collection('system').doc('lastSync').get();
  const lastSyncTime = lastSyncDoc.exists ? lastSyncDoc.data().timestamp : null;
  
  // Confluenceから更新されたデータを取得
  const updatedPages = await fetchUpdatedConfluencePages(lastSyncTime);
  
  // ページをチャンクに分割
  const chunks = [];
  for (const page of updatedPages) {
    const pageChunks = splitPageIntoChunks(page);
    chunks.push(...pageChunks);
  }
  
  // LanceDBとFirestoreに同期
  await syncDataToLanceDBAndFirestore(chunks);
  
  // 同期日時を更新
  await admin.firestore().collection('system').doc('lastSync').set({
    timestamp: new Date().toISOString()
  });
}
```

## 6. エラー処理と再試行

### 6.1 エラーハンドリング

```typescript
async function robustSync(records) {
  const failedRecords = [];
  
  for (const record of records) {
    try {
      await syncRecord(record);
    } catch (error) {
      console.error(`レコード同期エラー (ID: ${record.id}):`, error);
      failedRecords.push({ record, error });
    }
  }
  
  return failedRecords;
}
```

### 6.2 再試行メカニズム

```typescript
async function syncWithRetry(records, maxRetries = 3) {
  let remainingRecords = [...records];
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (remainingRecords.length === 0) break;
    
    console.log(`試行 ${attempt}/${maxRetries}: ${remainingRecords.length}件のレコードを同期`);
    
    const failedRecords = await robustSync(remainingRecords);
    
    if (failedRecords.length === 0) {
      console.log('すべてのレコードの同期が完了しました');
      break;
    }
    
    remainingRecords = failedRecords.map(f => f.record);
    
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 指数バックオフ
      console.log(`${delay}ミリ秒後に再試行します...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (remainingRecords.length > 0) {
    console.error(`${remainingRecords.length}件のレコードが同期できませんでした`);
    return false;
  }
  
  return true;
}
```

## 7. パフォーマンス最適化

### 7.1 インデックス作成

```typescript
// LanceDBのベクトルインデックス作成
await tbl.createIndex({
  vectors: { vector: 768 },
  config: lancedb.index.hnsw({
    M: 16,
    efConstruction: 100,
    distanceType: "cosine"
  })
});

// Firestoreのインデックス
// Firestoreコンソールで以下のフィールドにインデックスを作成:
// - spaceKey
// - labels
// - lastUpdated
```

### 7.2 キャッシュ戦略

```typescript
// メモリキャッシュの実装
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5分

async function getCachedFirestoreData(id) {
  const now = Date.now();
  const cacheKey = `firestore:${id}`;
  
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    
    // キャッシュが有効期限内であれば使用
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
  }
  
  // Firestoreからデータを取得
  const doc = await admin.firestore().collection('chunks').doc(id).get();
  const data = doc.exists ? doc.data() : null;
  
  // キャッシュに保存
  cache.set(cacheKey, { data, timestamp: now });
  
  return data;
}
```

## 8. 運用と監視

### 8.1 同期ステータスの追跡

```typescript
async function trackSyncStatus(operation, status, details = {}) {
  await admin.firestore().collection('syncLogs').add({
    operation,
    status,
    details,
    timestamp: new Date().toISOString()
  });
}

// 使用例
try {
  await fullSync();
  await trackSyncStatus('fullSync', 'success', { count: records.length });
} catch (error) {
  await trackSyncStatus('fullSync', 'error', { error: error.message });
  throw error;
}
```

### 8.2 データ整合性の検証

```typescript
async function validateDataConsistency() {
  // LanceDBのレコード数を取得
  const dbPath = path.resolve('.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');
  const lancedbCount = await tbl.countRows();
  
  // Firestoreのレコード数を取得
  const snapshot = await admin.firestore().collection('chunks').count().get();
  const firestoreCount = snapshot.data().count;
  
  console.log(`LanceDB: ${lancedbCount}件, Firestore: ${firestoreCount}件`);
  
  if (lancedbCount !== firestoreCount) {
    console.warn(`データ不整合: LanceDBとFirestoreのレコード数が一致しません (差: ${Math.abs(lancedbCount - firestoreCount)}件)`);
    return false;
  }
  
  return true;
}
```

## 9. まとめ

LanceDBとFirestoreの統合により、以下のメリットが得られます：

1. LanceDBによる高速なベクトル検索
2. Firestoreによる柔軟なメタデータ管理
3. クラウドとローカル環境の両方での動作
4. スケーラブルなアーキテクチャ

この統合アプローチは、RAG（Retrieval-Augmented Generation）システムや検索アプリケーションに最適です。特に、ローカル開発環境でのテストや、コスト効率の良い実装を目指す場合に有効です。

## 10. 参考リソース

- [LanceDB 公式ドキュメント](https://lancedb.github.io/lancedb/)
- [Firebase Firestore ドキュメント](https://firebase.google.com/docs/firestore)