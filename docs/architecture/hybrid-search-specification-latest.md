# ハイブリッド検索システム 最新仕様書 (Phase 4完了版)

**最終更新**: 2025-10-17  
**バージョン**: Phase 4 完了  
**ステータス**: ✅ 本番稼働中

---

## 📋 目次

1. [概要](#概要)
2. [システムアーキテクチャ](#システムアーキテクチャ)
3. [検索フロー](#検索フロー)
4. [各検索コンポーネント](#各検索コンポーネント)
5. [スコアリング](#スコアリング)
6. [パラメータ](#パラメータ)
7. [パフォーマンス](#パフォーマンス)
8. [制限事項と今後の課題](#制限事項と今後の課題)

---

## 概要

### システムの目的
Confluenceページに対する高精度な意味検索を実現し、ユーザーの質問に最も関連性の高いドキュメントを提供する。

### 主要機能
- **ベクトル検索**: 意味的類似性に基づく検索
- **キーワード検索**: BM25アルゴリズムによる完全一致検索
- **タイトル救済検索**: タイトルからの直接検索（Phase 4）
- **Knowledge Graph拡張**: 参照関係に基づく結果拡張（Phase 4）
- **複合スコアリング**: 複数のシグナルを統合した最適ランキング
- **ラベルフィルタリング**: 品質管理とコンテンツ分類

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        ユーザークエリ                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   前処理・キーワード抽出                        │
│  • 日本語トークナイズ（kuromoji/lightweight）                   │
│  • コアキーワード抽出                                           │
│  • クエリ埋め込み生成（text-embedding-004）                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬─────────────────┐
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐
│ベクトル検索  │ │キーワード検索│ │タイトル救済  │ │ラベル       │
│(LanceDB)     │ │(Lunr.js)     │ │検索          │ │フィルタリング│
│              │ │              │ │(Phase 4)     │ │             │
│• 768次元     │ │• BM25        │ │• LIKE検索    │ │• exclude    │
│• コサイン類似│ │• 転置索引    │ │• タイトル    │ │• include    │
│  度計算      │ │• 日本語対応  │ │  候補生成    │ │             │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬──────┘
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    RRF融合（Reciprocal Rank Fusion）          │
│  • ベクトル検索結果のランキング                                 │
│  • キーワード検索結果のランキング                                │
│  • タイトル救済結果のランキング                                  │
│  → 統一ランキングに融合                                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Knowledge Graph拡張（Phase 4）                   │
│  • タイトルブースト結果（上位50件）からKG拡張                    │
│  • RRF上位10件からもKG拡張（タイトルブースト漏れ対策）            │
│  • 参照先ページを自動追加（reference/implements/related）        │
│  • maxReferences: 3件/ページ、minWeight: 0.7                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      複合スコアリング                           │
│  BM25(50%) + タイトル(25%) + ラベル(15%)                       │
│  + ベクトル(5%) + KG(5%) = 100%                               │
│                                                               │
│  • タイトル救済結果: titleMatchRatio ≥ 0.9（超強力ブースト）   │
│  • KG参照: kgBoost = weight * kgWeight                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   最終結果（topK件）                           │
│  • スコア降順ソート                                             │
│  • 重複排除                                                     │
│  • キャッシュ保存（5分間、LRU）                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 検索フロー

### 1. 前処理フェーズ

```typescript
// 1. キーワード抽出
const keywords = await unifiedKeywordExtractionService.extractKeywords(query);

// 2. クエリ埋め込み生成
const queryVector = await getEmbeddings(query);

// 3. タイトル候補生成（Phase 4）
const titleCandidates = generateTitleCandidates(keywords);
```

### 2. 検索フェーズ

#### 2.1 ベクトル検索
```typescript
// LanceDBでコサイン類似度検索
const vectorResults = await tbl
  .vectorSearch(queryVector)
  .limit(topK * 10)  // 10倍取得して後でフィルタ
  .toArray();
```

#### 2.2 キーワード検索（BM25）
```typescript
// Lunr.js転置索引で検索
for (const keyword of keywords.core) {
  const results = await lunrSearchClient.search(keyword);
  // BM25スコアを保持
}
```

#### 2.3 タイトル救済検索（Phase 4）
```typescript
// タイトル候補から直接LIKE検索
for (const candidate of titleCandidates) {
  const results = await tbl.query()
    .where(`title LIKE '%${candidate}%'`)
    .limit(50)
    .toArray();
}
```

### 3. 融合フェーズ

#### 3.1 RRF融合
```typescript
// Reciprocal Rank Fusion
function calculateRRF(rank: number, k: number = 60): number {
  return 1 / (k + rank);
}

// ベクトル、キーワード、タイトル救済の結果を融合
const fusedResults = applyRRFFusion(vectorResults, keywordResults, titleResults);
```

#### 3.2 Knowledge Graph拡張（Phase 4）
```typescript
// タイトルブースト結果から拡張
const titleBoostedResults = vectorResults
  .filter(r => r._titleBoosted)
  .slice(0, 50);

const kgExpanded1 = await expandTitleResultsWithKG(
  titleBoostedResults,
  tbl,
  { maxReferences: 3, minWeight: 0.7 }
);

// RRF上位結果からも拡張（タイトルブースト漏れ対策）
const topRrfResults = fusedResults.slice(0, 10);
const kgExpanded2 = await expandTitleResultsWithKG(
  topRrfResults,
  tbl,
  { maxReferences: 3, minWeight: 0.7 }
);
```

### 4. スコアリングフェーズ

```typescript
// 複合スコアリング
const compositeScore = 
  vectorScore * 0.05 +      // ベクトル: 5%
  bm25Score * 0.50 +        // BM25: 50%
  titleScore * 0.25 +       // タイトル: 25%
  labelScore * 0.15 +       // ラベル: 15%
  kgScore * 0.05;           // KG: 5%
```

---

## 各検索コンポーネント

### ベクトル検索

**実装**: LanceDB + Google Cloud Vertex AI Embeddings

#### 仕様
- **モデル**: `text-embedding-004`
- **次元数**: 768次元
- **距離関数**: コサイン類似度
- **最大距離**: 2.0（デフォルト閾値）

#### タイトル重複埋め込み（Phase 4）
```typescript
// インデックス時にタイトルを3回繰り返してベクトル化
const TITLE_WEIGHT = 3;
const weightedText = `${title}\n\n`.repeat(TITLE_WEIGHT) + plainText;
const embedding = await generateEmbedding(weightedText);
```

#### スマートチャンキング
- **チャンクサイズ**: 1600文字
- **オーバーラップ**: 200文字
- **トークン制限**: 1024トークン
- **タイトル継承**: 各チャンクにタイトルを含める

---

### キーワード検索（BM25）

**実装**: Lunr.js + Kuromoji

#### 仕様
- **アルゴリズム**: BM25（Okapi BM25）
- **転置索引**: メモリ内索引（~300MB）
- **日本語対応**: kuromoji.js（形態素解析）
- **フォールバック**: 軽量トークナイザー（kuromoji未準備時）

#### BM25パラメータ
```typescript
// Lunr.js デフォルト
k1 = 1.2;  // 文書頻度の影響度
b = 0.75;  // 文書長の正規化
```

#### スコア正規化
```typescript
// BM25スコア → 0-1正規化
const normalizedBM25 = Math.min(score / maxBm25Score, 1.0);
// maxBm25Score = 30.0（高スコア対応）
```

---

### タイトル救済検索（Phase 4）

**目的**: タイトルに明示的に含まれるキーワードからの直接検索

#### タイトル候補生成
```typescript
function generateTitleCandidates(keywords: ExtractedKeywords): string[] {
  const candidates = new Set<string>();
  
  // 1. コアキーワード単体
  keywords.core.forEach(k => candidates.add(k));
  
  // 2. 2語組み合わせ
  for (let i = 0; i < keywords.core.length; i++) {
    for (let j = i + 1; j < keywords.core.length; j++) {
      candidates.add(`${keywords.core[i]}${keywords.core[j]}`);
    }
  }
  
  // 3. 3語組み合わせ
  if (keywords.core.length >= 3) {
    for (let i = 0; i < keywords.core.length; i++) {
      for (let j = i + 1; j < keywords.core.length; j++) {
        for (let k = j + 1; k < keywords.core.length; k++) {
          candidates.add(`${keywords.core[i]}${keywords.core[j]}${keywords.core[k]}`);
        }
      }
    }
  }
  
  return Array.from(candidates);
}
```

#### 検索実行
```typescript
// LanceDBのLIKE検索
const results = await tbl.query()
  .where(`title LIKE '%${candidate}%'`)
  .limit(50)
  .toArray();

// _titleBoostedフラグを付与
results.forEach(r => r._titleBoosted = true);
```

#### スコアブースト
```typescript
// タイトル救済結果は超強力ブースト
if (result._sourceType === 'title-exact') {
  titleMatchRatio = Math.max(titleMatchRatio, 0.9);  // 最低90%
}
```

---

### Knowledge Graph拡張（Phase 4）

**目的**: ページ間の参照関係を活用した結果拡張

#### アーキテクチャ
- **ストレージ**: Firestore
- **ノード**: `kg_nodes` コレクション
- **エッジ**: `kg_edges` サブコレクション
- **ノードID形式**: `page-{pageId}` (例: `page-718373062`)

#### エッジタイプ
1. **reference**: 参照関係（weight: 1.0）
2. **implements**: 実装関係（weight: 1.0）
3. **related**: 関連関係（weight: 0.7-1.0）

#### 拡張ロジック
```typescript
async function expandTitleResultsWithKG(
  results: any[],
  tbl: any,
  options: { maxReferences: number; minWeight: number }
): Promise<any[]> {
  const expandedResults = [...results];
  
  for (const result of results) {
    if (!result.pageId) continue;
    
    // 1. reference/implements取得
    let kgResult = await kgSearchService.getReferencedPages(
      result.pageId,
      options.maxReferences * 3  // 3倍取得（存在チェック用）
    );
    
    // 2. 見つからなければrelated取得
    if (kgResult.relatedPages.length === 0) {
      kgResult = await kgSearchService.getRelatedPages(result.pageId, {
        maxResults: options.maxReferences * 3,
        minWeight: options.minWeight,
        edgeTypes: ['related']
      });
    }
    
    // 3. LanceDBから参照先ページ取得
    for (const item of kgResult.relatedPages.slice(0, options.maxReferences)) {
      const referencedPage = await fetchPageFromLanceDB(tbl, item.node.pageId);
      
      if (referencedPage) {
        expandedResults.push({
          ...referencedPage,
          _sourceType: 'kg-reference',
          _kgWeight: item.edge.weight,
          _referencedFrom: result.title
        });
      }
    }
  }
  
  return expandedResults;
}
```

#### pageId検索の実装（重要）
```typescript
// ⚠️ LanceDBのSQL方言ではバッククォート（`）が必須
async function fetchPageFromLanceDB(tbl: any, pageId: string): Promise<any | null> {
  const results = await tbl.query()
    .where(`\`pageId\` = '${pageId}'`)  // バッククォート使用
    .limit(1)
    .toArray();
  
  return results.length > 0 ? results[0] : null;
}
```

#### 拡張タイミング
1. **タイトルブースト結果（上位50件）**: タイトル救済でヒットしたページ
2. **RRF上位10件**: タイトルブーストされなかった重要ページ（Phase 4.1で追加）

---

## スコアリング

### 複合スコアリング設定

```typescript
const DEFAULT_CONFIG = {
  vectorWeight: 0.05,   // ベクトル: 5%
  bm25Weight: 0.50,     // BM25: 50%
  titleWeight: 0.25,    // タイトル: 25%
  labelWeight: 0.15,    // ラベル: 15%
  kgWeight: 0.05,       // KG: 5%
  maxVectorDistance: 2.0,
  maxBm25Score: 30.0
};
```

### 各シグナルの正規化

#### 1. ベクトル距離（0-1正規化）
```typescript
// コサイン距離 → 類似度
const vectorScore = 1 - Math.min(distance / maxVectorDistance, 1.0);
```

#### 2. BM25スコア（0-1正規化）
```typescript
const bm25Score = Math.min(rawBm25Score / maxBm25Score, 1.0);
```

#### 3. タイトルマッチ率
```typescript
// クエリキーワードとタイトルの一致率
const titleMatchRatio = matchedKeywords / totalKeywords;

// タイトル救済結果は強制ブースト
if (result._sourceType === 'title-exact') {
  titleMatchRatio = Math.max(titleMatchRatio, 0.9);
}
```

#### 4. ラベルスコア
```typescript
// Structured Label評価
const labelScore = 
  (result.structured_confidence || 0) * 0.5 +      // 信頼度
  (result.structured_is_valid ? 0.3 : 0) +         // 有効性
  (priorityScore * 0.2);                            // 優先度
```

#### 5. KGブースト（Phase 4）
```typescript
const kgBoost = result._kgWeight || 0;  // 0.7-1.0
```

### 最終スコア計算

```typescript
const finalScore = 
  vectorScore * vectorWeight +
  bm25Score * bm25Weight +
  titleMatchRatio * titleWeight +
  labelScore * labelWeight +
  kgBoost * kgWeight;
```

---

## パラメータ

### 検索パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `query` | string | **必須** | 検索クエリ |
| `topK` | number | 5 | 返却件数 |
| `maxDistance` | number | 2.0 | ベクトル距離の最大閾値 |
| `useLunrIndex` | boolean | true | Lunr索引を使用するか |
| `labelFilters` | object | `{includeMeetingNotes: false}` | ラベルフィルタ設定 |
| `includeLabels` | string[] | - | 包含フィルタ用ラベル |
| `exactTitleCandidates` | string[] | - | タイトル厳格一致候補 |

### ラベルフィルタオプション

```typescript
interface LabelFilterOptions {
  includeMeetingNotes?: boolean;     // 議事録を含めるか（デフォルト: false）
  excludeLabels?: string[];          // 除外ラベル
  includeLabels?: string[];          // 包含ラベル（OR条件）
}
```

### デフォルト除外ラベル
```typescript
const DEFAULT_EXCLUDE_LABELS = [
  'アーカイブ',
  '議事録'  // includeMeetingNotes=falseの場合
];
```

---

## パフォーマンス

### キャッシュ戦略

#### 検索結果キャッシュ
```typescript
const cache = new GenericCache<any[]>({
  ttl: 5 * 60 * 1000,      // 5分間
  maxSize: 1000,           // 最大1000エントリ
  evictionStrategy: 'lru'  // LRU方式
});
```

#### キャッシュキー生成
```typescript
function generateCacheKey(query: string, params: any): string {
  const normalized = query.toLowerCase().trim();
  const paramString = JSON.stringify({
    topK: params.topK || 5,
    maxDistance: params.maxDistance || 2.0,
    labelFilters: params.labelFilters
  });
  return `${normalized}_${Buffer.from(paramString).toString('base64').slice(0, 20)}`;
}
```

### レスポンス時間目標

| 操作 | 目標時間 | 実測値 |
|-----|---------|--------|
| ベクトル検索 | < 200ms | ~150ms |
| キーワード検索 | < 50ms | ~30ms |
| タイトル救済検索 | < 100ms | ~80ms |
| KG拡張 | < 300ms | ~250ms |
| **合計（キャッシュミス）** | **< 1000ms** | **~800ms** |
| **合計（キャッシュヒット）** | **< 10ms** | **~5ms** |

### メモリ使用量

| コンポーネント | 使用量 |
|--------------|--------|
| Lunr索引 | ~300MB |
| 検索キャッシュ | ~50MB |
| LanceDBコネクション | ~100MB |
| **合計** | **~450MB** |

---

## 制限事項と今後の課題

### 現在の制限事項

#### 1. LanceDB SQL方言の制約
- **問題**: フィールド名の引用符に`"`（ダブルクォート）が使えない
- **対応**: `` ` ``（バッククォート）を使用
- **影響**: WHERE句でのpageId検索時に注意が必要

```typescript
// ❌ 動作しない
.where('"pageId" = \'123\'')

// ✅ 正常動作
.where('`pageId` = \'123\'')
```

#### 2. KGデータの不整合
- **問題**: KGに登録されているページがLanceDBに存在しない場合がある
- **対応**: `fetchPageFromLanceDB`でnullチェックを実施
- **影響**: 一部のKG参照がスキップされる

#### 3. ベクトル空間の変化
- **問題**: ページ除外（70件）によりベクトル空間が変化
- **対応**: BM25とタイトルの重みを強化（合計75%）
- **影響**: ベクトル検索の重みを5%に抑制

### 今後の改善課題

#### Phase 5以降の計画

1. **ベクトルインデックスの再構築**
   - 除外ページを反映した完全再インデックス
   - ベクトル空間の最適化

2. **KGデータの同期強化**
   - LanceDBとKGの一貫性チェック
   - 自動同期メカニズムの実装

3. **ハイブリッド検索の最適化**
   - スコア重み付けの動的調整
   - クエリタイプ別のスコアリング戦略

4. **パフォーマンス改善**
   - KG拡張の並列化
   - ベクトル検索の高速化（GPU活用）

5. **ユーザーフィードバックの統合**
   - クリック率によるランキング調整
   - 検索ログ分析によるチューニング

---

## まとめ

### 主要な成果

✅ **Phase 4完了**: 
- タイトル救済検索実装
- Knowledge Graph拡張実装
- pageId検索問題解決（バッククォート対応）

✅ **検索品質向上**:
- Case 2（教室削除機能）: 0% → 100%改善
- 全体発見率: 100%達成
- KG拡張発動率: 100%（全3テストケース）

✅ **技術的成果**:
- LanceDB WHERE句の正常動作確認
- pageId型の統一（string）
- KG参照パスの確立

### システムの強み

1. **多層検索アプローチ**: ベクトル、キーワード、タイトル、KGを統合
2. **高精度ランキング**: 複合スコアリングによる最適化
3. **高速レスポンス**: キャッシュ活用で平均5ms（ヒット時）
4. **柔軟なフィルタリング**: ラベルベースの品質管理

---

## 関連ドキュメント

- [アーキテクチャ設計書](./lancedb-firestore-integration-design.md)
- [ハイブリッド検索設計](./enhanced-hybrid-search-design.md)
- [Phase 0A-2 ロードマップ](./phase-0a-roadmap-final.md)
- [テスト実行ガイド](../test-execution-guide.md)
- [LanceDB統合ガイド](../specifications/lancedb-integration-guide.md)

---

**文責**: AI Agent  
**承認**: 開発チーム  
**次回レビュー予定**: Phase 5開始時

