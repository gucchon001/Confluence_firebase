# LanceDB統合ガイド

## 1. 概要

このドキュメントでは、Confluence仕様書要約チャットボットにおけるLanceDBの統合方法と使用方法について説明します。LanceDBは、ローカルファイルシステム上で動作する高速なベクトルデータベースであり、埋め込みベクトルとメタデータを効率的に保存・検索するために使用されています。

## 2. アーキテクチャ

### 2.1 システム構成

```
Confluence API → データ取得 → テキスト抽出 → チャンク分割 → 埋め込み生成 → LanceDB保存
                                                                    ↓
ユーザークエリ → 埋め込み生成 → LanceDB検索 → 結果統合 → AI回答生成
```

### 2.2 データフロー

1. **データ同期**: Confluenceからページデータを取得
2. **前処理**: HTMLからテキスト抽出、チャンク分割（1000文字、100文字オーバーラップ）
3. **埋め込み生成**: @xenova/transformersで768次元ベクトル生成
4. **保存**: LanceDBにベクトルとメタデータを保存
5. **検索**: ユーザークエリをベクトル化してLanceDBで検索

## 3. スキーマ定義

### 3.1 テーブルスキーマ

```typescript
interface ConfluenceRecord {
  id: string;                    // チャンクID (pageId-chunkIndex)
  vector: number[];              // 768次元の埋め込みベクトル
  pageId: number;                // ConfluenceページID
  chunkIndex: number;            // チャンク番号
  space_key: string;             // スペースキー
  title: string;                 // ページタイトル
  content: string;               // チャンク内容
  url: string;                   // ページURL
  lastUpdated: string;           // 最終更新日時
  labels: string[];              // ラベル配列
}
```

### 3.2 LanceDBスキーマ

```typescript
const schema = {
  id: 'utf8',
  vector: { 
    type: 'fixed_size_list', 
    listSize: 768, 
    field: { type: 'float32' } 
  },
  pageId: 'int64',
  chunkIndex: 'int32',
  space_key: 'utf8',
  title: 'utf8',
  content: 'utf8',
  url: 'utf8',
  lastUpdated: 'utf8',
  labels: { type: 'list', field: { type: 'utf8' } }
};
```

## 4. ハイブリッド検索

### 4.1 検索タイプ

1. **ベクトル検索**: 意味的類似性に基づく検索
2. **キーワード検索**: LanceDBのLIKE句による部分一致検索
3. **BM25検索**: Lunr.jsによる全文検索
4. **タイトル厳格一致検索**: 完全一致による高精度検索

### 4.2 検索実装

```typescript
// メイン検索関数
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  // 1. 埋め込みベクトル生成
  const vector = await getEmbeddings(params.query);
  
  // 2. キーワード抽出
  const { keywords, highPriority, lowPriority } = await extractKeywordsHybrid(params.query);
  
  // 3. ハイブリッド検索実行
  const vectorResults = await executeVectorSearch(tbl, vector, params, excludeLabels);
  const keywordResults = await executeKeywordSearch(tbl, keywords, highPriority, lowPriority, params, excludeLabels);
  const bm25Results = await executeBM25Search(tbl, params.query, params, excludeLabels);
  const titleResults = await executeTitleExactSearch(tbl, params, excludeLabels);
  
  // 4. 結果統合とスコアリング
  const allResults = [...vectorResults, ...keywordResults, ...bm25Results, ...titleResults];
  const scoredResults = calculateSearchScores(allResults, params, keywords, highPriority, lowPriority, labelFilters);
  
  // 5. 重複除去と上位K件返却
  return deduplicateResults(scoredResults).slice(0, params.topK);
}
```

## 5. パフォーマンス特性

### 5.1 検索性能

- **平均検索時間**: 7-23ms
- **ベクトル次元**: 768次元
- **メモリ使用量**: 100回検索で約0.5MB増加
- **対応ページ数**: 最大10,000ページ

### 5.2 最適化ポイント

1. **インデックス作成**: 頻繁に検索されるフィールドにインデックス
2. **ラベルフィルタリング**: 早期除外による処理速度向上
3. **並列処理**: 複数検索タイプの並列実行
4. **キャッシュ**: 頻繁に使用されるクエリの結果キャッシュ

## 6. 使用方法

### 6.1 基本的な検索

```typescript
import { searchLanceDB } from '@/lib/lancedb-search-client';

const results = await searchLanceDB({
  query: 'ログイン機能の詳細',
  topK: 5,
  useLunrIndex: true,
  labelFilters: { 
    includeMeetingNotes: false, 
    includeArchived: false 
  },
  tableName: 'confluence'
});
```

### 6.2 フィルタリング

```typescript
const results = await searchLanceDB({
  query: '教室管理',
  topK: 10,
  filter: 'space_key = "CLIENTTOMO"',
  includeLabels: ['機能要件', '画面仕様'],
  excludeTitlePatterns: ['xxx_*']
});
```

## 7. メンテナンス

### 7.1 データ同期

```bash
# 全データ同期
npm run sync:confluence:batch

# 差分同期
npm run sync:confluence:differential
```

### 7.2 データロード

```bash
# 既存の埋め込みデータをLanceDBに投入
npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
```

### 7.3 検索テスト

```bash
# 検索機能のテスト
npx tsx src/scripts/lancedb-search.ts "検索クエリ" --table confluence
```

## 8. トラブルシューティング

### 8.1 よくある問題

1. **テーブルが見つからない**: `.lancedb`ディレクトリの存在確認
2. **次元数エラー**: ベクトル次元が768であることを確認
3. **検索結果が空**: ラベルフィルタリングの設定確認

### 8.2 ログ確認

```typescript
// デバッグログの有効化
console.log('[searchLanceDB] Starting search with query:', params.query);
console.log('[searchLanceDB] Generated embedding vector with', vector.length, 'dimensions');
console.log('[searchLanceDB] Found', results.length, 'results');
```

## 9. 関連ファイル

- `src/lib/lancedb-search-client.ts` - メイン検索クライアント
- `src/lib/lancedb-schema.ts` - スキーマ定義
- `src/lib/lancedb-utils.ts` - ユーティリティ関数
- `src/ai/flows/retrieve-relevant-docs-lancedb.ts` - 関連ドキュメント取得
- `src/scripts/lancedb-search.ts` - 検索スクリプト
- `src/scripts/lancedb-load.ts` - データロードスクリプト
