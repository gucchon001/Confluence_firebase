# 最適化されたハイブリッド検索設計書

**作成日**: 2025-10-15  
**参考**: 最新のRAG/ハイブリッド検索ベストプラクティス  
**目的**: 発見率100%、レスポンス時間500ms以下を達成

---

## 📚 参考記事からの重要な知見

### 1. [LLMによるナレッジグラフの作成とハイブリッド検索](https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid)

**重要なポイント**:

1. **ノード情報のハイブリッド検索**
   ```python
   # 全文検索とベクトル検索を組み合わせる
   hybrid_query = (
       "CALL db.index.fulltext.queryNodes('node_text_fulltext', $query) "
       "YIELD node, score as fulltext_score "
       "WITH node, fulltext_score "
       "CALL db.index.vector.queryNodes('node_embeddings', $k, $embedding) "
       "YIELD node as vector_node, score as vector_score "
       "WHERE vector_node = node "
       "RETURN node, fulltext_score + vector_score as total_score"
   )
   ```
   
2. **リレーションシップ情報の活用**
   - ノード単体だけでなく、関連するノードも検索
   - パス探索で間接的な関係も取得

3. **検索の優先順位**
   - 全文検索（高速、精密）
   - ベクトル検索（セマンティック）
   - グラフ走査（関連性）

**適用**:
- ✅ Knowledge Graphを検索の早期段階で統合
- ✅ 全文検索（BM25）を最優先
- ✅ ベクトル検索は補助的に使用

---

### 2. チャンクサイズの最適化

**一般的なベストプラクティス**:

| 目的 | チャンクサイズ | 理由 |
|------|--------------|------|
| **Q&A、精密検索** | 200-512トークン | 局所的マッチング、高精度 |
| **RAG標準** | **512-1,024トークン** | バランスが良い ✅ |
| **長文生成** | 1,500-2,000トークン | 文脈保持 |

**オーバーラップ**:
- 推奨: 10-20%（100-200文字）
- 理由: チャンク境界での情報損失を防ぐ

**現在の問題**:
- TOKEN_LIMIT = 8,192トークン（**推奨の8倍**）
- オーバーラップ = 0

---

### 3. ハイブリッド検索の重み付け

**推奨される重み配分**:

```python
# 一般的な重み配分
score = (
    exact_match_score * 0.40 +      # タイトル/キーワード厳格一致
    semantic_score * 0.30 +          # ベクトル類似度
    keyword_score * 0.20 +           # BM25スコア
    metadata_score * 0.10            # ラベル/メタデータ
)
```

**現在の問題**:
- RRF（Reciprocal Rank Fusion）のみ
- タイトル/ラベルが軽視されている

---

### 4. Multi-Stage Retrieval

**推奨アプローチ**:

```
Stage 1: 高速フィルタリング
  ├─ タイトル厳格一致 → 即座に返す（Early Exit）
  └─ メタデータ厳格一致

Stage 2: セマンティック検索
  ├─ BM25（全文検索）← 優先
  └─ ベクトル検索 ← 補助

Stage 3: グラフ拡張
  └─ Knowledge Graphで関連ページ取得

Stage 4: Re-ranking
  └─ 複合スコアで最終順位決定
```

**参考**: [LangChainのベストプラクティス](https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid)

---

## 🎯 最適化されたハイブリッド検索フロー

### **Enhanced Multi-Stage Hybrid Search with KG**

```
╔════════════════════════════════════════════════════════════════╗
║  Phase 0: 前処理（並列実行、50-100ms）                         ║
╚════════════════════════════════════════════════════════════════╝

  [クエリ受信: "退会後の再登録はできますか"]
      ↓
  【並列実行】
  ├─ キーワード抽出 → ["退会", "再登録", "登録"]
  ├─ エンベディング生成 → [768次元ベクトル]
  └─ LanceDB接続

╔════════════════════════════════════════════════════════════════╗
║  Stage 1: 高速一致検索（Early Exit、10-50ms）                 ║
╚════════════════════════════════════════════════════════════════╝

  1.1 タイトル厳格一致検索（最高優先度）
      ├─ "退会後の再登録" と完全一致？ → No
      └─ なし → 次へ

  1.2 タイトル部分一致検索（キーワードベース）
      ├─ "退会" ⊂ "046_会員退会機能"？ → Yes ✅
      ├─ "再登録" ⊂ "046_会員退会機能"？ → No
      ├─ "登録" ⊂ "046_会員退会機能"？ → No
      └─ マッチ率: 1/3 = 33% → 候補に追加（高優先度）

  1.3 ラベル一致検索
      ├─ domain="会員管理" のページを検索
      └─ 046, 041, 044... → 候補に追加（中優先度）

  📊 Stage 1結果: 15-20件の候補

╔════════════════════════════════════════════════════════════════╗
║  Stage 2: セマンティック検索（並列実行、200-400ms）            ║
╚════════════════════════════════════════════════════════════════╝

  【並列実行】
  
  2.1 BM25検索（Lunr.js）← 優先
      ├─ keywords=["退会", "再登録", "登録"]
      ├─ タイトル重み: 3.0
      ├─ コンテンツ重み: 1.0
      └─ 結果: topK * 3 (150件)

  2.2 ベクトル検索（LanceDB）← 補助
      ├─ embedding similarity
      ├─ distance < 1.5（厳格な閾値）
      └─ 結果: topK * 5 (250件)

  2.3 ラベル類似検索
      ├─ domain類似度
      ├─ tag Jaccard類似度
      └─ 結果: topK * 2 (100件)

  📊 Stage 2結果: 最大500件の候補

╔════════════════════════════════════════════════════════════════╗
║  Stage 3: 統合とフィルタリング（50-100ms）                     ║
╚════════════════════════════════════════════════════════════════╝

  3.1 結果の統合
      ├─ Stage 1候補（高優先度）
      ├─ Stage 2候補（中優先度）
      └─ 重複排除（pageIdベース）

  3.2 ラベルフィルタリング
      └─ excludeLabels適用（議事録、アーカイブ等）

  📊 Stage 3結果: 100-150件の候補

╔════════════════════════════════════════════════════════════════╗
║  Stage 4: Knowledge Graph拡張（100-200ms）                     ║
╚════════════════════════════════════════════════════════════════╝

  4.1 参照関係で拡張
      ├─ 046 → 参照先ページ（weight >= 0.7）
      └─ 最大2件追加

  4.2 ドメイン関係で拡張
      ├─ domain="会員管理" のページ
      └─ 最大1件追加（Stage 3が少ない場合）

  📊 Stage 4結果: 105-155件の候補

╔════════════════════════════════════════════════════════════════╗
║  Stage 5: 複合スコアリング（30-50ms）                          ║
╚════════════════════════════════════════════════════════════════╝

  各候補に複合スコアを計算:

  finalScore = (
    titleExactScore * 0.40 +        // タイトル厳格一致
    titlePartialScore * 0.25 +      // タイトル部分一致（キーワード）
    bm25Score * 0.15 +              // BM25スコア
    vectorScore * 0.10 +            // ベクトル類似度
    labelScore * 0.05 +             // ラベル類似度
    kgBoost * 0.05                  // KGブースト
  )

  例: 046_会員退会機能
    titleExact: 0.0 * 0.40 = 0.00
    titlePartial: 0.33 * 0.25 = 0.083  ← "退会"がマッチ
    bm25: 0.6 * 0.15 = 0.09
    vector: 0.1 * 0.10 = 0.01          ← 678位で低スコア
    label: 0.8 * 0.05 = 0.04           ← domain="会員管理"
    kgBoost: 0.5 * 0.05 = 0.025
    ─────────────────────────
    finalScore: 0.248 → 上位候補 ✅

╔════════════════════════════════════════════════════════════════╗
║  Stage 6: 最終Re-ranking（10-20ms）                            ║
╚════════════════════════════════════════════════════════════════╝

  ├─ 複合スコアでソート
  ├─ topK件を選択（50件）
  └─ チャンク統合（isChunked=trueのみ）

  📊 最終結果: 50件
  ⏱️  総処理時間: 400-820ms（目標: 500ms以下）
```

---

## 🔧 具体的な改善実装

### 改善1: タイトル検索の最優先化 🔴

**実装**:

```typescript
// src/lib/lancedb-search-client.ts

async function searchTitleFirst(
  query: string, 
  keywords: string[], 
  table: any
): Promise<SearchResult[]> {
  
  // 1.1 タイトル厳格一致検索（Early Exit）
  const normalizedQuery = query.toLowerCase().replace(/[、。！？\s]/g, '');
  const allRecords = await table.query().limit(10000).toArray();
  
  const exactMatches = allRecords.filter(record => {
    const title = String(record.title || '').toLowerCase().replace(/[、。！？\s]/g, '');
    const similarity = calculateLevenshteinSimilarity(title, normalizedQuery);
    return similarity >= 0.85; // 85%以上の類似度
  });
  
  if (exactMatches.length > 0) {
    console.log(`[TitleFirst] Exact match found: ${exactMatches.length} results`);
    return exactMatches.map(r => ({
      ...r,
      _titleExactScore: 1.0,
      _sourceType: 'title-exact'
    }));
  }
  
  // 1.2 タイトル部分一致検索（キーワードベース）
  const partialMatches = allRecords
    .map(record => {
      const title = String(record.title || '').toLowerCase();
      
      // キーワードマッチング
      const matchedKeywords = keywords.filter(kw => 
        title.includes(kw.toLowerCase())
      );
      
      const matchRatio = matchedKeywords.length / keywords.length;
      
      return {
        ...record,
        _titleMatchedKeywords: matchedKeywords,
        _titleMatchRatio: matchRatio,
        _titlePartialScore: matchRatio
      };
    })
    .filter(r => r._titleMatchRatio >= 0.33) // 1つ以上マッチ
    .sort((a, b) => b._titleMatchRatio - a._titleMatchRatio);
  
  console.log(`[TitleFirst] Partial match found: ${partialMatches.length} results`);
  
  return partialMatches.slice(0, 20).map(r => ({
    ...r,
    _sourceType: 'title-partial'
  }));
}
```

**期待効果**: 発見率 17% → 50-60%

---

### 改善2: チャンクサイズの最適化 🔴

**推奨設定**（参考: [Databricks Vector Search ベストプラクティス](https://docs.databricks.com/gcp/ja/generative-ai/vector-search-best-practices)）:

```typescript
// scripts/rebuild-lancedb-smart-chunking.ts

// ❌ 現在
const TOKEN_LIMIT = 8192;  // 約32,768文字
const CHUNK_SIZE = 1800;   // 1,800文字
const OVERLAP = 0;         // オーバーラップなし

// ✅ 推奨
const TOKEN_LIMIT = 1024;  // 約4,000文字（RAG標準）
const CHUNK_SIZE = 1600;   // 1,600文字
const OVERLAP = 200;       // 10-15%オーバーラップ

// オーバーラップを考慮したチャンク分割
function splitIntoChunksWithOverlap(
  text: string, 
  chunkSize: number, 
  overlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    
    // 次のチャンクはoverlapだけ前から開始
    start = end - overlap;
    
    if (start >= text.length) break;
  }
  
  return chunks;
}
```

**期待効果**: 発見率 50-60% → 75-85%

---

### 改善3: ラベルスコアの統合 🟡

**実装**:

```typescript
// src/lib/label-scorer.ts（新規作成）

interface LabelScore {
  domainScore: number;    // ドメイン一致度
  categoryScore: number;  // カテゴリ一致度
  tagScore: number;       // タグ一致度（Jaccard）
  totalScore: number;     // 総合スコア
}

function calculateLabelScore(
  result: any,
  queryKeywords: string[]
): LabelScore {
  const label = result.structuredLabel || {};
  
  // ドメイン一致度
  const domainScore = queryKeywords.some(kw => 
    (label.domain || '').toLowerCase().includes(kw.toLowerCase())
  ) ? 1.0 : 0.0;
  
  // カテゴリ一致度
  const categoryScore = label.category === 'spec' ? 0.8 : 0.5;
  
  // タグ一致度（Jaccard類似度）
  const tags = label.tags || [];
  const intersection = tags.filter((tag: string) => 
    queryKeywords.some(kw => tag.toLowerCase().includes(kw.toLowerCase()))
  ).length;
  const union = new Set([...tags, ...queryKeywords]).size;
  const tagScore = union > 0 ? intersection / union : 0.0;
  
  // 総合スコア
  const totalScore = (
    domainScore * 0.5 +
    categoryScore * 0.3 +
    tagScore * 0.2
  );
  
  return { domainScore, categoryScore, tagScore, totalScore };
}
```

**期待効果**: 発見率 75-85% → 85-90%

---

### 改善4: KGの早期統合 🟡

**現在のフロー**:
```
検索 → 結果取得 → KG拡張
```

**推奨フロー**:
```
タイトル検索 → KG拡張（参照関係）
  ↓
ベクトル + BM25検索
  ↓
全結果統合 → Re-ranking
```

**実装**:

```typescript
async function enhancedHybridSearch(query: string, options: SearchOptions) {
  // Stage 1: タイトル検索
  const titleResults = await searchTitleFirst(query, keywords, table);
  
  // Stage 1.5: タイトル結果からKG拡張
  const kgExpandedTitleResults = await expandWithKG(titleResults, {
    maxReferences: 2,
    minWeight: 0.7
  });
  
  // Stage 2: セマンティック検索（並列）
  const [bm25Results, vectorResults] = await Promise.all([
    searchBM25(keywords, topK * 3),
    searchVector(embedding, topK * 5)
  ]);
  
  // Stage 3: 統合
  const allCandidates = [
    ...kgExpandedTitleResults,  // 最高優先度
    ...bm25Results,             // 高優先度
    ...vectorResults            // 中優先度
  ];
  
  // Stage 4: 複合スコアリング
  const scoredResults = allCandidates.map(result => ({
    ...result,
    finalScore: calculateCompositeScore(result, keywords)
  }));
  
  // Stage 5: Re-ranking
  return scoredResults
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}
```

**期待効果**: 発見率 85-90% → 90-95%

---

## 📊 フロー比較：現在 vs 推奨

### タイムライン比較

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
現在のフロー（Phase 0A-3）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0ms   ┌──────────────┐
      │ 並列前処理   │ キーワード、エンベディング、接続
100ms └──────────────┘
      ↓
      ┌──────────────┐
      │ ベクトル検索 │ ← 最初の検索（問題）
400ms └──────────────┘
      ├─ topK * 2件取得
      ├─ タイトルブースト ← ここで初めてタイトル検索
      └─ topK件に制限
      ↓
      ┌──────────────┐
      │ BM25検索     │
600ms └──────────────┘
      ↓
      ┌──────────────┐
      │ RRF融合      │
700ms └──────────────┘
      ↓
      ┌──────────────┐
      │ KG拡張       │
8700ms└──────────────┘ ← 遅い
      ↓
      [結果] 発見率: 17%


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
推奨フロー（Enhanced Multi-Stage）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0ms   ┌──────────────┐
      │ 並列前処理   │ キーワード、エンベディング、接続
100ms └──────────────┘
      ↓
      ┌──────────────┐
      │ タイトル検索 │ ← ⭐ 最優先（Early Exit可能）
150ms └──────────────┘
      ├─ 厳格一致 → 即座に返す
      ├─ 部分一致（キーワードベース）
      └─ ラベル一致
      ↓
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ BM25検索     │ │ ベクトル検索 │ │ ラベル検索   │
350ms └──────────────┘ └──────────────┘ └──────────────┘
      【並列実行】← 高速化
      ↓
      ┌──────────────┐
      │ KG拡張       │ ← 早期統合
450ms └──────────────┘
      ↓
      ┌──────────────┐
      │ 複合スコア   │
500ms └──────────────┘
      ↓
      [結果] 発見率: 80-95%（予測）
```

**改善**: 8,700ms → 500ms（**94%高速化**）

---

## 🎯 実装の優先順位（改訂版）

### Phase 1: タイトル検索の最優先化 🔴

**内容**:
1. タイトル厳格一致検索（Early Exit）
2. タイトル部分一致検索（キーワードベース）
3. ベクトル検索の前に実行

**工数**: 2-3時間  
**期待効果**: 発見率 17% → 50-60%

---

### Phase 2: チャンクサイズの最適化 🔴

**内容**:
1. TOKEN_LIMIT: 8,192 → 1,024
2. CHUNK_SIZE: 1,800 → 1,600
3. オーバーラップ: 200文字追加
4. LanceDB再構築（15分）

**工数**: 1.5時間 + rebuild 15分  
**期待効果**: 発見率 50-60% → 75-85%

---

### Phase 3: 複合スコアリングの実装 🟡

**内容**:
1. ラベルスコアの計算
2. 複合スコア計算（6要素）
3. Re-ranking実装

**工数**: 2時間  
**期待効果**: 発見率 75-85% → 85-95%

---

### Phase 4: KGの早期統合 🟡

**内容**:
1. タイトル結果からKG拡張
2. 並列検索の統合
3. KGブーストスコアの追加

**工数**: 1.5時間  
**期待効果**: 発見率 85-95% → 90-95% + レスポンス時間30%改善

---

## 📋 参考記事の適用マトリクス

| 記事 | 知見 | 適用箇所 | 優先度 |
|------|------|---------|--------|
| [Neo4j ハイブリッド検索](https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid) | 全文検索優先、KG統合 | Stage 1-4 | 🔴 |
| Databricks | チャンクサイズ最適化 | rebuild script | 🔴 |
| ActionBridge | Multi-vector検索 | Stage 2 | 🟡 |

---

## 💡 推奨される実装アプローチ

### **選択肢A: 段階的改善（推奨）** ✅

```
Week 1:
  Day 1-2: Phase 1（タイトル検索最優先化）
    → 発見率 17% → 50-60%
  
  Day 3: Phase 2（チャンクサイズ最適化）
    → 発見率 50-60% → 75-85%
  
  テスト・検証 → 品質確保

Week 2:
  Day 1-2: Phase 3（複合スコアリング）
    → 発見率 75-85% → 85-95%
  
  Day 3: Phase 4（KG早期統合）
    → レスポンス時間30%改善
  
  最終テスト → リリース
```

**メリット**:
- 各段階で効果測定可能
- 問題の早期発見
- リスク分散

---

### **選択肢B: Phase 0A-2復元 + 慎重な改善**

```
Day 1: Phase 0A-2のLanceDB復元
  → 発見率を即座に100%に回復

Week 1-2: 選択肢Aの改善を慎重に適用
  → 各改善を個別にテスト
  → 品質を維持しながらパフォーマンス向上
```

**メリット**:
- リスクゼロ
- 安定した品質
- 段階的な最適化

---

## 🎯 **最終推奨**

**即座に実施**: **選択肢B（Phase 0A-2復元）**

**理由**:
1. 発見率を即座に100%に回復
2. リスクゼロ
3. その後、慎重に最適化を適用

**実装順序**:
```
1. Phase 0A-2のLanceDB復元（今すぐ）
2. Phase 1: タイトル検索最優先化（Week 1）
3. Phase 2: チャンクサイズ最適化（Week 2、慎重にテスト）
4. Phase 3-4: 必要に応じて実施
```

---

**Status**: 分析完了、実装準備完了  
**Next**: Phase 0A-2復元の実行

Phase 0A-2を復元しますか？
