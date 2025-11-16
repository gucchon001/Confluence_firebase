# テストドキュメント

このディレクトリには、システムのテストに関するドキュメントが含まれています。

## 📚 テストドキュメント一覧

### データ検証テスト

- **[05.01-data-validation.md](./05.01-data-validation.md)**: データの整合性、インデックス、ラベルの正確性を確認するテスト
  - **実行方法**: `scripts\run-data-validation-tests.bat` または `npx tsx src/tests/run-all-individual-tests.ts`
  - **対象**: LanceDBスキーマ、Firestoreラベル統合、インデックス、同期、ラベル生成など

### 機能テスト

- **[05.02-feature-tests.md](./05.02-feature-tests.md)**: 検索、要約、ストリーミング等の主要機能の動作確認テスト
  - **実行方法**: `scripts\run-feature-tests.bat` または `npx tsx src/tests/runners/feature-tests-runner.ts`
  - **対象**: 検索品質、回答生成、ハイブリッド検索、ラベルマッチングなど

### デプロイ・整合性テスト

- **[05.03-deployment-integration.md](./05.03-deployment-integration.md)**: デプロイ、型チェック、データ整合性の確認テスト
  - **実行方法**: `scripts\run-deployment-integration-tests.bat` または `npx tsx src/tests/runners/deployment-integration-tests-runner.ts`
  - **対象**: 環境変数・設定値検証、型安全性、ローカルビルド、本番デプロイ準備、データ整合性など

## 🚀 クイックスタート

### データ検証テストを実行

```bash
# Windows
scripts\run-data-validation-tests.bat

# または npm script
npm run test:data-validation:all

# または直接実行
npx tsx src/tests/run-all-individual-tests.ts
```

### 機能テストを実行

```bash
# Windows
scripts\run-feature-tests.bat

# または npm script
npm run test:feature

# または直接実行
npx tsx src/tests/runners/feature-tests-runner.ts
```

### デプロイ・整合性テストを実行

```bash
# Windows
scripts\run-deployment-integration-tests.bat

# または npm script
npm run test:deployment-integration

# または直接実行
npx tsx src/tests/runners/deployment-integration-tests-runner.ts
```

## 📁 テストファイルの場所

### テストランナー

- **データ検証テスト**: `src/tests/run-all-individual-tests.ts`
- **機能テスト**: `src/tests/runners/feature-tests-runner.ts`
- **デプロイ・整合性テスト**: `src/tests/runners/deployment-integration-tests-runner.ts`
- **Windowsバッチファイル**: 
  - `scripts/run-data-validation-tests.bat`
  - `scripts/run-feature-tests.bat`
  - `scripts/run-deployment-integration-tests.bat`

### テストファイル

- **データ検証テスト**: `src/tests/test-*.ts` (例: `test-lancedb-indexes.ts`, `test-confluence-sync.ts`)
- **機能テスト**: `src/tests/*-test.ts` (例: `classroom-deletion-issue-search-test.ts`, `test-streaming-direct.ts`)

## 📖 詳細ドキュメント

各テストの詳細な説明、実行方法、確認項目については、上記の各ドキュメントを参照してください。
