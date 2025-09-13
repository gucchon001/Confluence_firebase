# Vector Search フィールド名修正

## 問題の特定

Vector Search APIへのデータアップロード時に発生していた400エラーの原因を特定しました。根本的な原因は、Vertex AI Vector Searchの `upsertDatapoints` APIが要求するJSONのフィールド名と、コードで作成しているJSONのフィールド名が異なっていることでした。

## 修正すべきフィールド名

1. **id → datapoint_id に変更**
   - 現在のコード: `id: ${record.pageId}-${record.chunkIndex}`
   - 修正後: `datapoint_id: ${record.pageId}-${record.chunkIndex}`

2. **embedding → feature_vector に変更**
   - 現在のコード: `embedding: record.embedding.map(Number)`
   - 修正後: `feature_vector: record.embedding.map(Number)`

3. **metadata フィールドの削除または restricts への変更**
   - 現在のコード:
     ```javascript
     metadata: {
       title: record.title,
       url: record.url,
       content: record.content
     }
     ```
   - 修正後:
     ```javascript
     restricts: [
       {
         namespace: "title",
         allow_list: [record.title]
       },
       {
         namespace: "content_type",
         allow_list: ["confluence_page"]
       }
     ]
     ```

## テスト関数の作成

API仕様に準拠した正しいフィールド名でテストするために、`testVectorSearchUploadV3` 関数を作成しました。この関数は以下の3つの形式のデータポイントをテストします：

1. **最もシンプルな形式（必須フィールドのみ）**
   ```javascript
   {
     datapoint_id: "test-correct-format-001",
     feature_vector: testEmbedding
   }
   ```

2. **restrictsを追加**
   ```javascript
   {
     datapoint_id: "test-correct-format-002",
     feature_vector: testEmbedding,
     restricts: [
       {
         namespace: "title",
         allow_list: ["テストタイトル2"]
       },
       {
         namespace: "content_type",
         allow_list: ["confluence_page"]
       }
     ]
   }
   ```

3. **crowding_tagを追加**
   ```javascript
   {
     datapoint_id: "test-correct-format-003",
     feature_vector: testEmbedding,
     restricts: [
       {
         namespace: "title",
         allow_list: ["テストタイトル3"]
       }
     ],
     crowding_tag: "test-page-003"
   }
   ```

## デプロイ状況

テスト関数 `testVectorSearchUploadV3` をデプロイしましたが、`firebase functions:list` コマンドで確認すると、リストに表示されていません。これはデプロイプロセスに問題がある可能性があります。

## 次のステップ

1. **デプロイの問題を解決**
   - `index.ts` ファイルの `export` 文を確認
   - デプロイコマンドを再実行

2. **テスト関数の実行**
   - 正しくデプロイされたら、テスト関数を実行して結果を確認

3. **メイン関数の修正**
   - テスト結果に基づいて、`index.ts` の `uploadToVectorSearch` 関数内のデータポイント形式を修正

4. **メイン関数の再デプロイとテスト**
   - 修正したメイン関数を再デプロイし、実際のデータでテスト
