# LanceDBとFirebaseの統合ガイド

## 1. 概要

このガイドでは、LanceDBとFirebase（特にFirestore）を統合して、効率的なベクトル検索システムを構築する方法について説明します。LanceDBはベクトル検索に優れており、Firestoreはメタデータの管理に適しています。これらを組み合わせることで、高性能で柔軟な検索システムを実現できます。

## 2. アーキテクチャ

### 2.1 全体アーキテクチャ

```
+-------------+     +-------------+     +--------------+
|             |     |             |     |              |
| クライアント  +---->  Next.js API  +---->  LanceDB     |
|             |     |             |     |  (ベクトル検索) |
+-------------+     +------+------+     +--------------+
                           |
                           v
                    +--------------+
                    |              |
                    |  Firestore   |
                    | (メタデータ)  |
                    |              |
                    +--------------+
```

### 2.2 データフロー

1. クライアントから検索クエリを受信
2. クエリをベクトルに変換
3. LanceDBでベクトル検索を実行
4. 検索結果のIDを使用してFirestoreからメタデータを取得
5. 検索結果とメタデータを結合してクライアントに返す

## 3. 前提条件

- Node.js環境
- LanceDB（`@lancedb/lancedb`）がインストールされていること
- Firebase Admin SDK（`firebase-admin`）がインストールされていること
- Firebaseサービスアカウントキー（`firebase-adminsdk-key.json`）

## 4. セットアップ

### 4.1 パッケージのインストール

```bash
npm install @lancedb/lancedb firebase-admin
```

### 4.2 環境変数の設定

`.env`ファイルに以下の設定を追加します：

```
EMBEDDINGS_PROVIDER=local
GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-adminsdk-key.json
```

### 4.3 Next.jsの設定

`next.config.js`に以下の設定を追加します：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverExternalPackages: ['@lancedb/lancedb', '@lancedb/lancedb-node'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'firebase-admin': 'commonjs firebase-admin',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
```

## 5. Firebase Admin SDKの初期化

```typescript
import * as admin from 'firebase-admin';

// Firebase Adminの初期化
if (!admin.apps.length) {
  try {
    // サービスアカウントキーを使用して初期化
    const serviceAccount = require('../../../../keys/firebase-adminsdk-key.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with service account');
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    // フォールバック: アプリケーションデフォルト認証情報を試す
    try {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      console.log('Firebase Admin initialized with application default credentials');
    } catch (fallbackError) {
      console.error('Firebase admin fallback initialization error:', fallbackError);
    }
  }
}

// Firestoreインスタンスを取得
const firestore = admin.firestore();
```

## 6. LanceDBの初期化

```typescript
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

// LanceDBに接続
const dbPath = path.resolve(process.cwd(), '.lancedb');
const db = await lancedb.connect(dbPath);

// テーブルを開く
const tableName = 'confluence';
const tbl = await db.openTable(tableName);
```

## 7. 統合実装

### 7.1 検索API実装

```typescript
import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

// Firebase Adminの初期化（上記のコードを使用）

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const filters: Record<string, string | string[]> | undefined = body?.filters;
    if (!query) return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });

    console.log(`Search query: "${query}", topK: ${topK}, filters:`, filters);

    // 1. クエリを埋め込みベクトルに変換
    const vec = await getEmbeddings(query);
    console.log(`Generated embedding vector (${vec.length} dimensions)`);

    // 2. LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`Connecting to LanceDB at ${dbPath}`);
    
    try {
      const db = await lancedb.connect(dbPath);
      
      // テーブル存在確認
      const tableNames = await db.tableNames();
      const tableName = 'confluence';
      if (!tableNames.includes(tableName)) {
        console.error(`Table '${tableName}' not found`);
        return new Response(JSON.stringify({ error: `Vector database table '${tableName}' not found` }), { status: 500 });
      }

      // 3. テーブルを開いて検索
      const tbl = await db.openTable(tableName);
      console.log(`Opened table '${tableName}'`);

      // 4. 検索クエリを構築
      let q = tbl.search(vec).limit(topK);
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
          console.log(`Applying filter: ${clauses.join(' AND ')}`);
          q = q.where(clauses.join(' AND '));
        }
      }

      // 5. 検索実行
      console.log('Executing search...');
      const results = await q.execute();
      
      // 6. 結果を配列に変換
      const resultArray: any[] = [];
      
      // 結果を処理
      for await (const batch of results) {
        for (let i = 0; i < batch.length; i++) {
          const row = batch[i];
          resultArray.push({
            id: row.id,
            _distance: row._distance,
            space_key: row.space_key,
            title: row.title,
            labels: row.labels || []
          });
        }
      }
      
      console.log(`Found ${resultArray.length} results`);

      // 7. Firestoreからメタデータを取得
      const docs = await Promise.all(
        resultArray.map(async (result: any) => {
          const id = result.id;
          if (!id) return { ...result, distance: result._distance };
          
          try {
            // Firestoreが初期化されているか確認
            if (!admin.apps.length || !admin.apps[0].options.credential) {
              console.log(`Firestore not initialized, using LanceDB data only for ${id}`);
              return { 
                id, 
                distance: result._distance, 
                title: result.title, 
                space_key: result.space_key,
                content: result.content || null,
                labels: result.labels || []
              };
            }
            
            const snap = await admin.firestore().collection('chunks').doc(id).get();
            if (!snap.exists) {
              console.log(`Firestore document not found for ${id}, using LanceDB data`);
              // Firestoreにデータが存在しない場合は、LanceDBのデータをFirestoreに保存
              try {
                await admin.firestore().collection('chunks').doc(id).set({
                  pageId: result.pageId || id.split('-')[0],
                  title: result.title,
                  spaceKey: result.space_key,
                  content: result.content,
                  labels: result.labels || [],
                  lastUpdated: new Date().toISOString(),
                  syncedFromLanceDB: true
                }, { merge: true });
                console.log(`Synced LanceDB data to Firestore for ${id}`);
              } catch (syncError) {
                console.error(`Failed to sync LanceDB data to Firestore for ${id}:`, syncError);
              }
            }
            
            return { 
              id, 
              distance: result._distance,
              ...(snap.exists ? snap.data() : {}),
              title: result.title || (snap.exists ? snap.data()?.title : null),
              space_key: result.space_key || (snap.exists ? snap.data()?.spaceKey : null),
              content: (snap.exists ? snap.data()?.content : null) || result.content,
              labels: (snap.exists ? snap.data()?.labels : null) || result.labels || []
            };
          } catch (error) {
            console.error(`Error fetching Firestore data for ${id}:`, error);
            return { 
              id, 
              distance: result._distance, 
              title: result.title, 
              space_key: result.space_key,
              content: result.content || null,
              labels: result.labels || []
            };
          }
        })
      );

      // 8. レスポンス返却
      return new Response(JSON.stringify({ results: docs }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (lanceDbError) {
      console.error('LanceDB error:', lanceDbError);
      return new Response(JSON.stringify({ 
        error: `LanceDB error: ${lanceDbError.message}`,
        details: lanceDbError.stack
      }), { status: 500 });
    }
  } catch (e: any) {
    console.error('Search API error:', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
```

### 7.2 データ同期実装

LanceDBとFirestoreのデータを同期するための関数を実装します：

```typescript
/**
 * LanceDBのデータをFirestoreと同期する関数
 */
async function syncLanceDBToFirestore(tableName: string = 'confluence'): Promise<void> {
  // LanceDBに接続
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  
  // テーブル存在確認
  const tableNames = await db.tableNames();
  if (!tableNames.includes(tableName)) {
    console.error(`Table '${tableName}' not found`);
    return;
  }
  
  // テーブルを開く
  const tbl = await db.openTable(tableName);
  console.log(`Opened table '${tableName}'`);
  
  // すべてのレコードを取得
  const records = await tbl.query().toArray();
  console.log(`Found ${records.length} records in LanceDB`);
  
  // Firestoreが初期化されているか確認
  if (!admin.apps.length || !admin.apps[0].options.credential) {
    console.error('Firestore not initialized');
    return;
  }
  
  // Firestoreインスタンスを取得
  const firestore = admin.firestore();
  
  // バッチ処理のための準備
  const batchSize = 500;
  const batches = [];
  
  // バッチに分割
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  
  // バッチごとに処理
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);
    
    // バッチ内のレコードを処理
    for (const record of batch) {
      const id = record.id;
      if (!id) continue;
      
      try {
        // Firestoreのドキュメントを取得
        const snap = await firestore.collection('chunks').doc(id).get();
        
        // Firestoreにデータが存在しない場合は保存
        if (!snap.exists) {
          await firestore.collection('chunks').doc(id).set({
            pageId: record.pageId || record.page_id || id.split('-')[0],
            title: record.title,
            spaceKey: record.space_key,
            content: record.content,
            labels: record.labels || [],
            lastUpdated: new Date().toISOString(),
            syncedFromLanceDB: true
          }, { merge: true });
          console.log(`Synced LanceDB data to Firestore for ${id}`);
        }
      } catch (error) {
        console.error(`Error syncing data for ${id}:`, error);
      }
    }
  }
  
  console.log('Sync completed');
}
```

## 8. エラーハンドリングとベストプラクティス

### 8.1 エラーハンドリング

LanceDBとFirestoreの操作は常にtry-catchブロックで囲み、エラーを適切に処理してください：

```typescript
try {
  // LanceDBまたはFirestore操作
} catch (error) {
  console.error('Operation failed:', error);
  // エラーに応じた適切な処理
}
```

### 8.2 接続管理

LanceDBとFirebase Admin SDKの初期化は、アプリケーションの起動時に一度だけ行うようにしてください。特にFirebase Admin SDKは複数回初期化するとエラーが発生します：

```typescript
if (!admin.apps.length) {
  // Firebase Admin SDKを初期化
}
```

### 8.3 パフォーマンス最適化

- **バッチ処理**: 大量のデータを処理する場合は、バッチ処理を使用してください
- **インデックス**: LanceDBのテーブルにインデックスを作成して検索パフォーマンスを向上させてください
- **キャッシュ**: 頻繁に使用されるデータはキャッシュすることを検討してください

## 9. テスト

LanceDBとFirestoreの統合をテストするためのテストケースを実装してください：

```typescript
/**
 * LanceDBとFirestore統合テスト
 */
import { describe, test, expect, beforeAll } from 'vitest';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

// Firebase Admin SDKの初期化
function initializeFirebase() {
  // 初期化コード
}

describe('LanceDBとFirestore統合テスト', () => {
  let db: lancedb.Connection;
  let tbl: lancedb.Table;
  let firestore: FirebaseFirestore.Firestore | null = null;
  
  // テスト前の準備
  beforeAll(async () => {
    // LanceDBに接続
    db = await lancedb.connect(path.resolve('.lancedb'));
    
    // テスト用テーブルを作成
    tbl = await db.createTable('test_table', [{
      id: 'test-1',
      vector: Array(10).fill(0).map(() => Math.random()),
      title: 'テストタイトル',
      content: 'テスト内容'
    }]);
    
    // Firebase Admin SDKを初期化
    if (initializeFirebase()) {
      firestore = admin.firestore();
    }
  });
  
  test('LanceDB-Firestore統合検索テスト', async () => {
    // テストコード
  });
});
```

## 10. デプロイと運用

### 10.1 環境変数の設定

本番環境では、環境変数を適切に設定してください：

```
EMBEDDINGS_PROVIDER=local
GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-adminsdk-key.json
```

### 10.2 セキュリティ

- サービスアカウントキーは機密情報であり、Gitリポジトリにコミットしないでください
- `.gitignore`ファイルに`keys/*.json`を追加してください
- Firebaseのセキュリティルールを適切に設定してください

### 10.3 監視とロギング

- エラーログを適切に記録してください
- パフォーマンスメトリクスを監視してください
- 定期的にデータの整合性を確認してください

## 11. まとめ

LanceDBとFirestoreを統合することで、高性能なベクトル検索と柔軟なメタデータ管理を組み合わせた検索システムを構築できます。このガイドに従って実装することで、効率的で拡張性の高いシステムを実現できます。

## 12. 参考リソース

- [LanceDB公式ドキュメント](https://lancedb.github.io/lancedb/)
- [Firebase Admin SDK公式ドキュメント](https://firebase.google.com/docs/admin/setup)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
