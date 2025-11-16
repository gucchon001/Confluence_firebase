# ベクトル関連処理の重複コード・未使用コード分析

## 📋 分析概要

ベクトル関連処理（埋め込み生成、距離計算、類似度計算、正規化）における重複コードと未使用コードを調査しました。

**分析日**: 2024年12月
**対象範囲**: 埋め込み生成、ベクトル距離計算、類似度計算、ベクトル正規化

---

## 🔍 調査結果サマリー

### ✅ 重複コードなし
- 本番コード内での重複は確認されませんでした
- テストファイル内の距離計算関数は、テスト専用のため問題なし

### ⚠️ 未使用コードあり
- アーカイブフォルダ内に未使用の埋め込みサービスが3つ存在
- これらは削除可能

---

## 📁 ファイル別分析

### 1. 現在使用中のファイル

#### `src/lib/embeddings.ts`
**状態**: ✅ 使用中（本番コードの主要な埋め込み生成サービス）

**機能**:
- Gemini Embeddings APIを使用した埋め込み生成
- 簡易メモリキャッシュ（15分TTL、最大1000エントリ）
- BOM除去処理
- タイムアウト処理（60秒）

**使用箇所**: 30ファイル以上で使用
- `src/lib/lancedb-search-client.ts`
- `src/lib/jira-sync-service.ts`
- `src/lib/hybrid-search-engine.ts`
- `src/lib/confluence-sync-service.ts`
- `src/app/api/search/route.ts`
- その他多数

**コメント**: 
```typescript
// embedding-cacheはアーカイブに移動済み。簡易キャッシュ実装を使用
```

---

#### `src/lib/score-utils.ts`
**状態**: ✅ 使用中（スコア計算の共通ユーティリティ）

**機能**:
- `calculateSimilarityPercentage`: ベクトル距離から類似度パーセンテージを計算
- `calculateSimilarityScore`: 距離値から類似度スコアを計算（ユークリッド/コサイン距離対応）
- `normalizeBM25Score`: BM25スコアの正規化
- `calculateHybridScore`: ハイブリッドスコア計算
- `calculateHybridSearchScore`: ハイブリッド検索エンジン用スコア計算

**重複**: なし（統一されたユーティリティとして機能）

---

### 2. アーカイブファイル（未使用）

#### `src/lib/archive/embedding-cache.ts`
**状態**: ❌ 未使用（削除可能）

**機能**:
- `GenericCache`を使用した埋め込みキャッシュ実装
- グローバルキャッシュインスタンス管理
- 2時間TTL、最大500エントリ

**使用状況**: 
- 使用されていない
- `embeddings.ts`のコメントで「アーカイブに移動済み」と明記

**削除推奨**: ✅ はい

---

#### `src/lib/archive/optimized-embeddings.ts`
**状態**: ❌ 未使用（削除可能）

**機能**:
- `OptimizedEmbeddingService`クラス
- 単一テキストの埋め込み生成
- バッチ埋め込み生成
- 実際には`embeddings.ts`の`getEmbeddings`を呼び出すだけのラッパー

**使用状況**: 
- 使用されていない
- `embeddings.ts`を呼び出すだけの薄いラッパーで、追加価値なし

**削除推奨**: ✅ はい

---

#### `src/lib/archive/unified-embedding-service.ts`
**状態**: ⚠️ 部分的に使用（修正が必要）

**機能**:
- `UnifiedEmbeddingService`クラス
- リトライ機能付き埋め込み生成
- バッチ処理
- L2正規化機能（178-180行目）
- エラーハンドリング

**使用状況**: 
- `src/lib/archive/simple-performance-optimizer.ts`で参照（未使用）
- ⚠️ **`src/tests/data-flow-integration-tests.ts`で3箇所参照**（インポートパスが間違っている）
  - 50行目: `await import('../lib/unified-embedding-service')`（実際のパスは`../lib/archive/unified-embedding-service`）
  - 108行目: 同様
  - 292行目: 同様

**問題点**:
- テストファイルのインポートパスが間違っている（`../lib/unified-embedding-service` → `../lib/archive/unified-embedding-service`）
- または、テストファイルを`embeddings.ts`を使用するように修正すべき

**削除推奨**: ⚠️ 修正後に削除可能（テストファイルを`embeddings.ts`に移行するか、インポートパスを修正）

---

#### `src/lib/archive/simple-performance-optimizer.ts`
**状態**: ❌ 未使用（削除可能）

**機能**:
- パフォーマンス最適化サービス
- 並列初期化
- 最適化された検索実行
- `UnifiedEmbeddingService`を使用

**使用状況**: 
- 使用されていない（grepで見つからず）

**削除推奨**: ✅ はい

---

### 3. テストファイル内の距離計算

#### `src/tests/lancedb/step1-distance-calculation-fix-v2.ts`
**状態**: ✅ テスト用（問題なし）

**機能**:
- `calculateCosineDistance`: コサイン距離を手動計算する関数（51-71行目）
- テスト専用の実装

**重複**: 問題なし（テスト専用のため）

---

#### `src/tests/lancedb/step1-distance-calculation-fix.ts`
**状態**: ✅ テスト用（問題なし）

**機能**:
- 距離計算方法の比較テスト
- ユークリッド距離とコサイン距離の比較

**重複**: 問題なし（テスト専用のため）

---

## 🔄 重複コードの確認

### 距離計算・類似度計算
- ✅ **重複なし**: `score-utils.ts`に統一されている
- ✅ **テストファイル内の実装**: テスト専用のため問題なし

### 埋め込み生成
- ✅ **重複なし**: `embeddings.ts`が唯一の本番実装
- ⚠️ **アーカイブファイル**: 未使用のラッパーが存在（削除可能）

### ベクトル正規化
- ⚠️ **`unified-embedding-service.ts`内にL2正規化実装あり**: しかし、このファイル自体が未使用
- ✅ **本番コード内での重複**: なし

---

## 📊 削除推奨ファイル一覧

| ファイル | 理由 | 削除推奨 |
|---------|------|---------|
| `src/lib/archive/embedding-cache.ts` | 使用されていない、`embeddings.ts`で簡易キャッシュを使用 | ✅ |
| `src/lib/archive/optimized-embeddings.ts` | 使用されていない、`embeddings.ts`の薄いラッパー | ✅ |
| `src/lib/archive/unified-embedding-service.ts` | テストファイルで参照（インポートパス修正が必要）、修正後に削除可能 | ⚠️ |
| `src/lib/archive/simple-performance-optimizer.ts` | 使用されていない | ✅ |

---

## 🎯 推奨アクション

### 1. テストファイルの修正（優先度: 高）
**問題**: `src/tests/data-flow-integration-tests.ts`が`UnifiedEmbeddingService`を参照しているが、インポートパスが間違っている

**対応方法（2つの選択肢）**:

#### オプションA: インポートパスを修正
```typescript
// 修正前
const { UnifiedEmbeddingService } = await import('../lib/unified-embedding-service');

// 修正後
const { UnifiedEmbeddingService } = await import('../lib/archive/unified-embedding-service');
```

#### オプションB: `embeddings.ts`を使用するように変更（推奨）
```typescript
// 修正前
const { UnifiedEmbeddingService } = await import('../lib/unified-embedding-service');
const embeddingService = UnifiedEmbeddingService.getInstance();
const embeddingResult = await embeddingService.generateSingleEmbedding(testText);
const embedding = embeddingResult.embedding;

// 修正後
import { getEmbeddings } from '../lib/embeddings';
const embedding = await getEmbeddings(testText);
```

**推奨**: オプションB（`embeddings.ts`を使用）を推奨。理由：
- `embeddings.ts`が本番コードで使用されている標準実装
- `UnifiedEmbeddingService`はアーカイブ済みで、将来的に削除予定

### 2. アーカイブファイルの削除
テストファイル修正後、以下の4ファイルを削除可能：
1. `src/lib/archive/embedding-cache.ts` ✅ 削除可能
2. `src/lib/archive/optimized-embeddings.ts` ✅ 削除可能
3. `src/lib/archive/unified-embedding-service.ts` ⚠️ テストファイル修正後に削除可能
4. `src/lib/archive/simple-performance-optimizer.ts` ✅ 削除可能

**注意事項**:
- テストファイル修正後に削除すること
- 削除前に、テストが正常に動作することを確認

### 3. コード品質の維持
- ✅ `embeddings.ts`の簡易キャッシュ実装は適切
- ✅ `score-utils.ts`の統一されたスコア計算は良好
- ✅ テストファイル内の実装は問題なし

---

## 📝 補足情報

### 現在の埋め込み生成フロー
```
ユーザーリクエスト
  ↓
getEmbeddings(text) [embeddings.ts]
  ↓
簡易キャッシュチェック（15分TTL）
  ↓
BOM除去処理
  ↓
Gemini Embeddings API呼び出し
  ↓
結果をキャッシュに保存
  ↓
埋め込みベクトルを返却
```

### 現在のスコア計算フロー
```
検索結果
  ↓
score-utils.ts の関数群
  ├─ calculateSimilarityPercentage (距離 → 類似度%)
  ├─ calculateSimilarityScore (距離 → スコア%)
  ├─ normalizeBM25Score (BM25正規化)
  ├─ calculateHybridScore (ハイブリッドスコア)
  └─ calculateHybridSearchScore (検索エンジン用)
  ↓
最終スコア
```

---

## ✅ 結論

1. **重複コード**: 本番コード内での重複は確認されませんでした
2. **未使用コード**: アーカイブフォルダ内に4つの未使用ファイルが存在
3. **推奨**: アーカイブファイルを削除してコードベースをクリーンに保つ

---

## 🔗 関連ドキュメント

- [キーワード抽出重複分析](./keyword-extraction-duplication-analysis.md)
- [RRF処理重複分析](./rrf-duplication-analysis.md)
- [LanceDB取得処理重複分析](./lancedb-duplication-analysis.md)

