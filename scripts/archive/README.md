# scripts/archive ディレクトリ

このディレクトリには、現在のコードベースで使用されていない古いスクリプトファイルがアーカイブされています。

## アーカイブされた理由

これらのファイルは、`package.json`で使用されていないか、または特定の調査・テスト目的で作成された一時的なファイルです。

## アーカイブされたファイル一覧

### check-scripts/ ディレクトリ（チェック系スクリプト）
以下の16ファイルがアーカイブされています：

1. `check-bm25-index.ts`
2. `check-confluence-labels.ts`
3. `check-expected-pages-exist.ts`
4. `check-firestore-structured-labels.ts`
5. `check-kg-status.ts`
6. `check-label-data.ts`
7. `check-lancedb-count.ts`
8. `check-lancedb-structured-labels.ts`
9. `check-meeting-notes-labels.ts`
10. `check-null-category-meetings.ts`
11. `check-production-lancedb-schema.ts`
12. `check-production-minimal.ts`
13. `check-production-schema-only.ts`
14. `check-structured-category.ts`
15. `check-type-consistency.ts`
16. `download-and-check-production-schema.ts`

### 分析系スクリプト
以下の3ファイルがアーカイブされています：

1. `analyze-lancedb-labels.ts`
2. `analyze-search-performance.ts`
3. `analyze-unused-lib-files.ts`

### 比較系スクリプト
以下の3ファイルがアーカイブされています：

1. `compare-lancedb-before-after.ts`
2. `compare-search-distance-before-after.ts`
3. `compare-vectors-before-after.ts`

### その他のスクリプト
以下の9ファイルがアーカイブされています：

1. `verify-all-optimizations.ts`
2. `verify-lancedb-structured-labels.ts`
3. `inspect-lancedb-schema.ts`
4. `count-structured-labels.ts`
5. `find-urgent-page.ts`
6. `measure-current-performance.ts`
7. `investigate-quality-degradation.ts`
8. `quick-test-phase-4.ts`
9. `simple-search-test-721.ts`

## 現在の実装

### 使用されているチェックスクリプト
- ✅ `check-cloud-storage-lancedb.ts` - package.jsonで使用
- ✅ `check-lancedb-indexes.ts` - package.jsonで使用
- ✅ `check-lancedb-schema.ts` - package.jsonで使用
- ✅ `check-production-type-fast.ts` - package.jsonで使用

### 使用されている比較スクリプト
- ✅ `compare-local-production-data.ts` - package.jsonで使用

### 使用されている検証スクリプト
- ✅ `verify-data-upload.ts` - package.jsonで使用
- ✅ `verify-label-filtering.ts` - package.jsonで使用

## 復元方法

必要に応じて、以下のコマンドでファイルを復元できます：

```bash
# 特定のファイルを復元
mv scripts/archive/filename.ts scripts/filename.ts

# すべてのチェックスクリプトを復元
mv scripts/archive/check-scripts/*.ts scripts/
```

## 注意事項

⚠️ **これらのファイルは現在のコードベースで使用されていません。**
- 復元する場合は、依存関係を確認してください
- 復元後は、ビルドとテストを実行して正常に動作することを確認してください

## アーカイブ日

2025-11-02
