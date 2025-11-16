# RRF処理の重複分析

**作成日**: 2025年1月  
**目的**: RRF（Reciprocal Rank Fusion）処理で重複コードを特定し、統合の可能性を検討

## 発見された重複・類似処理

### ⚠️ RRF処理の重複実装

#### 1. `lancedb-search-client.ts` - インライン実装

**場所**: `src/lib/lancedb-search-client.ts` (768-849行目)

**実装内容**:
- RRF融合処理を直接実装
- `kRrf = 60` (ハードコード)
- 順位計算ロジック:
  ```typescript
  const byVector = [...resultsWithHybridScore].sort((a, b) => (a._distance ?? 1) - (b._distance ?? 1));
  const byKeyword = [...resultsWithHybridScore].sort((a, b) => (b._keywordScore ?? 0) - (a._keywordScore ?? 0));
  const byTitleExact = resultsWithHybridScore.filter(r => r._sourceType === 'title-exact');
  const byBm25 = resultsWithHybridScore.filter(r => r._sourceType === 'bm25');
  
  const vecRank = new Map<string, number>();
  const kwRank = new Map<string, number>();
  const titleRank = new Map<string, number>();
  const bm25Rank = new Map<string, number>();
  byVector.forEach((r, idx) => vecRank.set(r.id, idx + 1));
  byKeyword.forEach((r, idx) => kwRank.set(r.id, idx + 1));
  byTitleExact.forEach((r, idx) => titleRank.set(r.id, idx + 1));
  byBm25.forEach((r, idx) => bm25Rank.set(r.id, idx + 1));
  ```
- RRFスコア計算:
  ```typescript
  let rrf = (1.0 / (kRrf + vr)) + 0.8 * (1 / (kRrf + kr)) + 
            (tr ? 1.2 * (1 / (kRrf + tr)) : 0) + 
            (br ? 0.6 * (1 / (kRrf + br)) : 0);
  ```
- ドメイン減衰・ブースト処理を直接実装
- タグマッチングボーナス処理も含む

**特徴**:
- 最も完全な実装（タグマッチングボーナスを含む）
- 直接使用されている（`searchLanceDB`関数内）

---

#### 2. `unified-search-result-processor.ts` - メソッド実装

**場所**: `src/lib/unified-search-result-processor.ts` (223-304行目)

**実装内容**:
- `applyRRFFusion()` メソッドとして実装
- `kRrf = options.rrfK` (設定可能、デフォルト60)
- 順位計算ロジック（`lancedb-search-client.ts`と同一）:
  ```typescript
  const byVector = [...results].sort((a, b) => (a._distance ?? 1) - (b._distance ?? 1));
  const byKeyword = [...results].sort((a, b) => (b._keywordScore ?? 0) - (a._keywordScore ?? 0));
  const byTitleExact = results.filter(r => r._sourceType === 'title-exact');
  const byBm25 = results.filter(r => r._sourceType === 'bm25');
  
  const vecRank = new Map<string, number>();
  const kwRank = new Map<string, number>();
  const titleRank = new Map<string, number>();
  const bm25Rank = new Map<string, number>();
  
  byVector.forEach((r, idx) => vecRank.set(r.id, idx + 1));
  byKeyword.forEach((r, idx) => kwRank.set(r.id, idx + 1));
  byTitleExact.forEach((r, idx) => titleRank.set(r.id, idx + 1));
  byBm25.forEach((r, idx) => bm25Rank.set(r.id, idx + 1));
  ```
- RRFスコア計算（`lancedb-search-client.ts`と同一）:
  ```typescript
  let rrf = (1.0 / (kRrf + vr)) + 0.8 * (1 / (kRrf + kr)) + 
            (tr ? 1.2 * (1 / (kRrf + tr)) : 0) + 
            (br ? 0.6 * (1 / (kRrf + br)) : 0);
  ```
- ドメイン減衰処理は `applyDomainPenalty()` メソッドを使用（簡易版）
- タグマッチングボーナスは含まれていない

**特徴**:
- 再利用可能なメソッド形式
- ドメイン減衰処理が分離されている
- タグマッチングボーナスが未実装

---

## 重複コードの詳細比較

### 共通部分（完全に重複）

1. **順位計算ロジック**: 完全に同一
   - `byVector`, `byKeyword`, `byTitleExact`, `byBm25` の計算
   - `vecRank`, `kwRank`, `titleRank`, `bm25Rank` のマップ作成

2. **RRFスコア計算式**: 完全に同一
   - 同じ重み（vector=1.0, keyword=0.8, title-exact=1.2, bm25=0.6）
   - 同じ計算式

3. **ドメイン減衰処理**: 実質的に同一（実装方法が異なる）
   - `hasPenalty`: 議事録などの減衰（×0.9）
   - `isGenericDoc`: 汎用文書の減衰（×0.5）
   - `本システム外`: タイトルに含まれる場合の減衰（×0.8）
   - ドメイン固有キーワードのブースト（×1.0～×2.0）

### 違い

1. **タグマッチングボーナス**: 
   - `lancedb-search-client.ts`: 実装済み（×2.0～×3.0）
   - `unified-search-result-processor.ts`: 未実装

2. **実装方法**:
   - `lancedb-search-client.ts`: インライン実装（直接使用）
   - `unified-search-result-processor.ts`: メソッド形式（再利用可能）

3. **パラメータ**:
   - `lancedb-search-client.ts`: `kRrf = 60` (ハードコード)
   - `unified-search-result-processor.ts`: `options.rrfK` (設定可能、デフォルト60)

---

## 問題点

### 1. コード重複

- **順位計算ロジック**: 完全に重複（約20行）
- **RRFスコア計算式**: 完全に重複（約1行）
- **ドメイン減衰処理**: 実質的に重複（約30行）

**合計**: 約50行の重複コード

### 2. 保守性の問題

- RRF計算式を変更する場合、2箇所を修正する必要がある
- 重みパラメータを変更する場合、2箇所を修正する必要がある
- ドメイン減衰ロジックを変更する場合、2箇所を修正する必要がある

### 3. 機能の不一致

- `lancedb-search-client.ts` にはタグマッチングボーナスがあるが、`unified-search-result-processor.ts` にはない
- ドメイン減衰処理の実装方法が異なる（インライン vs メソッド分離）

---

## 推奨される統合方針

### 方針1: `unified-search-result-processor.ts` を拡張して使用

**推奨度**: ⭐⭐⭐⭐⭐ (最高)

**理由**:
- `unified-search-result-processor.ts` は再利用可能な形式
- メソッド分離により保守性が高い
- 既存の `applyDomainPenalty` メソッドを活用可能

**手順**:
1. `unified-search-result-processor.ts` の `applyRRFFusion` メソッドを拡張:
   - タグマッチングボーナス処理を追加
   - `applyDomainPenalty` メソッドを拡張（タグマッチング対応）
2. `lancedb-search-client.ts` の重複コードを削除:
   - RRF処理部分を `unifiedSearchResultProcessor.applyRRFFusion()` の呼び出しに置き換え
3. パラメータの統一:
   - `kRrf` を設定可能にする（デフォルト60）

**メリット**:
- コード重複の削減（約50行）
- 保守性の向上（1箇所で修正可能）
- 機能の統一（タグマッチングボーナスが全体に適用）
- テストの容易さ（メソッド単位でテスト可能）

**デメリット**:
- `lancedb-search-client.ts` の修正が必要
- パラメータの受け渡しを調整する必要がある

---

### 方針2: `lancedb-search-client.ts` の実装を `unified-search-result-processor.ts` に移動

**推奨度**: ⭐⭐⭐ (中)

**理由**:
- `lancedb-search-client.ts` の実装が最も完全（タグマッチングボーナスを含む）
- ただし、インライン実装のため再利用性が低い

**手順**:
1. `lancedb-search-client.ts` のRRF処理を `unified-search-result-processor.ts` に移動
2. タグマッチングボーナス処理も含めて移動
3. `applyRRFFusion` メソッドを拡張
4. `lancedb-search-client.ts` で `unifiedSearchResultProcessor.applyRRFFusion()` を呼び出し

**メリット**:
- 最も完全な実装を活用
- 機能の統一

**デメリット**:
- `unified-search-result-processor.ts` が複雑になる
- パラメータの受け渡しが複雑になる可能性

---

## 使用状況の確認

### `lancedb-search-client.ts`
- **使用箇所**: `searchLanceDB` 関数内で直接使用
- **状態**: アクティブに使用中

### `unified-search-result-processor.ts`
- **使用箇所**: 要確認
- **状態**: 実装はされているが、実際に使用されているか不明

**確認が必要**:
- `unified-search-result-processor.ts` が実際に使用されているか
- 使用されている場合、どのファイルで使用されているか

---

## 実施手順（方針1を推奨）

### Step 1: `unified-search-result-processor.ts` の拡張

```typescript
// 1. applyRRFFusion メソッドを拡張
// - タグマッチングボーナス処理を追加
// - パラメータに tags と keywords を追加

// 2. applyDomainPenalty メソッドを拡張
// - タグマッチングボーナス処理を追加
// - パラメータに tags と keywords を追加
```

### Step 2: `lancedb-search-client.ts` の修正

```typescript
// 1. unified-search-result-processor.ts からインポート
import { unifiedSearchResultProcessor } from './unified-search-result-processor';

// 2. 重複コードを削除
// - RRF処理部分（768-849行目）を削除
// - unifiedSearchResultProcessor.applyRRFFusion() の呼び出しに置き換え
```

### Step 3: テスト実行

```bash
# 型チェック・ビルド確認
npm run typecheck
npm run build

# テスト実行
npm test
```

---

## まとめ

### 発見された重複

1. **✅ RRF処理の重複**: `lancedb-search-client.ts` と `unified-search-result-processor.ts`
   - 順位計算ロジック: 完全に重複（約20行）
   - RRFスコア計算式: 完全に重複（約1行）
   - ドメイン減衰処理: 実質的に重複（約30行）
   - **合計**: 約50行の重複コード

### 推奨アクション

1. **優先度: 高**: RRF処理の統合
   - `unified-search-result-processor.ts` を拡張して使用（方針1）
   - `lancedb-search-client.ts` の重複コードを削除
   - タグマッチングボーナス処理を統一

### 期待される効果

- **コード重複削減**: 約50行の削減
- **保守性向上**: 1箇所で修正可能
- **機能の統一**: タグマッチングボーナスが全体に適用
- **テスト容易性**: メソッド単位でテスト可能

