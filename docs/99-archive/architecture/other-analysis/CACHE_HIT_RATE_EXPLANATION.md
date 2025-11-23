# キャッシュヒット率の計測機能

**作成日**: 2025年1月27日  
**目的**: キャッシュヒット率の計測機能の説明と実装状況

---

## 📋 概要

**キャッシュヒット率の計測**とは、検索結果キャッシュがどの程度有効に活用されているかを測定する機能です。

### キャッシュヒット率とは？

**キャッシュヒット率** = **キャッシュから取得できた回数** / **総リクエスト数** × 100

- **ヒット**: キャッシュにデータがあり、データベース検索をスキップできた
- **ミス**: キャッシュにデータがなく、データベース検索を実行した

**例**:
- 100回の検索リクエストのうち、60回がキャッシュから取得できた
- キャッシュヒット率 = 60% = 60回 / 100回 × 100

---

## 🎯 この機能の目的

### 1. **パフォーマンス監視**

**効果**:
- キャッシュが有効に機能しているかを確認
- キャッシュヒット率が高い = 検索が高速（5ms vs 800ms）
- キャッシュヒット率が低い = 最適化の余地がある

**測定項目**:
- **ヒット率（hitRate）**: ヒットされたエントリの割合（0.0 - 1.0）
- **平均ヒット数（avgHits）**: 1つのエントリが平均何回使われたか
- **キャッシュサイズ（size）**: 現在キャッシュされているエントリ数

---

### 2. **キャッシュ戦略の最適化**

**判断材料として**:
- **TTL（Time To Live）**: キャッシュの有効期限
  - ヒット率が低い → TTLを延長する（例: 5分 → 15分）
  - ヒット率が高い → TTLを短縮しても問題ない可能性
- **maxSize**: キャッシュの最大サイズ
  - ヒット率が低い → maxSizeを増やす（例: 1000 → 5000）
  - サイズは大きいがヒット率が低い → maxSizeを削減してメモリ節約

**現在の設定**:
- TTL: 15分（Phase 5で5分 → 15分に拡大）
- maxSize: 5000（Phase 5で1000 → 5000に拡大）
- **課題**: 実際のヒット率が不明なため、設定の根拠が経験則のみ

---

### 3. **問題の早期発見**

**異常検知**:
- 通常はヒット率60%なのに、急に10%に低下 → キャッシュがクリアされた、または問題が発生
- ヒット率が0% → キャッシュ機能が動作していない可能性
- 平均ヒット数が異常に高い → 特定のクエリが大量にリクエストされている

---

## 🔍 現在の実装状況

### ✅ 実装済みの機能

**`GenericCache` クラス** (`src/lib/generic-cache.ts`):
```typescript
getStats(): CacheStats {
  let totalHits = 0;
  let entriesWithHits = 0;
  
  for (const entry of this.cache.values()) {
    totalHits += entry.hits;
    if (entry.hits > 0) {
      entriesWithHits++;
    }
  }
  
  return {
    size: this.cache.size,                    // 現在のキャッシュサイズ
    avgHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,  // 平均ヒット数
    hitRate: this.cache.size > 0 ? entriesWithHits / this.cache.size : 0  // ヒット率
  };
}
```

**統計情報の内容**:
- **size**: 現在キャッシュされているエントリ数（最大5000）
- **avgHits**: 1つのエントリが平均何回使われたか（例: 3.5回）
- **hitRate**: ヒットされたエントリの割合（0.0 - 1.0、例: 0.6 = 60%）

---

### ⚠️ 未実装の機能

**検索結果キャッシュで使用されていない**:

```typescript
// src/lib/lancedb-search-client.ts の現在の実装
const cacheInstance = getSearchCache();

// キャッシュから取得を試行
const cachedResults = cacheInstance.get(cacheKey);

if (cachedResults) {
  return cachedResults;  // ✅ キャッシュから取得（ヒット）
}

// ❌ getStats() が呼び出されていない
// ❌ ログ出力もない
// ❌ 統計情報の収集もない
```

**他のキャッシュでは実装されている例**:
- `AnswerCache`: `getStats()` メソッドが実装されている
- `KeywordCache`: `getStats()` メソッドが実装されている
- ただし、実際にログ出力や統計収集で使用されているかは不明

---

## 💡 実装例

### 1. **定期的なログ出力**

```typescript
// src/lib/lancedb-search-client.ts に追加
const CACHE_STATS_INTERVAL = 5 * 60 * 1000; // 5分ごと

// 定期的に統計をログ出力
setInterval(() => {
  const stats = getSearchCache().getStats();
  console.log(`[Cache Stats] Size: ${stats.size}, AvgHits: ${stats.avgHits.toFixed(2)}, HitRate: ${(stats.hitRate * 100).toFixed(1)}%`);
}, CACHE_STATS_INTERVAL);
```

**出力例**:
```
[Cache Stats] Size: 3420, AvgHits: 3.45, HitRate: 68.5%
```

---

### 2. **APIエンドポイントで統計を返す**

```typescript
// src/app/api/cache-stats/route.ts
export async function GET() {
  const searchCacheStats = getSearchCache().getStats();
  const answerCacheStats = getAnswerCache().getStats();
  
  return Response.json({
    searchCache: {
      size: searchCacheStats.size,
      maxSize: 5000,
      hitRate: (searchCacheStats.hitRate * 100).toFixed(1) + '%',
      avgHits: searchCacheStats.avgHits.toFixed(2)
    },
    answerCache: {
      size: answerCacheStats.size,
      maxSize: 1000,
      hitRate: (answerCacheStats.hitRate * 100).toFixed(1) + '%',
      avgHits: answerCacheStats.avgHits.toFixed(2)
    }
  });
}
```

**レスポンス例**:
```json
{
  "searchCache": {
    "size": 3420,
    "maxSize": 5000,
    "hitRate": "68.5%",
    "avgHits": "3.45"
  },
  "answerCache": {
    "size": 156,
    "maxSize": 1000,
    "hitRate": "45.2%",
    "avgHits": "2.1"
  }
}
```

---

### 3. **モニタリングダッシュボード**

管理画面やダッシュボードでキャッシュ統計を表示:
- リアルタイムのヒット率
- グラフ表示（ヒット率の推移）
- アラート（ヒット率が閾値以下になったら通知）

---

## 📊 期待される効果

### パフォーマンス改善の判断材料

**現在の問題**:
- キャッシュヒット率が不明
- TTLやmaxSizeの設定根拠が経験則のみ
- キャッシュが有効に機能しているか不明

**実装後の効果**:
- キャッシュヒット率が明確になり、設定の根拠がデータに基づく
- ヒット率が低い場合、改善策を検討できる
- 異常検知により、問題の早期発見が可能

---

### 具体的な改善例

**シナリオ1: ヒット率が低い（20%）**
- **原因**: TTLが短すぎる、またはmaxSizeが小さすぎる
- **対策**: TTLを延長（15分 → 30分）、またはmaxSizeを増やす（5000 → 10000）

**シナリオ2: ヒット率が高い（90%）**
- **状況**: キャッシュが非常に有効に機能している
- **判断**: 現在の設定は最適、またはさらに最適化の余地（maxSizeを削減してメモリ節約）

**シナリオ3: 平均ヒット数が異常に高い（100回以上）**
- **原因**: 特定のクエリが大量にリクエストされている
- **対策**: そのクエリを分析し、より長いTTLを設定、またはプリロードを検討

---

## 🔧 実装の優先度

### 優先度: 中（推奨）

**理由**:
- パフォーマンス監視のためには有用だが、システムの動作に必須ではない
- 現在のシステムは正常に動作している
- 将来的な最適化のために実装を推奨

**実装の容易さ**:
- `getStats()` は既に実装されているため、呼び出しとログ出力を追加するだけ
- 追加の依存関係は不要

**推奨される実装順序**:
1. **簡単な実装**: 定期的なログ出力（5分ごと）
2. **APIエンドポイント**: 統計情報を返すAPI
3. **モニタリング**: ダッシュボードやアラート機能

---

## 📝 まとめ

### 現在の状態

- ✅ **実装済み**: `GenericCache.getStats()` メソッド
- ⚠️ **未使用**: 検索結果キャッシュで `getStats()` が呼び出されていない
- ⚠️ **統計なし**: キャッシュヒット率のログ出力も統計収集もない

### 実装後の効果

- 📊 **可視化**: キャッシュの有効性が数値で明確になる
- 🔍 **最適化**: データに基づいた設定の最適化が可能
- 🚨 **異常検知**: 問題の早期発見が可能

### 推奨事項

- 定期的なログ出力（5分ごと）を追加
- APIエンドポイントで統計情報を返す
- 将来的にモニタリングダッシュボードを検討

---

**作成者**: AI Assistant  
**作成日**: 2025年1月27日  
**更新日**: 2025年1月27日

