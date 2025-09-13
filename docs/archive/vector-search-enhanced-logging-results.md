# Vector Search 強化されたログ出力の結果

## 実施した修正

エラーの詳細を確認するために、以下のログ出力を強化しました：

1. **エラーレスポンスの詳細表示**
   ```javascript
   // エラーメッセージの詳細な内容を表示
   console.error('[ingest-v3] Full error object:', JSON.stringify(batchErr.response.data.error, null, 2));
   
   // エラーレスポンスの完全な内容を表示
   try {
     console.error('[ingest-v3] Complete error response:', JSON.stringify(batchErr.response, null, 2));
   } catch (e) {
     console.error('[ingest-v3] Could not stringify complete error response:', e);
   }
   ```

2. **メイン関数のエラーハンドリングも同様に強化**

## テスト結果

残念ながら、強化されたログ出力でも依然として詳細なエラーメッセージは表示されていません：

```
data: { error: [Object] }
status: 400
```

これは、エラーオブジェクトの内容が適切に文字列化されていないか、Firebaseのログ出力に制限があることを示唆しています。

## 考察

1. **ログ出力の制限**
   - Firebase Functionsのログ出力には制限があり、大きなオブジェクトが適切に表示されない可能性があります。
   - 特に`[Object]`と表示されている部分は、オブジェクトが深すぎるか大きすぎるためにログに表示されていない可能性があります。

2. **Google Cloud Consoleでの確認**
   - Firebase Functionsのログは、Google Cloud Consoleのログビューアでより詳細に確認できる可能性があります。
   - ログビューアでは、より詳細なエラーメッセージが表示される場合があります。

3. **エラーの原因**
   - 400エラーは、リクエストの形式に問題があることを示しています。
   - 最新のVector Search APIの仕様と現在のリクエスト形式が一致していない可能性があります。

## 次のステップ

1. **Google Cloud Consoleのログビューアで確認**
   - [Google Cloud Console](https://console.cloud.google.com/)にアクセス
   - 「Logging」→「Logs Explorer」を選択
   - 以下のフィルターを適用：
     ```
     resource.type="cloud_function"
     resource.labels.function_name="syncConfluenceData"
     severity>=ERROR
     ```

2. **最小限のデータでテスト**
   - 1レコードのみの単純なデータでテスト実行
   - 必須フィールドのみを含むリクエストを試す

3. **インデックスの詳細確認**
   - Google Cloud Consoleで「Vertex AI」→「Vector Search」→「インデックス」を選択
   - インデックスの詳細設定を確認（特に次元数やデータ型）
