# LanceDBデータ構造仕様書

## 1. 概要

このドキュメントでは、Confluence仕様書要約チャットボットにおけるLanceDBの正しいデータ構造と仕様について詳細に説明します。本仕様書は、[LanceDB公式ドキュメント](https://lancedb.com/docs/)に基づいて作成され、本番環境で動作している正しい実装を反映しています。

### 1.1 LanceDBについて
LanceDBは、大規模な生成AI・検索アプリケーション向けのオープンソースマルチモーダルレイクハウスです。構造化データと非構造化データの両方を効率的に処理し、ベクトル検索、ハイブリッド検索、RAG（Retrieval-Augmented Generation）アプリケーションに最適化されています。

### 1.2 本プロジェクトでの用途
- **ベクトルデータベース**: Confluenceページの埋め込みベクトルを保存
- **ハイブリッド検索**: ベクトル検索とBM25検索の組み合わせ
- **RAGシステム**: チャットボットの知識ベースとして機能
- **スカラーインデックス**: `page_id`フィールドにスカラーインデックスを設定し、高速なクエリを実現

### 1.3 更新履歴
- **2025年11月**: pageId → page_id マイグレーション完了
  - スカラーインデックス対応のため`pageId` → `page_id`に変更
  - パフォーマンス向上（14秒 → 5ms）
  - API互換性のため変換レイヤーを実装

## 2. データベーススキーマ

### 2.1 テーブル設定
- **テーブル名**: `confluence`
- **データベースパス**: `.lancedb`
- **ストレージ形式**: Lance Format（列指向ストレージ）
- **インデックス**: 
  - ベクトルインデックス（IVF_PQ、自動生成）
  - スカラーインデックス（`page_id`、明示的に作成）

### 2.2 スキーマ定義（TypeScript）

```typescript
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },                    // チャンクID
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false }, // 埋め込みベクトル
  space_key: { type: 'string', nullable: false },            // スペースキー
  title: { type: 'string', nullable: false },                // ページタイトル
  labels: { type: 'list', valueType: 'string', nullable: false }, // ラベル配列
  content: { type: 'string', nullable: false },              // チャンク内容
  page_id: { type: 'int64', nullable: false },                // ページID（数値型）- pageIdから変更（スカラーインデックス対応）
  chunkIndex: { type: 'int32', nullable: false },            // チャンクインデックス
  url: { type: 'string', nullable: false },                  // ページURL
  lastUpdated: { type: 'string', nullable: false }           // 最終更新日時
};
```

### 2.3 LanceDB Arrow形式スキーマ

```typescript
// LanceDBクライアントで使用するArrow形式スキーマ
// ★★★ 2025年11月: pageId → page_id に変更（スカラーインデックス対応） ★★★
const lanceSchema = {
  id: 'utf8',
  vector: {
    type: 'fixed_size_list',
    listSize: 768,
    field: { type: 'float32' }
  },
  space_key: 'utf8',
  title: 'utf8',
  labels: { type: 'list', field: { type: 'utf8' } },
  content: 'utf8',
  page_id: 'int64',  // pageIdから変更（スカラーインデックス対応）
  chunkIndex: 'int32',
  url: 'utf8',
  lastUpdated: 'utf8'
};
```

### 2.4 データ型の対応関係

| フィールド | TypeScript型 | LanceDB Arrow型 | 説明 |
|-----------|-------------|----------------|------|
| `id` | `string` | `utf8` | チャンクの一意識別子 |
| `vector` | `number[]` | `fixed_size_list<float32>` | 768次元埋め込みベクトル |
| `space_key` | `string` | `utf8` | Confluenceスペースキー |
| `title` | `string` | `utf8` | ページタイトル |
| `labels` | `string[]` | `list<utf8>` | ラベル配列 |
| `content` | `string` | `utf8` | チャンク内容 |
| `page_id` | `number` | `int64` | ページID（数値型）- pageIdから変更（スカラーインデックス対応） |
| `chunkIndex` | `number` | `int32` | チャンクインデックス |
| `url` | `string` | `utf8` | ページURL |
| `lastUpdated` | `string` | `utf8` | 最終更新日時（ISO 8601） |

## 3. フィールド詳細仕様

### 3.1 必須フィールド

#### 3.1.1 id（チャンクID）
- **型**: `string`
- **制約**: `nullable: false`
- **形式**: `{pageId}-{chunkIndex}`
- **例**: `"123456789-0"`, `"123456789-1"`
- **説明**: 各チャンクの一意識別子

#### 3.1.2 vector（埋め込みベクトル）
- **型**: `vector`
- **値の型**: `float32`
- **次元数**: `768`（固定）
- **制約**: `nullable: false`
- **説明**: テキスト内容の意味的表現を表す768次元ベクトル

#### 3.1.3 page_id（ページID）
- **型**: `int64`
- **制約**: `nullable: false`
- **説明**: Confluenceページの一意識別子（数値型）
- **変更履歴**: `pageId`から`page_id`に変更（2025年11月、スカラーインデックス対応）
- **インデックス**: スカラーインデックスが作成され、高速なクエリが可能（平均5ms）
- **API互換性**: APIレスポンスでは`pageId`として返却（変換レイヤーで対応）
- **変換**: 文字列から数値への変換が必要

#### 3.1.4 chunkIndex（チャンクインデックス）
- **型**: `int32`
- **制約**: `nullable: false`
- **説明**: ページ内でのチャンクの順序（0から開始）

#### 3.1.5 space_key（スペースキー）
- **型**: `string`
- **制約**: `nullable: false`
- **例**: `"CLIENTTOMO"`
- **説明**: Confluenceスペースの識別子

#### 3.1.6 title（ページタイトル）
- **型**: `string`
- **制約**: `nullable: false`
- **説明**: Confluenceページのタイトル

#### 3.1.7 content（チャンク内容）
- **型**: `string`
- **制約**: `nullable: false`
- **説明**: チャンクのテキスト内容

#### 3.1.8 url（ページURL）
- **型**: `string`
- **制約**: `nullable: false`
- **形式**: `{CONFLUENCE_BASE_URL}/wiki/spaces/{space_key}/pages/{pageId}`
- **例**: `"https://giginc.atlassian.net/wiki/spaces/CLIENTTOMO/pages/123456789"`

#### 3.1.9 lastUpdated（最終更新日時）
- **型**: `string`
- **制約**: `nullable: false`
- **形式**: ISO 8601形式
- **例**: `"2024-01-15T10:30:00.000Z"`
- **注意**: `lastModified`ではない

#### 3.1.10 labels（ラベル配列）
- **型**: `list`
- **値の型**: `string`
- **制約**: `nullable: false`
- **説明**: ページに付与されたラベルの配列
- **空配列**: ラベルがない場合は空配列`[]`を保存

## 4. データ型変換仕様

### 4.1 ページID変換
```typescript
// 文字列から数値への変換
const pageId: number = parseInt(page.id);
```

### 4.2 ラベル抽出
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

### 4.3 更新日時変換
```typescript
// Confluenceのバージョン情報からISO文字列に変換
const lastUpdated: string = page.version?.when || new Date().toISOString();
```

## 5. チャンク分割仕様

### 5.1 本番仕様（動的分割）
```typescript
/**
 * 本番環境で使用されているチャンク分割ロジック
 * 注意: getConfluencePagesでマッピングされたpage.contentを使用
 */
private splitPageIntoChunks(page: ConfluencePage): ConfluenceChunk[] {
  const content = page.content || '';  // page.contentを使用（getConfluencePagesでマッピング済み）
  const chunkSize = 1800; // 1800文字で分割
  const chunks: ConfluenceChunk[] = [];
  
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.substring(i, i + chunkSize).trim();
    if (chunk) {
      chunks.push({
        pageId: parseInt(page.id),
        title: page.title || 'No Title',
        content: chunk,
        chunkIndex: Math.floor(i / chunkSize),
        lastUpdated: page.lastModified || new Date().toISOString(),  // page.lastModifiedを使用
        spaceKey: page.spaceKey || 'N/A',  // page.spaceKeyを使用
        embedding: []
      });
    }
  }
  
  return chunks;
}
```

### 5.2 理想仕様（固定分割）
```typescript
/**
 * 理想的な3チャンク固定分割ロジック
 */
private splitPageIntoChunks(page: IdealPage): Omit<IdealChunk, 'vector'>[] {
  const content = page.content;
  const chunkSize = Math.ceil(content.length / 3); // 3チャンクに分割
  const chunks: Omit<IdealChunk, 'vector'>[] = [];
  
  for (let i = 0; i < 3; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, content.length);
    const chunkContent = content.substring(start, end);
    
    if (chunkContent.trim()) {
      chunks.push({
        id: `${page.id}-${i}`,
        pageId: parseInt(page.id),
        title: page.title,
        content: chunkContent,
        chunkIndex: i,
        lastUpdated: page.lastUpdated,
        spaceKey: page.spaceKey,
        url: page.url,
        labels: page.labels
      });
    }
  }
  
  return chunks;
}
```

## 6. データ保存仕様

### 6.1 チャンクデータ作成
```typescript
/**
 * LanceDBに保存するチャンクデータの作成
 * ★★★ 2025年11月: pageId → page_id に変更（スカラーインデックス対応） ★★★
 */
const chunkData = {
  id: `${chunk.pageId}-${chunk.chunkIndex}`,
  page_id: Number(chunk.pageId),           // 数値型に変換、フィールド名はpage_id
  title: chunk.title,
  content: chunk.content,
  chunkIndex: chunk.chunkIndex,
  lastUpdated: chunk.lastUpdated,           // lastUpdatedフィールド
  space_key: chunk.spaceKey,
  url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${chunk.spaceKey}/pages/${chunk.pageId}`,
  labels: this.extractLabelsFromPage(page), // ラベル抽出メソッドを使用
  vector: embedding                         // 768次元ベクトル
};
```

### 6.2 データベース操作
```typescript
// データ追加
await table.add([chunkData]);

// データ削除（ページIDで削除）
// ★★★ 2025年11月: pageId → page_id に変更（スカラーインデックス対応） ★★★
await table.delete(`\`page_id\` = ${pageId}`);

// データ検索
const dummyVector = new Array(768).fill(0);
const results = await table.search(dummyVector).limit(10000).toArray();
```

## 7. 検索仕様

### 7.1 ベクトル検索
LanceDBのベクトル検索は、埋め込みベクトル間のコサイン類似度に基づいて類似したコンテンツを検索します。

```typescript
// 基本的なベクトル検索
const vectorResults = await table.search(queryVector)
  .limit(20)
  .toArray();

// 距離閾値を指定した検索
const vectorResultsWithThreshold = await table.search(queryVector)
  .limit(20)
  .where("distance < 0.8")
  .toArray();
```

### 7.2 ハイブリッド検索
ベクトル検索とBM25検索を組み合わせたハイブリッド検索を実装しています。

```typescript
// ハイブリッド検索の実装例
const hybridResults = await searchEngine.search({
  query: searchQuery,
  topK: 20,
  filters: {
    labels: excludeLabels
  }
});
```

### 7.3 フィルタリング検索
LanceDBのSQLクエリ機能を使用したフィルタリング検索。

```typescript
// ラベルによるフィルタリング
const filteredResults = await table.search(queryVector)
  .where("labels NOT IN ('フォルダ', 'アーカイブ', 'スコープ外')")
  .limit(20)
  .toArray();

// ページIDによる検索（スカラーインデックス使用）
// ★★★ 2025年11月: pageId → page_id に変更（スカラーインデックス対応） ★★★
const pageResults = await table.query()
  .where(`\`page_id\` = ${pageId}`)  // スカラーインデックスが効くため高速（平均5ms）
  .limit(100)
  .toArray();

// 複合条件での検索
const complexResults = await table.search(queryVector)
  .where("space_key = 'CLIENTTOMO' AND chunkIndex = 0")
  .limit(50)
  .toArray();
```

### 7.4 全文検索（Full-Text Search）
LanceDBの全文検索インデックスを使用した検索。

```typescript
// 全文検索の実装（将来の拡張）
const fullTextResults = await table.search(queryText)
  .where("content CONTAINS 'キーワード'")
  .limit(20)
  .toArray();
```

### 7.5 検索結果の再ランキング
検索結果をより精度の高い順序で並び替えるための再ランキング機能。

```typescript
// カスタム再ランキングの実装例
const rerankedResults = results
  .map(result => ({
    ...result,
    finalScore: calculateFinalScore(result)
  }))
  .sort((a, b) => b.finalScore - a.finalScore);
```

## 8. エラーハンドリング

### 8.1 データ型エラー
- **問題**: 文字列のpageIdを数値として扱う
- **解決**: `parseInt(pageId)`で変換

### 8.2 ラベルエラー
- **問題**: ラベルが存在しない場合のnull参照
- **解決**: `page.metadata?.labels?.results?.map(...) || []`

### 8.3 フィールド名エラー
- **問題**: `lastModified`と`lastUpdated`の混同
- **解決**: 正しいフィールド名`lastUpdated`を使用

## 9. パフォーマンス最適化

### 9.1 インデックス戦略
LanceDBは自動的にベクトルインデックスを生成し、効率的な検索を提供します。また、スカラーインデックスを明示的に作成することで、特定フィールドのクエリを高速化できます。

```typescript
// ベクトルインデックスの設定
const table = await db.createTable("confluence", data, {
  vector: {
    type: 'fixed_size_list',
    listSize: 768,
    field: { type: 'float32' }
  }
});

// ベクトルインデックスの作成（IVF_PQ）
await table.createIndex("vector", {
  type: "IVF_PQ",
  num_partitions: 256,
  num_sub_vectors: 16
});

// ★★★ 2025年11月追加: スカラーインデックスの作成（page_id） ★★★
// スカラーインデックスにより、page_idでのクエリが劇的に高速化（14秒 → 5ms）
await table.createIndex("page_id");
```

### 9.2 メモリ管理
- **ベクトルサイズ**: 768次元 × 4バイト = 3,072バイト/ベクトル
- **推奨バッチサイズ**: 50-100チャンク/バッチ
- **メモリ使用量**: 約3KB × チャンク数

```typescript
// メモリ効率的なバッチ処理
const BATCH_SIZE = 50;
for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  await table.add(batch);
}
```

### 9.3 検索パフォーマンス
- **ベクトル検索**: O(log n) - インデックス使用
- **スカラー検索（page_id）**: O(log n) - スカラーインデックス使用（平均5ms）
- **フィルタリング**: O(n) - 全件スキャン（インデックスなしの場合）
- **ハイブリッド検索**: ベクトル検索 + BM25検索 + 後処理フィルタリング

### 9.3.1 スカラーインデックスの効果
- **page_idインデックス作成前**: 約14秒（全件スキャン）
- **page_idインデックス作成後**: 約5ms（インデックス使用）
- **改善率**: 約99.96%の高速化

### 9.4 ストレージ最適化
LanceDBの列指向ストレージにより、以下の最適化が自動的に適用されます：
- **圧縮**: 類似データの効率的な圧縮
- **パーティショニング**: データの論理的分割
- **バージョニング**: データの変更履歴管理

### 9.5 クエリ最適化
```typescript
// 効率的なクエリパターン
const optimizedQuery = await table.search(queryVector)
  .limit(20)                    // 結果数を制限
  .where("space_key = 'CLIENTTOMO'")  // 事前フィルタリング
  .toArray();

// 非効率なクエリパターン（避ける）
const inefficientQuery = await table.search(queryVector)
  .limit(1000)                  // 大量の結果を取得
  .toArray()
  .then(results => results.filter(r => r.space_key === 'CLIENTTOMO')); // 後処理フィルタリング
```

## 10. テスト仕様

### 10.1 データ整合性テスト
```typescript
// 全チャンクのデータ型を検証
// ★★★ 2025年11月: pageId → page_id に変更 ★★★
allData.forEach((row: any) => {
  assert(typeof row.page_id === 'number', 'page_id must be number');
  assert(Array.isArray(row.labels), 'labels must be array');
  assert(typeof row.lastUpdated === 'string', 'lastUpdated must be string');
});
```

### 10.2 ラベル機能テスト
```typescript
// ラベルが正しく保存されているかテスト
// ★★★ 2025年11月: pageId → page_id に変更 ★★★
const testPage = allData.find(row => row.page_id === testPageId);
assert(testPage.labels.length > 0, 'Labels should be saved');
```

## 11. ベストプラクティス

### 11.1 データ設計の原則
1. **一意性の確保**: `id`フィールドは必ず一意であること
2. **型の一貫性**: TypeScript型とLanceDB Arrow型の対応を維持
3. **NULL値の回避**: 可能な限り`nullable: false`を使用
4. **インデックスの活用**: 検索頻度の高いフィールドにインデックスを設定

### 11.2 パフォーマンスのベストプラクティス
1. **バッチ処理**: 大量データは50-100件ずつバッチで処理
2. **事前フィルタリング**: `WHERE`句でデータベースレベルでフィルタリング
3. **結果数制限**: `LIMIT`句で適切な結果数を制限
4. **インデックス最適化**: 検索パターンに応じてインデックスを調整

### 11.3 エラーハンドリング
1. **型安全性**: TypeScriptの型チェックを活用
2. **例外処理**: データベース操作の例外を適切にキャッチ
3. **ログ出力**: デバッグ用のログを適切に出力
4. **リトライ機能**: 一時的なエラーに対するリトライ機能を実装

## 12. トラブルシューティング

### 12.1 よくある問題と解決策

#### 問題: ベクトル次元の不一致
```
Error: Vector dimension mismatch
```
**解決策**: 埋め込みベクトルが768次元であることを確認

#### 問題: スキーマの不一致
```
Error: Schema validation failed
```
**解決策**: TypeScript型とLanceDB Arrow型の対応を確認

#### 問題: メモリ不足
```
Error: Out of memory
```
**解決策**: バッチサイズを小さくして処理

### 12.2 デバッグ方法
```typescript
// データベースの状態確認
const stats = await table.countRows();
console.log(`Total rows: ${stats}`);

// スキーマの確認
const schema = table.schema;
console.log('Table schema:', schema);

// サンプルデータの確認
const sample = await table.search(dummyVector).limit(1).toArray();
console.log('Sample data:', sample[0]);
```

## 13. まとめ

この仕様書に従って実装することで、LanceDBでのデータ保存・検索が正しく動作し、ラベル機能も含めたハイブリッド検索が期待通りに機能します。特に以下の点に注意してください：

1. **page_idは数値型**で保存する（pageIdから変更済み、2025年11月）
2. **スカラーインデックス**を`page_id`に作成してパフォーマンスを最適化
3. **API互換性**のため、変換レイヤー（pageid-migration-helper.ts）を使用
4. **lastUpdatedフィールド名**を使用する
5. **ラベル抽出メソッド**を正しく実装する
6. **データ型変換**を適切に行う
7. **エラーハンドリング**を適切に実装する
8. **パフォーマンス最適化**を考慮する（スカラーインデックスの活用）
9. **LanceDBのベストプラクティス**に従う

### 参考資料
- [LanceDB公式ドキュメント](https://lancedb.com/docs/)
- [LanceDB GitHub](https://github.com/lancedb/lancedb)
- [Apache Arrow仕様](https://arrow.apache.org/docs/)
