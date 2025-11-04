# pageId → page_id マイグレーション実装進捗

## ✅ 完了項目

### 1. スキーマ定義の変更
- ✅ `src/lib/lancedb-schema-extended.ts`: `pageId` → `page_id`
- ✅ `src/lib/lancedb-client.ts`: スキーマ定義とダミーデータの変更

### 2. データベースクエリの変更
- ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
- ✅ `src/lib/lancedb-search-client.ts`: `.where(\`pageId\` = ...)` → `.where(\`page_id\` = ...)`
- ✅ `src/lib/confluence-sync-service.ts`: `chunk.pageId` → `chunk.page_id`

### 3. データ投入部分の変更
- ✅ `src/lib/confluence-sync-service.ts`: `pageId` → `page_id` (データ投入時)
- ✅ `src/lib/lancedb-client.ts`: ダミーデータの変更

### 4. 変換レイヤーの実装
- ✅ `src/lib/pageid-migration-helper.ts`: 新規作成
  - `mapLanceDBRecordToAPI`: 単一レコードの変換
  - `mapLanceDBRecordsToAPI`: 複数レコードの変換
  - `mapAPIToDatabaseRecord`: API→データベースの変換
  - `getPageIdFromRecord`: 両方のフィールド名に対応したpageId取得

### 5. 変換レイヤーの適用
- ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: `getAllChunksByPageIdInternal`で変換レイヤー適用
- ✅ `src/lib/lancedb-search-client.ts`: `fetchPageFromLanceDB`で変換レイヤー適用
- ✅ `src/ai/flows/retrieve-relevant-docs-lancedb.ts`: `getPageIdFromRecord`を使用してpageId取得を統一

## ⚠️ 残りの作業

### 1. その他のファイルでのpageId参照
- ⏳ `src/lib/lancedb-search-client.ts`: 他のpageId参照箇所（643行目など）
- ⏳ `src/lib/confluence-sync-service.ts`: データ構造内のpageId参照
- ⏳ その他のファイルでのpageId参照

### 2. 型定義の確認
- ⏳ 型定義ファイルでのpageId使用箇所（APIレスポンスでは維持）
- ⏳ 内部型定義でのpage_idへの変更

### 3. テスト
- ⏳ ユニットテストの更新
- ⏳ インテグレーションテストの更新
- ⏳ パフォーマンステストの実行

## 📝 注意事項

### API互換性
- APIレスポンスでは`pageId`を維持（変換レイヤーで対応）
- 内部処理では`page_id`を使用
- `getPageIdFromRecord`を使用して両方のフィールド名に対応

### データベース再構築
- 既存のデータベースは`pageId`フィールドを使用しているため、再構築が必要
- 新しいデータベースでは`page_id`フィールドを使用
- マイグレーションスクリプトの実行が必要

## 🔄 次のステップ

1. 残りのpageId参照箇所の確認と更新
2. 型定義の確認と更新
3. テストの実行と確認
4. データベース再構築の実行
5. 本番環境への適用

