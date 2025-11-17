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
  - **⚠️ 注意**: テストカバレッジが不十分です。詳細は[テストカバレッジ分析](./05.14-test-coverage-analysis.md)を参照してください。

### デプロイ・整合性テスト

- **[05.03-deployment-integration.md](./05.03-deployment-integration.md)**: デプロイ、型チェック、データ整合性の確認テスト
  - **実行方法**: `scripts\run-deployment-integration-tests.bat` または `npx tsx src/tests/runners/deployment-integration-tests-runner.ts`
  - **対象**: 環境変数・設定値検証、型安全性、ローカルビルド、本番デプロイ準備、データ整合性など

### パフォーマンステスト

- **[05.04-performance-tests.md](./05.04-performance-tests.md)**: 応答速度、スループット、リソース使用率を測定するテスト
  - **実行方法**: `npx tsx src/tests/test-api-performance.ts`
  - **対象**: 検索時間、AI生成時間、初回チャンク時間、総処理時間など

### E2Eテスト

- **[05.11-e2e-test-plan.md](./05.11-e2e-test-plan.md)**: エンドツーエンドテストの計画と仕様
  - **対象**: ユーザーフロー、UI/UX、会話履歴、認証など

### テストカバレッジ分析

- **[05.14-test-coverage-analysis.md](./05.14-test-coverage-analysis.md)**: テストカバレッジの現状分析と不足項目の特定
  - **重要**: 現在のテストスイートは機能要件・非機能要件を十分にカバーしていません

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

- **[05.08-test-execution-guide.md](./05.08-test-execution-guide.md)**: テスト実行方法の詳細ガイド
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**: よく使うコマンドのクイックリファレンス
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: トラブルシューティングガイド
- **[05.14-test-coverage-analysis.md](./05.14-test-coverage-analysis.md)**: テストカバレッジ分析（重要）

## ⚠️ テストカバレッジの現状

現在のテストスイートは、**過去の寄せ集めのテストファイルを統合しているだけで、本来テストすべき機能・非機能要件・ファイル・デプロイのテストが十分にカバーされていません**。

**主な不足項目**:
- ❌ 認証・認可テスト（高優先度）
- ❌ APIエンドポイントテスト（高優先度）
- ❌ 会話履歴・コンテキスト管理テスト（高優先度）
- ❌ セキュリティテスト（高優先度）
- ❌ デプロイ前検証テスト（高優先度）

詳細は **[05.14-test-coverage-analysis.md](./05.14-test-coverage-analysis.md)** を参照してください。
