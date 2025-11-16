# テスト実行トラブルシューティング

## よくある問題と解決方法

### 1. LanceDB接続エラー

**症状**:
```
❌ エラー: Connection failed
```

**原因**:
- LanceDBデータベースが存在しない
- データベースパスが間違っている
- 権限の問題

**解決方法**:
```bash
# データベースディレクトリの確認
ls -la .lancedb

# データベースが存在しない場合は同期を実行
npm run sync:confluence:differential
```

### 2. Firestore接続エラー

**症状**:
```
❌ Firebase初期化エラー
```

**原因**:
- `.env.local` ファイルが存在しない
- 環境変数が設定されていない
- Firebase設定が間違っている

**解決方法**:
1. `.env.local` ファイルが存在することを確認
2. 必要な環境変数が全て設定されていることを確認
3. 環境変数の値が正しいことを確認

### 3. モジュールインポートエラー

**症状**:
```
❌ Cannot find module '../lib/lancedb-client'
```

**原因**:
- ファイルパスが間違っている
- TypeScriptのコンパイルエラー

**解決方法**:
```bash
# TypeScriptの型チェック
npm run typecheck

# 依存関係の再インストール
npm install
```

### 4. テスト実行中のタイムアウト

**症状**:
```
❌ タイムアウトエラー
```

**原因**:
- ネットワーク接続が遅い
- データベース接続が遅い
- リソース不足

**解決方法**:
1. ネットワーク接続を確認
2. システムリソースを確認
3. 必要に応じてタイムアウト値を調整

### 5. エラーメッセージが表示されない

**症状**:
- テストが失敗するが、詳細なエラー情報が表示されない

**解決方法**:
- テストスクリプトを直接実行して詳細なエラーを確認:
```bash
npx tsx src/tests/check-lancedb-schema.ts
```

## デバッグ方法

### 詳細なログを有効にする

環境変数を設定:
```bash
# デバッグモード
export DEBUG=*
# または
DEBUG=* npm run test:data-validation:individual
```

### 個別テストを直接実行

問題のあるテストを直接実行して詳細なエラーを確認:
```bash
# 問題のあるテストを直接実行
npx tsx src/tests/check-lancedb-schema.ts
```

## テスト実行前の確認事項

### 1. 環境変数の確認

```bash
# .env.local ファイルの存在確認
test -f .env.local && echo "✅ .env.local exists" || echo "❌ .env.local not found"

# 必要な環境変数が設定されているか確認
grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID" .env.local && echo "✅ Firebase config found" || echo "❌ Firebase config missing"
```

### 2. データベースの確認

```bash
# LanceDBディレクトリの存在確認
test -d .lancedb && echo "✅ LanceDB directory exists" || echo "❌ LanceDB directory not found"

# LanceDBデータの確認
npx tsx src/tests/check-lancedb-schema.ts
```

### 3. 依存関係の確認

```bash
# 依存関係のインストール状態を確認
npm list --depth=0

# 不足している依存関係があればインストール
npm install
```

## エラー報告時の情報

問題が解決しない場合は、以下の情報を含めて報告してください：

1. **エラーメッセージ**: 完全なエラーメッセージとスタックトレース
2. **実行環境**: OS、Node.jsバージョン、npmバージョン
3. **実行コマンド**: 実行したコマンド
4. **環境変数**: `.env.local` の設定状況（機密情報は除く）
5. **データベース状態**: LanceDBとFirestoreの状態

## サポート

問題が解決しない場合は、以下のドキュメントを参照してください：

- [`05.01-data-validation.md`](./05.01-data-validation.md): テスト項目の詳細
- [`TEST_EXECUTION_GUIDE.md`](./TEST_EXECUTION_GUIDE.md): 実行方法の詳細
- [`06-troubleshooting/`](../06-troubleshooting/): トラブルシューティングドキュメント

