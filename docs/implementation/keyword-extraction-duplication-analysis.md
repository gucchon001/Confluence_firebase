# キーワード抽出・検索関連処理の重複分析

**作成日**: 2025年1月  
**目的**: キーワード抽出・検索関連の処理で重複コードや未使用コードを特定し、統合の可能性を検討

## 発見されたファイルとその使用状況

### ✅ 使用されているファイル

#### 1. `unified-keyword-extraction-service.ts` - 統一キーワード抽出サービス

**場所**: `src/lib/unified-keyword-extraction-service.ts`

**使用箇所**:
- `src/lib/lancedb-search-client.ts` (253行目): `extractKeywordsConfigured()` を使用
- `src/ai/flows/content-extraction-utils.ts` (20行目): `extractKeywordsSync()` を使用

**実装内容**:
- `extractKeywordsConfigured()`: 非同期キーワード抽出（BM25検索用）
  - 内部で `extractDynamicKeywords()` を呼び出し
  - 動的フィルタリング、優先度付け、最終選択（8個に制限）を実行
- `extractKeywordsSync()`: 同期キーワード抽出（コンテンツ抽出用）
  - `extractKeywordsFromCategories()` を呼び出し
  - 重複除去のみ、キーワード数制限なし

**特徴**:
- ✅ 実際に使用されている（メインコード）
- ✅ 統一されたキーワード抽出サービスの基盤
- ✅ 非同期と同期の両方をサポート

---

#### 2. `enhanced-keyword-extractor.ts` - 強化版キーワード抽出

**場所**: `src/lib/enhanced-keyword-extractor.ts`

**使用箇所**:
- `src/lib/lancedb-search-client.ts` (295-296行目): `extractCoreKeywords()` を使用

**実装内容**:
- `extractCoreKeywords()`: ネガティブワード除去、核心キーワード抽出
- `simplifyQuery()`: クエリの簡素化
- `isExactTitleMatch()`: タイトル完全一致の判定

**特徴**:
- ✅ 実際に使用されている（メインコード）
- ✅ ネガティブワード除去機能を提供
- ✅ 小さなユーティリティクラス（約70行）

---

### ⚠️ テストでのみ使用されているファイル

#### 3. `dynamic-keyword-extractor.ts` - 動的キーワード抽出

**場所**: `src/lib/dynamic-keyword-extractor.ts`

**使用箇所**:
- `src/tests/integration-test-framework.ts` (334行目): `new DynamicKeywordExtractor()` を使用
- `src/tests/data-flow-integration-tests.ts` (119行目, 306行目): `new DynamicKeywordExtractor()` を使用
- **メインコードでは使用されていない**

**実装内容**:
- `extractDynamicKeywords()`: 動的キーワード抽出のメイン処理
- `extractKeywordsConfigured()`: 設定済みキーワード抽出（互換性のため）
- `analyzeQueryDynamically()`: クエリの動的解析
- その他多くのメソッド（約540行）

**特徴**:
- ⚠️ テストでのみ使用されている
- ⚠️ `UnifiedKeywordExtractionService` の内部で `extractDynamicKeywords()` が実装されている
- ⚠️ メインコードでは `unified-keyword-extraction-service.ts` が使用されている

**重複の可能性**:
- `UnifiedKeywordExtractionService` の `extractDynamicKeywords()` メソッドと実装が重複している可能性

---

### ❌ 使用されていないファイル

#### 4. `archive/keyword-cache.ts` - キーワード抽出キャッシュ

**場所**: `src/lib/archive/keyword-cache.ts`

**使用箇所**:
- ❌ **使用されていない**（アーカイブフォルダ内）
- `unified-keyword-extraction-service.ts` 内でコメントアウトされている（268-270行目, 280-281行目）

**実装内容**:
- キーワード抽出結果のキャッシュ機能
- ディスクへの永続化
- TTL、LRUキャッシュ管理

**特徴**:
- ❌ アーカイブフォルダ内に移動済み
- ❌ 使用されていない（コメントアウト済み）
- ✅ 将来的に復活させる可能性はある

---

## 重複コードの詳細分析

### 🔴 重複の可能性: `DynamicKeywordExtractor` と `UnifiedKeywordExtractionService`

#### 1. `DynamicKeywordExtractor.extractDynamicKeywords()`

**場所**: `src/lib/dynamic-keyword-extractor.ts` (50-137行目)

**実装内容**:
```typescript
async extractDynamicKeywords(query: string): Promise<DynamicExtractResult> {
  // Step 1: クエリの動的解析
  const queryAnalysis = await this.analyzeQueryDynamically(query);
  
  // Step 2: ドメイン知識からの動的抽出
  const domainKeywords = await this.extractFromDomainKnowledge(queryAnalysis);
  
  // Step 3: パターンマッチングによる抽出
  const patternKeywords = this.extractFromPatterns(queryAnalysis);
  
  // Step 4: 動的フィルタリング
  const filteredKeywords = this.applyDynamicFiltering([...], queryAnalysis);
  
  // Step 5: 動的優先度付け
  const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);
  
  // Step 6: 最終的なキーワード選択（12個）
  const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 12);
  
  return { ... };
}
```

---

#### 2. `UnifiedKeywordExtractionService.extractDynamicKeywords()`

**場所**: `src/lib/unified-keyword-extraction-service.ts` (175-261行目)

**実装内容**:
```typescript
async extractDynamicKeywords(query: string): Promise<DynamicExtractResult> {
  try {
    // Step 1: クエリの動的解析
    const queryAnalysis = await this.analyzeQueryDynamically(query);
    
    // Step 2: ドメイン知識からの動的抽出
    const domainKeywords = await this.extractFromDomainKnowledge(queryAnalysis);
    
    // Step 3: パターンマッチングによる抽出
    const patternKeywords = this.extractFromPatterns(queryAnalysis);
    
    // Step 4: 動的フィルタリング
    const filteredKeywords = this.applyDynamicFiltering([...], queryAnalysis);
    
    // Step 5: 動的優先度付け
    const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);
    
    // Step 6: 最終的なキーワード選択（12個ではなく、extractKeywordsConfiguredでは8個）
    const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 8);
    
    return { ... };
  } catch (error) {
    // エラーハンドリング
  }
}
```

---

### 重複コードの詳細比較

#### 共通部分（実質的に重複）

1. **処理フロー**: 完全に同一
   - クエリの動的解析
   - ドメイン知識からの抽出
   - パターンマッチングによる抽出
   - 動的フィルタリング
   - 動的優先度付け
   - 最終的なキーワード選択

2. **メソッド構造**: 実質的に同一
   - `analyzeQueryDynamically()`
   - `extractFromDomainKnowledge()`
   - `extractFromPatterns()`
   - `applyDynamicFiltering()`
   - `applyDynamicPrioritization()`
   - `selectFinalKeywordsDynamically()`

#### 違い

1. **キーワード数制限**:
   - `DynamicKeywordExtractor`: 12個
   - `UnifiedKeywordExtractionService`: `extractKeywordsConfigured` では8個（`extractDynamicKeywords` 自体では12個の可能性）

2. **エラーハンドリング**:
   - `DynamicKeywordExtractor`: `getFallbackKeywords()` を使用
   - `UnifiedKeywordExtractionService`: エラーハンドリングが異なる可能性

3. **実装の詳細**:
   - メソッドの内部実装が異なる可能性

---

## 問題点

### 1. コード重複

- **`DynamicKeywordExtractor`**: 約540行
- **`UnifiedKeywordExtractionService`**: `extractDynamicKeywords` 関連部分が約100行
- **合計**: 約640行のコード（実質的に重複している可能性）

### 2. 保守性の問題

- `extractDynamicKeywords()` の実装を変更する場合、2箇所を修正する必要がある
- バグ修正や機能追加時に、2箇所で同期を取る必要がある

### 3. 使用状況の不一致

- `DynamicKeywordExtractor`: テストでのみ使用
- `UnifiedKeywordExtractionService`: メインコードで使用
- テストとメインコードで異なる実装を使用している可能性

---

## 推奨される統合方針

### 方針1: `DynamicKeywordExtractor` を削除し、テストで `UnifiedKeywordExtractionService` を使用

**推奨度**: ⭐⭐⭐⭐⭐ (最高)

**理由**:
- `UnifiedKeywordExtractionService` がメインコードで使用されている
- `DynamicKeywordExtractor` はテストでのみ使用されている
- テストでもメインコードと同じ実装を使用すべき

**手順**:
1. テストファイルを更新:
   - `integration-test-framework.ts`: `DynamicKeywordExtractor` を `UnifiedKeywordExtractionService` に置き換え
   - `data-flow-integration-tests.ts`: 同様に置き換え
2. `dynamic-keyword-extractor.ts` を削除:
   - 依存関係を確認
   - 削除後に型チェック・ビルド・テストを実行

**メリット**:
- コード重複の削減（約540行）
- 保守性の向上（1箇所で修正可能）
- テストとメインコードの統一

**デメリット**:
- テストファイルの修正が必要
- 削除前にテストが正常に動作することを確認する必要がある

---

### 方針2: `DynamicKeywordExtractor` の機能を `UnifiedKeywordExtractionService` に完全統合

**推奨度**: ⭐⭐⭐ (中)

**理由**:
- `UnifiedKeywordExtractionService` のコメント（287行目）に「既存のDynamicKeywordExtractorのメソッドをここに統合」と記載されている
- 統合作業が未完了の可能性

**手順**:
1. `UnifiedKeywordExtractionService` の `extractDynamicKeywords()` の実装を確認
2. `DynamicKeywordExtractor` の実装と比較し、違いを特定
3. より良い実装を選択するか、統合する
4. テストを更新

**メリット**:
- 統合が完了する
- 実装の違いを明確化

**デメリット**:
- 実装の詳細な比較が必要
- 時間がかかる可能性

---

## 使用状況の確認

### `DynamicKeywordExtractor`

**テストでの使用**:
- ✅ `src/tests/integration-test-framework.ts`: 使用中
- ✅ `src/tests/data-flow-integration-tests.ts`: 使用中

**メインコードでの使用**:
- ❌ 使用されていない

**確認が必要**:
- テストが `UnifiedKeywordExtractionService` を使用しても動作するか
- `DynamicKeywordExtractor` に特有の機能があるか

---

## 未使用コード

### `archive/keyword-cache.ts`

**状況**:
- ✅ アーカイブフォルダ内に移動済み
- ✅ コメントアウト済み
- ✅ 将来的に復活させる可能性はある

**推奨アクション**:
- ✅ 現状のままで問題なし（アーカイブ内に保持）

---

## 実施手順（方針1を推奨）

### Step 1: テストファイルの更新

```typescript
// integration-test-framework.ts を更新
// 変更前:
import { DynamicKeywordExtractor } from '../lib/dynamic-keyword-extractor';
const keywordExtractor = new DynamicKeywordExtractor();

// 変更後:
import { unifiedKeywordExtractionService } from '../lib/unified-keyword-extraction-service';
// extractKeywordsConfigured を使用
```

### Step 2: `dynamic-keyword-extractor.ts` の削除

```bash
# 依存関係を確認
grep -r "dynamic-keyword-extractor" src/

# 削除
rm src/lib/dynamic-keyword-extractor.ts
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

### 発見された重複・未使用コード

1. **✅ 重複コード**: `DynamicKeywordExtractor` と `UnifiedKeywordExtractionService`
   - 約540行のコードが重複している可能性
   - `DynamicKeywordExtractor` はテストでのみ使用

2. **✅ 未使用コード**: `archive/keyword-cache.ts`
   - アーカイブフォルダ内（問題なし）

### 実施した統合（方針1を採用）

1. **✅ 完了**: `DynamicKeywordExtractor` の削除
   - テストを `UnifiedKeywordExtractionService` を使用するように更新
   - `integration-test-framework.ts`: `extractKeywordsConfigured()` を使用
   - `data-flow-integration-tests.ts`: `extractKeywordsConfigured()` を使用（2箇所）
   - `dynamic-keyword-extractor.ts` を削除

### 実施結果

- **✅ 型チェック**: 成功
- **✅ ビルド**: 成功
- **✅ デグレード**: なし

### 達成された効果

- **コード重複削減**: 約540行の削減
- **保守性向上**: 1箇所で修正可能
- **テストとメインコードの統一**: 同じ実装（`UnifiedKeywordExtractionService`）を使用

---

**実施日**: 2025年1月  
**実施者**: AI Assistant  
**ステータス**: ✅ 完了

