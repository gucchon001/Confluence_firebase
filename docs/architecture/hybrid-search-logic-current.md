# ハイブリッド検索ロジック：現在の実装

**作成日**: 2025-10-14  
**対象ファイル**: `src/lib/lancedb-search-client.ts`

---

## 📊 検索フローの概要

```
┌─────────────────────────────────────────────────┐
│ 1. 前処理                                        │
│  - キャッシュチェック                             │
│  - キーワード抽出（keyword-lists-v2.json）        │
│  - ベクトル生成（embedding）                      │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 2. 並列検索                                      │
│  ├─ Vector Search (topK * 2 = 16件)             │
│  └─ BM25 Search (複数キーワード)                 │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 3. スコアリング                                   │
│  - Hybrid Score（Vector距離 + Keyword）          │
│  - BM25 Score（TF-IDF + タイトルブースト）        │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 4. RRF融合（Reciprocal Rank Fusion）             │
│  - Vector順位                                    │
│  - Keyword順位                                   │
│  - BM25順位                                      │
│  - Title Exact順位                               │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ 5. 後処理                                        │
│  - ページ単位の重複排除                           │
│  - 空ページフィルター                             │
│  - StructuredLabelスコアリング（Phase 0A-2）     │
└─────────────────────────────────────────────────┘
              ↓
         最終結果
```

---

## 🔍 詳細ロジック

### 1. キーワード抽出

**ファイル**: `src/lib/unified-keyword-extraction-service.ts`

**ロジック**:
```typescript
findMatchingKeywords(query, keywords) {
  for (const keyword of keyword-lists-v2.json) {
    // 1. 完全一致
    if (queryWords.includes(keyword)) → マッチ
    
    // 2. クエリ全体に含まれる
    if (query.includes(keyword)) → マッチ
    
    // 最大20個まで
  }
}
```

**データソース**: `data/domain-knowledge-v2/keyword-lists-v2.json`（9,126個）

**優先度**:
- 核心単語との一致: +100
- ドメインとの関連: +80
- キーワード長（2-8文字）: +20

---

### 2. Vector Search

**ロジック**:
```typescript
// topK * 2 = 16件を取得
vectorResults = await tbl.search(vector).limit(topK * 2).toArray();

// 距離閾値でフィルタリング
maxDistance = 2.0（デフォルト）
```

**距離から類似度への変換**:
```
類似度% = 100 * (1 - min(distance, 1.0))
```

---

### 3. BM25 Search

**ロジック**:
```typescript
// 複数キーワード（上位5個）でLIKE検索
for (const keyword of keywords.slice(0, 5)) {
  // タイトルと本文からヒット
  rows = await tbl.query().where(`title LIKE '%${keyword}%'`).toArray();
}

// BM25スコア計算
for (const keyword of keywords) {
  // TF-IDF計算
  idf = log(1 + (totalDocs - df + 0.5) / (df + 0.5))
  scoreTitle = idf * ((tfTitle * (k1 + 1)) / (...))
  scoreBody = idf * ((tfBody * (k1 + 1)) / (...))
  totalScore = TITLE_WEIGHT * scoreTitle + BODY_WEIGHT * scoreBody
}

// タイトルブースト
if (phraseInTitle) totalScore += 5.0  // フレーズ完全一致
if (keywordsInTitle.length >= 2) totalScore += keywordsInTitle.length * 2.0
```

**パラメータ**:
- `k1 = 1.2`（用語頻度の飽和パラメータ）
- `b = 0.75`（文書長正規化）
- `TITLE_WEIGHT = 1.0`
- `BODY_WEIGHT = 0.6`

---

### 4. RRF融合

**ロジック**:
```typescript
// 各検索手法でランキングを作成
vecRank = Vector検索結果の順位
kwRank = Keyword検索結果の順位
bm25Rank = BM25検索結果の順位

// RRFスコア計算
kRrf = 60
rrf = 1.0   / (kRrf + vecRank)      // Vector: 重み 1.0
    + 0.8   / (kRrf + kwRank)       // Keyword: 重み 0.8
    + 1.2   / (kRrf + titleRank)    // Title Exact: 重み 1.2
    + 0.6   / (kRrf + bm25Rank)     // BM25: 重み 0.6
```

**減衰ルール**:
```typescript
// 議事録・総論系を減衰
if (hasPenalty) rrf *= 0.9
if (isGenericDoc) rrf *= 0.8  // 共通要件、フロー、一覧など
if (title.includes('本システム外')) rrf *= 0.8
```

---

### 5. StructuredLabelスコアリング（Phase 0A-2）

**ロジック**:
```typescript
// StructuredLabelを取得
labels = await getStructuredLabels(pageIds);

// スコア計算
labelScore = calculateStructuredLabelScore(query, label);

// 統一処理サービスで融合
processedResults = unifiedSearchResultProcessor.processSearchResults(results, {
  vectorWeight: 0.3,
  keywordWeight: 0.3,
  labelWeight: 0.4  // StructuredLabelを最重視
});
```

---

## ⚠️ 現在の問題点

### 問題1: RRF融合でVector上位が消える

**事例2（164_教室削除）**:
- Vector: 1-2位（優秀）
- BM25: 圏外（164が候補に含まれない）
- RRF融合後: 消える

**原因**: BM25の重みが0.6と低いが、BM25候補が大量にあり、それらがVector結果を押し出す

---

### 問題2: タイトル部分一致の優先度が低い

**「教室削除ができないのは...」**:
- 164のタイトル: `164_【FIX】教室削除機能`
- キーワード: `削除`, `教室`（両方タイトルに含まれる）
- しかし、「教室：塾チャート」（`教室`のみ）がBM25で上位

**原因**: 複数キーワードマッチのブーストが不十分

---

### 問題3: BM25とVectorの結果が独立

- Vector searchで良いページを見つけても、BM25で見つからないと評価が下がる
- 逆に、BM25で無関係なページが上位に来ると、Vectorの良い結果が埋もれる

---

## 💡 改善案

### 案1: RRF重みの調整

```typescript
// 現在
vector=1.0, keyword=0.8, title-exact=1.2, bm25=0.6

// 改善案
vector=1.5, keyword=0.8, title-exact=1.2, bm25=0.5
// Vectorの重みを上げ、BM25の重みを下げる
```

### 案2: タイトル部分一致の強化

```typescript
// 複数キーワードのタイトルマッチ
if (keywordsInTitle.length >= 2) {
  totalScore += keywordsInTitle.length * 2.0;  // 現在
  totalScore += keywordsInTitle.length * 4.0;  // 改善案（2倍に強化）
}
```

### 案3: Vector結果を保護

```typescript
// Vector上位N件は必ず結果に含める
const topVectorResults = vectorResults.slice(0, 3);
// BM25融合後もこれらを優先
```

---

## 🎯 推奨アプローチ

**Phase 0A-2（Knowledge Graph）への移行を推奨**

**理由**:
1. 現在の問題（RRF融合、BM25の偏り）は複雑
2. 改善しても副作用のリスクが高い
3. Knowledge Graphで根本的に解決可能
   - 164 → 177の参照関係で自動拡張
   - domain関連ページの補完

**現状**: 67%（4/6件）  
**Phase 0A-2期待**: 80-85%

---

## 📝 次のステップ

1. ✅ ハードコード削除完了
2. ✅ キーワード抽出改善完了
3. ✅ N-gram削除完了
4. ⏭️ **Phase 0A-2（Knowledge Graph）に進む**


