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
2. **前処理**: HTMLからテキスト抽出、チャンク分割（1800文字、オーバーラップなし）
3. **埋め込み生成**: @xenova/transformersで768次元ベクトル生成
4. **保存**: LanceDBにベクトルとメタデータを保存
5. **検索**: ユーザークエリをベクトル化してLanceDBで検索

## 3. スキーマ定義

### 3.1 正しいデータ構造（本番仕様）

#### 3.1.1 TypeScriptインターフェース

```typescript
interface ConfluenceRecord {
  id: string;                    // チャンクID (pageId-chunkIndex)
  vector: number[];              // 768次元の埋め込みベクトル
  pageId: number;                // ConfluenceページID（数値型）
  chunkIndex: number;            // チャンク番号
  space_key: string;             // スペースキー
  title: string;                 // ページタイトル
  content: string;               // チャンク内容
  url: string;                   // ページURL
  lastUpdated: string;           // 最終更新日時（ISO文字列）
  labels: string[];              // ラベル配列（空配列も可）
}
```

#### 3.1.2 LanceDBスキーマ定義

```typescript
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },                    // チャンクID
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false }, // 埋め込みベクトル
  space_key: { type: 'string', nullable: false },            // スペースキー
  title: { type: 'string', nullable: false },                // ページタイトル
  labels: { type: 'list', valueType: 'string', nullable: false }, // ラベル配列
  content: { type: 'string', nullable: false },              // チャンク内容
  pageId: { type: 'int64', nullable: false },                // ページID（数値型）
  chunkIndex: { type: 'int32', nullable: false },            // チャンクインデックス
  url: { type: 'string', nullable: false },                  // ページURL
  lastUpdated: { type: 'string', nullable: false }           // 最終更新日時
};
```

### 3.2 重要なデータ型の仕様

#### 3.2.1 ページID（pageId）
- **型**: `number`（int64）
- **変換**: `parseInt(pageId)` で文字列から数値に変換
- **例**: `"123456789"` → `123456789`

#### 3.2.2 更新日時（lastUpdated）
- **型**: `string`（ISO 8601形式）
- **フィールド名**: `lastUpdated`（`lastModified`ではない）
- **例**: `"2024-01-15T10:30:00.000Z"`

#### 3.2.3 ラベル（labels）
- **型**: `string[]`配列
- **抽出方法**: `page.metadata?.labels?.results?.map(label => label.name) || []`
- **空配列**: ラベルがない場合は空配列`[]`を保存

#### 3.2.4 埋め込みベクトル（vector）
- **型**: `number[]`配列
- **次元数**: 768次元（固定）
- **値の型**: `float32`

### 3.3 ラベル抽出ロジック

```typescript
/**
 * ページからラベルを抽出（本番仕様）
 */
private extractLabelsFromPage(page: ConfluencePage): string[] {
  if (!page.metadata?.labels?.results) {
    return [];
  }
  return page.metadata.labels.results.map(label => label.name);
}
```

### 3.4 チャンク分割ロジック

#### 3.4.1 現在の実装（動的分割）
```typescript
// 1800文字での動的分割（オーバーラップなし）
const chunkSize = 1800;
for (let i = 0; i < content.length; i += chunkSize) {
  const chunk = content.substring(i, i + chunkSize).trim();
  // チャンク処理
}
```

**実装場所**: `src/lib/confluence-sync-service.ts` (行753-801)

#### 3.4.2 将来の改善案（オーバーラップあり）
```typescript
// 1800文字での動的分割 + 100文字オーバーラップ
const chunkSize = 1800;
const overlap = 100;
for (let i = 0; i < content.length; i += (chunkSize - overlap)) {
  const chunk = content.substring(i, Math.min(i + chunkSize, content.length)).trim();
  // チャンク処理
}
```

**メリット**: チャンク境界をまたぐ文脈の連続性が保持され、検索精度が向上します。

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
