# 残りのpageId参照箇所の更新サマリー

## ✅ 完了した更新

### 1. データベースクエリ関連
- ✅ `src/lib/lancedb-utils.ts`: `getRowsByPageId` - `pageId` → `page_id`、変換レイヤー適用
- ✅ `src/lib/pageid-utils.ts`: `buildPageIdEqualityWhere` - `pageId` → `page_id`
- ✅ `src/lib/confluence-sync-service.ts`: 削除・更新処理 - `pageId` → `page_id`

### 2. データ取得・変換
- ✅ `src/lib/lunr-initializer.ts`: `getPageIdFromRecord`を使用
- ✅ `src/lib/title-search-service.ts`: `getPageIdFromRecord`を使用（完全一致・部分一致）
- ✅ `src/lib/lancedb-search-client.ts`: 
  - `deduplicateByPageId` - 非同期対応、`getPageIdFromRecord`を使用
  - `expandTitleResultsWithKG` - `getPageIdFromRecord`を使用
  - BM25結果マッピング - `getPageIdFromRecord`を使用

### 3. キャッシュ・ユーティリティ
- ✅ `src/lib/answer-cache.ts`: `getPageIdFromRecord`を使用（同期処理のため`require`を使用）

## 📊 更新統計

- **更新ファイル数**: 8ファイル
- **リンターエラー**: 0件（すべて解消済み）
- **主要な変更**:
  - データベースクエリ: `pageId` → `page_id`
  - データ取得: `getPageIdFromRecord`を使用（両方のフィールド名に対応）
  - 変換レイヤー: データベース→APIの変換を適用

## 🔄 実装方針

### データベースクエリ
- **クエリ条件**: `pageId` → `page_id`に変更
- **結果変換**: `mapLanceDBRecordsToAPI`を使用して`page_id` → `pageId`に変換

### データ取得
- **統一関数**: `getPageIdFromRecord`を使用
- **対応範囲**: `page_id`と`pageId`の両方に対応

### 同期処理
- **`answer-cache.ts`**: 同期処理のため`require`を使用（`await import`の代わり）

## ⚠️ 注意事項

### 非同期処理の対応
- `deduplicateByPageId`を非同期関数に変更
- 呼び出し側で`await`を追加

### インポートタイミング
- 非同期関数内では`await import`を使用
- 同期関数内では`require`を使用

## 🎯 次のステップ

1. テストの実行と確認
2. データベース再構築スクリプトの実行
3. 本番環境への適用準備

