# Vector Search デバッグ手順

## 実施した修正

1. **Vector Search APIフィールド名の修正**
   - `feature_vector` → `featureVector`
   - `datapoint_id` → `datapointId`

2. **メタデータフィールドの追加**
   ```typescript
   metadata: {
     title: record.title,
     url: record.url,
     content: record.content
   }
   ```

3. **デバッグログの追加**
   - エンドポイントURLのログ出力
   - リクエストボディのJSON出力
   - レスポンスデータのJSON出力

4. **環境変数の設定**
   - `.env.local`ファイルの作成
   - `NEXT_PUBLIC_USE_MOCK_DATA=false`に設定

5. **Cloud Functions環境変数の更新**
   ```bash
   firebase functions:config:set vertexai.endpoint_id="1435927001503367168" vertexai.deployed_index_id="confluence_embeddings_endp_1757347487752"
   ```

## 確認方法

1. **ブラウザでアプリケーションにアクセス**
   - http://localhost:9002 にアクセス
   - ログインして質問を入力

2. **ブラウザのコンソールでログを確認**
   - 以下のログを確認
     - `[searchVectorIndex] Using endpoint: ...`
     - `[searchVectorIndex] Request body: ...`
     - `[searchVectorIndex] Response: ...`

3. **エラーの場合の確認ポイント**
   - エンドポイントURLが正しいか
   - リクエストボディのフォーマットが正しいか
   - 認証トークンが取得できているか

## 次のステップ

1. **検索パラメータの調整**
   - `distanceThreshold`を大きくする（例: 0.8 → 0.95）
   - `neighborCount`を増やす（例: 5 → 10）

2. **エラーハンドリングの強化**
   - 詳細なエラーメッセージの表示
   - リトライロジックの調整

3. **データの確認**
   - Google Cloud ConsoleでVector Searchインデックスのデータポイント数を確認
   - データが正しくアップロードされているか確認
