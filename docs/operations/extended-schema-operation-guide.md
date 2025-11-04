# 拡張スキーマ運用ガイド

**最終更新**: 2025年11月4日  
**対象**: LanceDB拡張スキーマ（StructuredLabel統合版）の運用

## 📋 概要

このドキュメントでは、拡張スキーマ（`structured_*`フィールドを含む）が適用されたLanceDBの運用方法を説明します。

## ✅ 現在の状態

### スキーマ
- ✅ **基本フィールド**: `page_id`, `title`, `content`, `vector`, など
- ✅ **StructuredLabelフィールド**: `structured_category`, `structured_domain`, `structured_feature`, など
- ✅ **インデックス**: ベクトルインデックス（IVF_PQ）、`page_id`スカラーインデックス（制約により作成されない場合あり）

### 統合機能
- ✅ **通常の同期プロセス**: `confluence-sync-service.ts`が自動的にFirestoreからStructuredLabelを取得して統合
- ✅ **マイグレーションスクリプト**: インデックス再作成とラベル同期機能を内蔵

## 🔄 日常的な運用

### 1. 通常の同期処理

**通常の同期処理では、追加の作業は不要です。**

`confluence-sync-service.ts`が自動的に以下を実行します：

1. Confluenceからページを取得
2. **FirestoreからStructuredLabelを取得**（ページ単位で1回のみ）
3. StructuredLabelをフラット化
4. LanceDBに統合して保存

**実行方法**:
```bash
# 通常の同期処理（StructuredLabelは自動統合される）
npm run sync:confluence
# または
npm run complete-pipeline
```

### 2. 新しいページの追加

新しいページを追加する場合：

```bash
# 通常の同期処理を実行
npm run sync:confluence
```

**自動処理される内容**:
- Confluenceからページを取得
- FirestoreからStructuredLabelを取得（存在する場合）
- LanceDBにStructuredLabelを統合して保存

**注意**: 新しいページにStructuredLabelが存在しない場合は、`structured_*`フィールドは空文字列や0になります。

### 3. 既存ページの更新

既存ページを更新する場合：

```bash
# 通常の同期処理を実行（差分更新）
npm run sync:confluence
```

**自動処理される内容**:
- 変更されたページのみを更新
- Firestoreから最新のStructuredLabelを取得
- LanceDBの既存レコードを更新

## 🔧 メンテナンス作業

### 1. インデックスの再作成

**必要になる場合**:
- テーブルを再作成した後
- インデックスが破損した場合
- パフォーマンスが低下した場合

**実行方法**:
```bash
npm run lancedb:create-indexes
```

**確認方法**:
```bash
npm run lancedb:check-indexes
```

### 2. スキーマ拡張の再適用

**必要になる場合**:
- 新しいStructuredLabelフィールドを追加する場合
- テーブルが古いスキーマのままの場合

**実行方法**:
```bash
npm run migrate:lancedb-to-extended-schema
```

**このスクリプトは以下を自動実行**:
1. 既存データをバックアップ
2. テーブルを削除
3. 新しいスキーマでテーブルを再作成
4. データを復元
5. **インデックスを再作成**
6. **FirestoreからStructuredLabelを同期**

### 3. ラベルの手動同期

**必要になる場合**:
- FirestoreのStructuredLabelを更新した後、LanceDBに即座に反映したい場合
- 通常の同期プロセスでラベルが反映されていない場合

**実行方法**:
```bash
# マイグレーションスクリプトを実行（ラベル同期機能を含む）
npm run migrate:lancedb-to-extended-schema

# または、通常の同期処理を実行（StructuredLabelは自動統合される）
npm run sync:confluence
```

**注意**: 通常の同期処理（`confluence-sync-service.ts`）が自動的にStructuredLabelを統合するため、手動同期は通常不要です。

## 📊 データ確認

### 1. ローカル環境のスキーマ確認

```bash
npm run check:lancedb-table-schema
```

**確認項目**:
- `structured_*`フィールドが存在するか
- データ件数が正しいか

### 2. 本番環境のスキーマ確認（推奨）

```bash
npm run check:production-lancedb-schema
```

**確認項目**:
- Cloud Storageから本番環境のデータをダウンロード
- `structured_*`フィールドが存在するか
- サンプルデータでStructuredLabelが統合されているか
- 特定のページID（教室削除機能）でStructuredLabelが統合されているか

**実行時間**: 約1-2分（データダウンロード時間を含む）

**注意**: このスクリプトは一時ディレクトリ（`.lancedb-production-check`）を作成し、確認後に自動的にクリーンアップします。

### 2. インデックスの確認

```bash
npm run lancedb:check-indexes
```

**確認項目**:
- ベクトルインデックスが存在するか
- スカラーインデックスが存在するか

### 3. Firestoreラベルの確認

```bash
npm run check:firestore-structured-labels
```

**確認項目**:
- FirestoreにStructuredLabelが存在するか
- 特定のページIDに関連するラベルがあるか

## 🚨 トラブルシューティング

### 問題1: StructuredLabelが反映されない

**症状**: LanceDBに`structured_*`フィールドが空のまま

**原因**:
1. FirestoreにStructuredLabelが存在しない
2. 通常の同期処理が実行されていない
3. テーブルが古いスキーマのまま

**解決方法**:
```bash
# 1. FirestoreにStructuredLabelが存在するか確認
npm run check:firestore-structured-labels

# 2. 通常の同期処理を実行（StructuredLabelは自動統合される）
npm run sync:confluence

# 3. それでも反映されない場合は、マイグレーションスクリプトを実行
npm run migrate:lancedb-to-extended-schema
```

### 問題2: インデックスが存在しない

**症状**: 検索パフォーマンスが低下

**原因**:
- テーブルを再作成した後、インデックスを再作成していない

**解決方法**:
```bash
# インデックスを再作成
npm run lancedb:create-indexes

# 確認
npm run lancedb:check-indexes
```

### 問題3: スキーマエラー

**症状**: `Found field not in schema: structured_*`エラー

**原因**:
- テーブルが古いスキーマのまま
- 拡張スキーマが適用されていない

**解決方法**:
```bash
# マイグレーションスクリプトを実行
npm run migrate:lancedb-to-extended-schema
```

### 問題4: パフォーマンスが低下

**症状**: 検索が遅い（5秒以上）

**原因**:
- インデックスが存在しない
- インデックスが破損している

**解決方法**:
```bash
# 1. インデックスを確認
npm run lancedb:check-indexes

# 2. インデックスを再作成
npm run lancedb:create-indexes

# 3. パフォーマンスを再テスト
```

## 📝 運用フロー

### 通常運用（推奨）

```
1. 通常の同期処理を実行
   → npm run sync:confluence
   → StructuredLabelは自動統合される

2. 定期的にインデックスを確認
   → npm run lancedb:check-indexes

3. 問題があれば対処
   → インデックス再作成: npm run lancedb:create-indexes
   → マイグレーション: npm run migrate:lancedb-to-extended-schema
```

### 新規ページ追加時

```
1. Confluenceに新しいページを追加

2. 通常の同期処理を実行
   → npm run sync:confluence
   → StructuredLabelは自動統合される

3. FirestoreにStructuredLabelを追加（オプション）
   → 手動で追加、または自動生成スクリプトを実行

4. 必要に応じて再同期
   → npm run sync:confluence
```

### メンテナンス時

```
1. データをバックアップ（自動）
   → マイグレーションスクリプトが自動的にバックアップ

2. マイグレーションスクリプトを実行
   → npm run migrate:lancedb-to-extended-schema
   → インデックス再作成とラベル同期が自動実行される

3. 本番環境にアップロード
   → npm run upload:production-data
```

## 🎯 ベストプラクティス

### 1. 定期的な確認

- **週1回**: インデックスの状態を確認
- **月1回**: スキーマの状態を確認
- **必要に応じて**: Firestoreラベルの状態を確認

### 2. バックアップ

- マイグレーションスクリプトは自動的にバックアップを保存
- バックアップファイル: `.lancedb-backup/confluence-backup.json`

### 3. パフォーマンス監視

- 検索時間が5秒以上かかる場合は、インデックスを確認
- 定期的にパフォーマンステストを実行

### 4. エラーハンドリング

- エラーが発生した場合は、ログを確認
- バックアップから復元可能: `npm run restore:lancedb-backup`

## 📚 関連ドキュメント

- [LanceDBデータ構造仕様書](../implementation/lancedb-data-structure-specification.md)
- [Firestoreラベル統合実装サマリー](../analysis/firestore-labels-integration-implementation-summary.md)
- [インデックス作成ガイド](../troubleshooting/index-creation-completed.md)

## 🔗 関連スクリプト

### 同期・マイグレーション
- `npm run sync:confluence` - 通常の同期処理（StructuredLabel自動統合）
- `npm run migrate:lancedb-to-extended-schema` - スキーマ拡張とラベル同期
- `npm run upload:production-data` - 本番環境へのアップロード

### インデックス管理
- `npm run lancedb:create-indexes` - インデックス再作成
- `npm run lancedb:check-indexes` - インデックス確認

### データ確認
- `npm run check:lancedb-table-schema` - ローカル環境のスキーマ確認
- `npm run check:production-lancedb-schema` 🌟 **NEW** - 本番環境のスキーマ確認（推奨）
- `npm run check:firestore-structured-labels` - Firestoreラベル確認

