# scripts ディレクトリ一時ファイル・不要ファイル分析

**作成日**: 2025年11月6日  
**目的**: `scripts/`と`src/scripts/`の一時ファイルや不要なファイルを特定

---

## 📊 分析結果サマリー

### ✅ 使用されているファイル（削除しない）

以下のファイルは`package.json`で使用されています：

#### ビルドスクリプト
- `conditional-download.js` ✅
- `copy-kuromoji-dict.js` ✅
- `copy-lancedb-data.js` ✅

#### テストスクリプト
- `test-feature-name-matching.ts` ✅
- `test-page-id-in-search-results.ts` ✅
- `test-search-ranking-classroom-deletion.ts` ✅
- `test-label-and-title-matching.ts` ✅
- `test-bom-error-browser.ts` ✅
- `test-firestore-labels-integration.ts` ✅
- `test-local-search-performance.ts` ✅
- `test-duplicate-cleanup.ts` ✅
- `test-generic-terms-unification.ts` ✅

#### デバッグスクリプト
- `debug-search-logger.ts` ✅
- `debug-lancedb-index-status.ts` ✅
- `debug-lancedb-data-query.ts` ✅

#### チェックスクリプト
- `check-cloud-storage-lancedb.ts` ✅
- `check-lancedb-indexes.ts` ✅
- `check-lancedb-schema.ts` ✅
- `check-production-type-fast.ts` ✅
- `check-firestore-structured-labels.ts` ✅
- `check-lancedb-table-schema.ts` ✅
- `check-production-lancedb-schema.ts` ✅
- `check-url-issues.ts` ✅
- `check-local-performance.ts` ✅

#### 検証スクリプト
- `verify-label-filtering.ts` ✅
- `verify-extended-schema.ts` ✅
- `verify-data-upload.ts` ✅

#### クリーンアップスクリプト
- `cleanup-old-lancedb-files.ts` ✅
- `cleanup-old-lancedb-transactions.ts` ✅
- `cleanup-lancedb-completely.ts` ✅
- `cleanup-duplicate-chunks.ts` ✅

#### 再構築スクリプト
- `rebuild-lancedb-smart-chunking.ts` ✅
- `rebuild-lunr-msgpack.ts` ✅
- `rebuild-lancedb-without-duplicates.ts` ✅

#### その他
- `generate-structured-labels.ts` ✅
- `build-knowledge-graph.ts` ✅
- `visualize-kg.ts` ✅
- `prepare-production-deployment.ts` ✅
- `upload-production-data.ts` ✅
- `download-production-data.ts` ✅
- `backup-production-data.ts` ✅
- `sync-firestore-labels-to-lancedb.ts` ✅
- `monitor-lancedb-count.ts` ✅
- `analyze-lancedb-data-structure.ts` ✅
- `analyze-duplicate-impact.ts` ✅
- `compare-local-production-data.ts` ✅
- `delete-lancedb-table.ts` ✅
- `restore-lancedb-from-backup.ts` ✅
- `warmup-cache.ts` ✅
- `clean-domain-knowledge.ts` ✅
- `setup-firebase-secrets.ps1` ✅
- `setup-firebase-secrets.sh` ✅

---

## ⚠️ 一時ファイル・不要ファイル（アーカイブ候補）

### 1. `migrate-lancedb-table-to-extended-schema.ts` ⚠️ **完了済みマイグレーション**

**状態**: 拡張スキーマへの移行は完了済み（2025年11月）

**確認結果**:
- `package.json`で使用されていない（`migrate:lancedb-to-extended-schema`スクリプトは存在するが、実際には使用されていない）
- 移行は完了済みで、今後は`rebuild-lancedb-smart-chunking.ts`を使用

**推奨アクション**: **アーカイブに移動**

---

### 2. `lancedb-rebuild.ts` ⚠️ **古い再構築スクリプト**

**状態**: `rebuild-lancedb-smart-chunking.ts`に置き換え済み

**確認結果**:
- `package.json`で使用されていない
- `rebuild-lancedb-smart-chunking.ts`が現在使用されている

**推奨アクション**: **アーカイブに移動**

---

### 3. `lancedb-cleanup.ts` ⚠️ **古いクリーンアップスクリプト**

**状態**: `cleanup-lancedb-completely.ts`に置き換え済み

**確認結果**:
- `package.json`で使用されていない
- `cleanup-lancedb-completely.ts`が現在使用されている

**推奨アクション**: **アーカイブに移動**

---

### 4. `test-bom-error-browser.ts` ⚠️ **一時的なテストスクリプト**

**状態**: BOMエラーの調査用に作成された一時的なテストスクリプト

**確認結果**:
- `package.json`で使用されている（`test:bom-error-browser`）
- BOMエラーは解決済み（2025年11月）
- 今後は使用されない可能性が高い

**推奨アクション**: **アーカイブに移動**（`package.json`からも削除）

---

### 5. `package.json`で参照されているがファイルが存在しないスクリプト

以下のスクリプトは`package.json`で参照されているが、実際のファイルが存在しない：

- `test-gemini-embedding-limits.ts` - `embedding:test`スクリプトで参照
- `test-get-chunks.ts` - `test:get-chunks`スクリプトで参照
- `analyze-page-sizes.ts` - `lancedb:analyze`スクリプトで参照
- `performance-test-phase-0a-2.ts` - `perf:test`スクリプトで参照
- `list-kg-nodes.ts` - `kg:list`スクリプトで参照

**推奨アクション**: **`package.json`から削除**

---

## 📋 推奨アクション

### 優先度: 高 🔴

1. **`migrate-lancedb-table-to-extended-schema.ts`** - アーカイブに移動
2. **`lancedb-rebuild.ts`** - アーカイブに移動
3. **`lancedb-cleanup.ts`** - アーカイブに移動
4. **`test-bom-error-browser.ts`** - アーカイブに移動（`package.json`からも削除）

### 優先度: 中 🟡

5. **`package.json`から存在しないファイルへの参照を削除**
   - `test-gemini-embedding-limits.ts`
   - `test-get-chunks.ts`
   - `analyze-page-sizes.ts`
   - `performance-test-phase-0a-2.ts`
   - `list-kg-nodes.ts`

---

## 📊 統計

| カテゴリ | 使用中 | アーカイブ候補 | 削除候補 |
|---------|--------|--------------|---------|
| ビルドスクリプト | 3 | 0 | 0 |
| テストスクリプト | 9 | 1 | 0 |
| デバッグスクリプト | 3 | 0 | 0 |
| チェックスクリプト | 9 | 0 | 0 |
| 検証スクリプト | 3 | 0 | 0 |
| クリーンアップスクリプト | 4 | 0 | 0 |
| 再構築スクリプト | 3 | 1 | 0 |
| マイグレーションスクリプト | 0 | 1 | 0 |
| その他 | 20+ | 0 | 0 |
| **合計** | **50+** | **3** | **5（package.json参照）** |

---

**結論**: 3つのファイルがアーカイブ候補で、5つの`package.json`参照が削除候補です。

---

## ✅ アーカイブ完了（2025年11月6日）

### アーカイブに移動したファイル

#### `scripts/`ディレクトリ（4ファイル）
1. ✅ **`migrate-lancedb-table-to-extended-schema.ts`** → `scripts/archive/temporary/`
   - 完了済みマイグレーションスクリプト
2. ✅ **`lancedb-rebuild.ts`** → `scripts/archive/temporary/`
   - 古い再構築スクリプト（`rebuild-lancedb-smart-chunking.ts`に置き換え済み）
3. ✅ **`lancedb-cleanup.ts`** → `scripts/archive/temporary/`
   - 古いクリーンアップスクリプト（`cleanup-lancedb-completely.ts`に置き換え済み）
4. ✅ **`test-bom-error-browser.ts`** → `scripts/archive/temporary/`
   - 一時的なテストスクリプト（BOMエラーは解決済み）

#### `src/scripts/`ディレクトリ（4ファイル）
5. ✅ **`check-data-basic.ts`** → `scripts/archive/temporary/src-scripts/`
   - 使用されていないチェックスクリプト
6. ✅ **`unified-confluence-sync.ts`** → `scripts/archive/temporary/src-scripts/`
   - 使用されていない同期スクリプト（`batch-sync-confluence.ts`に置き換え済み）
7. ✅ **`graph-data-generator.ts`** → `scripts/archive/temporary/src-scripts/`
   - 使用されていないグラフデータ生成スクリプト
8. ✅ **`performance-monitor.ts`** → `scripts/archive/temporary/src-scripts/`
   - 使用されていないパフォーマンス監視スクリプト

### `package.json`から削除したスクリプト

1. ✅ **`test:bom-error-browser`** - `test-bom-error-browser.ts`がアーカイブに移動したため
2. ✅ **`migrate:lancedb-to-extended-schema`** - `migrate-lancedb-table-to-extended-schema.ts`がアーカイブに移動したため
3. ✅ **`kg:list`** - `list-kg-nodes.ts`が存在しないため
4. ✅ **`perf:test`** - `performance-test-phase-0a-2.ts`が存在しないため
5. ✅ **`lancedb:analyze`** - `analyze-page-sizes.ts`が存在しないため
6. ✅ **`embedding:test`** - `test-gemini-embedding-limits.ts`が存在しないため
7. ✅ **`test:get-chunks`** - `test-get-chunks.ts`が存在しないため

---

**アーカイブ作業完了**: 8つのファイルをアーカイブに移動し、7つの`package.json`参照を削除しました。

