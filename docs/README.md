# 📚 Confluence Firebase ドキュメント

このディレクトリには、Confluence Firebaseプロジェクトの包括的なドキュメントが含まれています。

## 🗂️ ドキュメント構成

### 🏗️ [architecture/](./architecture/) - アーキテクチャ・設計
システムの全体的な設計とアーキテクチャに関するドキュメント

#### 現行システム
- **[blueprint.md](./architecture/blueprint.md)** - プロジェクト概要と全体設計
- **[data-flow-diagram-lancedb.md](./architecture/data-flow-diagram-lancedb.md)** - LanceDBデータフロー図
- **[hybrid-search-specification-latest.md](./architecture/hybrid-search-specification-latest.md)** 🌟 **最新** - ハイブリッド検索システム完全仕様書（Phase 4完了版）
- **[hybrid-search-quick-reference.md](./architecture/hybrid-search-quick-reference.md)** ⚡ **NEW** - ハイブリッド検索クイックリファレンス
- **[hybrid-search-logic-current.md](./architecture/hybrid-search-logic-current.md)** - ハイブリッド検索ロジック（Phase 0A-4 + BM25修正版）
- **[hybrid-search-contract.md](./architecture/hybrid-search-contract.md)** - ハイブリッド検索契約
- **[hybrid-search-flow-and-parallelization-analysis.md](./architecture/hybrid-search-flow-and-parallelization-analysis.md)** - ハイブリッド検索並行実行分析
- **[enhanced-hybrid-search-design.md](./architecture/enhanced-hybrid-search-design.md)** - 強化版ハイブリッド検索設計
- **[search-system-comprehensive-guide.md](./architecture/search-system-comprehensive-guide.md)** - 検索システム総合ガイド
- **[lancedb-firestore-integration-design.md](./architecture/lancedb-firestore-integration-design.md)** 🔧 **更新** - LanceDB-Firestore統合設計（ページ除外フィルタリング追加）
- **[prompt-design.md](./architecture/prompt-design.md)** - プロンプト設計
- **[ui-ux-performance-strategy.md](./architecture/ui-ux-performance-strategy.md)** - UI/UXパフォーマンス戦略

#### ラベル・ドメイン知識
- **[structured-label-design.md](./architecture/structured-label-design.md)** - 構造化ラベル設計
- **[label-domain-kg-integration.md](./architecture/label-domain-kg-integration.md)** - ラベル・ドメイン知識・KG統合

#### Knowledge Graph / GraphRAG
- **[KNOWLEDGE_GRAPH_README.md](./architecture/KNOWLEDGE_GRAPH_README.md)** 📚 **NEW** - KG/GraphRAG ドキュメント一覧（ナビゲーション）
- **[knowledge-graph-comprehensive-overview.md](./architecture/knowledge-graph-comprehensive-overview.md)** 🌟 **NEW** - KG/GraphRAG 総合ドキュメント
  - 現在の実装状況（KG拡張無効化の経緯）
  - GraphRAGとの比較
  - パフォーマンス分析
  - 将来的な導入計画（デュアルモード検索）

#### 将来計画
- **[phase-5-improvement-plan.md](./architecture/phase-5-improvement-plan.md)** 🚀 **NEW** - Phase 5: パフォーマンス最適化計画（レスポンス速度85%削減）
- **[foundation-first-strategy.md](./architecture/foundation-first-strategy.md)** 🔥 - 基盤強化優先戦略（ラベル+KG → 横断拡張）
- **[genkit-migration-and-expansion-roadmap.md](./architecture/genkit-migration-and-expansion-roadmap.md)** ⭐ - Genkit移行と拡張ロードマップ（6.5ヶ月計画）
- **[genkit-design.md](./architecture/genkit-design.md)** - Genkit設計方針

### 🛠️ [implementation/](./implementation/) - 実装・開発
具体的な実装方法と開発に関するドキュメント

#### Phase 完了状況
- **[phase-0a-4-completion-report.md](./implementation/phase-0a-4-completion-report.md)** ✅ - Phase 0A-4完了レポート
- **[phase-4-kg-integration-completion-report.md](./implementation/phase-4-kg-integration-completion-report.md)** ✅ **最新** - Phase 4: KG統合完了レポート（タイトル重複埋め込み含む）
- **[phase-4-kg-integration-plan.md](./implementation/phase-4-kg-integration-plan.md)** - Phase 4: KG統合計画
- **[current-search-quality-report.md](./implementation/current-search-quality-report.md)** ✅ - 現在の検索品質レポート
- **[kg-contribution-analysis-report.md](./implementation/kg-contribution-analysis-report.md)** - ナレッジグラフ貢献度分析
- **[phase-1-4-implementation-status.md](./implementation/phase-1-4-implementation-status.md)** - Phase 1-4実装状況
- **[phase-1-3-spec-compliance.md](./implementation/phase-1-3-spec-compliance.md)** - Phase 1-3仕様準拠状況

#### Phase 0A-2 データ品質管理
- **[lancedb-label-filtering-specification.md](./implementation/lancedb-label-filtering-specification.md)** 🔧 **NEW** - ラベルフィルタリング仕様
- **[lancedb-label-filtering-fix-report.md](./implementation/lancedb-label-filtering-fix-report.md)** ✅ **NEW** - フィルタリング修正完了報告

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

### 🚀 [operations/](./operations/) - 運用・デプロイ
システムの運用、デプロイ、移行に関するドキュメント

#### AI開発・協働
- **[cursor-ai-collaboration-guide.md](./operations/cursor-ai-collaboration-guide.md)** 🤖 **NEW** - Cursor AI協働マニュアル

#### 同期・データ管理
- **[data-synchronization-strategy.md](./operations/data-synchronization-strategy.md)** ⭐ - データ同期戦略と定期実行スケジュール
- **[firebase-scheduled-sync-setup.md](./operations/firebase-scheduled-sync-setup.md)** - Firebase Functions自動同期セットアップ

#### デプロイ・設定
- **[deployment-guide.md](./operations/deployment-guide.md)** - 包括的デプロイガイド
- **[build-optimization-guide.md](./operations/build-optimization-guide.md)** 🚀 **NEW** - ビルド最適化ガイド（75-90%高速化）
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
- **[phase-0a-4-test-criteria.md](./testing/phase-0a-4-test-criteria.md)** - Phase 0A-4テスト基準
- **[real-vector-search-testing-guide.md](./testing/real-vector-search-testing-guide.md)** - リアルベクトル検索テストガイド

### 📋 [specifications/](./specifications/) - 仕様書
システムの詳細仕様と技術仕様に関するドキュメント

- **[spec.md](./specifications/spec.md)** - システム仕様書
- **[lancedb-integration-guide.md](./specifications/lancedb-integration-guide.md)** - LanceDB統合ガイド
- **[implementation-gap-analysis.md](./specifications/implementation-gap-analysis.md)** - 仕様書と実装のギャップ分析

### 📊 [analysis/](./analysis/) - 分析レポート
パフォーマンス分析、技術調査レポート

- **[graphrag-performance-impact.md](./analysis/graphrag-performance-impact.md)** 🔬 **NEW** - GraphRAG導入時のパフォーマンス影響分析
  - グラフトラバーサルのコスト
  - Community Detectionの計算量
  - Firestoreクエリのボトルネック
  - 最適化後の予測

### 💡 [proposals/](./proposals/) - 提案書
新機能・改善提案に関するドキュメント

- **[graphrag-dual-mode-search.md](./proposals/graphrag-dual-mode-search.md)** 🚀 **NEW** - GraphRAG デュアルモード検索提案
  - 「高速検索」と「詳細分析」の2モード提供
  - OpenAI o1 "Thinking Mode"と同様のコンセプト
  - UI/UX設計、段階的な実装計画
  - 期待される効果とリスク対策

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
1. **[operations/build-optimization-guide.md](./operations/build-optimization-guide.md)** 🚀 - ビルド最適化（75-90%高速化）
2. **[operations/data-synchronization-strategy.md](./operations/data-synchronization-strategy.md)** - データ同期戦略と定期実行スケジュール
3. **[operations/deployment-guide.md](./operations/deployment-guide.md)** - デプロイガイド
4. **[operations/migration-guide.md](./operations/migration-guide.md)** - 移行手順を確認
5. **[operations/network-sharing-guide.md](./operations/network-sharing-guide.md)** - ネットワーク共有設定
6. **[testing/chatbot-performance-improvement-plan.md](./testing/chatbot-performance-improvement-plan.md)** - パフォーマンス改善計画

### 開発者向け
1. **[architecture/hybrid-search-logic-current.md](./architecture/hybrid-search-logic-current.md)** ✅ - 現在のハイブリッド検索ロジック（最新版）
2. **[implementation/phase-4-kg-integration-completion-report.md](./implementation/phase-4-kg-integration-completion-report.md)** - Phase 4: KG統合完了レポート
3. **[architecture/genkit-design.md](./architecture/genkit-design.md)** - Genkit設計方針
4. **[implementation/error-handling.md](./implementation/error-handling.md)** - エラーハンドリング
5. **[implementation/label-system-api.md](./implementation/label-system-api.md)** - ラベルシステムAPI
6. **[implementation/lancedb-data-structure-specification.md](./implementation/lancedb-data-structure-specification.md)** - LanceDBデータ構造仕様

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