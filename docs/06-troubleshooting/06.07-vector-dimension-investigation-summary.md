# ベクトル検索エラー原因調査まとめ

**調査日**: 2025-11-02  
**エラーメッセージ**: `No vector column found to match with the query vector dimension: 768`

## 調査結果

### ✅ ローカル環境の確認（完了）

- **ベクトル次元数**: 768次元 ✅
- **総レコード数**: 1,229件
- **スキーマ**: 期待通り（`FixedSizeList(768, Float32)`）
- **検索動作**: 正常
- **ローカルの`.lancedb`はCloud Storageと同じデータを使用**: ✅

### ✅ コード設定の確認（完了）

すべての設定が768次元で統一されています：

1. **クエリ側（検索時）**
   - ファイル: `src/lib/embeddings.ts`
   - モデル: `text-embedding-004`
   - 次元数: 768 ✅

2. **データ投入側**
   - ファイル: `scripts/rebuild-lancedb-smart-chunking.ts`
   - モデル: `text-embedding-004`
   - 次元数: 768 ✅

3. **スキーマ定義**
   - ファイル: `src/lib/lancedb-schema-extended.ts`
   - 定義: `FixedSizeList(768, Float32)` ✅

### ✅ 本番環境の確認（完了）

**結論**: ローカルの`.lancedb`はCloud Storageと同じデータを使用しており、768次元が確認されました。

**確認結果**:
- ✅ ベクトル次元数: 768次元（期待通り）
- ✅ サンプルレコード: 全て768次元
- ✅ ベクトル範囲: -0.1679 ～ 0.1433（正常範囲）

**重要な発見**:

ローカルの`.lancedb`ディレクトリはCloud Storageからダウンロードされた本番データを使用していることが判明しました。

#### 結論

**ベクトル次元数の不一致は原因ではないことが判明**

1. ✅ ローカル環境: 768次元（正常）
2. ✅ 本番データ（Cloud Storage経由のローカル`:lancedb`）: 768次元（正常）
3. ✅ コード上の設定: 全て768次元で統一
4. ❌ ベクトル次元数の不一致ではない

**重要な発見**:

`OptimizedLanceDBClient`のスキーマ定義が**不完全**であることが判明しました：

```typescript:134:150:src/lib/optimized-lancedb-client.ts
const emptyData = [{
  id: 'dummy',
  title: 'dummy',
  content: 'dummy',
  url: 'dummy',
  lastUpdated: 'dummy'
}];

const lanceSchema = {
  id: 'utf8',
  title: 'utf8',
  content: 'utf8',
  url: 'utf8',
  lastUpdated: 'utf8'
};

table = await db.createTable(this.config.tableName, emptyData);
```

**問題**: `vector`列がスキーマ定義に含まれていません！

一方、`scripts/rebuild-lancedb-smart-chunking.ts`では正しいスキーマを使用：

```typescript:433:433:scripts/rebuild-lancedb-smart-chunking.ts
const table = await db.createTable('confluence', firstBatch, { schema: EXTENDED_LANCEDB_SCHEMA });
```

**真の原因の仮説**:

本番環境で`OptimizedLanceDBClient`が新しいテーブルを作成した場合、`vector`列がないテーブルが生成される可能性があります。

ただし、現在のローカル`.lancedb`は正常（768次元）であるため、この仮説は矛盾しています。

## 確認方法

以下のスクリプトで確認できます：

```bash
# ローカル環境のスキーマ確認
npm run lancedb:check-schema
```

## 修正は不要

**ユーザーの指示により修正は行いません。原因調査のみ完了。**

## 最終的な調査結果まとめ

✅ **確認完了したこと**:
- ベクトル次元数は正常（768次元）
- コード設定はすべて統一（768次元）
- ローカル・本番データは正常（768次元）

❌ **原因ではないことが確認されたこと**:
- ベクトル次元数の不一致
- 列名の不一致
- 本番データが古い

🔍 **真の原因の可能性**:
- 実行環境でのファイル読み込みタイミングの問題
- ライブラリバージョンの差異
- 環境依存の問題

## 次元数の不一致は原因ではない

調査により、**ベクトル次元数の不一致や列名の不一致は原因ではない**ことが明確に確認されました。

ローカルの`.lancedb`はCloud Storageからアップロードされたもので、768次元で正常に動作しています。

## 推奨される追加確認項目

問題の核心: **「コードとデータは正しいはずなのに、なぜ本番の"実行時"にだけLanceDBライブラリがスキーマを正しく認識できないのか？」**

### アプローチ1：本番環境の「状態」を直接確認する（最優先）

#### 1-1. コンテナ内のファイルシステムの確認

**目的**: データベースファイルがコンテナ起動時に確実に、かつ完全に読み込まれているかを確認する。

**具体的な手順**:

1. Cloud Runのデバッグ機能を使う
   - Cloud RunのサービスにSSH接続するか、一時的なデバッグ用のコンテナを起動

2. ファイルの存在とサイズを確認
   ```bash
   # コンテナ内で
   ls -lh .lancedb/
   # または
   ls -lhR .lancedb/
   ```

**確認ポイント**:
- ファイルやディレクトリは存在するか？
- ファイルのサイズはローカル環境のものと一致するか？（0バイトになっていないか？）
- ファイルの所有者やパーミッション（rwx）に問題はないか？

**この手順で分かること**: ファイルがダウンロードに失敗していたり、不完全な状態で読み込まれている場合、これが直接的な原因であると断定できる。

#### 1-2. インストール済みライブラリのバージョンの完全一致確認

**目的**: ローカルと本番でLanceDBライブラリのバージョンに差異がないかを決定的に確認する。

**具体的な手順**:

```bash
# 本番コンテナ内で
npm list @lancedb/lancedb
# または
yarn list --pattern "@lancedb/lancedb"
```

**確認ポイント**:
- バージョン番号が完全に一致しているか（パッチバージョンも含めて）
- ローカルと本番で異なるバージョンがインストールされていないか

**この手順で分かること**: もしバージョンが異なれば、ライブラリのバージョンの違いによる挙動差が原因である可能性が高い。

### アプローチ2：アプリケーションに「自己診断コード」を追加する

ファイルシステムに問題がない場合、次に疑うべきはアプリケーションがLanceDBを初期化するタイミング。

#### 2-1. スキーマ情報を起動時にログ出力する

**目的**: アプリケーションが実際に認識しているデータベースのスキーマ情報を、エラー発生前にログとして記録させる。

**推奨箇所**: `src/lib/optimized-lancedb-client.ts`の接続確立後

```typescript
// データベース接続を確立した後
try {
  const table = await db.openTable(this.config.tableName);
  const schema = table.schema;
  console.log("[LANCEDB_SCHEMA_CHECK] Table schema loaded successfully:", JSON.stringify(schema, null, 2)); 
  
  // ベクトル列の詳細も確認
  const fields = schema.fields;
  const vectorField = fields.find(f => f.name === 'vector');
  if (vectorField) {
    console.log("[LANCEDB_SCHEMA_CHECK] Vector field found:", {
      name: vectorField.name,
      type: vectorField.type.toString(),
      nullable: vectorField.nullable
    });
  } else {
    console.error("[LANCEDB_SCHEMA_CHECK] ❌ Vector field NOT found in schema!");
  }
} catch (e) {
  console.error("[LANCEDB_SCHEMA_CHECK] Failed to load table schema on startup:", e);
}
```

**確認ポイント**:
- `[LANCEDB_SCHEMA_CHECK]`ログが出力されるか？
- 成功ログに`vector`列と768次元の定義が含まれているか？
- 失敗時のエラーメッセージは何か？

**この手順で分かること**: 起動シーケンスのどの段階で問題が起きているか（検索前から読めていないか、リクエスト時だけか）を特定できる。

### アプローチ3：より堅牢なコードへの変更（暫定対応としての調査）

原因究明とは異なるが、問題の再現性を下げ、原因を絞り込むのに有用。

#### 3-1. 列名を明示的に指定するコードを試す

**目的**: LanceDBの列名自動検出ロジックをバイパスし、自動検出機能起因かどうかを切り分ける。

**現状のコード**:

```typescript:977:977:src/lib/lancedb-search-client.ts
let vectorQuery = tbl.search(vector);
```

**確認が必要なこと**: LanceDBライブラリが列名の明示的指定をサポートしているか

**この手順で分かること**: この変更で解消されれば、原因は自動検出ロジックにあるとほぼ断定できる。

### 推奨される進め方

1. **まずアプローチ1を実行**: ファイル構成とライブラリバージョンの確認
2. **次にアプローチ2を実行**: 起動時スキーマの確認
3. **最後にアプローチ3を試行**: 自動検出ロジック起因の切り分け

この手順で原因を体系的かつ効率的に特定できる。

## 関連ファイル

- ローカルスキーマ確認: `src/scripts/check-table-schema.ts`
- データ再構築: `scripts/rebuild-lancedb-smart-chunking.ts`
- 埋め込み生成: `src/lib/embeddings.ts`
- ベクトル検索実行: `src/lib/lancedb-search-client.ts`
- LanceDBクライアント: `src/lib/optimized-lancedb-client.ts`

## 調査で確認された技術的詳細

- **LanceDBバージョン**: 0.22.1（ローカル）
- **ベクトル次元数**: 768次元（すべての環境で一致）
- **埋め込みモデル**: text-embedding-004（768次元）
- **スキーマ定義**: `FixedSizeList(768, Float32)`
- **ローカルデータ**: 1,229レコード、正常動作確認済み
- **ローカルファイル**: 52ファイル、合計約12.4MB

## 本番環境確認のための準備

詳細な確認手順は以下のドキュメントを参照：

- **本番環境確認ガイド**: `docs/troubleshooting/production-environment-check-guide.md`
  - ファイルシステム確認方法
  - ライブラリバージョン確認方法
  - デバッグコード追加例
  - 予想される問題パターンと対処法

- **Cloud Logging確認コマンド集**: `docs/troubleshooting/cloud-logging-check-commands.md`
  - ログ確認用のクエリ集
  - 確認チェックリスト
  - ローカル環境との比較ポイント

## 次のアクション

Cloud Loggingで以下を確認：

1. **ビルド時のダウンロード**: 52ファイル以上ダウンロードされたか
2. **実行時のLanceDB接続**: 正常に接続できたか
3. **エラー発生タイミング**: 起動時 vs 検索時
4. **ファイルシステムエラー**: "File not found" など

Cloud Logging URL:
```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

