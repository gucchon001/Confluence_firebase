# 参照元パーセンテージロジック分析

**作成日**: 2025年11月4日  
**問題**: 参照元のパーセンテージが最新の計算ロジック（Composite Score）を反映しているか

## 📋 現在の実装

### 1. `unified-search-result-processor.ts` の `formatResults`

```typescript
// 299行目
const scoreText = generateScoreText(sourceType, bm25Score, distance);
```

**問題点**:
- `_compositeScore` を使用していない
- `sourceType`、`bm25Score`、`distance` のみを使用
- 最新の Composite Score 計算ロジックを反映していない

### 2. `score-utils.ts` の `generateScoreText`

```typescript
export function generateScoreText(
  sourceType: 'vector' | 'bm25' | 'keyword' | 'hybrid',
  score?: number,
  distance?: number
): string {
  switch (sourceType) {
    case 'vector':
    case 'hybrid':
      const similarityPct = calculateSimilarityPercentage(distance ?? 1);
      return `${sourceType === 'hybrid' ? 'Hybrid' : 'Vector'} ${similarityPct}%`;
    case 'bm25':
      const normalizedBM25 = normalizeBM25Score(score ?? 0, 30);
      return `BM25 ${normalizedBM25}%`;
    case 'keyword':
      const normalizedKeyword = Math.min(100, Math.max(0, ((score ?? 0) / 20) * 100));
      return `Keyword ${Math.round(normalizedKeyword)}%`;
    default:
      return 'Unknown';
  }
}
```

**問題点**:
- `compositeScore` パラメータがない
- Composite Score を考慮していない

### 3. `composite-scoring-service.ts` の `calculateCompositeScore`

```typescript
public calculateCompositeScore(signals: SearchSignals): CompositeScore {
  // 各信号を0-1に正規化
  const normalizedVector = 1.0 - Math.min(signals.vectorDistance / maxVectorDistance, 1.0);
  const normalizedBm25 = Math.min(signals.bm25Score / maxBm25Score, 1.0);
  const normalizedTitle = signals.titleMatchRatio;
  const normalizedLabel = signals.labelScore;
  const normalizedKg = signals.kgBoost || 0;
  
  // 重み付き合計
  const finalScore = vectorContribution + bm25Contribution + titleContribution + labelContribution + kgContribution;
  
  return { finalScore, breakdown: {...} };
}
```

**計算される値**:
- `finalScore`: 0-1の範囲（各信号の重み付き合計）
- `breakdown`: 各信号の寄与度

## ❌ 問題点

### 1. `scoreText` が `_compositeScore` を使用していない

現在の実装では：
- `scoreText` は `sourceType`、`bm25Score`、`distance` のみを使用
- `_compositeScore` は計算されているが、`scoreText` に反映されていない

### 2. 最新の計算ロジックが反映されていない

Composite Score は以下の要素を考慮：
- Vector Distance（ベクトル距離）
- BM25 Score（BM25スコア）
- Title Match Ratio（タイトルマッチ比率）
- Label Score（ラベルスコア）
- KG Boost（知識グラフブースト）

しかし、`scoreText` は：
- Vector Distance のみ（または BM25 Score のみ）を使用
- Title Match Ratio、Label Score、KG Boost を考慮していない

## 💡 解決策

### 1. `generateScoreText` に `compositeScore` パラメータを追加

```typescript
export function generateScoreText(
  sourceType: 'vector' | 'bm25' | 'keyword' | 'hybrid',
  score?: number,
  distance?: number,
  compositeScore?: number  // 追加
): string {
  // compositeScore が提供されている場合は、それを優先的に使用
  if (compositeScore !== undefined && compositeScore !== null) {
    // Composite Score を0-100%に変換
    const compositePct = Math.round(compositeScore * 100);
    return `Composite ${compositePct}%`;
  }
  
  // 既存のロジック（フォールバック）
  switch (sourceType) {
    // ... 既存のコード ...
  }
}
```

### 2. `unified-search-result-processor.ts` の `formatResults` を修正

```typescript
// スコア情報生成
const scoreKind = sourceType;
const scoreRaw = sourceType === 'bm25' || sourceType === 'keyword' ? bm25Score : distance;
const compositeScore = (result as any)._compositeScore;  // 追加
const scoreText = generateScoreText(sourceType, bm25Score, distance, compositeScore);  // 修正
```

## ✅ 期待される効果

### 1. 最新の計算ロジックが反映される

- Composite Score が `scoreText` に反映される
- Vector Distance、BM25 Score、Title Match Ratio、Label Score、KG Boost がすべて考慮される

### 2. ユーザーへの表示が正確になる

- 参照元のパーセンテージが実際のスコア計算ロジックを反映する
- より正確な関連度が表示される

## 📝 実装計画

1. **`score-utils.ts` の `generateScoreText` を修正**
   - `compositeScore` パラメータを追加
   - Composite Score を優先的に使用するロジックを追加

2. **`unified-search-result-processor.ts` の `formatResults` を修正**
   - `_compositeScore` を取得
   - `generateScoreText` に `compositeScore` を渡す

3. **テスト**
   - Composite Score が正しく表示されるか確認
   - 既存のロジック（フォールバック）が正しく動作するか確認

