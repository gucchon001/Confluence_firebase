# 📚 Confluence Firebase ドキュメント

このディレクトリには、Confluence Firebaseプロジェクトの包括的なドキュメントが含まれています。

## 🗂️ ドキュメント構成

### 🏗️ [architecture/](./architecture/) - アーキテクチャ・設計
システムの全体的な設計とアーキテクチャに関するドキュメント

- **[blueprint.md](./architecture/blueprint.md)** - プロジェクト概要と全体設計
- **[data-flow-diagram-lancedb.md](./architecture/data-flow-diagram-lancedb.md)** - LanceDBデータフロー図
- **[genkit-design.md](./architecture/genkit-design.md)** - Genkit設計方針
- **[graphrag-tuned-architecture.md](./architecture/graphrag-tuned-architecture.md)** - GraphRAG調整アーキテクチャ
- **[hybrid-search-contract.md](./architecture/hybrid-search-contract.md)** - ハイブリッド検索契約
- **[prompt-design.md](./architecture/prompt-design.md)** - プロンプト設計
- **[search-system-comprehensive-guide.md](./architecture/search-system-comprehensive-guide.md)** - 検索システム総合ガイド
- **[ui-ux-performance-strategy.md](./architecture/ui-ux-performance-strategy.md)** - UI/UXパフォーマンス戦略

### 🛠️ [implementation/](./implementation/) - 実装・開発
具体的な実装方法と開発に関するドキュメント

- **[api-design.md](./implementation/api-design.md)** - API設計
- **[current-implementation-status.md](./implementation/current-implementation-status.md)** - 現在の実装状況
- **[domain-knowledge-extraction-comprehensive-guide.md](./implementation/domain-knowledge-extraction-comprehensive-guide.md)** - ドメイン知識抽出総合ガイド
- **[error-handling.md](./implementation/error-handling.md)** - エラーハンドリング
- **[firestore-integration-guide.md](./implementation/firestore-integration-guide.md)** - Firestore統合ガイド
- **[label-system-api.md](./implementation/label-system-api.md)** - ラベルシステムAPI
- **[label-system-design.md](./implementation/label-system-design.md)** - ラベルシステム設計
- **[label-system-overview.md](./implementation/label-system-overview.md)** - ラベルシステム概要
- **[lancedb-data-structure-specification.md](./implementation/lancedb-data-structure-specification.md)** - LanceDBデータ構造仕様
- **[remaining-issues.md](./implementation/remaining-issues.md)** - 残課題・既知の問題

### 🚀 [operations/](./operations/) - 運用・デプロイ
システムの運用、デプロイ、移行に関するドキュメント

- **[deployment-guide.md](./operations/deployment-guide.md)** - デプロイガイド
- **[migration-guide.md](./operations/migration-guide.md)** - 移行ガイド
- **[network-sharing-guide.md](./operations/network-sharing-guide.md)** - ネットワーク共有ガイド

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

- **[lancedb-integration-guide.md](./specifications/lancedb-integration-guide.md)** - LanceDB統合ガイド
- **[spec.md](./specifications/spec.md)** - システム仕様書

### 📁 [archive/](./archive/) - アーカイブ
過去の分析レポート、テスト結果、最適化計画

- 過去のパフォーマンス分析レポート
- 最適化計画書
- 古いテスト結果
- プロジェクトクリーンアップ計画

## 🚀 クイックスタート

### 新規開発者向け
1. **[architecture/blueprint.md](./architecture/blueprint.md)** - プロジェクト概要を理解
2. **[implementation/current-implementation-status.md](./implementation/current-implementation-status.md)** - 現在の実装状況を確認
3. **[operations/deployment-guide.md](./operations/deployment-guide.md)** - デプロイ手順を確認

### 運用担当者向け
1. **[operations/migration-guide.md](./operations/migration-guide.md)** - 移行手順を確認
2. **[operations/network-sharing-guide.md](./operations/network-sharing-guide.md)** - ネットワーク共有設定
3. **[testing/chatbot-performance-improvement-plan.md](./testing/chatbot-performance-improvement-plan.md)** - パフォーマンス改善計画

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