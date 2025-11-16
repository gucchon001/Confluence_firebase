# 負の距離の根本原因分析

**調査日**: 2025年11月5日  
**影響度**: 高（スコア: undefined の原因）  
**状態**: 原因特定完了

---

## 📋 問題の概要

本番環境で「スコア: undefined」が発生しており、ログに「距離: -0.0437」などの負の距離が記録されている。

---

## 🔍 根本原因

### 1. BM25スコアから距離への変換で負の値が発生

**問題箇所**: `src/lib/lancedb-search-client.ts` 696行目

```typescript
_distance: 1 - (row._bm25Score / 20),
```

**問題点**:
- BM25スコアが20を超える場合、この計算で負の値が発生する
- 例：`BM25スコア = 24.255` → `1 - (24.255/20) = -0.21275` ❌

### 2. 実際のデータで確認された負の距離

調査スクリプト（`scripts/debug-negative-distance-cause.ts`）の実行結果：

#### クエリ: "教室削除"
- **負の距離が検出された結果**:
  - タイトル: "501_【FIX】教室一覧閲覧機能"
  - 距離: **-0.21275**
  - BM25スコア: **24.255**
  - ソースタイプ: `bm25`

#### クエリ: "求人詳細"
- **負の距離が検出された結果**:
  - タイトル: "【FIX】求人登録・公開・削除フロー"
  - 距離: **-0.10125**
  - BM25スコア: **22.025**
  - ソースタイプ: `bm25`

### 3. BM25スコアの実際の値域

調査結果から、BM25スコアは実際に20を超える値が存在することが確認された：

| タイトル | BM25スコア | 距離 | ソースタイプ |
|---------|-----------|------|------------|
| 501_【FIX】教室一覧閲覧機能 | 24.255 | **-0.21275** | bm25 |
| 【FIX】求人登録・公開・削除フロー | 22.025 | **-0.10125** | bm25 |
| 517_【FIX】求人プレビュー 機能 | 36.801 | 0.2 | hybrid |
| 505_【FIX】教室削除 機能 | 36.801 | 0.2 | hybrid |

**注意**: `hybrid`ソースタイプの場合は、ベクトル検索の距離が優先されているため、負の値は発生していない。

---

## 📊 負の距離がスコア計算に与える影響

### 現在のスコア計算ロジック

`src/lib/unified-search-result-processor.ts` の `formatResults` メソッド：

```typescript
const distance = result._distance ?? 1;
const safeDistance = (typeof distance === 'number' && !isNaN(distance) && isFinite(distance))
  ? Math.max(0, distance) // 負の値を0にクランプ
  : 1.0;
```

**問題点**:
- 負の距離は`Math.max(0, distance)`で0にクランプされる
- しかし、`calculateSimilarityPercentage`関数では：
  ```typescript
  const similarity = 1 - Math.min(1, safeDistance);
  ```
  - `safeDistance = 0`の場合、`similarity = 1 - 0 = 1.0`（100%）
  - これは、負の距離があった場合に、実際には非常に類似度が高い結果を誤って100%と評価してしまう

**さらに問題なのは**:
- 負の距離が`_distance`フィールドに保存され、後続の処理で使用される
- `CompositeScore`の計算では、`vectorDistance`として負の値が使用される可能性がある

---

## ✅ 修正方法

### オプション1: BM25スコアの正規化を改善（推奨）

**修正箇所**: `src/lib/lancedb-search-client.ts` 696行目

```typescript
// Before（問題あり）
_distance: 1 - (row._bm25Score / 20),

// After（修正版）
_distance: Math.max(0, 1 - (row._bm25Score / 30)), // 30を上限として使用（composite-scoring-service.tsのmaxBm25Scoreと一致）
```

**理由**:
- `composite-scoring-service.ts`の59行目で`maxBm25Score: 30.0`が設定されている
- これと一致させることで、距離が0未満になることを防ぐ

### オプション2: 距離の計算方法を変更

BM25スコアから距離への変換を、より適切な方法に変更：

```typescript
// BM25スコアを距離に変換（0-1の範囲）
const normalizedBm25 = Math.min(1, row._bm25Score / 30); // 30を最大値として使用
_distance: 1 - normalizedBm25; // 距離は0-1の範囲
```

### オプション3: 負の距離を検出して警告ログを出力

負の距離が発生した場合に警告ログを出力し、デフォルト値を設定：

```typescript
let calculatedDistance = 1 - (row._bm25Score / 20);
if (calculatedDistance < 0) {
  console.warn(`[BM25 Distance] Negative distance detected: ${calculatedDistance} for BM25 score: ${row._bm25Score}`);
  calculatedDistance = 0; // 負の値を0にクランプ
}
_distance: calculatedDistance,
```

---

## 🎯 推奨される修正

**オプション1を推奨**：
- `composite-scoring-service.ts`の`maxBm25Score: 30.0`と一致させる
- 距離が0未満になることを確実に防ぐ
- 既存のロジックへの影響が最小限

---

## 📝 修正後の検証

修正後、以下のテストを実行して確認：

1. **負の距離の発生確認**:
   ```bash
   npm run tsx scripts/debug-negative-distance-cause.ts
   ```
   - 負の距離が0件になることを確認

2. **スコア計算の確認**:
   - BM25スコアが20を超える結果でも、スコアが正しく計算されることを確認
   - `score: undefined`が発生しないことを確認

3. **本番環境での検証**:
   - 実際の検索クエリで「スコア: undefined」が発生しないことを確認

---

## 🔗 関連ファイル

- `src/lib/lancedb-search-client.ts` (696行目): BM25スコアから距離への変換
- `src/lib/composite-scoring-service.ts` (59行目): `maxBm25Score: 30.0`の設定
- `src/lib/unified-search-result-processor.ts`: スコア計算と距離の処理
- `src/lib/score-utils.ts`: 類似度計算関数

---

## 📚 参考情報

- BM25スコアの正規化: `composite-scoring-service.ts`では`maxBm25Score: 30.0`が使用されている
- 距離の処理: `calculateSimilarityPercentage`関数では負の値を0にクランプしているが、これは適切ではない

