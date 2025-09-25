# デバッグファイル説明

## 📁 このディレクトリについて
このディレクトリには、ラベル機能の修復とテスト中に作成された一時的なデバッグファイルが含まれています。

## 📋 ファイル一覧

### ラベル機能テスト
- `test-label-extraction-simple.ts` - シンプルなラベル抽出テスト（推奨）
- `test-fixed-label-extraction.ts` - 修正版ラベル抽出テスト
- `test-search-with-labels.ts` - 検索機能でのラベルフィルタリングテスト

### データベース確認
- `check-db-status.ts` - データベース状況確認（有用、保持推奨）
- `verify-labels-during-sync.ts` - 同期中のラベル確認

### API接続テスト
- `debug-api-call.ts` - Confluence API接続デバッグ（有用、保持推奨）
- `test-env-loading.ts` - 環境変数読み込みテスト
- `test-existing-pages.ts` - 既存ページのAPI接続テスト

### 一時的デバッグファイル（削除候補）
- `fix-undefined-issue.ts` - undefined問題修正用（完了済み）
- `fixed-confluence-sync.ts` - 修正版同期テスト（完了済み）
- `label-debug-environment.ts` - ラベルデバッグ環境（完了済み）
- `simple-label-debug.ts` - シンプルラベルデバッグ（完了済み）
- `test-existing-data-undefined.ts` - 既存データundefinedテスト（完了済み）

## 🗑️ 削除推奨ファイル
以下のファイルは目的を達成しており、削除可能です：
- `fix-undefined-issue.ts`
- `fixed-confluence-sync.ts`
- `label-debug-environment.ts`
- `simple-label-debug.ts`
- `test-existing-data-undefined.ts`

## 📁 保持推奨ファイル
以下のファイルは将来的にも有用なため保持を推奨します：
- `check-db-status.ts`
- `debug-api-call.ts`
- `test-label-extraction-simple.ts`
- `test-search-with-labels.ts`
