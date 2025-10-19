# ハイブリッド検索 パフォーマンス最適化案

## 📊 現状分析

### パフォーマンス測定結果 (2025-10-18)

| メトリクス | 現状 | 目標 | ギャップ |
|-----------|------|------|---------|
| 平均初回検索時間 | 19.8秒 | 5秒以内 | **-75%必要** |
| 最速ケース | 4.2秒 | 5秒以内 | ✅ 達成 |
| 最遅ケース | 61.7秒 | 5秒以内 | **-92%必要** |
| キャッシュヒット時 | 1-3秒 | 3秒以内 | ✅ 達成 |

### ボトルネック分析

| コンポーネント | 所要時間 | 割合 | 優先度 |
|---------------|----------|------|--------|
| **Composite Scoring** | 10-15秒 | **~70%** | 🔴 **最優先** |
| 埋め込みベクトル生成 | 2-3秒 | ~15% | 🟡 中 |
| KG拡張（合計） | 1-2秒 | ~10% | 🟢 低 |
| その他 | 0.5秒 | ~5% | - |

---

## 🚀 最適化案

### 【最優先】案1: Composite Scoring の段階的実行

**現状の問題**:
- 全結果（150-200件）に対してComposite Scoringを実行
- N-gramマッチング（二重ループ）が各結果で実行される
- 計算量: O(n × m²) (n=結果数, m=機能名長)

**提案**: 段階的スコアリング

```typescript
// Step 1: RRF上位50件のみComposite Scoringを実行
const top50ByRrf = rrfSortedResults.slice(0, 50);
const scored50 = compositeScoringService.scoreAndRankResults(top50ByRrf, keywords, query);

// Step 2: 残りは簡易スコアリング（RRFスコアのみ）
const remaining = rrfSortedResults.slice(50);

// Step 3: マージして最終ソート
const finalResults = [...scored50, ...remaining].sort(...);
```

**期待効果**:
- 計算量削減: 150件 → 50件 (**-67%**)
- 予想改善: 10秒 → **3秒** (**-70%**)
- 品質影響: **なし** （上位50件で十分）

**リスク**: 🟢 低（上位結果の品質は維持される）

---

### 【優先】案2: N-gramマッチングのキャッシュ化

**現状の問題**:
```typescript
// structured-label-scorer.ts
for (let i = 0; i < featureLower.length; i++) {
  for (let len = 2; len <= Math.min(featureLower.length - i, 6); len++) {
    const substring = featureLower.substring(i, i + len);
    if (queryLower.includes(substring)) {
      // 毎回計算される
    }
  }
}
```

**提案**: クエリ × 機能名のN-gramマッチ結果をキャッシュ

```typescript
const ngramCache = new Map<string, number>();

function calculatePartialMatch(query: string, feature: string): number {
  const cacheKey = `${query}::${feature}`;
  
  if (ngramCache.has(cacheKey)) {
    return ngramCache.get(cacheKey)!;
  }
  
  const score = computeNgramScore(query, feature);
  ngramCache.set(cacheKey, score);
  return score;
}
```

**期待効果**:
- N-gram計算: 初回のみ
- 予想改善: 2-3秒削減
- メモリ使用: +5MB程度

**リスク**: 🟢 低（メモリ使用量は許容範囲）

---

### 【優先】案3: 早期結果絞り込み

**現状の問題**:
- RRF融合前に150-200件の候補が存在
- 全候補に対してComposite Scoringを実行

**提案**: RRF上位のみを次段階に渡す

```typescript
// RRF融合後、上位100件のみをComposite Scoringに渡す
const rrfSorted = vectorResults.sort((a, b) => b._rrfScore - a._rrfScore);
const top100 = rrfSorted.slice(0, 100);

// Composite Scoringは上位100件のみ
vectorResults = compositeScoringService.scoreAndRankResults(top100, keywords, query);
```

**期待効果**:
- 処理対象: 150-200件 → 100件 (**-40%**)
- 予想改善: 3-4秒削減
- 品質影響: **なし** （下位結果は元々返さない）

**リスク**: 🟢 低

---

### 【中優先】案4: 構造化ラベルスコアの事前計算

**現状の問題**:
- 各結果でStructuredLabelスコアを計算
- 同じラベルでも毎回計算される

**提案**: ラベルIDベースのスコアキャッシュ

```typescript
const labelScoreCache = new Map<string, number>();

function getCachedLabelScore(query: string, label: StructuredLabel): number {
  const cacheKey = `${query}::${label.domain}::${label.feature}`;
  
  if (labelScoreCache.has(cacheKey)) {
    return labelScoreCache.get(cacheKey)!;
  }
  
  const score = calculateLabelMatchScore(query, label);
  labelScoreCache.set(cacheKey, score);
  return score;
}
```

**期待効果**:
- ラベルスコア計算: 初回のみ
- 予想改善: 1-2秒削減
- 品質影響: **なし**

**リスク**: 🟢 低

---

### 【中優先】案5: 並列化の拡大

**現状**:
- ベクトル検索 + BM25検索のみ並列化
- KG拡張、Composite Scoringは逐次実行

**提案**: KG拡張とComposite Scoringも並列化

```typescript
// Phase 1: 並列検索
const [vectorResults, bm25Results] = await Promise.all([
  executeVectorSearch(...),
  executeBM25Search(...)
]);

// Phase 2: RRF融合
const rrfResults = applyRRF(vectorResults, bm25Results);

// Phase 3: KG拡張とComposite Scoringを並列化
const [kgResults, scoredResults] = await Promise.all([
  expandWithKG(topResults),
  compositeScoringService.scoreAndRankResults(rrfResults, keywords, query)
]);

// Phase 4: KG結果をマージして最終ソート
const finalResults = mergeAndSort(scoredResults, kgResults);
```

**期待効果**:
- KG拡張時間を隠蔽（並列実行）
- 予想改善: 1-2秒削減

**リスク**: 🟡 中（実装の複雑さ増加）

---

### 【低優先】案6: 埋め込みベクトルのバッチ生成

**現状**:
- 1クエリずつ埋め込みベクトル生成
- 複数クエリの場合は逐次実行

**提案**: 複数クエリのバッチ生成

```typescript
// 複数クエリを一括で埋め込み生成（API制限内）
const embeddings = await getBatchEmbeddings([query1, query2, ...]);
```

**期待効果**:
- API呼び出し回数削減
- テスト実行時の高速化

**リスク**: 🟢 低

**注意**: 通常の検索（1クエリ）では効果なし

---

## 📋 推奨実装順序

### フェーズ1: 即座に実装可能（品質影響なし）

1. **案3: 早期結果絞り込み** → -40%削減
2. **案1: Composite Scoringの段階的実行** → -67%削減

**合計予想改善**: **10-15秒 → 3-5秒** (-70%)

**実装工数**: 1-2時間  
**リスク**: 🟢 低  
**品質影響**: なし

---

### フェーズ2: キャッシュ最適化（品質影響なし）

3. **案2: N-gramマッチングキャッシュ** → -2-3秒
4. **案4: 構造化ラベルスコアキャッシュ** → -1-2秒

**合計予想改善**: **3-5秒 → 1-2秒** (-60%)

**実装工数**: 2-3時間  
**リスク**: 🟢 低  
**メモリ**: +5-10MB

---

### フェーズ3: アーキテクチャ改善（要検証）

5. **案5: 並列化の拡大** → -1-2秒

**実装工数**: 3-4時間  
**リスク**: 🟡 中（実装複雑さ）

---

## 🎯 最終目標

### フェーズ1+2実装後の予想パフォーマンス

| メトリクス | 現状 | 予想 | 目標 |
|-----------|------|------|------|
| 平均初回検索時間 | 19.8秒 | **2-3秒** ✅ | 5秒以内 |
| 最速ケース | 4.2秒 | **1.0秒** ✅ | 5秒以内 |
| 最遅ケース | 61.7秒 | **5-8秒** ⚠️ | 5秒以内 |
| キャッシュヒット時 | 1-3秒 | **<1秒** ✅ | 3秒以内 |

**達成率**: 85-90% ✅

---

## 💡 具体的な実装コード例

### 案1+3: 段階的Composite Scoring

```typescript
// src/lib/lancedb-search-client.ts

// RRF融合後、早期絞り込み
const rrfSorted = vectorResults.sort((a, b) => (b._rrfScore || 0) - (a._rrfScore || 0));

// 上位50件のみComposite Scoringを実行（-67%削減）
const top50 = rrfSorted.slice(0, 50);
const scored50 = compositeScoringService.scoreAndRankResults(top50, finalKeywords, params.query);

// 残りは簡易スコア（RRFスコアを維持）
const remaining = rrfSorted.slice(50).map(r => ({
  ...r,
  _compositeScore: (r._rrfScore || 0) * 0.5,  // RRFスコアを50%に減衰
  _scoreBreakdown: null  // 簡易版
}));

// マージして最終ソート
vectorResults = [...scored50, ...remaining]
  .sort((a, b) => b._compositeScore - a._compositeScore);

console.log(`[searchLanceDB] Applied composite scoring to top 50 (optimized)`);
```

---

### 案2: N-gramキャッシュ

```typescript
// src/lib/structured-label-scorer.ts

// モジュールレベルでキャッシュ定義
const ngramMatchCache = new Map<string, number>();

export function calculateLabelMatchScore(
  query: string,
  label: StructuredLabel | null | undefined,
  options = {}
): number {
  if (!label || !label.feature) {
    return 0;
  }
  
  // キャッシュキー
  const cacheKey = `${query.toLowerCase()}::${label.feature.toLowerCase()}`;
  
  if (ngramMatchCache.has(cacheKey)) {
    // キャッシュヒット
    return ngramMatchCache.get(cacheKey)!;
  }
  
  // 既存のN-gram計算ロジック
  const score = computeFeatureMatchScore(query, label, options);
  
  // キャッシュ保存
  ngramMatchCache.set(cacheKey, score);
  
  return score;
}

// キャッシュクリア関数（テスト用）
export function clearNgramCache() {
  ngramMatchCache.clear();
}
```

---

## 🧪 検証計画

### 段階的ロールアウト

#### Step 1: ローカルテスト
- [ ] 案1+3を実装
- [ ] 7ケーステストで品質検証
- [ ] パフォーマンス測定

**期待結果**: 品質100%維持、速度3-5秒

#### Step 2: 追加最適化
- [ ] 案2+4を実装
- [ ] 再度テスト
- [ ] パフォーマンス測定

**期待結果**: 速度1-3秒

#### Step 3: 本番デプロイ
- [ ] ステージング環境でテスト
- [ ] 実ユーザークエリで検証
- [ ] 本番環境展開

---

## ⚠️ リスク管理

### 品質リスク

| リスク | 軽減策 | 重要度 |
|--------|--------|--------|
| 上位50件外に正解がある | RRFで上位に来るため問題なし | 🟢 低 |
| スコア変動 | 7ケーステストで検証 | 🟢 低 |
| キャッシュメモリ | サイズ上限設定 | 🟢 低 |

### パフォーマンスリスク

| リスク | 軽減策 | 重要度 |
|--------|--------|--------|
| 最遅ケースが残る | 広範クエリの事前フィルタ | 🟡 中 |
| キャッシュミス時遅い | ウォームアップ実装 | 🟢 低 |

---

## 📈 期待される改善効果

### パフォーマンス改善（フェーズ1実装後）

```
平均検索時間: 19.8秒 → 3-5秒 (-75%～-85%)

ケース別予想:
  Case 1: 61.7秒 → 8-10秒 (-85%)
  Case 2: 17.9秒 → 2-3秒 (-85%)
  Case 3: 4.2秒 → 1.0秒 (-75%)
  Case 4: 4.6秒 → 1.2秒 (-75%)
  Case 5: 9.6秒 → 2.0秒 (-80%)
  Case 6: 16.1秒 → 2.5秒 (-85%)
  Case 7: 24.5秒 → 3.5秒 (-86%)
```

### 品質維持

- ✅ 発見率: 100% (変更なし)
- ✅ Top 10発見率: 100% (変更なし)
- ✅ フォールバック率: 0% (変更なし)
- ✅ 平均コンテンツ長: 1332文字 (変更なし)

---

## 🔧 実装詳細

### 変更ファイル

1. **`src/lib/lancedb-search-client.ts`**
   - 早期結果絞り込み追加
   - Composite Scoringを上位50件に制限

2. **`src/lib/structured-label-scorer.ts`**
   - N-gramキャッシュ追加
   - キャッシュクリア関数追加

3. **`src/lib/composite-scoring-service.ts`**
   - 段階的スコアリング対応
   - パフォーマンスログ追加

### テスト計画

**テストケース**: 既存の7ケース
- Case 1: 会員退会
- Case 2: 教室削除
- Case 3: 教室コピー
- Case 4: 重複応募不可期間
- Case 5: 求人応募期間
- Case 6: 学年自動更新バッチ
- Case 7: 急募機能

**検証項目**:
1. 発見率 (目標: 100%)
2. Top 10発見率 (目標: 100%)
3. 平均検索時間 (目標: <5秒)
4. フォールバック率 (目標: <5%)

---

## 📊 ROI分析

### 投資

- 実装工数: **3-5時間**
- テスト工数: **1-2時間**
- 合計: **4-7時間**

### リターン

- ユーザー体験: **大幅改善**（20秒 → 3秒）
- サーバー負荷: **-75%削減**
- キャッシュヒット率: **向上**（高速体験の頻度増加）

### ROI

**投資対効果**: **非常に高い** 🎯

---

## 🎬 アクションアイテム

### 即座に実装すべき最適化（フェーズ1）

- [ ] **案3**: 早期結果絞り込み（RRF上位100件）
- [ ] **案1**: Composite Scoringを上位50件に制限
- [ ] 7ケーステストで品質検証
- [ ] パフォーマンステストで速度検証
- [ ] レポート生成

**予想所要時間**: 2時間  
**予想改善**: -70% (19.8秒 → 5秒)

---

### 次のステップ（フェーズ2）

- [ ] **案2**: N-gramキャッシュ実装
- [ ] **案4**: ラベルスコアキャッシュ実装
- [ ] 再度テスト
- [ ] パフォーマンス測定

**予想所要時間**: 3時間  
**予想改善**: -50% (5秒 → 2.5秒)

---

## 📝 まとめ

### 品質を維持したままパフォーマンスを改善する方法

**✅ 可能です！**

**鍵となる洞察**:
1. **上位結果のみ精密計算すれば十分** - 下位結果は返さない
2. **重複計算をキャッシュ** - 同じ計算を繰り返さない
3. **並列化の拡大** - 待ち時間を隠蔽

**実装の容易さ**: 🟢 高（既存コードへの小さな変更のみ）  
**効果**: 🔴 **非常に高い** (-75%～-85%)  
**リスク**: 🟢 低（品質影響なし）

---

*このドキュメントの提案を実装することで、品質を犠牲にすることなく、大幅なパフォーマンス改善が期待できます。*

