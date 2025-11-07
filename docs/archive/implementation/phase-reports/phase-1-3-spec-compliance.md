# Phase 1-3 仕様適合度レポート

## 📋 **比較対象**

- **設計仕様**: `docs/architecture/enhanced-hybrid-search-design.md`
- **実装**: Phase 0A-4（Phase 1-3）

---

## ✅ **Phase 2: チャンクサイズの最適化（100%適合）**

### 仕様
```typescript
TOKEN_LIMIT: 8,192 → 1,024トークン
CHUNK_SIZE: 1,800 → 1,600文字
OVERLAP: 0 → 200文字
```

### 実装
```typescript
// scripts/rebuild-lancedb-smart-chunking.ts
const TOKEN_LIMIT = 1024;
const CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 200;
```

### 結果
✅ **完全一致** - LanceDB再構築済み（1,316レコード、813ユニークページ）

---

## ⚠️ **Phase 1: タイトル検索の最優先化（20%適合）**

### 仕様（`enhanced-hybrid-search-design.md`より）

```
Stage 1: 高速一致検索（Early Exit、10-50ms）

1.1 タイトル厳格一致検索（最高優先度）
    ├─ Levenshtein距離 >= 85%
    └─ 即座に返す（Early Exit）

1.2 タイトル部分一致検索（キーワードベース）
    ├─ keywords.filter(kw => title.includes(kw))
    ├─ マッチ率 >= 33%
    └─ 候補に追加（高優先度）

1.3 ラベル一致検索
    └─ domain/tag一致

📊 Stage 1結果: 15-20件の候補

→ ベクトル検索・BM25検索の「前」に実行
```

### 実装状況

#### ❌ 実装されていない機能
1. **Early Exit（タイトル厳格一致）**
   - 仕様: Levenshtein距離で85%以上一致 → 即座に返す
   - 実装: なし

2. **Stage 1の実行順序**
   - 仕様: タイトル検索 → ベクトル検索・BM25検索
   - 実装: ベクトル検索・BM25検索 → タイトルブースト（順序が逆）

3. **独立したタイトル検索結果**
   - 仕様: 15-20件の高優先度候補を事前取得
   - 実装: なし

#### ✅ 部分的に実装されている機能
1. **タイトル部分一致（キーワードベース）**
   ```typescript
   // src/lib/lancedb-search-client.ts (実装)
   const matchedKeywords = finalKeywords.filter(kw => 
     title.includes(kw.toLowerCase())
   );
   const titleMatchRatio = finalKeywords.length > 0 ? 
     matchedKeywords.length / finalKeywords.length : 0;
   ```
   - ⚠️ ただし、ベクトル検索・BM25の「後」にブーストとして適用

2. **タイトルブースト**
   ```typescript
   // ベクトル検索
   if (titleMatchRatio >= 0.66) {
     boostFactor = 10.0; // Phase 4強化
   }
   
   // BM25検索
   if (titleMatchRatio >= 0.66) {
     boostedScore *= 5.0; // Phase 4強化
   }
   ```

### 適合度: **20%** ⚠️

**理由:**
- タイトルマッチング自体は実装されているが、仕様の「Early Exit」と「実行順序」が満たされていない
- タイトル検索が独立したStage 1として機能していない

---

## ⚠️ **Phase 3: 複合スコアリングの実装（50%適合）**

### 仕様（`enhanced-hybrid-search-design.md`より）

```typescript
finalScore = (
  titleExactScore * 0.40 +      // タイトル厳格一致（最重要）
  titlePartialScore * 0.25 +    // タイトル部分一致
  bm25Score * 0.15 +            // BM25スコア
  vectorScore * 0.10 +          // ベクトル類似度
  labelScore * 0.05 +           // ラベル類似度
  kgBoost * 0.05                // KGブースト
)
```

### 実装状況

```typescript
// src/lib/composite-scoring-service.ts (実装)
const compositeScore =
  (bm25Score * 0.4) +           // BM25（40%）
  (vectorScore * 0.3) +         // ベクトル（30%）
  (titleContribution * 0.2) +   // タイトル（20%）
  (labelContribution * 0.1);    // ラベル（10%）
```

### 比較表

| 要素 | 仕様の重み | 実装の重み | 適合度 |
|------|-----------|-----------|--------|
| **タイトル厳格一致** | **40%** | **0%** | ❌ 未実装 |
| **タイトル部分一致** | **25%** | **20%** | ⚠️ 近い（-5%） |
| **BM25** | 15% | **40%** | ❌ 大幅に異なる（+25%） |
| **ベクトル** | 10% | **30%** | ❌ 大幅に異なる（+20%） |
| **ラベル** | 5% | **10%** | ⚠️ 近い（+5%） |
| **KGブースト** | **5%** | **0%** | ❌ 未実装 |

### 問題点

1. **タイトル重視が不十分**
   - 仕様: タイトル合計 **65%**（厳格40% + 部分25%）
   - 実装: タイトル合計 **20%**
   - **差異: -45%** ❌

2. **BM25/ベクトルが過大評価**
   - 仕様: BM25=15%、ベクトル=10% → 合計25%
   - 実装: BM25=40%、ベクトル=30% → 合計70%
   - **差異: +45%** ❌

3. **タイトル厳格一致が未実装**
   - 最も重要な要素（40%）が実装されていない

4. **KGブーストが未実装**
   - Knowledge Graph統合のインセンティブがない

### 適合度: **50%** ⚠️

**理由:**
- スコアリング自体は実装されているが、重み配分が仕様と大きく異なる
- タイトル重視の設計思想が反映されていない

---

## 📊 **総合適合度**

| Phase | 適合度 | 評価 | 主な問題点 |
|-------|--------|------|-----------|
| **Phase 1** | **20%** | ❌ 不適合 | Early Exit未実装、実行順序が逆 |
| **Phase 2** | **100%** | ✅ 完全適合 | なし |
| **Phase 3** | **50%** | ⚠️ 部分適合 | タイトル重視が不十分、重み配分が異なる |

**平均適合度: 56.7%** ⚠️

---

## 🔴 **仕様との主な相違点**

### 1. フロー順序の相違

**仕様:**
```
Stage 1: タイトル検索（Early Exit可能）
   ↓
Stage 2: ベクトル + BM25検索（並列）
   ↓
Stage 3: 結果統合
   ↓
Stage 4: KG拡張
   ↓
Stage 5: 複合スコアリング
```

**実装:**
```
Stage 1: ベクトル検索（タイトルブースト付き）
   ↓
Stage 2: BM25検索（タイトルブースト付き）
   ↓
Stage 3: RRF融合
   ↓
Stage 4: 複合スコアリング
   ↓
Stage 5: KG拡張
```

**問題:**
- タイトル検索が独立していない
- KG拡張が最後（仕様では中間）
- Early Exitの仕組みがない

### 2. スコアリング重みの相違

**仕様の優先順位:**
1. タイトル厳格一致: **40%** ← 最重要
2. タイトル部分一致: **25%**
3. BM25: 15%
4. ベクトル: 10%
5. ラベル: 5%
6. KGブースト: 5%

**実装の優先順位:**
1. BM25: **40%** ← 最重要（仕様と異なる）
2. ベクトル: **30%**
3. タイトル: **20%**
4. ラベル: **10%**

**問題:**
- タイトル重視の設計思想が反映されていない
- BM25/ベクトルが過大評価されている

---

## 💡 **推奨される修正**

### 優先度1: Phase 1の正しい実装（Early Exit）

```typescript
// src/lib/lancedb-search-client.ts

async function searchLanceDB(params) {
  // 【NEW】Stage 1: タイトル検索（Early Exit）
  const titleResults = await searchTitleFirst(
    params.query, 
    keywords, 
    connection.table
  );
  
  // Early Exit: タイトル厳格一致があれば即座に返す
  if (titleResults.exactMatches.length > 0) {
    console.log('[Early Exit] Title exact match found');
    return formatResults(titleResults.exactMatches);
  }
  
  // Stage 2以降: 通常のハイブリッド検索...
}
```

### 優先度2: Phase 3の重み修正

```typescript
// src/lib/composite-scoring-service.ts

const compositeScore =
  (titleExactScore * 0.40) +      // タイトル厳格一致（最重要）
  (titlePartialScore * 0.25) +    // タイトル部分一致
  (bm25Score * 0.15) +            // BM25
  (vectorScore * 0.10) +          // ベクトル
  (labelScore * 0.05) +           // ラベル
  (kgBoost * 0.05);               // KGブースト
```

---

## 🎯 **結論**

### Phase 2のみが仕様通り ✅

- **Phase 1**: ❌ 仕様に沿っていない（20%適合）
  - Early Exit未実装
  - 実行順序が逆
  
- **Phase 2**: ✅ 仕様通り（100%適合）
  - チャンクサイズ最適化完了
  
- **Phase 3**: ⚠️ 部分的に仕様通り（50%適合）
  - スコアリング自体は実装
  - 重み配分が大きく異なる

### 次のアクション

**選択肢A**: Phase 1-3を仕様通りに修正（2-3時間）
- タイトル検索のEarly Exit実装
- 複合スコアの重み修正

**選択肢B**: 現在の実装で継続（効果測定済み）
- 発見率83%達成済み
- 仕様とは異なるが実用的

どちらを選びますか？

