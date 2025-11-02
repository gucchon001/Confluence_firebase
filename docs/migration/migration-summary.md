# pageId → page_id マイグレーション実装サマリー

## ✅ 完了した実装

### Phase 1: スキーマ定義の変更 ✅
1. ✅ `src/lib/lancedb-schema-extended.ts`: `pageId` → `page_id`
2. ✅ `src/lib/lancedb-client.ts`: スキーマ定義とダミーデータの変更

### Phase 2: データベースクエリの変更 ✅
1. ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
2. ✅ `src/lib/lancedb-search-client.ts`: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
3. ✅ `src/lib/confluence-sync-service.ts`: `chunk.pageId` → `chunk.page_id`

### Phase 3: データ投入部分の変更 ✅
1. ✅ `src/lib/confluence-sync-service.ts`: `pageId` → `page_id` (データ投入時)
2. ✅ `src/lib/lancedb-client.ts`: ダミーデータの変更

### Phase 4: 変換レイヤーの実装 ✅
1. ✅ `src/lib/pageid-migration-helper.ts`: 新規作成
   - `mapLanceDBRecordToAPI`: 単一レコードの変換（page_id → pageId）
   - `mapLanceDBRecordsToAPI`: 複数レコードの変換
   - `mapAPIToDatabaseRecord`: API→データベースの変換（pageId → page_id）
   - `getPageIdFromRecord`: 両方のフィールド名に対応したpageId取得

### Phase 5: 変換レイヤーの適用 ✅
1. ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts`:
   - `getAllChunksByPageIdInternal`: 変換レイヤー適用
   - `lancedbRetrieverTool`: `getPageIdFromRecord`を使用
   - `enrichWithAllChunks`: `getPageIdFromRecord`を使用
   - `filterInvalidPagesServer`: `getPageIdFromRecord`を使用

2. ✅ `src/lib/lancedb-search-client.ts`:
   - `fetchPageFromLanceDB`: 変換レイヤー適用
   - 重複除去処理: `getPageIdFromRecord`を使用
   - RRFフィルタリング: `getPageIdFromRecord`を使用
   - BM25結果マッピング: `getPageIdFromRecord`を使用

## 📊 実装統計

- **変更ファイル数**: 5ファイル
- **新規ファイル数**: 1ファイル（`pageid-migration-helper.ts`）
- **リンターエラー**: 0件（すべて解消済み）

## 🎯 実装方針

### API互換性の維持
- **内部処理**: `page_id`を使用（データベースフィールド名）
- **APIレスポンス**: `pageId`を維持（変換レイヤーで対応）
- **段階的移行**: 既存データとの互換性を確保

### 変換レイヤーの役割
1. **データベース→API**: `page_id` → `pageId`に変換
2. **API→データベース**: `pageId` → `page_id`に変換（将来の拡張用）
3. **両方のフィールド名に対応**: `getPageIdFromRecord`で統一

## ⚠️ 注意事項

### データベース再構築が必要
- 既存の`.lancedb`データベースは`pageId`フィールドを使用
- 新しいデータベースでは`page_id`フィールドを使用
- データベース再構築スクリプトの実行が必要

### 残りの作業
- その他のファイルでのpageId参照（影響は少ない）
- テストコードの更新
- データベース再構築スクリプトの実行

## 🧪 次のステップ

1. ローカル環境でテスト実行
2. データベース再構築スクリプトの実行
3. パフォーマンステストの実行
4. 本番環境への適用準備

