# キーワード抽出モジュールの使用状況分析

## 概要

キーワード抽出と周辺コンテンツの抽出が同一モジュールを利用しているかを確認します。

## 調査結果

### 1. 検索時のキーワード抽出（BM25検索）

**ファイル**: `src/lib/lancedb-search-client.ts` (249-259行目)

**使用モジュール**: `unifiedKeywordExtractionService`

**使用メソッド**: `extractKeywordsConfigured()`

**処理フロー**:
```typescript
const keywordsPromise = (async () => {
  const cleanQueryForKeywords = cleanQuery;
  const kw = await unifiedKeywordExtractionService.extractKeywordsConfigured(cleanQueryForKeywords);
  return kw;
})();
```

**内部処理**:
```typescript
async extractKeywordsConfigured(query: string): Promise<string[]> {
  // Step 1: 動的キーワード抽出
  const result = await this.extractDynamicKeywords(query);
  
  // Step 2: 動的フィルタリング
  const filteredKeywords = this.applyDynamicFiltering([...], queryAnalysis);
  
  // Step 3: 動的優先度付け
  const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);
  
  // Step 4: 最終的なキーワード選択（8個に制限）
  const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 8);
  
  return finalKeywords;
}
```

**特徴**:
- ✅ 非同期処理（`async/await`）
- ✅ 動的キーワード抽出（`extractDynamicKeywords`を呼び出す）
- ✅ 優先度付けとフィルタリングが適用される
- ✅ 最大8個のキーワードに制限される
- ✅ 重複除去が適用される

**出力例**:
```
["会員情報", "職業", "会員", "更新", "学年"]
（最大8個、優先度付けとフィルタリングが適用される）
```

### 2. コンテンツ抽出時のキーワード抽出

**ファイル**: `src/ai/flows/content-extraction-utils.ts` (13-55行目)

**使用モジュール**: `unifiedKeywordExtractionService`

**使用メソッド**: `extractKeywordsSync()`

**処理フロー**:
```typescript
function extractKeywords(query: string): string[] {
  try {
    if (typeof unifiedKeywordExtractionService.extractKeywordsSync === 'function') {
      return unifiedKeywordExtractionService.extractKeywordsSync(query);
    }
  } catch (error) {
    // フォールバック: 簡易版のキーワード抽出
    // ...
  }
}
```

**内部処理**:
```typescript
extractKeywordsSync(query: string): string[] {
  if (!this.keywordCategories) {
    return [];
  }
  
  // Step 1: カテゴリ別のキーワード抽出
  const extracted = this.extractKeywordsFromCategories(query);
  
  // Step 2: 重複除去のみ
  return [...new Set(extracted.allKeywords)];
}
```

**特徴**:
- ✅ 同期処理（`sync`）
- ✅ カテゴリ別のキーワード抽出（`extractKeywordsFromCategories`を呼び出す）
- ❌ 優先度付けやフィルタリングは適用されない
- ❌ キーワード数制限は適用されない
- ✅ 重複除去が適用される

**出力例**:
```
["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]
（すべてのキーワード、優先度付けやフィルタリングは適用されない）
```

## 比較

### 使用メソッドの比較

| 項目 | 検索時（BM25検索） | コンテンツ抽出時 |
|------|------------------|----------------|
| **モジュール** | `unifiedKeywordExtractionService` | `unifiedKeywordExtractionService` |
| **メソッド** | `extractKeywordsConfigured()` | `extractKeywordsSync()` |
| **処理** | 非同期（`async/await`） | 同期（`sync`） |
| **内部処理** | `extractDynamicKeywords()` | `extractKeywordsFromCategories()` |
| **優先度付け** | ✅ あり（動的優先度付け） | ❌ なし |
| **フィルタリング** | ✅ あり（動的フィルタリング） | ❌ なし |
| **キーワード数制限** | ✅ あり（最大8個） | ❌ なし（すべてのキーワード） |
| **重複除去** | ✅ あり | ✅ あり |

### 処理フローの比較

#### 検索時（BM25検索）

```typescript
// ステップ1: 動的キーワード抽出
const result = await this.extractDynamicKeywords(query);

// ステップ2: 動的フィルタリング
const filteredKeywords = this.applyDynamicFiltering([...], queryAnalysis);

// ステップ3: 動的優先度付け
const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);

// ステップ4: 最終的なキーワード選択（8個に制限）
const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 8);

// ステップ5: 重複除去
return [...new Set(finalKeywords)];
```

**出力例**:
```
["会員情報", "職業", "会員", "更新", "学年"]
（最大8個、優先度付けとフィルタリングが適用される）
```

#### コンテンツ抽出時

```typescript
// ステップ1: カテゴリ別のキーワード抽出
const extracted = this.extractKeywordsFromCategories(query);

// ステップ2: 重複除去のみ
return [...new Set(extracted.allKeywords)];
```

**出力例**:
```
["会員", "更新", "会員情報", "学年", "情報", "現在の職業", "職業", "自動"]
（すべてのキーワード、優先度付けやフィルタリングは適用されない）
```

## 問題点

### 問題1: 異なるメソッドを使用している ⚠️

**問題**:
- 検索時: `extractKeywordsConfigured()` (非同期、動的キーワード抽出)
- コンテンツ抽出時: `extractKeywordsSync()` (同期、カテゴリ別抽出)

**影響**:
- 異なるキーワードが抽出される可能性
- 一貫性の欠如
- 検索時とコンテンツ抽出時でキーワードが異なる

### 問題2: 優先度付けとフィルタリングが適用されていない ⚠️

**問題**:
- コンテンツ抽出時は優先度付けやフィルタリングが適用されない
- すべてのキーワードが抽出される

**影響**:
- 重要度の低いキーワードも抽出される
- キーワード数が多くなる可能性
- コンテンツ抽出の精度が低下する可能性

### 問題3: キーワード数制限が適用されていない ⚠️

**問題**:
- コンテンツ抽出時はキーワード数制限が適用されない
- すべてのキーワードが抽出される

**影響**:
- キーワード数が多くなる可能性
- コンテンツ抽出のパフォーマンスが低下する可能性

## 改善案

### 案1: 同一メソッドを使用する（推奨）

**説明**:
- 検索時とコンテンツ抽出時で同じメソッドを使用
- ただし、同期処理が必要な場合は同期版を使用

**実装**:
```typescript
// コンテンツ抽出時
function extractKeywords(query: string): string[] {
  try {
    // 同期版の動的キーワード抽出を使用
    if (typeof unifiedKeywordExtractionService.extractKeywordsSync === 'function') {
      // 動的キーワード抽出の同期版を実装
      return unifiedKeywordExtractionService.extractKeywordsSync(query);
    }
  } catch (error) {
    // フォールバック
  }
}
```

**メリット**:
- ✅ 一貫性の確保
- ✅ 同じキーワードが抽出される
- ✅ 優先度付けとフィルタリングが適用される

**デメリット**:
- ⚠️ 同期版の動的キーワード抽出を実装する必要がある
- ⚠️ パフォーマンスへの影響

### 案2: 優先度付けとフィルタリングを適用する

**説明**:
- コンテンツ抽出時にも優先度付けとフィルタリングを適用
- キーワード数制限を適用

**実装**:
```typescript
extractKeywordsSync(query: string): string[] {
  if (!this.keywordCategories) {
    return [];
  }
  
  const extracted = this.extractKeywordsFromCategories(query);
  
  // 優先度付けとフィルタリングを適用（簡易版）
  const prioritizedKeywords = this.applySimplePrioritization(extracted.allKeywords);
  
  // キーワード数制限（最大8個）
  const finalKeywords = prioritizedKeywords.slice(0, 8);
  
  return [...new Set(finalKeywords)];
}
```

**メリット**:
- ✅ 優先度付けとフィルタリングが適用される
- ✅ キーワード数制限が適用される
- ✅ 検索時と同様の処理

**デメリット**:
- ⚠️ 簡易版の優先度付けを実装する必要がある

### 案3: 現在の実装を維持する

**説明**:
- 検索時とコンテンツ抽出時で異なるメソッドを使用
- それぞれの用途に適したメソッドを使用

**メリット**:
- ✅ それぞれの用途に最適化
- ✅ 実装が簡単

**デメリット**:
- ❌ 一貫性の欠如
- ❌ 異なるキーワードが抽出される可能性

## 推奨される改善

### 推奨案: 案1（同一メソッドを使用する）

**理由**:
1. **一貫性の確保**: 検索時とコンテンツ抽出時で同じキーワードが抽出される
2. **優先度付けとフィルタリング**: 重要度の高いキーワードが優先される
3. **キーワード数制限**: パフォーマンスの向上

**実装**:
```typescript
// コンテンツ抽出時
function extractKeywords(query: string): string[] {
  try {
    // 同期版の動的キーワード抽出を使用
    // 検索時と同じ処理を同期版で実装
    if (typeof unifiedKeywordExtractionService.extractKeywordsSync === 'function') {
      return unifiedKeywordExtractionService.extractKeywordsSync(query);
    }
  } catch (error) {
    // フォールバック
  }
}
```

**改善内容**:
1. `extractKeywordsSync()`に優先度付けとフィルタリングを追加
2. キーワード数制限を適用（最大8個）
3. 検索時と同じ処理を同期版で実装

## まとめ

### 現在の実装

- **モジュール**: 同一モジュール（`unifiedKeywordExtractionService`）を使用 ✅
- **メソッド**: 異なるメソッドを使用 ⚠️
  - 検索時: `extractKeywordsConfigured()` (非同期、動的キーワード抽出)
  - コンテンツ抽出時: `extractKeywordsSync()` (同期、カテゴリ別抽出)

### 問題点

1. ⚠️ 異なるメソッドを使用している
2. ⚠️ 優先度付けとフィルタリングが適用されていない
3. ⚠️ キーワード数制限が適用されていない

### 改善案

1. ✅ **同一メソッドを使用する**（推奨）
2. ⚠️ 優先度付けとフィルタリングを適用する
3. ❌ 現在の実装を維持する

## 参考資料

- `src/lib/unified-keyword-extraction-service.ts`: 統一キーワード抽出サービス
- `src/lib/lancedb-search-client.ts`: LanceDB検索クライアント
- `src/ai/flows/content-extraction-utils.ts`: コンテンツ抽出ユーティリティ
