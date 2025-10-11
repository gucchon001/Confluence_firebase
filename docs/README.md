# 📚 Confluence Firebase ドキュメント

このディレクトリには、Confluence Firebaseプロジェクトの包括的なドキュメントが含まれています。

## 🗂️ ドキュメント構成

### 🏗️ [architecture/](./architecture/) - アーキテクチャ・設計
システムの全体的な設計とアーキテクチャに関するドキュメント

#### 現行システム
- **[blueprint.md](./architecture/blueprint.md)** - プロジェクト概要と全体設計
- **[data-flow-diagram-lancedb.md](./architecture/data-flow-diagram-lancedb.md)** - LanceDBデータフロー図
- **[hybrid-search-contract.md](./architecture/hybrid-search-contract.md)** - ハイブリッド検索契約
- **[search-system-comprehensive-guide.md](./architecture/search-system-comprehensive-guide.md)** - 検索システム総合ガイド
- **[prompt-design.md](./architecture/prompt-design.md)** - プロンプト設計
- **[ui-ux-performance-strategy.md](./architecture/ui-ux-performance-strategy.md)** - UI/UXパフォーマンス戦略

#### 分析・検証
- **[architecture-implementation-verification.md](./architecture/architecture-implementation-verification.md)** - アーキテクチャドキュメント実装検証レポート
- **[rag-performance-analysis.md](./architecture/rag-performance-analysis.md)** - RAGパフォーマンス分析

#### 将来計画
- **[foundation-first-strategy.md](./architecture/foundation-first-strategy.md)** 🔥 **NEW** - 基盤強化優先戦略（ラベル+KG → 横断拡張）
- **[genkit-migration-and-expansion-roadmap.md](./architecture/genkit-migration-and-expansion-roadmap.md)** ⭐ - Genkit移行と拡張ロードマップ（6.5ヶ月計画）
- **[genkit-design.md](./architecture/genkit-design.md)** - Genkit設計方針
- **[graphrag-tuned-architecture.md](./architecture/graphrag-tuned-architecture.md)** - GraphRAG調整アーキテクチャ

### 🛠️ [implementation/](./implementation/) - 実装・開発
具体的な実装方法と開発に関するドキュメント

#### システム設計・仕様
- **[error-handling.md](./implementation/error-handling.md)** - エラーハンドリング仕様
- **[ai-models-configuration.md](./implementation/ai-models-configuration.md)** - AIモデル設定ガイド
- **[lancedb-data-structure-specification.md](./implementation/lancedb-data-structure-specification.md)** - LanceDBデータ構造仕様
- **[firestore-integration-guide.md](./implementation/firestore-integration-guide.md)** - Firestore統合ガイド

#### ラベルシステム
- **[label-system-overview.md](./implementation/label-system-overview.md)** - ラベルシステム概要
- **[label-system-design.md](./implementation/label-system-design.md)** - ラベルシステム設計
- **[label-system-api.md](./implementation/label-system-api.md)** - ラベルシステムAPI

#### ドメイン知識
- **[domain-knowledge-extraction-comprehensive-guide.md](./implementation/domain-knowledge-extraction-comprehensive-guide.md)** - ドメイン知識抽出総合ガイド

#### 課題管理
- **[remaining-issues.md](./implementation/remaining-issues.md)** - 継続的な課題管理

#### 監査レポート
- **[implementation-docs-audit-report.md](./implementation/implementation-docs-audit-report.md)** - ドキュメント監査レポート (2025-10-11)

### 🚀 [operations/](./operations/) - 運用・デプロイ
システムの運用、デプロイ、移行に関するドキュメント

#### 同期・データ管理
- **[data-synchronization-strategy.md](./operations/data-synchronization-strategy.md)** ⭐ - データ同期戦略と定期実行スケジュール
- **[firebase-scheduled-sync-setup.md](./operations/firebase-scheduled-sync-setup.md)** - Firebase Functions自動同期セットアップ

#### デプロイ・設定
- **[deployment-guide.md](./operations/deployment-guide.md)** - 包括的デプロイガイド
- **[firebase-app-hosting-configuration.md](./operations/firebase-app-hosting-configuration.md)** ⭐ - App Hosting設定（動作確認済み）
- **[firebase-app-hosting-troubleshooting.md](./operations/firebase-app-hosting-troubleshooting.md)** - トラブルシューティング
- **[required-environment-variables.md](./operations/required-environment-variables.md)** - 必須環境変数一覧

#### 運用・管理
- **[backup-management-guide.md](./operations/backup-management-guide.md)** - バックアップ管理ガイド
- **[migration-guide.md](./operations/migration-guide.md)** - リポジトリ移管ガイド
- **[network-sharing-guide.md](./operations/network-sharing-guide.md)** - ネットワーク共有ガイド

#### 監査レポート
- **[operations-docs-audit-report.md](./operations/operations-docs-audit-report.md)** - ドキュメント監査レポート (2025-10-11)

### 📊 [testing/](./testing/) - テスト・分析
テスト計画、分析結果、品質評価に関するドキュメント

- **[case_classroom-management-search-quality-test.md](./testing/case_classroom-management-search-quality-test.md)** - 教室管理検索品質テスト
- **[chatbot-performance-improvement-plan.md](./testing/chatbot-performance-improvement-plan.md)** - チャットボットパフォーマンス改善計画
- **[confluence-fetch-analysis.md](./testing/confluence-fetch-analysis.md)** - Confluence取得分析
- **[confluence-sync-duplicate-analysis.md](./testing/confluence-sync-duplicate-analysis.md)** - Confluence同期重複分析
- **[differential-sync-test-plan.md](./testing/differential-sync-test-plan.md)** - 差分同期テスト計画
- **[real-vector-search-testing-guide.md](./testing/real-vector-search-testing-guide.md)** - リアルベクトル検索テストガイド

### 📋 [specifications/](./specifications/) - 仕様書
システムの詳細仕様と技術仕様に関するドキュメント

- **[spec.md](./specifications/spec.md)** - システム仕様書
- **[lancedb-integration-guide.md](./specifications/lancedb-integration-guide.md)** - LanceDB統合ガイド
- **[implementation-gap-analysis.md](./specifications/implementation-gap-analysis.md)** - 仕様書と実装のギャップ分析

### 📁 [archive/](./archive/) - アーカイブ
過去の分析レポート、テスト結果、最適化計画、非推奨ドキュメント

#### 分析レポート
- **[scoring-simplification-analysis.md](./archive/analysis-reports/scoring-simplification-analysis.md)** - スコアリング簡素化分析
- **[scoring-quality-checklist.md](./archive/analysis-reports/scoring-quality-checklist.md)** - 品質チェックリスト

#### バグ修正レポート
- **[markdown-processing-fixes.md](./archive/bug-fix-reports/markdown-processing-fixes.md)** - Markdown処理修正 (2025-10-08)

#### パフォーマンス分析
- **[server-startup-analysis.md](./archive/performance-analysis/server-startup-analysis.md)** - サーバー起動分析
- **[nextjs-compile-time-optimization.md](./archive/performance-analysis/nextjs-compile-time-optimization.md)** - コンパイル最適化

#### 非推奨ドキュメント
- **[current-implementation-status.md](./archive/deprecated/current-implementation-status.md)** - 古い実装状況 (2024-12)
- **[api-design.md](./archive/deprecated/api-design.md)** - 古いAPI設計 (2025-09)

その他、過去のLanceDB関連ドキュメント、パフォーマンス分析、プロジェクトクリーンアップ計画など

## 🚀 クイックスタート

### 新規開発者向け
1. **[architecture/blueprint.md](./architecture/blueprint.md)** - プロジェクト概要を理解
2. **[architecture/data-flow-diagram-lancedb.md](./architecture/data-flow-diagram-lancedb.md)** - システム全体のデータフローを確認
3. **[specifications/spec.md](./specifications/spec.md)** - 機能要件と技術スタックを確認
4. **[operations/deployment-guide.md](./operations/deployment-guide.md)** - デプロイ手順を確認

### 運用担当者向け
1. **[operations/data-synchronization-strategy.md](./operations/data-synchronization-strategy.md)** - データ同期戦略と定期実行スケジュール
2. **[operations/deployment-guide.md](./operations/deployment-guide.md)** - デプロイガイド
3. **[operations/migration-guide.md](./operations/migration-guide.md)** - 移行手順を確認
4. **[operations/network-sharing-guide.md](./operations/network-sharing-guide.md)** - ネットワーク共有設定
5. **[testing/chatbot-performance-improvement-plan.md](./testing/chatbot-performance-improvement-plan.md)** - パフォーマンス改善計画

### 開発者向け
1. **[architecture/genkit-design.md](./architecture/genkit-design.md)** - Genkit設計方針
2. **[implementation/api-design.md](./implementation/api-design.md)** - API設計
3. **[implementation/error-handling.md](./implementation/error-handling.md)** - エラーハンドリング

## 📝 ドキュメント更新

ドキュメントを更新する際は、以下の点にご注意ください：

- 関連するディレクトリに適切に配置する
- 更新日時を記録する
- 関連ドキュメントへのリンクを更新する
- アーカイブが必要な場合は `archive/` ディレクトリに移動する

## 🔗 関連リンク

- [プロジェクトルートのREADME.md](../README.md)
- [セットアップガイド](../SETUP_GUIDE.md)
- [クイックスタートガイド](../QUICK_START.md)