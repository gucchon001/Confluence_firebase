# 本番環境スキーマ確認ガイド

**最終更新**: 2025年11月4日  
**目的**: 本番環境（Cloud Storage）のLanceDBスキーマが拡張スキーマ（StructuredLabel統合版）に対応しているか確認する

## 🎯 確認方法

### 推奨方法: スクリプトで確認

```bash
npm run check:production-lancedb-schema
```

このスクリプトは以下を自動実行します：

1. **Cloud Storageから本番環境のデータをダウンロード**
   - 一時ディレクトリ（`.lancedb-production-check`）を作成
   - Cloud StorageからLanceDBデータをダウンロード（約77ファイル）

2. **スキーマを確認**
   - テーブルが存在するか確認
   - スキーマフィールドを一覧表示
   - `structured_*`フィールドの存在を確認

3. **サンプルデータでStructuredLabelを確認**
   - 10件のサンプルデータを取得
   - StructuredLabelが統合されている件数を確認
   - `structured_feature`が設定されている件数を確認

4. **特定のページID（教室削除機能）を確認**
   - ページID `718373062` を検索
   - StructuredLabelが統合されているか確認

5. **クリーンアップ**
   - 一時ディレクトリを自動削除

**実行時間**: 約1-2分（データダウンロード時間を含む）

## 📊 確認結果の見方

### ✅ 正常な状態

```
✅ StructuredLabelフィールドが存在します: 10件
✅ サンプルデータにStructuredLabelが統合されています
✅ このページにはStructuredLabelが統合されています
```

### ❌ 問題がある状態

```
❌ StructuredLabelフィールドが存在しません
⚠️ 拡張スキーマが適用されていない可能性があります
⚠️ このページにはStructuredLabelが統合されていません
```

## 🔧 問題がある場合の対処方法

### 問題1: StructuredLabelフィールドが存在しない

**症状**: `❌ StructuredLabelフィールドが存在しません`

**原因**: 本番環境のデータベースが古いスキーマのまま

**解決方法**:
1. ローカルでマイグレーションを実行
   ```bash
   npm run migrate:lancedb-to-extended-schema
   ```

2. マイグレーション済みデータベースを本番環境にアップロード
   ```bash
   npm run upload:production-data
   ```

3. 本番環境のアプリケーションを再起動（または自動再起動を待つ）

4. 再度確認
   ```bash
   npm run check:production-lancedb-schema
   ```

### 問題2: StructuredLabelが統合されていない

**症状**: `⚠️ サンプルデータにStructuredLabelが統合されていません`

**原因**: 
- FirestoreにStructuredLabelが存在しない
- 通常の同期処理が実行されていない

**解決方法**:
1. FirestoreにStructuredLabelが存在するか確認
   ```bash
   npm run check:firestore-structured-labels
   ```

2. 通常の同期処理を実行（StructuredLabelは自動統合される）
   ```bash
   npm run sync:confluence
   ```

3. マイグレーション済みデータベースを本番環境にアップロード
   ```bash
   npm run upload:production-data
   ```

4. 再度確認
   ```bash
   npm run check:production-lancedb-schema
   ```

## 📋 確認チェックリスト

### 定期的な確認（週1回推奨）

- [ ] 本番環境のスキーマを確認
  ```bash
  npm run check:production-lancedb-schema
  ```

- [ ] StructuredLabelフィールドが存在することを確認

- [ ] サンプルデータにStructuredLabelが統合されていることを確認

- [ ] 特定のページID（教室削除機能）でStructuredLabelが統合されていることを確認

### デプロイ後の確認

- [ ] 本番環境のスキーマを確認
  ```bash
  npm run check:production-lancedb-schema
  ```

- [ ] 検索品質を確認（「教室削除ができないのは何が原因ですか」で検索）

- [ ] ログでStructuredLabelが使用されているか確認

## 🔍 詳細な確認方法

### 1. スキーマの詳細確認

スクリプトの出力で以下を確認：

```
📋 現在のテーブルスキーマ:
  1. id: utf8
  2. page_id: int64
  3. title: utf8
  ...
  18. structured_category: utf8  ← これが存在するか確認
  19. structured_domain: utf8
  20. structured_feature: utf8
  ...
```

### 2. サンプルデータの確認

スクリプトの出力で以下を確認：

```
📊 サンプルデータ分析結果:
  - 総サンプル数: 10件
  - StructuredLabelが統合されている: 5件以上  ← これが0でないことを確認
  - structured_featureが設定されている: 3件以上  ← これが0でないことを確認
```

### 3. 特定ページの確認

スクリプトの出力で以下を確認：

```
✅ ページID 718373062 が見つかりました（2チャンク）
   title: 164_【FIX】教室削除機能
   structured_feature: 教室削除機能  ← これが「空」でないことを確認
   structured_domain: 求人管理  ← これが「空」でないことを確認
   structured_category: spec  ← これが「空」でないことを確認
```

## 🚨 トラブルシューティング

### エラー: Table 'confluence' was not found

**原因**: ダウンロードしたデータの構造が正しくない

**解決方法**:
1. 一時ディレクトリを削除
   ```bash
   Remove-Item -Recurse -Force .lancedb-production-check
   ```

2. 再度実行
   ```bash
   npm run check:production-lancedb-schema
   ```

### エラー: ダウンロードエラー

**原因**: Cloud Storageへのアクセス権限がない、またはネットワークエラー

**解決方法**:
1. 環境変数を確認
   ```bash
   echo $GOOGLE_CLOUD_PROJECT
   echo $STORAGE_BUCKET
   ```

2. 認証情報を確認
   ```bash
   gcloud auth application-default login
   ```

### エラー: スキーマ情報が取得できませんでした

**原因**: LanceDBのバージョンやデータ構造の問題

**解決方法**:
1. サンプルデータの確認結果を参照
2. 特定のページIDの確認結果を参照
3. それでも問題がある場合は、ローカル環境で確認

## 📚 関連ドキュメント

- [拡張スキーマ運用ガイド](./extended-schema-operation-guide.md)
- [Firestoreラベル統合実装サマリー](../analysis/firestore-labels-integration-implementation-summary.md)
- [LanceDBデータ構造仕様書](../implementation/lancedb-data-structure-specification.md)

## 🔗 関連スクリプト

- `npm run check:production-lancedb-schema` - 本番環境のスキーマ確認（このガイド）
- `npm run check:lancedb-table-schema` - ローカル環境のスキーマ確認
- `npm run check:firestore-structured-labels` - Firestoreラベル確認
- `npm run migrate:lancedb-to-extended-schema` - スキーマ拡張とラベル同期
- `npm run upload:production-data` - 本番環境へのアップロード

