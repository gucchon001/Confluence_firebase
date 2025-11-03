# Cloud Storage上の古いLanceDBファイルのクリーンアップガイド

## 現状分析

### 確認結果
- **総ファイル数**: 48,525
- **最新ファイル**（2025-11-02以降）: 3,592 ✅
- **古いファイル**（2025-11-02以前）: 44,933 ⚠️
- **削除対象サイズ**: 約238.82 MB

### カテゴリ別の古いファイル数
- `_indices/`: 18ファイル (14.62 MB)
- `_transactions/`: 22,459ファイル (2.97 MB)
- `_versions/`: 80ファイル (7.68 MB)
- `data/`: 22,376ファイル (213.55 MB)

## 重要な注意事項

### LanceDBの動作について

**重要**: LanceDBは最新の`_versions`マニフェストを読み込んでデータをロードします。

- **最新ファイル**: `_versions/`配下の最新マニフェスト（2025-11-02以降）が使用される
- **古いファイル**: 理論的には使用されないが、ディスク容量を消費する

### 削除のリスク

1. **マニフェストの不整合**: 古いマニフェストを参照するファイルを削除すると、データの読み込みに失敗する可能性
2. **バージョン履歴の喪失**: 過去のバージョンに戻れなくなる
3. **削除の取り返し**: 一度削除したファイルは復元できない

## クリーンアップ方法

### 方法1: 安全な手動削除（推奨）

#### ステップ1: 最新ファイルを確認
```bash
npm run check:cloud-storage-lancedb
```

#### ステップ2: 古いトランザクションファイルを削除
Cloud Consoleで以下を削除：
```
https://console.cloud.google.com/storage/browser/confluence-copilot-data/lancedb/confluence.lance/_transactions
```

**削除基準**: 2025-11-02以前の`*.txn`ファイル

#### ステップ3: 古いバージョンマニフェストを削除
最新のマニフェストを確認してから、古いものを削除：
```
https://console.cloud.google.com/storage/browser/confluence-copilot-data/lancedb/confluence.lance/_versions
```

**注意**: 最新のマニフェスト（2025-11-02以降）は残す

#### ステップ4: 古いデータファイルを削除（慎重に）
最新のマニフェストが参照していないデータファイルのみ削除：
```
https://console.cloud.google.com/storage/browser/confluence-copilot-data/lancedb/confluence.lance/data
```

**注意**: 最新のマニフェストが参照しているファイルは絶対に削除しない

### 方法2: gcloudコマンドで一括削除（上級者向け）

#### 古いトランザクションファイルを削除
```bash
# 2025-11-02以前のトランザクションファイルを削除
gcloud storage rm gs://confluence-copilot-data/lancedb/confluence.lance/_transactions/*.txn \
  --condition="timeCreated < 2025-11-02T00:00:00Z"
```

#### 古いバージョンマニフェストを削除
```bash
# 最新のマニフェストを確認
gcloud storage ls gs://confluence-copilot-data/lancedb/confluence.lance/_versions/ \
  --sort-by=timeCreated \
  --format="value(name,timeCreated)"

# 2025-11-02以前のマニフェストを削除（最新は残す）
gcloud storage rm gs://confluence-copilot-data/lancedb/confluence.lance/_versions/*.manifest \
  --condition="timeCreated < 2025-11-02T00:00:00Z" \
  --exclude="*5.manifest"  # 最新のマニフェストは除外
```

**⚠️ 警告**: この方法は破壊的です。実行前に必ずバックアップを確認してください。

### 方法3: 完全削除と再アップロード（最も安全）

#### ステップ1: 古いデータを完全削除
```bash
# 注意: この操作は不可逆です
gcloud storage rm gs://confluence-copilot-data/lancedb/confluence.lance/** \
  --recursive
```

#### ステップ2: 最新のデータベースを再アップロード
```bash
npm run upload:production-data
```

**メリット**:
- 完全にクリーンな状態になる
- 古いファイルが混在しない
- 確実に最新のスキーマが使われる

**デメリット**:
- ダウンタイムが発生する可能性
- 過去のバージョン履歴が失われる

## 推奨アプローチ

### 最優先: トランザクションファイルの削除

古いトランザクションファイル（22,459ファイル）は安全に削除できます。

```bash
# 2025-11-02以前のトランザクションファイルを削除
gcloud storage rm gs://confluence-copilot-data/lancedb/confluence.lance/_transactions/*.txn \
  --condition="timeCreated < 2025-11-02T00:00:00Z"
```

### 次: 古いバージョンマニフェストの削除

最新のマニフェストを確認してから、古いものを削除：

```bash
# 最新のマニフェストを確認
gcloud storage ls gs://confluence-copilot-data/lancedb/confluence.lance/_versions/*.manifest \
  --sort-by=timeCreated

# 最新を除いて古いマニフェストを削除
# （注意: 最新のマニフェストの番号を確認してから実行）
```

### 最後: データファイルの削除（慎重に）

最新のマニフェストが参照していないデータファイルのみ削除。

**注意**: この操作は慎重に行う必要があります。最新のマニフェストが参照しているファイルは削除しないでください。

## 確認方法

### クリーンアップ後の確認
```bash
npm run check:cloud-storage-lancedb
```

**期待される結果**:
- 最新ファイルのみが存在する
- 総ファイル数が大幅に減少する（約3,600ファイル程度）
- 最新更新日時が2025-11-02以降である

## ロールバック

問題が発生した場合：
1. Cloud Storageのバージアップから復元
2. または、最新のデータベースを再アップロード
   ```bash
   npm run upload:production-data
   ```

