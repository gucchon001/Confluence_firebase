# LanceDBとConfluenceの統合ガイド

## 1. 概要

このドキュメントでは、ConfluenceからデータをLanceDBに保存し、ベクトル検索を実行するための手順を説明します。LanceDBは軽量なベクトルデータベースであり、ローカル環境での開発やテストに適しています。

## 2. 環境設定

### 2.1 必要なパッケージ

```json
{
  "@lancedb/lancedb": "^0.22.0",
  "@xenova/transformers": "^2.17.2",
  "axios": "^1.11.0",
  "dotenv": "^16.5.0"
}
```

### 2.2 環境変数

`.env`ファイルに以下の環境変数を設定します：

```
EMBEDDINGS_PROVIDER=local
CONFLUENCE_BASE_URL=https://your-confluence-instance.atlassian.net
CONFLUENCE_USER_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=your-space-key
```

## 3. LanceDBの基本操作

### 3.1 データベース接続

```typescript
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

const dbPath = path.resolve('.lancedb');
const db = await lancedb.connect(dbPath);
```

### 3.2 テーブル作成

```typescript
// 最小限のスキーマ定義
interface MinimalRecord {
  id: string;
  vector: number[];
  title: string;
  content: string;
}

const record: MinimalRecord = {
  id: 'document-1',
  vector: [...], // 埋め込みベクトル
  title: 'ドキュメントタイトル',
  content: 'ドキュメントの内容'
};

// テーブル作成
const tableName = 'documents';
const tbl = await db.createTable(tableName, [record]);
```

### 3.3 レコード追加

```typescript
await tbl.add([record]);
```

### 3.4 検索

```typescript
const results = await tbl.search(vector).limit(5).toArray();
```

## 4. 埋め込みベクトル生成

### 4.1 @xenova/transformersを使用した埋め込み

```typescript
import { pipeline } from '@xenova/transformers';

let extractor: any | null = null;

async function getLocalEmbeddings(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // 768次元
}
```

### 4.2 ベクトルの正規化

LanceDBに保存する前に、ベクトルを純粋なnumber[]型に変換することが重要です：

```typescript
const vector = Array.from(rawVector, x => {
  const num = Number(x);
  return Number.isFinite(num) ? num : 0;
});
```

## 5. Confluenceからのデータ取得

### 5.1 Confluence APIの呼び出し

```typescript
import axios from 'axios';

async function fetchConfluencePage(pageId: string): Promise<ConfluencePage> {
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  const userEmail = process.env.CONFLUENCE_USER_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;

  const endpoint = `${baseUrl}/wiki/rest/api/content/${pageId}`;
  const auth = { username: userEmail, password: apiToken };
  const params = {
    expand: 'body.storage,metadata.labels,version,space',
  };

  const response = await axios.get(endpoint, { params, auth, timeout: 30000 });
  return response.data;
}
```

### 5.2 HTMLからのテキスト抽出

```typescript
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  
  // HTMLタグを削除して空白に置換
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  
  // 連続する空白を1つにまとめる
  const normalizedSpaces = withoutTags.replace(/\s+/g, ' ');
  
  // 前後の空白を削除
  return normalizedSpaces.trim();
}
```

## 6. 統合フロー

1. Confluenceからページを取得
2. HTMLからテキストを抽出
3. テキストから埋め込みベクトルを生成
4. ベクトルを純number[]型に変換
5. LanceDBにデータを保存
6. ベクトル検索を実行

## 7. 注意点と既知の問題

### 7.1 ベクトル型の扱い

LanceDBから読み戻したベクトルは標準的なJavaScript配列ではなく、特殊なオブジェクトとして返されます。そのため、以下の点に注意が必要です：

- `Array.isArray(record.vector)`は`false`を返す
- `record.vector.slice()`や`record.vector.map()`などの配列メソッドは使用できない
- ベクトルの内容を確認するには`JSON.stringify(record.vector)`を使用する

### 7.2 mergeInsertの制限

`mergeInsert`メソッドはNode.js v22環境では現在動作しないことが確認されています。エラー「Failed to convert JavaScript value into rust type String」が発生します。レコードの更新が必要な場合は、以下の代替アプローチを使用してください：

1. 既存レコードを削除
2. 新しいレコードを追加

```typescript
// 更新したいレコードのIDを指定
const recordId = 'document-1';

// 既存レコードを削除
await tbl.delete(`id = '${recordId}'`);

// 新しいレコードを追加
await tbl.add([updatedRecord]);
```

## 8. パフォーマンス最適化

### 8.1 バッチ処理

大量のデータを扱う場合は、バッチ処理を検討してください：

```typescript
// バッチサイズ
const batchSize = 10;

// データをバッチに分割
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  await tbl.add(batch);
}
```

### 8.2 メモリ管理

Node.jsのメモリ制限に注意し、必要に応じてガベージコレクションを明示的に実行します：

```typescript
if (global.gc) {
  global.gc();
  console.log('ガベージコレクションを実行しました');
}
```

実行時に`--expose-gc`フラグを使用することで、明示的なガベージコレクションが可能になります：

```
node --expose-gc -r tsx/cjs src/scripts/your-script.ts
```

## 9. 次のステップ

- スキーマの拡張（space_key, labels, pageId, chunkIndex, url, lastUpdatedなどのフィールド追加）
- Firestoreとの連携（メタデータ保存）
- バッチ同期処理の実装
- 検索APIの開発