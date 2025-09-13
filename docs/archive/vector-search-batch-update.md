# Vector Search バッチ更新方式の実装

## 現状の分析

テスト関数の実行結果から、以下のエラーが確認されました：

```json
{
  "error": {
    "code": 400,
    "message": "StreamUpdate is not enabled on this index Optional[7360896096425476096].",
    "status": "FAILED_PRECONDITION"
  }
}
```

このエラーは、現在のインデックスが「バッチ更新」モードで作成されており、`upsertDatapoints` APIを使用したリアルタイム更新（StreamUpdate）に対応していないことを示しています。

## 要件の再確認

プロジェクトの要件として「1日1回のアップデートで十分」とのことですので、リアルタイム更新機能（StreamUpdate）は必要ありません。むしろ、バッチ更新方式の方がコスト効率も良く、要件に適しています。

## バッチ更新方式の実装

現在のインデックスをそのまま利用し、Cloud Functionsの処理内容を変更して、バッチ更新方式を実装します。

### 実装手順

1. **データの準備**:
   - Cloud Functions内で、Confluenceから取得した全ページのデータを、JSON形式のファイルとして作成します。
   - ファイルには複数のJSONオブジェクトを含めます（行区切りは任意）。

   ```json
   {"id": "page-id-1-chunk-0", "embedding": [0.1, 0.2, ...], "metadata": {"title": "タイトル1", "content": "内容1"}}
   {"id": "page-id-2-chunk-0", "embedding": [0.3, 0.4, ...], "metadata": {"title": "タイトル2", "content": "内容2"}}
   ```

2. **Cloud Storageへのアップロード**:
   - 作成したJSONファイルをGoogle Cloud Storage（GCS）の特定のバケットにアップロードします。

   ```typescript
   // Cloud Storageへのアップロード例
   const storage = new Storage();
   const bucket = storage.bucket('your-bucket-name');
   const file = bucket.file(`embeddings-${new Date().toISOString()}.json`);
   
   await file.save(jsonContent);
   const gcsUri = `gs://${bucket.name}/${file.name}`;
   ```

3. **インデックスの更新**:
   - GCSへのアップロード後、Vertex AI APIの `IndexService.UpdateIndex` メソッドを呼び出します。
   - この呼び出しで、アップロードしたGCS上のファイルのパスを指定します。

   ```typescript
   // インデックス更新の例
   const indexServiceClient = new IndexServiceClient();
   const [operation] = await indexServiceClient.updateIndex({
     index: {
       name: `projects/${projectId}/locations/${location}/indexes/${indexId}`,
       metadata: {
         contentsDeltaUri: gcsUri
       }
     }
   });
   
   // 更新が完了するのを待機
   const [response] = await operation.promise();
   ```

### 修正が必要なファイル

1. **`functions/src/index.ts`**:
   - `uploadToVectorSearch` 関数を修正して、バッチ更新方式を実装します。
   - `upsertDatapoints` APIの代わりに、GCSへのアップロードとインデックス更新APIを使用します。

2. **依存関係の追加**:
   - `@google-cloud/storage` パッケージをインストールして、GCSへのアップロードを行います。
   - `@google-cloud/aiplatform` パッケージをインストールして、Vertex AI APIを使用します。

## メリット

1. **要件に最適**: 1日1回の更新という要件に最適なアーキテクチャです。
2. **効率的**: 大規模なデータ更新を効率的に行えます。
3. **コスト効率**: ストリーミング更新に比べてコストが安価な場合が多いです。

## デメリット

1. **コード変更**: Cloud Functionsのコードを大幅に書き直す必要があります。
2. **更新時間**: 更新が完了するまでに時間がかかります（数分〜数時間）。

## 次のステップ

1. **GCSバケットの作成**: データアップロード用のGCSバケットを作成します。
2. **必要なパッケージのインストール**: `@google-cloud/storage` と `@google-cloud/aiplatform` をインストールします。
3. **Cloud Functions修正**: バッチ更新方式を実装するようにコードを修正します。
4. **テスト実行**: 修正したコードをデプロイしてテストを行います。
