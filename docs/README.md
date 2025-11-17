# 📚 Confluence Firebase ドキュメント

このディレクトリには、Confluence Firebaseプロジェクトの包括的なドキュメントが含まれています。

## 📋 採番ルール

### フォルダの採番

すべてのフォルダには2桁の番号が付けられています：

- **`01-architecture/`** - アーキテクチャ・設計
- **`02-specifications/`** - 仕様書
- **`03-implementation/`** - 実装・開発
- **`04-operations/`** - 運用・デプロイ
- **`05-testing/`** - テスト・分析
- **`06-troubleshooting/`** - トラブルシューティング
- **`99-archive/`** - アーカイブ（過去のドキュメント）

### ファイルの採番

各フォルダ内のファイルは、フォルダ番号に続けて採番されます：

#### `01-architecture/` 内のファイル
- 階層的な採番を使用（`01.01.01-`, `01.02.01-`など）
- 第1レベル: カテゴリ（例: 01=システム全体、02=検索システム）
- 第2レベル: サブカテゴリ（例: 01=データフロー、02=データベース統合）
- 第3レベル: 個別ドキュメント（例: 01, 02, 03...）

#### `02-specifications/` 内のファイル
- `02.01-`, `02.02-`, `02.03-`など（2桁の連番）

#### `03-implementation/` 内のファイル
- `03.01-`, `03.02-`, `03.03-`など（2桁の連番）

#### `04-operations/` 内のファイル
- `04.01-`, `04.02-`, `04.03-`など（2桁の連番）

#### `05-testing/` 内のファイル
- `05.01-`, `05.02-`, `05.03-`など（2桁の連番）

#### `06-troubleshooting/` 内のファイル
- `06.01-`, `06.02-`, `06.03-`など（2桁の連番）

### 採番の原則

1. **フォルダ番号**: 2桁の番号（01-99）
2. **ファイル番号**: フォルダ番号 + `.` + 2桁の連番（例: `04.01-`, `04.02-`）
3. **階層的採番**: `01-architecture/`のみ階層的採番を使用（`01.01.01-`など）
4. **README.md**: 各フォルダのREADME.mdは採番なし
5. **アーカイブ**: `99-archive/`は特別扱い（採番なしまたは任意）

---

## 🗂️ ドキュメント構成

### 🏗️ [01-architecture/](./01-architecture/) - アーキテクチャ・設計
システムの全体的な設計とアーキテクチャに関するドキュメント

#### 現行システム
- **[01.01.01-data-flow-diagram-lancedb.md](./01-architecture/01.01.01-data-flow-diagram-lancedb.md)** - LanceDBデータフロー図
- **[02.01.02-hybrid-search-specification.md](./01-architecture/02.01.02-hybrid-search-specification.md)** 🌟 **最新** - ハイブリッド検索システム完全仕様書（Phase 4完了版）
- **[02.01.01-hybrid-search-quick-reference.md](./01-architecture/02.01.01-hybrid-search-quick-reference.md)** ⚡ **NEW** - ハイブリッド検索クイックリファレンス
- **[01.02.01-lancedb-firestore-integration-design.md](./01-architecture/01.02.01-lancedb-firestore-integration-design.md)** 🔧 **更新** - LanceDB-Firestore統合設計（ページ除外フィルタリング追加）
- **[03.02.01-prompt-design.md](./01-architecture/03.02.01-prompt-design.md)** - プロンプト設計
- **[05.01.01-ui-ux-performance-strategy.md](./01-architecture/05.01.01-ui-ux-performance-strategy.md)** - UI/UXパフォーマンス戦略

詳細は [`01-architecture/README.md`](./01-architecture/README.md) を参照してください。

### 📋 [02-specifications/](./02-specifications/) - 仕様書
システムの詳細仕様と技術仕様に関するドキュメント

- **[02.01-spec.md](./02-specifications/02.01-spec.md)** - システム全体仕様書
- **[02.02-confluence-spec.md](./02-specifications/02.02-confluence-spec.md)** - Confluence検索システム仕様
- **[02.03-jira-spec.md](./02-specifications/02.03-jira-spec.md)** - Jira検索システム仕様
- **[02.04-implementation-gap-analysis.md](./02-specifications/02.04-implementation-gap-analysis.md)** - 仕様書と実装のギャップ分析
- **[02.05-management-dashboard-specification.md](./02-specifications/02.05-management-dashboard-specification.md)** - 管理画面・ダッシュボード仕様書

### 🛠️ [03-implementation/](./03-implementation/) - 実装・開発
具体的な実装方法と開発に関するドキュメント

- **[03.01-jira-field-mapping.md](./03-implementation/03.01-jira-field-mapping.md)** - Jiraフィールドマッピング仕様

詳細は [`03-implementation/README.md`](./03-implementation/README.md) を参照してください。

### 🚀 [04-operations/](./04-operations/) - 運用・デプロイ
システムの運用、デプロイ、移行に関するドキュメント

- **[04.01-deployment-guide.md](./04-operations/04.01-deployment-guide.md)** - 包括的デプロイガイド
- **[04.02-github-actions-setup.md](./04-operations/04.02-github-actions-setup.md)** - GitHub Actions設定
- **[04.03-data-synchronization-strategy.md](./04-operations/04.03-data-synchronization-strategy.md)** - データ同期戦略
- **[04.04-backup-management-guide.md](./04-operations/04.04-backup-management-guide.md)** - バックアップ管理
- **[04.05-extended-schema-operation-guide.md](./04-operations/04.05-extended-schema-operation-guide.md)** - 拡張スキーマ運用ガイド
- **[04.06-scripts-guide.md](./04-operations/04.06-scripts-guide.md)** - スクリプト利用ガイド
- **[04.07-migration-guide.md](./04-operations/04.07-migration-guide.md)** - リポジトリ移管ガイド
- **[04.08-network-sharing-guide.md](./04-operations/04.08-network-sharing-guide.md)** - ネットワーク共有ガイド
- **[04.12-environment-setup.md](./04-operations/04.12-environment-setup.md)** - 環境別設定ガイド
- **[04.13-environment-variables.md](./04-operations/04.13-environment-variables.md)** - 環境変数設定ガイド
- **[04.15-jira-production-deployment-guide.md](./04-operations/04.15-jira-production-deployment-guide.md)** - Jira本番環境デプロイガイド
- **[04.16-github-cli-and-actions-guide.md](./04-operations/04.16-github-cli-and-actions-guide.md)** ⚡ **NEW** - GitHub CLIとGitHub Actions運用ガイド
- **[14-quick-start.md](./04-operations/14-quick-start.md)** - クイックスタートガイド

詳細は [`04-operations/README.md`](./04-operations/README.md) を参照してください。

### 📊 [05-testing/](./05-testing/) - テスト・分析
テスト計画、分析結果、品質評価に関するドキュメント

- **[05.01-data-validation.md](./05-testing/05.01-data-validation.md)** - データ関連テスト
- **[05.02-feature-tests.md](./05-testing/05.02-feature-tests.md)** - 主要機能関連テスト
- **[05.03-deployment-integration.md](./05-testing/05.03-deployment-integration.md)** - デプロイ・整合性テスト
- **[05.04-performance-tests.md](./05-testing/05.04-performance-tests.md)** - パフォーマンステスト
- **[05.07-production-readiness-verification.md](./05-testing/05.07-production-readiness-verification.md)** - 本番環境データ整合性テスト
- **[05.08-test-execution-guide.md](./05-testing/05.08-test-execution-guide.md)** - テスト実行ガイド
- **[05.10-test-coverage-analysis.md](./05-testing/05.10-test-coverage-analysis.md)** - テストカバレッジ分析レポート
- **[05.11-e2e-test-plan.md](./05-testing/05.11-e2e-test-plan.md)** - E2Eテスト計画書

詳細は [`05-testing/README.md`](./05-testing/README.md) を参照してください。

### 🔧 [06-troubleshooting/](./06-troubleshooting/) - トラブルシューティング
問題解決とデバッグに関するドキュメント

- **[06.01-cloud-logging-check-commands.md](./06-troubleshooting/06.01-cloud-logging-check-commands.md)** - Cloud Logging確認コマンド集
- **[06.06-production-environment-check-guide.md](./06-troubleshooting/06.06-production-environment-check-guide.md)** - 本番環境確認ガイド

詳細は [`06-troubleshooting/README.md`](./06-troubleshooting/README.md) を参照してください。

### 💡 [proposals/](./proposals/) - 提案書
新機能・改善提案に関するドキュメント

- **[dashboard-consolidation-plan.md](./proposals/dashboard-consolidation-plan.md)** - 管理画面統合・整理計画

### 📁 [99-archive/](./99-archive/) - アーカイブ
過去の分析レポート、テスト結果、最適化計画、非推奨ドキュメント

完了した分析レポート、統合済みドキュメント、古い仕様書などがアーカイブされています。

詳細は [`99-archive/README.md`](./99-archive/README.md) を参照してください。

---

## 🚀 クイックスタート

### 新規開発者向け
1. **[01-architecture/01.01.01-data-flow-diagram-lancedb.md](./01-architecture/01.01.01-data-flow-diagram-lancedb.md)** - システム全体のデータフローを確認
2. **[02-specifications/02.01-spec.md](./02-specifications/02.01-spec.md)** - 機能要件と技術スタックを確認
3. **[04-operations/04.12-environment-setup.md](./04-operations/04.12-environment-setup.md)** - 開発環境のセットアップ
4. **[04-operations/04.01-deployment-guide.md](./04-operations/04.01-deployment-guide.md)** - デプロイ手順を確認

### 運用担当者向け
1. **[04-operations/04.01-deployment-guide.md](./04-operations/04.01-deployment-guide.md)** - デプロイガイド
2. **[04-operations/04.03-data-synchronization-strategy.md](./04-operations/04.03-data-synchronization-strategy.md)** - データ同期戦略
3. **[04-operations/04.05-extended-schema-operation-guide.md](./04-operations/04.05-extended-schema-operation-guide.md)** - 拡張スキーマ運用ガイド

### 開発者向け
1. **[01-architecture/02.01.02-hybrid-search-specification.md](./01-architecture/02.01.02-hybrid-search-specification.md)** - ハイブリッド検索システム完全仕様書
2. **[01-architecture/03.01.01-genkit-design.md](./01-architecture/03.01.01-genkit-design.md)** - Genkit設計方針
3. **[01-architecture/04.01.01-structured-label-design.md](./01-architecture/04.01.01-structured-label-design.md)** - 構造化ラベル設計

---

## 📝 ドキュメント更新

**最終更新**: 2025年11月16日（採番ルール統一完了）

### 最新の実装状況
- ✅ **pageId → page_id マイグレーション完了**（2025年11月）
- ✅ **ドキュメント整理完了**（2025年11月16日）
  - フォルダとファイルに統一的な採番ルールを適用
  - 重複フォルダの統合（deployment → operations）
  - 関連ドキュメントとの連携強化

---

## 🔗 関連リンク

- [プロジェクトルートのREADME.md](../README.md)
- [セットアップガイド](./04-operations/04.12-environment-setup.md)
- [クイックスタートガイド](./04-operations/README.md#クイックスタート)
