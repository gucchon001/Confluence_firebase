# Vector Search API エラー分析

## エラー状況

Vector Search APIへのデータアップロード時に400エラー（Bad Request）が発生しています。

```
status: 400
```

## 考えられる原因

1. **フィールド名の不一致**
   - `functions/src/index.ts`では`datapointId`と`featureVector`に修正しましたが、APIの期待する形式と異なる可能性があります。

2. **メタデータの形式**
   - メタデータフィールドの形式が正しくない可能性があります。
   - 特定のデータ型が期待されている可能性があります。

3. **認証の問題**
   - サービスアカウントに適切な権限がない可能性があります。

4. **インデックス構成との不一致**
   - インデックス作成時の設定（ディメンション数など）とアップロードデータの不一致。

5. **エンドポイントの問題**
   - エンドポイントが正しく設定されていない、またはデプロイされていない可能性があります。

## 確認したこと

1. **環境変数の設定**
   ```json
   {
     "vertexai": {
       "endpoint_id": "1435927001503367168",
       "index_id": "7360896096425476096",
       "location": "asia-northeast1",
       "project_id": "confluence-copilot-ppjye",
       "deployed_index_id": "confluence_embeddings_endp_1757347487752"
     }
   }
   ```

2. **リクエスト形式**
   ```javascript
   {
     datapointId: `${record.pageId}-${record.chunkIndex}`,
     featureVector: record.embedding.map(Number),
     metadata: {
       title: record.title,
       url: record.url,
       content: record.content
     }
   }
   ```

3. **エンドポイント**
   ```
   https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints
   ```

## 次のステップ

1. **詳細なエラーメッセージの取得**
   - Cloud Functionsのログで、エラーの詳細な内容を確認する。
   - 特に`batchErr.response.data.error.message`や`batchErr.response.data.error.details`を確認する。

2. **Vertex AI APIドキュメントの確認**
   - 最新のAPIリファレンスを確認し、リクエスト形式が正しいか確認する。
   - [Vertex AI Vector Search API リファレンス](https://cloud.google.com/vertex-ai/docs/vector-search/setup/deploy-index-public)

3. **テスト用の単純なデータでアップロードを試す**
   - 最小限のデータ構造（IDとベクトルのみ）でアップロードをテストする。

4. **Google Cloud Consoleでの確認**
   - インデックスの詳細や権限を確認する。
   - サービスアカウントに適切な権限があるか確認する。

5. **APIバージョンの確認**
   - 使用しているAPIのバージョンが最新かどうか確認する。

## 参考情報

- [Vertex AI Vector Search データポイントのアップロード](https://cloud.google.com/vertex-ai/docs/vector-search/manage-data)
- [Vertex AI Vector Search トラブルシューティング](https://cloud.google.com/vertex-ai/docs/vector-search/troubleshooting)
- [Google Cloud 認証](https://cloud.google.com/docs/authentication)
