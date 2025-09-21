# LanceDBを使用したハイブリッド検索の実装

## 1. ハイブリッド検索とは

ハイブリッド検索は、ベクトル検索（意味的類似性）とキーワード検索（正確なマッチング）を組み合わせた検索手法です。これにより、検索の精度と関連性を向上させることができます。

## 2. 現行実装の中核（概要）

本プロジェクトの中核は `src/lib/lancedb-search-client.ts` の `searchLanceDB` です。実行ステップは次の通りです。

1) 事前処理（並列）
- 埋め込み生成（384次元）: `getEmbeddings(query)`
- キーワード抽出: `extractKeywordsHybrid(query)`（高/低優先語）
- LanceDB接続とテーブルオープン（`.lancedb/`）

2) 候補取得（早期ラベル除外）
- ベクトル: `executeVectorSearch`
- キーワード: `executeKeywordSearch`（LIKE）
- BM25/Lunr: `executeBM25Search`（準備済みなら候補→`pageId`で join）
- タイトル厳格一致: `executeTitleExactSearch`

3) スコア付与と融合
- キーワード: `calculateKeywordScore`
- ラベル: `calculateLabelScore`
- ハイブリッド: `calculateHybridScore(distance, keywordScore, labelScore)`

4) 再ランク/整形
- 重複除去（タイトル）→ 表示用フィールド付与 → 上位 `topK` を返却

パラメータ例: `query`, `topK`, `useLunrIndex`, `labelFilters`, `tableName`

注意: Lunrが未初期化の場合、LIKE検索へフォールバックします。

## 3. ハイブリッド検索の種類

### 3.1 フィルタリングによるハイブリッド検索

最も基本的なハイブリッド検索は、ベクトル検索の結果をキーワードでフィルタリングする方法です：

```typescript
// ベクトル検索 + テキストフィルタリング
const results = await tbl.search(vector)
  .where(`content LIKE '%検索キーワード%'`)
  .limit(5)
  .toArray();
```

### 3.2 スコア結合によるハイブリッド検索

ベクトル検索のスコアとキーワード検索のスコアを結合する方法もあります。LanceDBのJavaScript APIでは直接サポートされていないため、以下のように実装します：

```typescript
// 1. ベクトル検索を実行
const vectorResults = await tbl.search(vector).limit(20).toArray();

// 2. キーワードでフィルタリングしてスコアを計算
const hybridResults = vectorResults
  .map(record => {
    // キーワードの出現回数をカウント
    const keywordCount = (record.content.match(new RegExp(keyword, 'gi')) || []).length;
    // ベクトル距離とキーワードスコアを組み合わせた複合スコア
    const combinedScore = record._distance * 0.7 + (keywordCount > 0 ? -0.3 : 0);
    return { ...record, _combinedScore: combinedScore };
  })
  // 複合スコアでソート（距離が小さい方が類似度が高い）
  .sort((a, b) => a._combinedScore - b._combinedScore)
  .slice(0, 5);
```

## 4. リランキングによるハイブリッド検索

ベクトル検索の結果を、より高度なモデルを使用してリランキングする方法も効果的です：

```typescript
// 1. ベクトル検索を実行
const vectorResults = await tbl.search(vector).limit(20).toArray();

// 2. リランキング用の関数
async function rerank(query: string, results: any[]) {
  // リランキングロジックを実装
  // 例: BM25スコアリングや他のモデルを使用
  return results.map(record => {
    // ここでは簡易的なスコアリング
    const titleMatch = record.title.includes(query) ? 0.5 : 0;
    const contentMatch = record.content.includes(query) ? 0.3 : 0;
    const newScore = record._distance - titleMatch - contentMatch;
    return { ...record, _score: newScore };
  }).sort((a, b) => a._score - b._score);
}

// 3. リランキングを適用
const rerankedResults = await rerank(queryText, vectorResults);
```

## 5. フィルタリングの最適化

### 5.1 インデックスを使用したフィルタリング

LanceDBでは、フィルタリングに使用するフィールドにインデックスを作成することで、パフォーマンスを向上させることができます：

```typescript
// スカラーインデックスの作成
await tbl.createIndex({
  field: "space_key",
  config: lancedb.index.scalar()
});

// インデックスを使用したフィルタリング
const results = await tbl.search(vector)
  .where(`space_key = 'TEST'`)
  .limit(5)
  .toArray();
```

### 5.2 複合フィルタリング

複数の条件を組み合わせたフィルタリングも可能です：

```typescript
// 複合フィルタリング
const results = await tbl.search(vector)
  .where(`space_key = 'TEST' AND chunk_index = 0 AND content LIKE '%検索キーワード%'`)
  .limit(5)
  .toArray();
```

## 6. 実装例：API/ユースケース

### 6.1 推奨: 中核関数 `searchLanceDB` を直接利用

```typescript
import { searchLanceDB } from '../lib/lancedb-search-client';

const results = await searchLanceDB({
  query: 'ログイン 仕様',
  topK: 12,
  useLunrIndex: true,
  labelFilters: { includeMeetingNotes: false, includeArchived: false },
  tableName: 'confluence',
});
```

### 6.2 参考: ベクトル単体の簡易検索API

```typescript
import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const filters: Record<string, string | string[]> | undefined = body?.filters;
    const useHybrid: boolean = body?.useHybrid || false;
    
    if (!query) return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });

    // 1. クエリを埋め込みベクトルに変換
    const vec = await getEmbeddings(query);
    
    // 2. LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // 3. 検索クエリを構築
    let q = tbl.search(vec).limit(useHybrid ? topK * 3 : topK); // ハイブリッド検索の場合は多めに取得
    
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
    let results = await q.toArray();
    
    // 5. ハイブリッド検索の場合はリランキング
    if (useHybrid && query.trim().length > 0) {
      const keywords = query.toLowerCase().split(/\s+/);
      
      results = results.map(record => {
        // タイトルとコンテンツのキーワードマッチングスコアを計算
        const titleLower = record.title.toLowerCase();
        const contentLower = record.content.toLowerCase();
        
        let keywordScore = 0;
        for (const keyword of keywords) {
          if (keyword.length < 2) continue; // 短すぎるキーワードはスキップ
          
          // タイトルに含まれる場合は高いスコア
          if (titleLower.includes(keyword)) {
            keywordScore += 0.5;
          }
          
          // コンテンツに含まれる場合はより低いスコア
          if (contentLower.includes(keyword)) {
            keywordScore += 0.3;
          }
        }
        
        // ベクトル距離とキーワードスコアを組み合わせた複合スコア
        // 距離が小さいほど類似度が高いため、キーワードスコアは引き算
        const hybridScore = record._distance - (keywordScore * 0.5);
        
        return {
          ...record,
          _keywordScore: keywordScore,
          _hybridScore: hybridScore
        };
      })
      .sort((a, b) => a._hybridScore - b._hybridScore) // ハイブリッドスコアでソート
      .slice(0, topK); // 上位K件を返す
    }
    
    // 6. レスポンス返却
    return new Response(JSON.stringify({ results }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
```

## 6. ハイブリッド検索のベストプラクティス

### 6.1 重みの調整

ベクトル検索とキーワード検索の重みは、ユースケースに応じて調整する必要があります：

```typescript
// 重みの調整
const vectorWeight = 0.7; // ベクトル検索の重み
const keywordWeight = 0.3; // キーワード検索の重み

const hybridScore = record._distance * vectorWeight - keywordScore * keywordWeight;
```

### 6.2 キャッシュの活用

頻繁に使用されるクエリの結果をキャッシュすることで、パフォーマンスを向上させることができます：

```typescript
// キャッシュの実装例（簡易版）
const cache = new Map();

async function searchWithCache(query, vector, filters) {
  const cacheKey = JSON.stringify({ query, filters });
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // 検索を実行
  const results = await performSearch(vector, filters);
  
  // キャッシュに保存
  cache.set(cacheKey, results);
  
  return results;
}
```

### 6.3 段階的検索

大規模なデータセットでは、段階的な検索アプローチが効果的です：

1. まず、ベクトル検索で候補を絞り込む
2. 次に、キーワードフィルタリングを適用
3. 最後に、詳細なリランキングを行う

```typescript
// 段階的検索の実装例
async function tieredSearch(query, vector, filters) {
  // 1. ベクトル検索で候補を取得（多めに）
  const candidates = await tbl.search(vector).limit(100).toArray();
  
  // 2. キーワードフィルタリング
  const filteredCandidates = candidates.filter(record => 
    record.content.toLowerCase().includes(query.toLowerCase())
  );
  
  // 3. リランキング
  const rerankedResults = rerank(query, filteredCandidates);
  
  return rerankedResults.slice(0, 10); // 上位10件を返す
}
```

## 7. まとめ

ハイブリッド検索は、ベクトル検索の意味的理解とキーワード検索の正確性を組み合わせることで、より関連性の高い検索結果を提供します。LanceDBを使用することで、ローカル環境でも効率的にハイブリッド検索を実装することができます。

実際の実装では、以下の点に注意してください：

1. ベクトル検索とキーワード検索の重みを適切に調整する
2. パフォーマンスを考慮し、必要に応じてインデックスを作成する
3. ユーザーのフィードバックに基づいて検索アルゴリズムを継続的に改善する

## 8. 参考リソース

- [LanceDB 公式ドキュメント - Hybrid Search](https://lancedb.github.io/lancedb/guides/hybrid_search/)
- [LanceDB 公式ドキュメント - Reranking](https://lancedb.github.io/lancedb/guides/reranking/)
