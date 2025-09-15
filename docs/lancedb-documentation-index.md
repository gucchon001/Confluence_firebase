# LanceDBドキュメント一覧

## 1. 設計・計画ドキュメント

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| テスト計画書 | LanceDBのテスト計画と実行方法 | [docs/lancedb-test-plan.md](./lancedb-test-plan.md) |
| テスト実行レポート | テスト実行結果と分析 | [docs/lancedb-test-report-updated.md](./lancedb-test-report-updated.md) |
| GCSからLanceDBへの移行計画 | GCSからLanceDBへの移行手順 | [docs/gcs-to-lancedb-migration.md](./gcs-to-lancedb-migration.md) |
| データフロー図 | LanceDBを使用したデータフロー | [docs/data-flow-diagram-lancedb.md](./data-flow-diagram-lancedb.md) |

## 2. 実装ガイド

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| LanceDB-Firebase統合ガイド | LanceDBとFirebaseの統合方法 | [docs/lancedb-firebase-integration-guide.md](./lancedb-firebase-integration-guide.md) |
| Firebase統合ガイド | Firebase Admin SDKの使用方法 | [docs/firebase-integration.md](./firebase-integration.md) |

## 3. テストコード

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| 基本機能テスト | LanceDBの基本機能をテスト | [src/tests/lancedb/basic.test.ts](../src/tests/lancedb/basic.test.ts) |
| パフォーマンステスト | LanceDBのパフォーマンスをテスト | [src/tests/lancedb/performance.test.ts](../src/tests/lancedb/performance.test.ts) |
| 統合テスト | LanceDBとFirestoreの統合をテスト | [src/tests/lancedb/integration.test.ts](../src/tests/lancedb/integration.test.ts) |

## 4. スクリプト

| スクリプト名 | 説明 | 実行方法 |
|------------|------|---------|
| LanceDB基本機能テスト | 基本機能テストを実行 | `npm run test:lancedb:basic` |
| LanceDBパフォーマンステスト | パフォーマンステストを実行 | `npm run test:lancedb:performance` |
| LanceDB統合テスト | 統合テストを実行 | `npm run test:lancedb:integration` |
| LanceDBテスト一括実行 | すべてのLanceDBテストを実行 | `npm run test:lancedb:all` |

## 5. API実装

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| 検索API | LanceDBとFirestoreを使用した検索API | [src/app/api/search/route.ts](../src/app/api/search/route.ts) |
| 埋め込み生成 | テキストから埋め込みベクトルを生成 | [src/lib/embeddings.ts](../src/lib/embeddings.ts) |

## 6. ユーティリティスクリプト

| スクリプト名 | 説明 | パス |
|------------|------|-----|
| LanceDBローダー | JSONLファイルをLanceDBに読み込む | [src/scripts/lancedb-load.ts](../src/scripts/lancedb-load.ts) |
| LanceDB検索 | コマンドラインからLanceDBを検索 | [src/scripts/lancedb-search.ts](../src/scripts/lancedb-search.ts) |
| LanceDBリスト | LanceDBのテーブルとデータを表示 | [src/scripts/lancedb-list.ts](../src/scripts/lancedb-list.ts) |
| LanceDBデバッグ | LanceDBの接続とデータを検証 | [src/scripts/lancedb-debug.ts](../src/scripts/lancedb-debug.ts) |
| Confluence取得 | Confluenceからデータを取得 | [src/scripts/confluence-fetch.ts](../src/scripts/confluence-fetch.ts) |
| ConfluenceからLanceDBへ | Confluenceデータを取得してLanceDBに保存 | [src/scripts/confluence-to-lancedb.ts](../src/scripts/confluence-to-lancedb.ts) |
| 改良版ConfluenceからLanceDBへ | メモリ管理を改善したスクリプト | [src/scripts/confluence-to-lancedb-improved.ts](../src/scripts/confluence-to-lancedb-improved.ts) |

## 7. 設定ファイル

| ファイル名 | 説明 | パス |
|-----------|------|-----|
| Next.js設定 | LanceDBとFirebaseの設定 | [next.config.js](../next.config.js) |
| パッケージ設定 | npmスクリプトとパッケージ | [package.json](../package.json) |
| 環境変数サンプル | 必要な環境変数の設定例 | [.env.example](../.env.example) |

## 8. アーカイブ

以下のドキュメントは、Vertex AIからLanceDBへの移行に伴いアーカイブされました：

| ドキュメント名 | 説明 | パス |
|-------------|------|-----|
| Vector Search成功レポート | Vertex AI Vector Searchの問題解決 | [docs/archive/vector-search-success.md](./archive/vector-search-success.md) |
| Vector Search検証 | Vertex AI Vector Search設定の検証 | [docs/archive/vector-search-index-verification.md](./archive/vector-search-index-verification.md) |
| Confluence-VectorSearch設計 | Vertex AIを使用した設計 | [docs/archive/confluence-vectorsearch-design.md](./archive/confluence-vectorsearch-design.md) |
| バッチ更新設計 | Vertex AIのバッチ更新設計 | [docs/archive/batch-update-design.md](./archive/batch-update-design.md) |

## 9. 今後の開発計画

1. **大規模データセットテスト**: 1000件以上のデータでのパフォーマンステスト
2. **インデックス最適化**: LanceDBのインデックス作成と最適化
3. **自動同期機能**: LanceDBとFirestoreの自動同期機能の実装
4. **パフォーマンス監視**: 実運用環境での継続的なパフォーマンス監視
5. **セキュリティ強化**: Firebase Admin SDKを使用したセキュリティ強化

## 10. 参考リソース

- [LanceDB公式ドキュメント](https://lancedb.github.io/lancedb/)
- [Firebase Admin SDK公式ドキュメント](https://firebase.google.com/docs/admin/setup)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Xenova/transformers](https://huggingface.co/Xenova/all-mpnet-base-v2)