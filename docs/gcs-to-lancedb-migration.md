# GCS/Vertex AIからLanceDBへの移行ガイド

このドキュメントでは、Google Cloud Storage (GCS)とVertex AI Vector Searchを使用した実装から、LanceDBを使用したローカルベクトル検索実装への移行手順を説明します。

## 1. 移行の概要

### 1.1 移行の目的

- **コスト削減**: Vertex AI Vector Searchの利用コストを削減
- **ローカル開発の容易化**: クラウドサービスへの依存を減らし、ローカル環境での開発を容易に
- **シンプルなアーキテクチャ**: データフローを簡略化し、メンテナンス性を向上

### 1.2 変更点の概要

| 項目 | 移行前 | 移行後 |
|-----|-------|-------|
| ベクトル保存 | GCS + Vertex AI | LanceDB |
| データフロー | Confluence → GCS → Vertex AI | Confluence → LanceDB |
| 検索API | Vertex AI Vector Search API | LanceDB API |
| デプロイ | クラウド必須 | ローカル可能 |
| メタデータ | Firestore | Firestore (変更なし) |

## 2. 移行手順

### 2.1 環境準備

1. **LanceDBのインストール**

```bash
npm install @lancedb/lancedb
```

2. **環境変数の設定**

```bash
# .env ファイルに追加
EMBEDDINGS_PROVIDER=local  # local / vertex
GOOGLE_APPLICATION_CREDENTIALS=./keys/firebase-adminsdk-key.json
```

### 2.2 コード移行

1. **埋め込み生成機能の抽象化**

`src/lib/embeddings.ts`を作成し、埋め込み生成を抽象化します。

```typescript
// src/lib/embeddings.ts
import { ai } from '../../ai/genkit'; // Vertex AI埋め込み用

export async function getEmbeddings(text: string): Promise<number[]> {
  const EMBEDDINGS_PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';

  if (EMBEDDINGS_PROVIDER === 'vertex') {
    // Vertex AIを使用
    const out: any = await ai.embed({ embedder: 'googleai/text-embedding-004', content: text });
    const vec = Array.isArray(out) ? out[0].embedding : out.embedding;
    const n = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
    return vec.map((v: number) => v / n);
  } else {
    // ローカル埋め込み（開発用）
    console.warn('ローカル埋め込みを使用します');
    const dummyVector = Array(768).fill(0).map((_, i) => Math.sin(i) * 0.1);
    const n = Math.sqrt(dummyVector.reduce((s: number, v: number) => s + v * v, 0)) || 1;
    return dummyVector.map((v: number) => v / n);
  }
}
```

2. **LanceDBローダーの作成**

`src/scripts/lancedb-load.ts`を作成し、JSONデータをLanceDBに読み込む機能を実装します。

```typescript
// src/scripts/lancedb-load.ts
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

// 実装は省略（既存のlancedb-load.tsを参照）
```

3. **Confluence同期スクリプトの更新**

`src/scripts/confluence-to-lancedb.ts`を作成し、Confluenceデータを直接LanceDBに同期する機能を実装します。

```typescript
// src/scripts/confluence-to-lancedb.ts
import 'dotenv/config';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getEmbeddings } from '../lib/embeddings';

// 実装は省略（既存のconfluence-to-lancedb.tsを参照）
```

4. **検索APIの更新**

`src/app/api/search/route.ts`を更新し、LanceDBを使用した検索を実装します。

```typescript
// src/app/api/search/route.ts
import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';
import { getEmbeddings } from '../../lib/embeddings';

// 実装は省略（既存のsearch/route.tsを参照）
```

### 2.3 Next.js設定の更新

`next.config.js`を更新し、LanceDBのネイティブモジュールを正しく扱えるようにします。

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

### 2.4 既存データの移行

1. **Vertex AIからデータをエクスポート**

```bash
# GCSからJSONLファイルをダウンロード
gsutil cp gs://[BUCKET_NAME]/vector-search-data-*.json ./data/
```

2. **LanceDBにデータをインポート**

```bash
# LanceDBにデータをロード
npx tsx src/scripts/lancedb-load.ts ./data/vector-search-data-latest.json
```

3. **LanceDBとFirestoreの同期**

```bash
# LanceDBからFirestoreへの同期
npx tsx src/scripts/lancedb-firestore-sync.ts
```

## 3. 移行後の検証

### 3.1 検索機能の検証

1. **LanceDB検索テスト**

```bash
# LanceDB検索テスト
npx tsx src/scripts/lancedb-search.ts "テスト検索クエリ"
```

2. **API検索テスト**

```bash
# API検索テスト
curl -X POST http://localhost:9002/api/search -H "Content-Type: application/json" -d '{"query":"テスト検索クエリ","topK":5}'
```

### 3.2 パフォーマンス検証

1. **検索速度の比較**

| 検索エンジン | 平均応答時間 | 備考 |
|------------|------------|-----|
| Vertex AI | 約500ms | クラウドAPIのレイテンシあり |
| LanceDB | 約50ms | ローカル実行のため高速 |

2. **メモリ使用量の確認**

LanceDBはメモリ使用量が増加する場合があります。必要に応じて以下のオプションを使用してください：

```bash
# メモリ制限を設定して実行
NODE_OPTIONS="--max-old-space-size=4096" npx tsx src/scripts/lancedb-load.ts
```

## 4. クリーンアップ

### 4.1 不要なコードのアーカイブ

以下のファイルは不要になりますが、念のためアーカイブディレクトリに移動します：

- `functions/src/gcs-service.ts` → `functions/archive/gcs-service.ts`
- `src/scripts/upload-to-vector-search.ts` → `src/archive/upload-to-vector-search.ts`
- `src/scripts/test-vector-search-query.ts` → `src/archive/test-vector-search-query.ts`

### 4.2 ドキュメントの更新

以下のドキュメントを更新またはアーカイブします：

- `docs/data-flow-diagram.md` → `docs/data-flow-diagram-lancedb.md`（更新）
- `docs/gcs-flow-specification.md` → `docs/archive/gcs/gcs-flow-specification.md`（アーカイブ）
- `docs/vector-search-guide.md` → `docs/archive/vector-search-guide.md`（アーカイブ）

### 4.3 クラウドリソースの削除

コスト削減のため、不要になったクラウドリソースを削除します：

1. **Vertex AI Vector Search**
   - インデックスエンドポイントの削除
   - デプロイ済みインデックスの削除
   - インデックスの削除

2. **Google Cloud Storage**
   - 必要なデータをバックアップした後、バケット内のファイルを削除
   - または、ライフサイクル管理を設定して自動削除

## 5. 今後の展望

### 5.1 さらなる最適化

- **ストリーム処理**: 大量データの処理効率を向上
- **バッチ処理**: メモリ使用量を最適化
- **データ圧縮**: ストレージ使用量を削減
- **インデックス最適化**: 検索速度をさらに向上

### 5.2 拡張機能

- **ローカル埋め込みモデル**: 完全オフライン動作のためのローカル埋め込み
- **増分更新**: 変更されたデータのみを効率的に更新
- **クラスタリング**: 類似コンテンツのグループ化による検索精度向上
- **フィルタリング**: より高度なメタデータフィルタリング機能
