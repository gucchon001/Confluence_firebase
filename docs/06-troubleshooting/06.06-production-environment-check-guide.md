# Cloud Run本番環境のファイルシステム・ライブラリ確認ガイド

**作成日**: 2025-11-02  
**目的**: 本番環境のLanceDBファイルとライブラリバージョンを確認

## 概要

現在の本番環境（Cloud Run）では以下の設定になっています：

- **SKIP_DATA_DOWNLOAD**: `false` → ビルド時にCloud Storageからダウンロード
- **USE_INMEMORY_FS**: `false` → 通常のファイルシステムを使用
- **実行環境**: Cloud Run Gen1（デフォルト）

データはビルド時に `.lancedb/` ディレクトリにダウンロードされ、実行時にこのディレクトリから読み込まれます。

## ローカル環境の確認結果

### LanceDBライブラリバージョン

```bash
$ npm list @lancedb/lancedb --depth=0
nextn@0.1.0 C:\dev\CODE\Confluence_firebase
`-- @lancedb/lancedb@0.22.1
```

**ローカル環境のバージョン**: `0.22.1`

### ローカル環境のLanceDBファイル

- **ベクトル次元数**: 768次元 ✅
- **総レコード数**: 1,229件
- **スキーマ**: `FixedSizeList(768, Float32)`
- **ファイルサイズ**: 約50MB（推定）

## 本番環境での確認手順

### 方法1: Cloud Run Logsで確認（推奨）

**Cloud Logging URL**:
```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

詳細なクエリは `docs/troubleshooting/cloud-logging-check-commands.md` を参照。

#### 1-1. ベクトル検索エラーを確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Vector Search.*Error"
timestamp>="2025-11-01T00:00:00Z"
```

#### 1-2. ビルド時のダウンロードログ

```logql
resource.type="cloud_run_revision"
textPayload=~"Downloading.*lancedb"
timestamp>="2025-11-01T00:00:00Z"
```

期待されるログ:
```
📥 Downloading lancedb/confluence.lance -> .lancedb/confluence.lance
✅ Downloaded XXX files
```

#### 1-3. 実行時のLanceDB接続ログ

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"OptimizedLanceDBClient.*Connecting"
timestamp>="2025-11-01T00:00:00Z"
```

期待されるログ:
```
[OptimizedLanceDBClient] Connecting to database at: /workspace/.lancedb
[OptimizedLanceDBClient] Database connected
[OptimizedLanceDBClient] Opened existing table 'confluence'
```

#### 1-4. データチェック結果

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"データチェック結果"
timestamp>="2025-11-01T00:00:00Z"
```

### 方法2: 一時的にデバッグコードを追加

以下のコードを本番に一時的に追加してデプロイ：

```typescript
// src/lib/optimized-lancedb-client.ts の _performConnection() メソッド内
private async _performConnection(): Promise<LanceDBConnection> {
  const startTime = Date.now();
  
  try {
    console.log(`[OptimizedLanceDBClient] Connecting to database at: ${this.config.dbPath}`);
    
    // ★★★ デバッグ: ファイルシステム確認 ★★★
    const fs = require('fs');
    const path = require('path');
    console.log('[DEBUG] Checking file system...');
    
    const dbDir = this.config.dbPath;
    if (fs.existsSync(dbDir)) {
      console.log(`✅ [DEBUG] Database directory exists: ${dbDir}`);
      const files = fs.readdirSync(dbDir);
      console.log(`[DEBUG] Files in directory: ${files.length} files`);
      files.slice(0, 10).forEach((file: string) => {
        const filePath = path.join(dbDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file}: ${stats.size} bytes`);
      });
    } else {
      console.error(`❌ [DEBUG] Database directory NOT found: ${dbDir}`);
    }
    
    // データベースに接続
    const db = await lancedb.connect(this.config.dbPath);
    console.log(`[OptimizedLanceDBClient] Database connected in ${Date.now() - startTime}ms`);
    
    // テーブルの存在確認
    let table: lancedb.Table;
    try {
      table = await db.openTable(this.config.tableName);
      console.log(`[OptimizedLanceDBClient] Opened existing table '${this.config.tableName}'`);
      
      // ★★★ デバッグ: スキーマ確認 ★★★
      const schema = table.schema;
      console.log('[DEBUG] Table schema:', JSON.stringify(schema, null, 2));
      
      const fields = schema.fields;
      const vectorField = fields.find((f: any) => f.name === 'vector');
      if (vectorField) {
        console.log('[DEBUG] Vector field found:', {
          name: vectorField.name,
          type: vectorField.type?.toString(),
          nullable: vectorField.nullable
        });
      } else {
        console.error('[DEBUG] ❌ Vector field NOT found in schema!');
        console.error('[DEBUG] Available fields:', fields.map((f: any) => f.name).join(', '));
      }
    } catch (error) {
      // ... 既存のエラーハンドリング
    }
    
    // ... 既存のコード
    
  } catch (error) {
    // ... 既存のエラーハンドリング
  }
}
```

### 方法3: Cloud Runのデバッグ用コンテナを起動（最も確実）

以下のシェルスクリプトを実行して本番環境の状態を確認：

```bash
# scripts/check-production-filesystem.sh を使用

# Cloud RunにSSH接続またはデバッグコンテナを起動
# その後、以下のコマンドを実行：

# 1. ファイルシステム確認
ls -lhR .lancedb/

# 2. ライブラリバージョン確認
npm list @lancedb/lancedb

# 3. スキーマ確認
npx tsx src/scripts/check-table-schema.ts
```

## チェックリスト

本番環境で確認すべき項目：

### ファイルシステム

- [ ] `.lancedb/` ディレクトリが存在する
- [ ] `.lancedb/confluence.lance/` ディレクトリが存在する
- [ ] ファイルサイズが0バイトではない
- [ ] 必要な全ファイルが存在する
- [ ] ファイルのパーミッションが適切（読み取り可能）

### ライブラリバージョン

- [ ] `@lancedb/lancedb` がインストールされている
- [ ] バージョンが `0.22.1` である（ローカルと一致）
- [ ] `package-lock.json` と一致している

### スキーマ

- [ ] テーブル `confluence` が存在する
- [ ] `vector` 列が存在する
- [ ] ベクトル次元数が 768 である
- [ ] データレコード数が 1,229 件である

## 予想される問題パターン

### パターン1: ファイルが存在しない

**症状**: `[OptimizedLanceDBClient] Database directory NOT found`

**原因**: 
- ビルド時のダウンロードが失敗した
- ビルドが不完全だった

**確認方法**:
- Cloud Runのビルドログを確認

**解決方法**:
- 再ビルド＆再デプロイ

### パターン2: ファイルは存在するが空

**症状**: ファイルサイズが0バイト

**原因**:
- ダウンロードは開始されたが完了しなかった
- ネットワークエラー

**確認方法**:
- ファイルサイズを確認

**解決方法**:
- Cloud Storageのファイルを確認し、再アップロード

### パターン3: ライブラリバージョンが異なる

**症状**: ローカルでは動作するが本番でエラー

**原因**:
- `package-lock.json` が同期されていない
- 本番のビルドキャッシュ

**確認方法**:
- `npm list @lancedb/lancedb` で本番のバージョンを確認

**解決方法**:
- `package-lock.json` を修正
- クリーンビルド

### パターン4: スキーマが異なる

**症状**: `No vector column found`

**原因**:
- 古いデータが残っている
- テーブルの再作成が発生した

**確認方法**:
- スキーマ情報をログ出力

**解決方法**:
- データを再構築して再アップロード

## 次のステップ

本番環境の状態を確認したら、結果を以下に記録：

1. ファイルの存在とサイズ
2. ライブラリバージョン
3. スキーマ情報
4. エラー発生時の詳細ログ

これらの情報を元に、原因を特定して修正方針を決定します。

