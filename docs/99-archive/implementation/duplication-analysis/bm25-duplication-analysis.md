# BM25関連処理の重複コード・未使用コード分析

## 📋 分析概要

BM25関連処理（BM25検索実行、スコア計算、正規化）における重複コードと未使用コードを調査しました。

**分析日**: 2024年12月
**対象範囲**: BM25検索実行、BM25スコア計算、BM25スコア正規化

---

## 🔍 調査結果サマリー

### ✅ 重複コードなし
- BM25検索実行関数は2箇所に存在するが、用途が異なる（重複ではない）
- BM25スコア計算・正規化は統一されたユーティリティとして機能
- 未使用コードは確認されませんでした

### 📝 補足
- `executeBM25Search`と`performBM25Search`は異なるコンテキストで使用されるため、実質的な重複ではない
- ただし、将来的な統合の余地あり

---

## 📁 ファイル別分析

### 1. 現在使用中のファイル

#### `src/lib/lancedb-search-client.ts`
**状態**: ✅ 使用中（本番コードの主要なBM25検索実装）

**機能**:
- **`executeBM25Search`関数** (1287-1485行目): BM25検索を実行
  - 各キーワードのスコアを個別に取得し、複数キーワードでマッチした場合にスコアを統合
  - LanceDBレコードの取得とStructuredLabelの補完
  - タイトルマッチングによるブースト処理
  - パフォーマンス最適化（kwCapの調整）

**使用箇所**:
- `searchLanceDB`関数内で並列実行（365行目）
  ```typescript
  const [vectorSearchResult, bm25SearchResult] = await Promise.allSettled([
    executeVectorSearch(...),
    executeBM25Search(tbl, params, finalKeywords, topK)
  ]);
  ```

**特徴**:
- LanceDBとの統合を考慮した実装
- StructuredLabel（Extended Schema）のサポート
- タイトルブースト処理を含む
- 複数キーワードのスコア統合ロジック

---

#### `src/lib/hybrid-search-engine.ts`
**状態**: ✅ 使用中（ハイブリッド検索エンジンのBM25検索実装）

**機能**:
- **`performBM25Search`メソッド** (152-224行目): BM25検索を実行（privateメソッド）
  - Lunrクライアントの状態チェックと初期化
  - `lunrSearchClient.searchWithFilters`を使用した検索
  - URL再構築（Confluence/Jira対応）
  - ラベルフィルタリング対応

**使用箇所**:
- `HybridSearchEngine.search`メソッド内で並列実行（77行目）
  ```typescript
  const [vectorResults, bm25Results] = await Promise.all([
    this.performVectorSearch(...),
    useLunrIndex ? this.performBM25Search(...) : []
  ]);
  ```
- `src/app/api/search/route.ts`で使用（54行目）
  ```typescript
  const hybridResults = await hybridSearchEngine.search({...});
  ```

**特徴**:
- シンプルな実装（Lunr検索結果をそのまま返す）
- URL再構築機能
- Jira/Confluence両対応
- ラベルフィルタリング対応

---

#### `src/lib/score-utils.ts`
**状態**: ✅ 使用中（BM25スコア正規化の統一ユーティリティ）

**機能**:
- **`normalizeBM25Score`関数** (44-47行目): BM25スコアを0-100%の範囲に正規化
  ```typescript
  export function normalizeBM25Score(score: number, maxScore: number = 20): number {
    const normalized = Math.max(0, Math.min(1, score / maxScore));
    return Math.round(normalized * 100);
  }
  ```
- **`calculateHybridSearchScore`関数** (95-109行目): ハイブリッド検索エンジン用のスコア計算（ベクトル + BM25）

**使用箇所**:
- `lancedb-search-client.ts`で使用（76行目、88行目）
  ```typescript
  import { normalizeBM25Score } from './score-utils';
  if (source === 'bm25' || source === 'keyword') {
    return normalizeBM25Score(score);
  }
  ```
- `unified-search-result-processor.ts`で使用（6行目）

**重複**: なし（統一されたユーティリティとして機能）

---

#### `src/lib/composite-scoring-service.ts`
**状態**: ✅ 使用中（複合スコアリングサービスのBM25スコア処理）

**機能**:
- **BM25スコアの抽出** (126行目): 複数のフィールドからBM25スコアを取得
  ```typescript
  const bm25Score = result.keyword || result._bm25Score || result._keywordScore || 0;
  ```
- **複合スコア計算**: BM25スコアを他の信号と組み合わせて計算
- **`maxBm25Score`設定** (60行目): 30.0（高スコア対応）

**使用箇所**:
- `searchLanceDB`関数内で使用（複合スコア計算時）

**重複**: なし（統一されたスコアリングロジック）

---

#### `src/lib/unified-search-result-processor.ts`
**状態**: ✅ 使用中（検索結果処理のBM25スコア処理）

**機能**:
- **BM25スコアの抽出** (354行目): `result._bm25Score ?? result._keywordScore ?? 0`
- **BM25スコアの安全な処理** (372-374行目): NaN、無限大、負の値を考慮
- **スコア計算**: Composite Scoreが利用可能な場合は優先、なければBM25スコアから計算

**使用箇所**:
- `searchLanceDB`関数内で使用（RRF処理時）

**重複**: なし（統一された処理ロジック）

---

## 🔄 重複コードの確認

### BM25検索実行関数の比較

#### `lancedb-search-client.ts`の`executeBM25Search`:
```typescript
async function executeBM25Search(
  tbl: any,
  params: LanceDBSearchParams,
  finalKeywords: string[],
  topK: number
): Promise<any[]>
```

**特徴**:
- 各キーワードのスコアを個別に取得
- 複数キーワードでマッチした場合にスコアを統合
- LanceDBレコードの取得とStructuredLabelの補完
- タイトルマッチングによるブースト処理
- より詳細な結果処理

#### `hybrid-search-engine.ts`の`performBM25Search`:
```typescript
private async performBM25Search(
  query: string,
  limit: number,
  labelFilters: any,
  tableName: string = 'confluence'
): Promise<HybridSearchResult[]>
```

**特徴**:
- Lunr検索結果をそのまま返す（シンプル）
- URL再構築機能
- Jira/Confluence両対応
- ラベルフィルタリング対応

**分析**:
- **用途が異なるため、実質的な重複ではない**
  - `executeBM25Search`: `lancedb-search-client.ts`の`searchLanceDB`内で使用（詳細な結果処理が必要）
  - `performBM25Search`: `HybridSearchEngine`クラス内で使用（シンプルな検索結果が必要）
- **将来的な統合の余地**: 共通部分を抽出してユーティリティ化することは可能

---

### BM25スコア正規化の確認

#### `score-utils.ts`の`normalizeBM25Score`:
```typescript
export function normalizeBM25Score(score: number, maxScore: number = 20): number {
  const normalized = Math.max(0, Math.min(1, score / maxScore));
  return Math.round(normalized * 100);
}
```

#### `composite-scoring-service.ts`の正規化:
```typescript
const normalizedBm25 = Math.min(signals.bm25Score / maxBm25Score, 1.0);
```

**分析**:
- `composite-scoring-service.ts`は0-1の範囲で正規化（0-100%ではない）
- `score-utils.ts`は0-100%の範囲で正規化
- **用途が異なるため、重複ではない**
- ただし、将来的には`normalizeBM25Score`を使用して統一することも検討可能

---

## 📊 使用状況の確認

### `executeBM25Search`の使用箇所
- ✅ `src/lib/lancedb-search-client.ts`内の`searchLanceDB`関数（365行目）
- ✅ 本番コードで使用中

### `performBM25Search`の使用箇所
- ✅ `src/lib/hybrid-search-engine.ts`内の`search`メソッド（77行目）
- ✅ `src/app/api/search/route.ts`で使用（`hybridSearchEngine.search`経由）
- ✅ テストファイルで使用（`data-flow-integration-tests.ts`など）
- ✅ 本番コードで使用中

### `normalizeBM25Score`の使用箇所
- ✅ `src/lib/lancedb-search-client.ts`（76行目、88行目）
- ✅ `src/lib/unified-search-result-processor.ts`（6行目）
- ✅ 本番コードで使用中

---

## 📝 補足情報

### 現在のBM25検索フロー（2つのパス）

#### パス1: `searchLanceDB`経由
```
ユーザークエリ
  ↓
searchLanceDB
  ↓
並列実行（ベクトル検索 + BM25検索）
  ↓
executeBM25Search
  ├─ 各キーワードのスコアを個別に取得
  ├─ スコア統合（複数キーワード対応）
  ├─ LanceDBレコード取得
  ├─ StructuredLabel補完
  └─ タイトルブースト処理
  ↓
結果をベクトル検索結果とマージ
  ↓
RRF処理・複合スコア計算
  ↓
最終結果を返却
```

#### パス2: `HybridSearchEngine`経由
```
ユーザークエリ
  ↓
HybridSearchEngine.search
  ↓
並列実行（ベクトル検索 + BM25検索）
  ↓
performBM25Search
  ├─ Lunr検索実行
  ├─ URL再構築
  └─ ラベルフィルタリング
  ↓
結果をベクトル検索結果と統合・再ランキング
  ↓
最終結果を返却
```

---

## 🎯 推奨アクション

### 1. 現状のまま維持（優先度: 低）
**理由**:
- 2つのBM25検索関数は異なる用途で使用されている
- それぞれ異なる特徴と利点がある
- 統合によるリスクが大きい

**推奨**: 現状のまま維持

### 2. 将来的な統合の検討（優先度: 低）
**機会**: リファクタリング時

**検討事項**:
- 共通部分の抽出（Lunr検索実行部分など）
- 設定による挙動の切り替え（詳細処理 vs シンプル処理）
- 段階的な統合（まず共通ユーティリティの作成）

### 3. コード品質の維持
- ✅ BM25スコア正規化は統一されたユーティリティとして機能
- ✅ BM25スコア抽出ロジックは複数のフィールドを考慮
- ✅ エラーハンドリングが適切に実装されている
- ✅ パフォーマンス最適化が施されている

---

## ✅ 結論

1. **重複コード**: 実質的な重複は確認されませんでした
   - `executeBM25Search`と`performBM25Search`は異なる用途で使用される
   - BM25スコア正規化は統一されたユーティリティとして機能

2. **未使用コード**: 確認されませんでした
   - すべてのBM25関連関数が本番コードで使用中

3. **推奨**: 現状のまま維持
   - 2つのBM25検索関数は異なるコンテキストで使用されるため、現状のまま維持することを推奨
   - 将来的な統合の余地はあるが、優先度は低い

---

## 🔗 関連ドキュメント

- [ベクトル関連処理重複分析](./vector-processing-duplication-analysis.md)
- [タイトル検索重複分析](./title-search-duplication-analysis.md)
- [キーワード抽出重複分析](./keyword-extraction-duplication-analysis.md)
- [RRF処理重複分析](./rrf-duplication-analysis.md)
- [LanceDB取得処理重複分析](./lancedb-duplication-analysis.md)

