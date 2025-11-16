# Confluence取得・処理関連の重複コード・未使用コード分析

## 📋 分析概要

Confluence取得とその後の関連処理（同期処理、チャンク分割、データ変換）における重複コードと未使用コードを調査しました。

**分析日**: 2024年12月
**対象範囲**: Confluence APIからのページ取得、同期処理、チャンク分割、データ変換、アーカイブされた同期実装

---

## 🔍 調査結果サマリー

### ✅ 使用中のファイル
- `src/lib/confluence-sync-service.ts` - Confluence同期サービスのメイン実装
- `src/scripts/batch-sync-confluence.ts` - バッチ同期スクリプト

### ⚠️ 未使用メソッド
- `getConfluencePagesBatch` - 定義されているが使用されていない（`getAllConfluencePages`が使用されている）
- `syncPagesParallel` - 定義されているが本番コードで使用されていない（`syncPages`が使用されている）
- `syncPagesByCount` - アーカイブスクリプトでのみ使用

### ⚠️ 限定的に使用されているメソッド
- `getConfluencePageById` - アーカイブスクリプト（`scripts/archive/differential-sync.ts`）でのみ使用

### 📝 補足
- アーカイブファイルは既に`scripts/archive/`に移動済み
- 重複コードは少ないが、未使用メソッドが複数存在

---

## 📁 ファイル別分析

### 1. 現在使用中のファイル

#### `src/lib/confluence-sync-service.ts`
**状態**: ✅ 使用中（Confluence同期サービスのメイン実装）

**機能**:
- **`getConfluencePageById`関数** (109-152行目): 特定のページIDでConfluenceページを取得
- **`getConfluencePages`関数** (253-298行目): Confluence APIからページを取得（単一バッチ）
- **`getConfluencePagesBatch`関数** (163-201行目): Confluenceページを並列バッチで取得（未使用）
- **`getAllConfluencePages`関数** (206-248行目): Confluence APIから全ページを取得（ページネーション対応）
- **`syncPages`関数** (514-587行目): 正しい仕様に基づく同期処理
- **`syncPagesParallel`関数** (407-509行目): 並列同期処理（未使用）
- **`syncPagesByCount`関数** (393-402行目): ページ数を指定した同期処理（アーカイブスクリプトでのみ使用）

**使用箇所**:
- `src/scripts/batch-sync-confluence.ts`: `getAllConfluencePages`と`syncPages`を使用（24, 34行目）
- `scripts/rebuild-lancedb-smart-chunking.ts`: `getAllConfluencePages`を使用（151行目）
- アーカイブスクリプトで一部のメソッドを使用

**重複**: `getConfluencePagesBatch`と`getAllConfluencePages`が部分的に重複（後述）

---

#### `src/scripts/batch-sync-confluence.ts`
**状態**: ✅ 使用中（バッチ同期スクリプト）

**機能**:
- 全ページ同期を実行
- インデックス再構築

**使用箇所**:
- `package.json`のスクリプトから呼び出し（`sync:confluence:batch`など）

**重複**: なし（統一された同期スクリプト）

---

### 2. アーカイブファイル（未使用だが参照あり）

#### `scripts/archive/optimized-confluence-sync-service.ts`
**状態**: ❌ アーカイブ済み（`confluence-sync-service.ts`に統合済み）

**機能**:
- 最適化された同期処理（旧実装）
- キャッシュ、並列処理、事前フィルタリング

**使用状況**:
- ❌ 本番コードでは使用されていない
- `ConfluenceSyncService`を拡張したクラス

**削除推奨**: ✅ 削除可能（アーカイブ済み）

---

#### `scripts/archive/temporary/src-scripts/unified-confluence-sync.ts`
**状態**: ❌ アーカイブ済み（`batch-sync-confluence.ts`に置き換え済み）

**機能**:
- 統一Confluence同期スクリプト（旧実装）

**使用状況**:
- ❌ 本番コードでは使用されていない
- `batch-sync-confluence.ts`に置き換え済み

**削除推奨**: ✅ 削除可能（アーカイブ済み）

---

### 3. 未使用コード

#### `src/lib/confluence-sync-service.ts`の`getConfluencePagesBatch`関数
**状態**: ❌ 未使用（削除可能）

**機能**:
- **`getConfluencePagesBatch`関数** (163-201行目): Confluenceページを並列バッチで取得
  ```typescript
  async getConfluencePagesBatch(totalPages: number, batchSize: number = 50): Promise<ConfluencePage[]> {
    // バッチを作成して並列実行
    const batches: Promise<ConfluencePage[]>[] = [];
    for (let start = 0; start < totalPages; start += batchSize) {
      batches.push(this.getConfluencePages(currentBatchSize, start));
    }
    const batchResults = await Promise.all(batches);
    // 結果をマージ
    return allPages;
  }
  ```

**使用状況**: 
- 定義されているが、使用箇所が見つからない
- `getAllConfluencePages`が代わりに使用されている（同じ機能を提供）

**重複**: `getAllConfluencePages`と機能的に重複（並列実行 vs シーケンシャル実行）

**削除推奨**: ✅ はい

---

#### `src/lib/confluence-sync-service.ts`の`syncPagesParallel`関数
**状態**: ❌ 未使用（削除推奨）

**機能**:
- **`syncPagesParallel`関数** (407-509行目): 並列同期処理
  ```typescript
  async syncPagesParallel(pages: ConfluencePage[], concurrency: number = 10): Promise<SyncResult> {
    // ページをチャンクに分割して並列処理
    // 各チャンクを並列実行
  }
  ```

**使用状況**: 
- 定義されているが、本番コードでは使用されていない
- `syncPages`が代わりに使用されている（シーケンシャル処理）

**重複**: `syncPages`と機能的に重複（並列実行 vs シーケンシャル実行）

**削除推奨**: ⚠️ 確認が必要（将来の最適化で使用される可能性があるため、コメントアウト推奨）

---

#### `src/lib/confluence-sync-service.ts`の`syncPagesByCount`関数
**状態**: ⚠️ 限定的に使用（アーカイブスクリプトでのみ使用）

**機能**:
- **`syncPagesByCount`関数** (393-402行目): ページ数を指定した同期処理
  ```typescript
  async syncPagesByCount(maxPages: number): Promise<SyncResult> {
    const pages = await this.getAllConfluencePages(maxPages);
    return await this.syncPagesParallel(pages, 10);
  }
  ```

**使用状況**: 
- アーカイブスクリプト（`scripts/archive/sync-20pages.ts`、`scripts/archive/production-full-sync.ts`）でのみ使用
- 本番コードでは使用されていない

**削除推奨**: ⚠️ 確認が必要（アーカイブスクリプトが削除されれば削除可能）

---

## 🔄 重複コードの確認

### `getConfluencePagesBatch`と`getAllConfluencePages`の比較

#### `getConfluencePagesBatch`:
```typescript
async getConfluencePagesBatch(totalPages: number, batchSize: number = 50): Promise<ConfluencePage[]> {
  const batches: Promise<ConfluencePage[]>[] = [];
  for (let start = 0; start < totalPages; start += batchSize) {
    batches.push(this.getConfluencePages(currentBatchSize, start));
  }
  const batchResults = await Promise.all(batches);
  // 結果をマージ
  return allPages;
}
```

#### `getAllConfluencePages`:
```typescript
async getAllConfluencePages(maxPages: number = 1000): Promise<ConfluencePage[]> {
  let start = 0;
  const limit = 50;
  while (hasMore && allPages.length < maxPages) {
    const pages = await this.getConfluencePages(limit, start);
    allPages.push(...pages);
    start += limit;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return allPages;
}
```

**分析**:
- **機能的な違い**: 
  - `getConfluencePagesBatch`: 並列実行（`Promise.all`を使用）
  - `getAllConfluencePages`: シーケンシャル実行（API制限を考慮した待機あり）
- **使用状況**:
  - `getAllConfluencePages`: 本番コードで使用中
  - `getConfluencePagesBatch`: 未使用
- **推奨**: `getConfluencePagesBatch`を削除（並列実行が必要な場合は`getAllConfluencePages`を改善）

---

### `syncPagesParallel`と`syncPages`の比較

#### `syncPagesParallel`:
```typescript
async syncPagesParallel(pages: ConfluencePage[], concurrency: number = 10): Promise<SyncResult> {
  // ページをチャンクに分割
  const chunks: ConfluencePage[][] = [];
  for (let i = 0; i < pages.length; i += concurrency) {
    chunks.push(pages.slice(i, i + concurrency));
  }
  // 各チャンクを並列処理
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(page => this.processPage(page));
    await Promise.all(chunkPromises);
  }
}
```

#### `syncPages`:
```typescript
async syncPages(pages: ConfluencePage[]): Promise<SyncResult> {
  // シーケンシャル処理
  for (const page of pages) {
    await this.processPage(page);
  }
}
```

**分析**:
- **機能的な違い**: 
  - `syncPagesParallel`: 並列実行（同時実行数を制御）
  - `syncPages`: シーケンシャル実行（安全性重視）
- **使用状況**:
  - `syncPages`: 本番コードで使用中
  - `syncPagesParallel`: 未使用
- **推奨**: `syncPagesParallel`をコメントアウトまたは削除（並列処理が必要な場合は`syncPages`を改善）

---

## 📊 削除推奨ファイル・メソッド一覧

| ファイル/メソッド | 理由 | 削除推奨 | 備考 |
|---------|------|---------|------|
| `getConfluencePagesBatch`関数 | 未使用（`getAllConfluencePages`が使用されている） | ✅ | `src/lib/confluence-sync-service.ts`から削除 |
| `syncPagesParallel`関数 | 本番コードで未使用（`syncPages`が使用されている） | ⚠️ | コメントアウトまたは削除（将来使用の可能性を考慮） |
| `syncPagesByCount`関数 | アーカイブスクリプトでのみ使用 | ⚠️ | アーカイブスクリプトが削除されれば削除可能 |
| `scripts/archive/optimized-confluence-sync-service.ts` | アーカイブ済み | ✅ | 削除可能 |
| `scripts/archive/temporary/src-scripts/unified-confluence-sync.ts` | アーカイブ済み | ✅ | 削除可能 |

---

## 🎯 推奨アクション

### 1. 未使用メソッドの削除（優先度: 中）

**問題**: `getConfluencePagesBatch`が未使用

**対応方法**: 関数を削除

**注意事項**:
- `getAllConfluencePages`が同じ機能を提供している
- 並列実行が必要な場合は`getAllConfluencePages`を改善することを検討

### 2. 並列同期処理の整理（優先度: 低）

**問題**: `syncPagesParallel`が未使用

**対応方法**: 
- コメントアウト（将来の最適化で使用される可能性を考慮）
- または削除（シーケンシャル処理で十分な場合）

**注意事項**:
- 並列処理が必要な場合は`syncPages`を改善することを検討
- パフォーマンステストで並列処理の効果を確認

### 3. アーカイブファイルの削除（優先度: 低）

**問題**: アーカイブファイルが残っている

**対応方法**: アーカイブファイルを削除

**注意事項**:
- アーカイブファイルへの参照がないことを確認
- 削除前にバックアップを推奨

### 4. コード品質の維持

- ✅ `getAllConfluencePages`は適切に機能している
- ✅ `syncPages`は適切に機能している
- ✅ `batch-sync-confluence.ts`は統一されたスクリプト
- ⚠️ 未使用メソッドを削除してコードベースを整理

---

## 📝 補足情報

### 現在のConfluence同期フロー

```
バッチ同期スクリプト実行
  ↓
batch-sync-confluence.ts
  ├─ データベース状態表示
  ├─ getAllConfluencePages() で全ページ取得
  ├─ syncPages() で同期実行
  ├─ データベース状態表示
  └─ インデックス再構築
  ↓
confluence-sync-service.ts
  ├─ getConfluencePages() - APIからページ取得
  ├─ shouldExcludePage() - 除外判定
  ├─ findExistingChunks() - 既存チャンク検索
  ├─ addNewPage() - 新規ページ追加
  ├─ updateExistingPage() - 既存ページ更新
  └─ splitPageIntoChunks() - チャンク分割
  ↓
LanceDB / Firestore
  ├─ データ保存
  └─ インデックス更新
```

### Confluence処理の役割

1. **ページ取得**: Confluence APIからページを取得
2. **フィルタリング**: 除外対象ページをスキップ
3. **チャンク分割**: ページを2-3チャンクに分割
4. **埋め込み生成**: 各チャンクの埋め込みベクトルを生成
5. **同期処理**: 新規追加・更新・変更なしを判定して処理
6. **インデックス更新**: LunrインデックスとLanceDBインデックスを更新

---

## ✅ 結論

1. **使用中のファイル**: 2つの主要ファイルが適切に機能している
   - `confluence-sync-service.ts`
   - `batch-sync-confluence.ts`

2. **未使用メソッド**: 3つの未使用メソッドが確認されました
   - `getConfluencePagesBatch`（削除推奨）
   - `syncPagesParallel`（コメントアウトまたは削除推奨）
   - `syncPagesByCount`（アーカイブスクリプトでのみ使用）

3. **アーカイブファイル**: 2つのアーカイブファイルが残っている
   - 削除可能（アーカイブ済み）

4. **推奨**: 
   - 未使用メソッドを削除してコードベースを整理
   - 並列処理が必要な場合は既存メソッドを改善することを検討

---

## 🔗 関連ドキュメント

- [ベクトル関連処理重複分析](./vector-processing-duplication-analysis.md)
- [タイトル検索重複分析](./title-search-duplication-analysis.md)
- [BM25関連処理重複分析](./bm25-duplication-analysis.md)
- [マークダウン処理重複分析](./markdown-processing-duplication-analysis.md)
- [キーワード抽出重複分析](./keyword-extraction-duplication-analysis.md)
- [ストリーミング処理重複分析](./streaming-processing-duplication-analysis.md)
- [インデックス処理重複分析](./indexing-processing-duplication-analysis.md)

