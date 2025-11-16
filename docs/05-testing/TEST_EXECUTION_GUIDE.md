# テスト実行ガイド

## 📋 概要

このガイドでは、データ関連テスト（`05.01-data-validation.md`対応）の実行方法を説明します。

## 🚀 推奨実行方法

### 方法1: 個別実行 → 一括実行（推奨）

個別テストを順次実行し、全て成功したら一括テストを自動実行：

```bash
# package.json経由（推奨）
npm run test:data-validation:individual

# 直接実行
npx tsx src/tests/run-all-individual-tests.ts
```

**実行されるテスト順序：**
1. 1.1 LanceDBスキーマ検証
2. 1.2 Firestoreラベル統合
3. 2.1 LanceDBインデックス
4. 2.2 Lunrインデックス
5. 3.1 Confluence同期
6. 3.2 Jira同期
7. 4.1 ラベル生成
8. 4.2 ラベルフィルタリング
9. （全成功時）一括テスト実行

**動作：**
- 各テストが成功するまで順次実行
- 1つでも失敗した場合は、以降のテストをスキップ
- 全8個のテストが成功した場合のみ、一括テストを実行

### 方法2: 一括実行のみ

全テストを一括で実行：

```bash
# package.json経由
npm run test:data-validation

# 直接実行
npx tsx src/tests/test-data-validation-all.ts
```

### 方法3: 個別実行

特定のテストのみを実行：

```bash
# 1.1 LanceDBスキーマ検証
npx tsx src/tests/check-lancedb-schema.ts

# 1.2 Firestoreラベル統合
npx tsx src/tests/test-firestore-labels-integration.ts

# 2.1 LanceDBインデックス
npx tsx src/tests/test-lancedb-indexes.ts

# 2.2 Lunrインデックス
npx tsx src/tests/test-lunr-index.ts

# 3.1 Confluence同期
npx tsx src/tests/test-confluence-sync.ts

# 3.2 Jira同期
npx tsx src/tests/test-jira-sync.ts

# 4.1 ラベル生成
npx tsx src/tests/test-label-generation.ts

# 4.2 ラベルフィルタリング
npx tsx src/tests/test-label-filtering.ts
```

## 📊 実行結果の解釈

### 成功時の表示

```
✅ 1.1 LanceDBスキーマ検証: 成功 (1234ms)
✅ 1.2 Firestoreラベル統合: 成功 (567ms)
...
✅ 全個別テスト成功！

一括テストを実行します...
...
🎉 全テスト成功！
```

### 失敗時の表示

```
✅ 1.1 LanceDBスキーマ検証: 成功 (1234ms)
❌ 1.2 Firestoreラベル統合: 失敗 (567ms)
   エラー: Exit code: 1

⚠️  テストが失敗したため、以降のテストをスキップします。
```

## ⚙️ 環境要件

### 必要な環境変数

`.env.local` ファイルに以下の設定が必要です：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 必要な依存関係

```bash
npm install
```

### データベース接続

- **Firestore**: 本番環境への接続が必要（読み取り専用推奨）
- **LanceDB**: ローカルまたは本番環境のLanceDBデータベースへの接続が必要

### 事前チェック

テスト実行前に、以下を確認してください：

```bash
# 1. 環境変数の確認
test -f .env.local && echo "✅ .env.local exists" || echo "❌ .env.local not found"

# 2. LanceDBディレクトリの確認
test -d .lancedb && echo "✅ LanceDB directory exists" || echo "⚠️  LanceDB directory not found (test may create it)"

# 3. 依存関係の確認
npm list --depth=0 > /dev/null 2>&1 && echo "✅ Dependencies installed" || echo "❌ Run 'npm install'"
```

## 🔧 トラブルシューティング

### エラー: Firebase初期化エラー

**原因**: 環境変数が設定されていない

**解決方法**:
1. `.env.local` ファイルが存在することを確認
2. 必要な環境変数が全て設定されていることを確認
3. 環境変数の値が正しいことを確認

### エラー: LanceDB接続エラー

**原因**: LanceDBデータベースが存在しない、またはパスが間違っている

**解決方法**:
1. `.lancedb` ディレクトリが存在することを確認
2. データベースが正しく初期化されていることを確認
3. 必要に応じて `npm run sync:confluence:differential` を実行

### エラー: Firestore接続エラー

**原因**: Firestoreへの接続ができない

**解決方法**:
1. ネットワーク接続を確認
2. Firebase設定が正しいことを確認
3. 認証情報が正しいことを確認

## 📝 定期実行の推奨

以下のタイミングでテストを実行することを推奨します：

- **デプロイ前**: 全てのテストを実行して問題がないことを確認
- **データ更新後**: データ整合性テストを実行
- **インデックス再構築後**: インデックス検証テストを実行
- **ラベル更新後**: ラベル管理検証テストを実行

## 🔗 関連ドキュメント

- [`05.01-data-validation.md`](./05.01-data-validation.md): テスト項目の詳細
- [`TEST_EXECUTION_RESULTS.md`](./TEST_EXECUTION_RESULTS.md): テスト実行結果の記録
- [`05.08-test-execution-guide.md`](./05.08-test-execution-guide.md): 一般的なテスト実行ガイド

