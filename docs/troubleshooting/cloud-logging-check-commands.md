# Cloud Logging確認コマンド集

**作成日**: 2025-11-02  
**目的**: 本番環境のベクトル検索エラー原因を特定するためのログ確認クエリ

## Cloud Loggingにアクセス

```
https://console.cloud.google.com/logs/query?project=confluence-copilot-ppjye
```

## 確認すべきログクエリ

### 1. ベクトル検索エラーを確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Vector Search.*Error"
timestamp>="2025-11-01T00:00:00Z"
```

### 2. LanceDB接続ログを確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"OptimizedLanceDBClient.*Connecting"
timestamp>="2025-11-01T00:00:00Z"
```

### 3. ビルド時のデータダウンロードを確認

```logql
resource.type="cloud_run_revision"
textPayload=~"Downloading.*lancedb"
timestamp>="2025-11-01T00:00:00Z"
```

### 4. ファイルシステム関連のエラー

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
(textPayload=~"File not found" OR textPayload=~"Permission denied" OR textPayload=~"Failed to mount")
timestamp>="2025-11-01T00:00:00Z"
```

### 5. データチェック結果を確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"データチェック結果"
timestamp>="2025-11-01T00:00:00Z"
```

### 6. Instrumentationログを確認（起動時データ確認）

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"Instrumentation"
timestamp>="2025-11-01T00:00:00Z"
```

### 7. すべてのエラーを確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
severity>=ERROR
timestamp>="2025-11-01T00:00:00Z"
```

### 8. パフォーマンス警告を確認

```logql
resource.type="cloud_run_revision"
resource.labels.service_name="confluence-chat"
textPayload=~"⚠️.*Slow"
timestamp>="2025-11-01T00:00:00Z"
```

## 確認チェックリスト

### ビルド時のチェック

- [ ] データダウンロードが成功している
- [ ] ファイル数が期待通り（52ファイル以上）
- [ ] エラーが出ていない

### 実行時のチェック

- [ ] LanceDB接続が成功している
- [ ] テーブルが正しく開かれている
- [ ] vector列が存在している
- [ ] ファイルが見つからないエラーが出ていない

### エラー時のチェック

- [ ] エラーメッセージの詳細
- [ ] エラー発生タイミング（起動時 vs 検索時）
- [ ] ファイルパスが正しいか
- [ ] 権限エラーが発生していないか

## 重要な確認ポイント

### ベクトル検索エラーの直前のログを確認

エラー発生直前に以下を確認：

1. **ファイルシステム関連のエラー**がないか
2. **LanceDB接続**は成功しているか
3. **テーブル**は正常に開かれているか
4. **スキーマ**の読み込みは成功しているか

### ビルド時の確認

1. **ダウンロード**が完了しているか
2. **ファイルサイズ**が0バイトではないか
3. **必要な全ファイル**がダウンロードされているか

## ローカル環境との比較

以下をローカル環境と比較：

- ファイル数: ローカル52ファイル vs 本番？
- ファイルサイズ: ローカル12.4MB vs 本番？
- LanceDBバージョン: ローカル0.22.1 vs 本番？

