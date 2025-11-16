# テスト実行クイックリファレンス

## 🚀 よく使うコマンド

### データ関連テスト

```bash
# 推奨: 個別テスト → 一括テスト
npm run test:data-validation:individual

# 一括テストのみ
npm run test:data-validation

# 個別テストのみ（特定のテストを実行）
npx tsx src/tests/check-lancedb-schema.ts
npx tsx src/tests/test-firestore-labels-integration.ts
npx tsx src/tests/test-lancedb-indexes.ts
npx tsx src/tests/test-lunr-index.ts
npx tsx src/tests/test-confluence-sync.ts
npx tsx src/tests/test-jira-sync.ts
npx tsx src/tests/test-label-generation.ts
npx tsx src/tests/test-label-filtering.ts
```

### 他のテスト

```bash
# クイックバリデーション
npx tsx src/tests/quick-validation-test.ts

# 包括的テスト
npx tsx src/tests/comprehensive-test-runner.ts

# コード品質チェック
npx tsx src/tests/code-quality-checker.ts

# APIパフォーマンス
npx tsx src/tests/test-api-performance.ts
```

## 📋 テスト項目マッピング

| テスト項目 | スクリプト | npm run |
|-----------|----------|---------|
| 1.1 LanceDBスキーマ検証 | `check-lancedb-schema.ts` | `check:lancedb-schema` |
| 1.2 Firestoreラベル統合 | `test-firestore-labels-integration.ts` | `test:firestore-labels-integration` |
| 2.1 LanceDBインデックス | `test-lancedb-indexes.ts` | `lancedb:check-indexes` |
| 2.2 Lunrインデックス | `test-lunr-index.ts` | `rebuild:lunr` |
| 3.1 Confluence同期 | `test-confluence-sync.ts` | `sync:confluence:differential` |
| 3.2 Jira同期 | `test-jira-sync.ts` | - |
| 4.1 ラベル生成 | `test-label-generation.ts` | `label:generate` |
| 4.2 ラベルフィルタリング | `test-label-filtering.ts` | `lancedb:verify` |

## ⚡ トラブルシューティング

### よくあるエラー

1. **LanceDB接続エラー**: `.lancedb` ディレクトリが存在しない → `npm run sync:confluence:differential` を実行
2. **Firebase初期化エラー**: `.env.local` が存在しない、または環境変数が設定されていない
3. **モジュールインポートエラー**: `npm install` を実行して依存関係をインストール

詳細は [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) を参照してください。

## 🔗 関連ドキュメント

- [`05.01-data-validation.md`](./05.01-data-validation.md): データ関連テストの詳細
- [`TEST_EXECUTION_GUIDE.md`](./TEST_EXECUTION_GUIDE.md): 実行方法の詳細
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md): トラブルシューティング

