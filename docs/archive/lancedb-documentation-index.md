# LanceDBドキュメント一覧

## 1. 設計・計画ドキュメント

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| LanceDB使用ガイド | LanceDBの使用方法とベストプラクティス | [docs/lancedb-usage-guide.md](./lancedb-usage-guide.md) |
| LanceDB移行レポート | Vertex AIからLanceDBへの移行報告 | [docs/lancedb-migration-report.md](./lancedb-migration-report.md) |
| トラブルシューティングガイド | LanceDBの問題解決と対処法 | [docs/lancedb-troubleshooting.md](./lancedb-troubleshooting.md) |
| テスト計画書 | LanceDBのテスト計画と実行方法 | [docs/lancedb-test-plan.md](./lancedb-test-plan.md) |
| テスト実行レポート | テスト実行結果と分析 | [docs/lancedb-test-report-updated.md](./lancedb-test-report-updated.md) |
| LanceDB移行計画 | LanceDBへの移行手順 | [docs/gcs-to-lancedb-migration.md](./gcs-to-lancedb-migration.md) |
| データフロー図 | LanceDBを使用したデータフロー | [docs/data-flow-diagram-lancedb.md](./data-flow-diagram-lancedb.md) |

## 2. 実装ガイド

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| Firebase統合ガイド | Firebase Admin SDKの使用方法 | [docs/firebase-integration.md](./firebase-integration.md) |
| Firestore使用方針 | Firestoreの使用用途と設計 | [docs/firestore-usage.md](./firestore-usage.md) |
| ローカル検索移行方針 | ローカル検索基盤への移行方針 | [docs/local-search-migration.md](./local-search-migration.md) |

## 3. テストコード

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| 基本機能テスト | LanceDBの基本機能をテスト | [src/tests/lancedb/basic.test.ts](../src/tests/lancedb/basic.test.ts) |
| パフォーマンステスト | LanceDBのパフォーマンスをテスト | [src/tests/lancedb/performance.test.ts](../src/tests/lancedb/performance.test.ts) |
| 統合テスト | LanceDBとFirestoreの統合をテスト | [src/tests/lancedb/integration.test.ts](../src/tests/lancedb/integration.test.ts) |
| 差分更新テスト | 差分更新機能のテスト | [src/tests/unit/differential-sync.test.ts](../src/tests/unit/differential-sync.test.ts) |

## 4. スクリプト

| スクリプト名 | 説明 | 実行方法 |
|------------|------|---------|
| Confluenceバッチ同期 | Confluenceデータの差分更新 | `npm run sync:confluence:batch` |
| LanceDB基本機能テスト | 基本機能テストを実行 | `npm run test:lancedb:basic` |
| LanceDBパフォーマンステスト | パフォーマンステストを実行 | `npm run test:lancedb:performance` |
| LanceDB統合テスト | 統合テストを実行 | `npm run test:lancedb:integration` |
| LanceDBテスト一括実行 | すべてのLanceDBテストを実行 | `npm run test:lancedb:all` |
| 差分更新テスト | 差分更新機能のテスト | `npm run test:differential` |

## 5. コア実装

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| LanceDBスキーマ定義 | LanceDBのスキーマ定義 | [src/lib/lancedb-schema.ts](../src/lib/lancedb-schema.ts) |
| LanceDB検索クライアント | LanceDB検索機能のラッパー | [src/lib/lancedb-search-client.ts](../src/lib/lancedb-search-client.ts) |
| 埋め込み生成 | テキストから埋め込みベクトルを生成 | [src/lib/embeddings.ts](../src/lib/embeddings.ts) |
| エラーハンドリング | エラー処理とログ機能 | [src/lib/error-handling.ts](../src/lib/error-handling.ts) |

## 6. API実装

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| 検索API | LanceDBを使用した検索API | [src/app/api/search/route.ts](../src/app/api/search/route.ts) |
| RAGフロー | LanceDBを使用したRAG処理 | [src/ai/flows/retrieve-relevant-docs-lancedb.ts](../src/ai/flows/retrieve-relevant-docs-lancedb.ts) |
| フローAPI | AI処理フローのAPI | [src/app/api/flow/[flow]/route.ts](../src/app/api/flow/[flow]/route.ts) |

## 7. ユーティリティスクリプト

| スクリプト名 | 説明 | パス |
|------------|------|-----|
| LanceDBローダー | JSONLファイルをLanceDBに読み込む | [src/scripts/lancedb-load.ts](../src/scripts/lancedb-load.ts) |
| LanceDB検索 | コマンドラインからLanceDBを検索 | [src/scripts/lancedb-search.ts](../src/scripts/lancedb-search.ts) |
| LanceDBリスト | LanceDBのテーブルとデータを表示 | [src/scripts/lancedb-list.ts](../src/scripts/lancedb-list.ts) |
| LanceDBデバッグ | LanceDBの接続とデータを検証 | [src/scripts/lancedb-debug.ts](../src/scripts/lancedb-debug.ts) |
| Confluence取得 | Confluenceからデータを取得 | [src/scripts/confluence-fetch.ts](../src/scripts/confluence-fetch.ts) |
| ConfluenceからLanceDBへ | Confluenceデータを取得してLanceDBに保存 | [src/scripts/confluence-to-lancedb.ts](../src/scripts/confluence-to-lancedb.ts) |
| 改良版ConfluenceからLanceDBへ | メモリ管理を改善したスクリプト | [src/scripts/confluence-to-lancedb-improved.ts](../src/scripts/confluence-to-lancedb-improved.ts) |
| Confluenceバッチ同期 | Confluenceデータの差分更新 | [src/scripts/batch-sync-confluence.ts](../src/scripts/batch-sync-confluence.ts) |

## 8. 設定ファイル

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| Next.js設定 | LanceDBとFirebaseの設定 | [next.config.js](../next.config.js) |
| パッケージ設定 | npmスクリプトとパッケージ | [package.json](../package.json) |
| 環境変数サンプル | 必要な環境変数の設定例 | [.env.example](../.env.example) |

## 9. アーカイブ

以下のドキュメントは、Vertex AIからLanceDBへの移行に伴いアーカイブされました：

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| LanceDB-Firestore統合 | LanceDBとFirestoreの統合方法 | [docs/archive/lancedb-firestore-integration.md](./archive/lancedb-firestore-integration.md) |
| Vector Search成功レポート | Vertex AI Vector Searchの問題解決 | [docs/archive/vector-search-success.md](./archive/vector-search-success.md) |
| Vector Search検証 | Vertex AI Vector Search設定の検証 | [docs/archive/vector-search-index-verification.md](./archive/vector-search-index-verification.md) |
| Confluence-VectorSearch設計 | Vertex AIを使用した設計 | [docs/archive/confluence-vectorsearch-design.md](./archive/confluence-vectorsearch-design.md) |
| バッチ更新設計 | Vertex AIのバッチ更新設計 | [docs/archive/batch-update-design.md](./archive/batch-update-design.md) |

## 10. 今後の開発計画

1. **インデックス最適化**: LanceDBのインデックス作成と最適化
2. **大規模データセットテスト**: 1000件以上のデータでのパフォーマンステスト
3. **パフォーマンス監視**: 実運用環境での継続的なパフォーマンス監視
4. **プロンプトチューニング**: AIの回答品質向上のためのプロンプト最適化
5. **LanceDBスキーマ拡張**: 必要に応じてスキーマを拡張し、より豊富なメタデータを保存

## 11. 参考リソース

- [LanceDB公式ドキュメント](https://lancedb.github.io/lancedb/)
- [LanceDB GitHub](https://github.com/lancedb/lancedb)
- [Firebase Admin SDK公式ドキュメント](https://firebase.google.com/docs/admin/setup)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [@xenova/transformers ドキュメント](https://huggingface.co/Xenova/all-mpnet-base-v2)