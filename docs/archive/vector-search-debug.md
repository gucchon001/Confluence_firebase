# Vector Search デバッグレポート

## 1. 問題概要

Vertex AI Vector Search へのデータアップロード時に `400 Bad Request` エラーが発生していました。

## 2. エラー詳細

Cloud Functions のログには以下のエラーが表示されていました：

```
Error uploading batch 1: Request failed with status code 400
Error status: 400
Error headers: {"vary":"Origin, X-Origin, Referer","content-type":"application/json; charset=UTF-8",...}
```

詳細なエラーメッセージは表示されていませんでした。

## 3. 原因調査

1. **データ構造の検証**
   - Vector Search API の仕様に合わせたデータ構造になっているか確認
   - 必須フィールドの有無と形式をチェック

2. **ペイロードの簡素化**
   - 最小限のデータ構造（`datapoint_id` と `feature_vector` のみ）で試行
   - メタデータや制約フィールドを削除

3. **データ型の確認**
   - `feature_vector` が数値配列として正しく送信されているか確認
   - JavaScript の型変換の挙動を調査

## 4. 解決策

以下の修正を実施することで問題を解決しました：

1. **データ型の明示的変換**
   ```typescript
   return {
     datapoint_id: `${record.pageId}-${record.chunkIndex}`,
     feature_vector: record.embedding.map(Number)
   };
   ```

2. **バッチサイズの調整**
   - バッチサイズを10から5に削減して処理負荷を軽減

3. **デバッグログの強化**
   - ログプレフィックスを `[ingest-v3]` に更新して新バージョンのログを識別しやすく
   - リクエストペイロードの完全なログ出力を追加

## 5. 検証結果

修正後、Cloud Functions から Vector Search へのデータアップロードが成功しました：

```
[ingest-v3] Uploading 32 records to Vector Search index 7360896096425476096
[ingest-v3] Project: confluence-copilot-ppjye, Location: asia-northeast1
[ingest-v3] Uploading in 7 batches
[ingest-v3] Batch 1 upload complete: Status 200
...
[ingest-v3] Vector Search upload complete: 32 records processed
```

## 6. 教訓

1. **型の明示性**
   - JavaScript/TypeScript では、特に外部APIとの連携時に型を明示的に変換することが重要
   - `map(Number)` のような明示的な変換を使用する

2. **段階的なデバッグ**
   - ペイロードを最小限に簡素化してから徐々に機能を追加する
   - 詳細なログ出力でリクエスト/レスポンスの内容を確認する

3. **バッチ処理の最適化**
   - 大量データ処理時はバッチサイズを適切に調整する
   - 最初のバッチのみをテストするデバッグモードを実装する

## 7. 今後の改善点

1. **エラーメッセージの改善**
   - Google Cloud APIからのより詳細なエラー情報の取得方法を調査
   - エラーコードに応じた具体的な対処方法をドキュメント化

2. **バッチサイズの最適化**
   - 環境変数でバッチサイズを設定可能にする
   - 処理速度とエラー率のバランスを測定

3. **リトライ機構の強化**
   - 一時的なエラーに対する指数バックオフリトライの実装
   - 部分的な失敗時の継続処理の改善
