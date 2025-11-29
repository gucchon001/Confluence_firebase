# libフォルダ内ファイル使用状況調査結果

調査日: 2025-01-XX
調査対象: `src/lib` フォルダ内の全ファイル

## 調査方法
1. 各ファイルのエクスポート（関数、クラス、定数）を確認
2. プロジェクト内での使用箇所を検索
3. 使用状況を分類

## 使用状況分類

### ✅ 使用されているファイル（主要なエクスポートが使用されている）

#### 検索・スコアリング関連
- `unified-search-result-processor.ts` - ✅ 使用中（lancedb-search-client.tsで使用）
- `composite-scoring-service.ts` - ✅ 使用中（lancedb-search-client.tsで使用）
- `score-utils.ts` - ✅ 使用中（複数ファイルで使用）
- `search-weights.ts` - ✅ 使用中（複数ファイルで使用）
- `search-result-formatter.ts` - ✅ 使用中（hybrid-search-engine.tsで使用）
- `lancedb-search-client.ts` - ✅ 使用中（主要検索クライアント）
- `hybrid-search-engine.ts` - ✅ 使用中（search/route.tsで使用）
- `lunr-search-client.ts` - ✅ 使用中（複数ファイルで使用）
- `lunr-initializer.ts` - ✅ 使用中（複数ファイルで使用）

#### キャッシュ関連
- `generic-cache.ts` - ✅ 使用中（answer-cache.tsで使用）
- `answer-cache.ts` - ✅ 使用中（streaming-summarize-confluence-docs.tsで使用）
- `persistent-cache.ts` - ✅ 使用中（複数ファイルで使用）
- `lancedb-cache.ts` - ✅ 使用中（retrieve-relevant-docs-lancedb.tsで使用）

#### データ処理・変換関連
- `pageid-migration-helper.ts` - ✅ 使用中（複数ファイルで使用）
- `pageid-utils.ts` - ✅ 使用中（一部で使用）
- `bom-utils.ts` - ✅ 使用中（複数ファイルで使用）
- `firestore-data-mapper.ts` - ✅ 使用中（post-log-service.tsで使用）
- `firestore-data-mapper-admin.ts` - ✅ 使用中（streaming-process/route.tsで使用）
- `url-utils.ts` - ✅ 使用中（複数ファイルで使用）
- `jira-url-utils.ts` - ✅ 使用中（複数ファイルで使用）

#### ラベル・構造化ラベル関連
- `label-utils.ts` - ✅ 使用中（複数ファイルで使用）
- `label-manager.ts` - ✅ 使用中（複数ファイルで使用）
- `label-helper.ts` - ✅ 使用中（confluence-sync-service.tsで使用）
- `structured-label-service.ts` - ✅ 使用中（複数ファイルで使用）
- `structured-label-service-admin.ts` - ✅ 使用中（複数ファイルで使用）
- `structured-label-scorer.ts` - ✅ 使用中（composite-scoring-service.tsで使用）
- `lancedb-schema-extended.ts` - ✅ 使用中（複数ファイルで使用）

#### キーワード抽出関連
- `unified-keyword-extraction-service.ts` - ✅ 使用中（lancedb-search-client.tsで使用）
- `enhanced-keyword-extractor.ts` - ✅ 使用中（lancedb-search-client.tsで使用）
- `keyword-lists-loader.ts` - ✅ 使用中（複数ファイルで使用）
- `common-terms-config.ts` - ✅ 使用中（複数ファイルで使用）
- `domain-knowledge-loader.ts` - ✅ 使用中（複数ファイルで使用）

#### トークナイザー・日本語処理
- `japanese-tokenizer.ts` - ✅ 使用中（複数ファイルで使用）

#### エンベディング・ベクトル関連
- `embeddings.ts` - ✅ 使用中（複数ファイルで使用）
- `lancedb-client.ts` - ✅ 使用中（複数ファイルで使用）
- `lancedb-utils.ts` - ✅ 使用中（複数ファイルで使用）
- `lancedb-schema.ts` - ⚠️ 一部使用（ドキュメントで参照）

#### 同期・インポート関連
- `confluence-sync-service.ts` - ✅ 使用中（複数ファイルで使用）
- `jira-sync-service.ts` - ✅ 使用中（複数ファイルで使用）
- `google-drive-service.ts` - ✅ 使用中（複数ファイルで使用）
- `google-drive-firestore-service.ts` - ✅ 使用中（google-drive-lancedb-service.tsで使用）
- `google-drive-lancedb-service.ts` - ✅ 使用中（admin/google-drive/import/route.tsで使用）

#### チャンキング・テキスト処理
- `text-chunking.ts` - ✅ 使用中（google-drive-lancedb-service.tsで使用）
- `markdown-utils.tsx` - ✅ 使用中（chat-page.tsxで使用）

#### リトライ・エラーハンドリング
- `retry-utils.ts` - ✅ 使用中（chat-service.ts, conversation-service.tsで使用）
- `api-error-handler.ts` - ✅ 使用中（search/route.ts, flow/[flow]/route.tsで使用）
- `genkit-error-handler.ts` - ✅ 使用中（複数ファイルで使用）
- `gemini-api-errors.ts` - ✅ 使用中（embeddings.ts, confluence-sync-service.tsで使用）
- `fallback-answer-generator.ts` - ✅ 使用中（streaming-summarize-confluence-docs.tsで使用）

#### 参照拡張
- `reference-enhancer.ts` - ✅ 使用中（streaming-summarize-confluence-docs.tsで使用）

#### メモリ・パフォーマンス監視
- `memory-monitor.ts` - ✅ 使用中（複数ファイルで使用）
- `performance-monitor.ts` - ⚠️ 一部使用（ドキュメントで参照、実際の使用は限定的）
- `startup-optimizer.ts` - ✅ 使用中（複数ファイルで使用）

#### キャッシュ・ストレージ
- `gcs-cache-helper.ts` - ✅ 使用中（lunr-initializer.ts, lunr-search-client.tsで使用）

#### ユーザー・認証関連
- `user-service.ts` - ✅ 使用中（複数ファイルで使用）
- `chat-service.ts` - ✅ 使用中（chat-page.tsxで使用）
- `conversation-service.ts` - ✅ 使用中（chat-page.tsxで使用）

#### Firestore関連
- `firebase-admin-init.ts` - ✅ 使用中（複数ファイルで使用）
- `firebase-unified.ts` - ✅ 使用中（複数ファイルで使用）
- `firebase-config.ts` - ✅ 使用中（firebase-unified.tsで使用）
- `firebase.ts` - ✅ 使用中（複数ファイルで使用）
- `firestore-query-builder.ts` - ✅ 使用中（複数ファイルで使用）

#### ログ・分析関連
- `post-log-service.ts` - ✅ 使用中（複数ファイルで使用）
- `satisfaction-rating-service.ts` - ✅ 使用中（複数ファイルで使用）
- `question-analysis-service.ts` - ✅ 使用中（複数ファイルで使用）
- `admin-service.ts` - ✅ 使用中（複数ファイルで使用）
- `jira-dashboard-service.ts` - ✅ 使用中（複数ファイルで使用）
- `jira-firestore-enrichment-service.ts` - ✅ 使用中（search/route.ts, streaming-process/route.tsで使用）
- `system-health-service.ts` - ✅ 使用中（複数ファイルで使用）
- `error-analysis-service.ts` - ✅ 使用中（複数ファイルで使用）
- `performance-alert-service.ts` - ✅ 使用中（複数ファイルで使用）
- `screen-test-logger.ts` - ⚠️ 一部使用（streaming-process/route.ts, search/route.tsで使用）

#### Knowledge Graph関連
- `kg-storage-service.ts` - ✅ 使用中（kg-search-service.tsで使用）
- `kg-search-service.ts` - ✅ 使用中（lancedb-search-client.tsで使用）
- `kg-reference-extractor.ts` - ✅ 使用中（build-knowledge-graph.tsで使用）
- `kg-label-builder.ts` - ✅ 使用中（build-knowledge-graph.tsで使用）

#### 統計・ユーティリティ
- `statistics-utils.ts` - ✅ 使用中（satisfaction-rating-service.ts, question-analysis-service.tsで使用）
- `date-comparison-utils.ts` - ⚠️ 使用されていない可能性（検索結果なし）
- `title-utils.ts` - ⚠️ 使用されていない可能性（検索結果なし）
- `deployment-info.ts` - ✅ 使用中（複数ファイルで使用）
- `utils.ts` - ✅ 使用中（cn関数が複数のUIコンポーネントで使用）

#### その他
- `streaming-process-client.ts` - ✅ 使用中（chat-page.tsxで使用）
- `query-preprocessor.ts` - ✅ 使用中（hybrid-search-engine.tsで使用）
- `dynamic-priority-manager.ts` - ⚠️ 一部使用（unified-keyword-extraction-service.ts, keyword-lists-loader.tsで使用、ただし実際の機能は限定的）

### ⚠️ 使用状況が不明確なファイル

#### 使用されていない可能性があるファイル
1. **`date-comparison-utils.ts`**
   - エクスポート: `normalizeToISO8601`, `parseToUTCDate`, `compareDates`, `isNewerThan`, `isOlderThan`, `isEqual`, `getTimeDifference`, `formatDateForDisplay`, `getRelativeTime`, `getDateComparisonDebugInfo`
   - 使用箇所: 検索結果なし（ファイル自体のみ）
   - 推奨: 削除を検討

2. **`title-utils.ts`**
   - エクスポート: `isTitleExcluded`
   - 使用箇所: 検索結果なし（ファイル自体のみ）
   - 推奨: 削除を検討

3. **`performance-monitor.ts`** ✅ **削除済み**
   - エクスポート: `PerformanceMonitor`, `performanceMonitor`, `measurePerformance`
   - 使用箇所: ドキュメントで参照されているが、実際のコードでの使用は見つからなかった
   - 対応: 削除済み

4. **`screen-test-logger.ts`**
   - エクスポート: `ScreenTestLogger`, `screenTestLogger`
   - 使用箇所: streaming-process/route.ts, search/route.tsで使用されているが、実際の使用は限定的
   - 推奨: 使用状況を確認してから判断

5. **`dynamic-priority-manager.ts`** ✅ **削除済み・リファクタリング完了**
   - エクスポート: `DynamicPriorityManager`, `dynamicPriorityManager`
   - 使用箇所: keyword-lists-loader.tsで使用されていたが、rulesが空配列で機能が実装されていなかった
   - 対応: 削除し、`keyword-lists-loader.ts`内で直接basePriorityを使用するようにリファクタリング

6. **`lancedb-schema.ts`** ✅ **削除済み**
   - エクスポート: `MinimalLanceDBSchema`, `FullLanceDBSchema`, `createConfluenceSampleData`, `createConfluenceRecord`
   - 使用箇所: ドキュメントで参照されているが、実際のコードでの使用は見つからなかった（`lancedb-schema-extended.ts`が使用されている）
   - 対応: 削除済み

## クリーンアップ実施結果（2025-01-XX）

### ✅ 削除したファイル
1. **`src/lib/performance-monitor.ts`** - 未使用（ドキュメントでのみ参照）
2. **`src/lib/lancedb-schema.ts`** - 未使用（`lancedb-schema-extended.ts`が使用されている）
3. **`src/lib/dynamic-priority-manager.ts`** - 機能が実装されていないため削除し、`keyword-lists-loader.ts`内で直接basePriorityを使用するようにリファクタリング

### ✅ リファクタリング実施
- **`src/lib/keyword-lists-loader.ts`**: `DynamicPriorityManager`への依存を削除し、直接basePriorityを使用するように変更

### 📝 既に削除済み
- `date-comparison-utils.ts` - ファイルが見つからない（既に削除されている）
- `title-utils.ts` - ファイルが見つからない（既に削除されている）

### ✅ 保持したファイル
- **`screen-test-logger.ts`** - 実際に使用されている（`streaming-process/route.ts`, `search/route.ts`, `flow/[flow]/route.ts`で使用）

### 注意事項
- 多くのファイルは実際に使用されている
- 削除前に、テストコードでの使用も確認済み
- リファクタリング後、リンターエラーは発生していない

