# scripts ディレクトリのクリーンアップ計画

## 分析結果

scriptsフォルダ内には多くのチェック・テスト・分析系ファイルがありますが、`package.json`で使用されていないファイルが多数存在します。

## 削除候補ファイル

### チェック系（package.jsonで未使用）
- `check-bm25-index.ts`
- `check-confluence-labels.ts`
- `check-expected-pages-exist.ts`
- `check-firestore-structured-labels.ts`
- `check-kg-status.ts`
- `check-label-data.ts`
- `check-lancedb-count.ts`
- `check-lancedb-structured-labels.ts`
- `check-meeting-notes-labels.ts`
- `check-null-category-meetings.ts`
- `check-production-lancedb-schema.ts`
- `check-production-minimal.ts`
- `check-production-schema-only.ts`
- `check-structured-category.ts`
- `check-type-consistency.ts`
- `download-and-check-production-schema.ts`

### 分析系（package.jsonで未使用）
- `analyze-lancedb-labels.ts`
- `analyze-search-performance.ts`
- `analyze-unused-lib-files.ts` （新しく作成したファイル）

### 比較系（package.jsonで未使用）
- `compare-lancedb-before-after.ts`
- `compare-search-distance-before-after.ts`
- `compare-vectors-before-after.ts`

### 検証系（package.jsonで未使用）
- `verify-all-optimizations.ts`
- `verify-lancedb-structured-labels.ts`

### 検査系（package.jsonで未使用）
- `inspect-lancedb-schema.ts`

### その他（package.jsonで未使用）
- `count-structured-labels.ts`
- `find-urgent-page.ts`
- `measure-current-performance.ts`
- `investigate-quality-degradation.ts`
- `quick-test-phase-4.ts`
- `simple-search-test-721.ts`

## 使用されているファイル（削除しない）

### package.jsonで使用されているファイル
- `check-cloud-storage-lancedb.ts` ✅
- `check-lancedb-indexes.ts` ✅
- `check-lancedb-schema.ts` ✅
- `check-production-type-fast.ts` ✅
- `cleanup-old-lancedb-files.ts` ✅
- `cleanup-old-lancedb-transactions.ts` ✅
- `cleanup-lancedb-completely.ts` ✅
- `compare-local-production-data.ts` ✅
- `verify-data-upload.ts` ✅
- `verify-label-filtering.ts` ✅
- `prepare-production-deployment.ts` ✅
- `upload-production-data.ts` ✅
- `download-production-data.ts` ✅
- `build-knowledge-graph.ts` ✅
- `visualize-kg.ts` ✅
- `rebuild-lancedb-smart-chunking.ts` ✅
- `create-lancedb-indexes.ts` ✅
- `generate-structured-labels.ts` ✅
- `clean-domain-knowledge.ts` ✅
- `sync-firestore-labels-to-lancedb.ts` ✅

### ビルドスクリプト（削除しない）
- `conditional-download.js` ✅
- `copy-kuromoji-dict.js` ✅
- `copy-lancedb-data.js` ✅
- `copy-model-files.js` ✅
- `copy-xenova-models.js` ✅
- `download-embedding-model.js` ✅
- `setup-firebase-secrets.ps1` ✅
- `setup-firebase-secrets.sh` ✅

## 実行結果

✅ **2025-11-02: 28ファイルを `scripts/archive/` に移動しました**

### 移動されたファイル（28ファイル）

#### チェック系スクリプト（16ファイル）
- `check-bm25-index.ts` → `scripts/archive/check-scripts/`
- `check-confluence-labels.ts` → `scripts/archive/check-scripts/`
- `check-expected-pages-exist.ts` → `scripts/archive/check-scripts/`
- `check-firestore-structured-labels.ts` → `scripts/archive/check-scripts/`
- `check-kg-status.ts` → `scripts/archive/check-scripts/`
- `check-label-data.ts` → `scripts/archive/check-scripts/`
- `check-lancedb-count.ts` → `scripts/archive/check-scripts/`
- `check-lancedb-structured-labels.ts` → `scripts/archive/check-scripts/`
- `check-meeting-notes-labels.ts` → `scripts/archive/check-scripts/`
- `check-null-category-meetings.ts` → `scripts/archive/check-scripts/`
- `check-production-lancedb-schema.ts` → `scripts/archive/check-scripts/`
- `check-production-minimal.ts` → `scripts/archive/check-scripts/`
- `check-production-schema-only.ts` → `scripts/archive/check-scripts/`
- `check-structured-category.ts` → `scripts/archive/check-scripts/`
- `check-type-consistency.ts` → `scripts/archive/check-scripts/`
- `download-and-check-production-schema.ts` → `scripts/archive/check-scripts/`

#### 分析系スクリプト（3ファイル）
- `analyze-lancedb-labels.ts` → `scripts/archive/`
- `analyze-search-performance.ts` → `scripts/archive/`
- `analyze-unused-lib-files.ts` → `scripts/archive/`

#### 比較系スクリプト（3ファイル）
- `compare-lancedb-before-after.ts` → `scripts/archive/`
- `compare-search-distance-before-after.ts` → `scripts/archive/`
- `compare-vectors-before-after.ts` → `scripts/archive/`

#### その他のスクリプト（9ファイル）
- `verify-all-optimizations.ts` → `scripts/archive/`
- `verify-lancedb-structured-labels.ts` → `scripts/archive/`
- `inspect-lancedb-schema.ts` → `scripts/archive/`
- `count-structured-labels.ts` → `scripts/archive/`
- `find-urgent-page.ts` → `scripts/archive/`
- `measure-current-performance.ts` → `scripts/archive/`
- `investigate-quality-degradation.ts` → `scripts/archive/`
- `quick-test-phase-4.ts` → `scripts/archive/`
- `simple-search-test-721.ts` → `scripts/archive/`

### アーカイブの詳細
- アーカイブ先: `scripts/archive/`
- チェックスクリプト: `scripts/archive/check-scripts/`
- README: `scripts/archive/README.md` に詳細を記載

## 推奨アクション

### Phase 1: アーカイブに移動（推奨）
削除するのではなく、`scripts/archive/`フォルダに移動することを推奨します。

### Phase 2: 確認後の削除
将来的に不要と判断された場合、アーカイブから完全に削除できます。

## 注意事項

⚠️ **削除前に必ず以下を確認してください：**

1. Gitリポジトリにコミット済みであること
2. バックアップを取得していること
3. テストが正常に動作すること
4. ビルドが正常に完了すること

