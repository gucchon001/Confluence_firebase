# Architecture ドキュメント

このディレクトリには、Confluence Firebase RAGシステムのアーキテクチャ設計書を格納しています。

**最終更新**: 2025年10月20日  
**現在のPhase**: Phase 5完了

---

## 📋 目次

### 🎯 システム全体設計

| ドキュメント | 説明 | 最終更新 |
|------------|------|---------|
| [data-flow-diagram-lancedb.md](./data-flow-diagram-lancedb.md) | **UML図・システム設計の全体像**<br>コンポーネント図、データフロー図、シーケンス図 | 2025-10-20 |
| [blueprint.md](./blueprint.md) | システムブループリント | 2025-01 |
| [lancedb-firestore-integration-design.md](./lancedb-firestore-integration-design.md) | LanceDBとFirestoreの統合設計 | 2025-01 |

---

### 🔍 ハイブリッド検索システム

| ドキュメント | 説明 | 最終更新 |
|------------|------|---------|
| [hybrid-search-quick-reference.md](./hybrid-search-quick-reference.md) | **クイックリファレンス**<br>検索コンポーネント、スコアリング、重み配分 | 2025-10-17 |
| [hybrid-search-specification-latest.md](./hybrid-search-specification-latest.md) | **最新仕様書**<br>Phase 4完成版の詳細仕様 | 2025-10-17 |
| [hybrid-search-logic-current.md](./hybrid-search-logic-current.md) | 現在の検索ロジック詳細<br>実装コードベース | 2025-10-16 |
| [hybrid-search-contract.md](./hybrid-search-contract.md) | 検索APIの契約インターフェース | 2025-10 |
| [search-system-comprehensive-guide.md](./search-system-comprehensive-guide.md) | 検索システム総合ガイド | 2025-10 |

**検索システムの構成**:
- **ベクトル検索** (5%): Gemini Embedding 768次元、コサイン類似度
- **BM25検索** (50% - 最優先): Lunr.js + Kuromoji、Okapi BM25
- **タイトル救済検索** (25%): LanceDB LIKE検索、1〜3語組み合わせ
- **ラベルスコア** (15%): カテゴリ、ドメイン、優先度
- **スコアリング**: RRF融合 + Composite Scoring

---

### 🧠 AI・LLM関連

| ドキュメント | 説明 | 最終更新 |
|------------|------|---------|
| [genkit-design.md](./genkit-design.md) | **Genkit統合設計**<br>Flows実装方針、利用ガイド | 2025-01 |
| [prompt-design.md](./prompt-design.md) | プロンプト設計ガイドライン | 2025-01 |

**Genkit統合状況** (v1.19.2):
- ✅ 実装済みFlows: auto-label-flow, retrieve-relevant-docs-lancedb, streaming-summarize-confluence-docs
- ✅ Dev UI: http://localhost:4000
- 🔄 ハイブリッド: メイン処理は直接Gemini API、ラベル生成はGenkit Flow

**LLMモデル**:
- **gemini-2.5-flash**: メイン処理（ストリーミング回答生成）
- **gemini-2.0-flash**: ラベル自動生成（一貫性重視）

---

### 📊 Phase 0A機能

| ドキュメント | 説明 | ステータス | 最終更新 |
|------------|------|---------|---------|
| [structured-label-design.md](./structured-label-design.md) | **Structured Label System**<br>自動ラベル付けシステム | 🟡 部分実装 | 2025-10-14 |
| [KNOWLEDGE_GRAPH_README.md](./KNOWLEDGE_GRAPH_README.md) | **Knowledge Graph README**<br>概要、実装状況、将来計画 | 🔴 無効化済み | 2025-10-19 |
| [KG_DOCUMENTATION_SUMMARY.md](./KG_DOCUMENTATION_SUMMARY.md) | Knowledge Graphドキュメント集約 | 🔴 無効化済み | 2025-10-19 |

**Phase 0A機能の状況**:

#### Structured Label (Phase 0A-1): 🟡 部分実装
- **実装**: Genkit Flowによる自動生成機能完成
- **生成方法**: ルールベース(80%) + LLMベース(20%)
- **使用状況**: 検索では既存labels配列を使用

#### Knowledge Graph (Phase 0A-2): 🔴 無効化済み
- **実装**: 完了（ノード679件、エッジ24,208件）
- **無効化理由**: パフォーマンス悪化（9.2秒オーバーヘッド）、品質向上なし
- **将来計画**: デュアルモード検索（高速モード/詳細分析モード）

---

### 📈 Phase 5完了レポート

| ドキュメント | 説明 | 最終更新 |
|------------|------|---------|
| [phase5-week2-completion-report.md](./phase5-week2-completion-report.md) | **Phase 5 Week 2完了レポート**<br>パフォーマンス最適化と品質強化の最終成果 | 2025-10-17 |

**Phase 5の主な成果**:
- ✅ 並列検索実装（品質維持100%）
- ✅ ハイブリッド検索強化（RRF融合 + Composite Scoring）
- ✅ 検索重み配分最適化
- ✅ LanceDB接続プーリング
- ✅ 検索キャッシュ拡大（TTL 15分、maxSize 5000）

---

### 🎨 UI/UX

| ドキュメント | 説明 | 最終更新 |
|------------|------|---------|
| [ui-ux-performance-strategy.md](./ui-ux-performance-strategy.md) | UI/UXパフォーマンス戦略<br>ストリーミングUI、レスポンシブ設計 | 2025-01 |

---

## 📦 アーカイブされたドキュメント

古いバージョンの仕様書や完了したPhaseのドキュメントは、以下に移動されています：

- `docs/archive/architecture-legacy/`: 旧バージョンの設計書
  - hybrid-search-specification-v5.md
  - hybrid-search-optimization-proposals.md
  - hybrid-search-flow-and-parallelization-analysis.md
  - enhanced-hybrid-search-design.md
  - phase5-week1-completion-report.md
  - phase-5-improvement-plan.md
  - phase5-parallel-search-risk-analysis.md
  - phase5-code-quality-check.md
  - knowledge-graph-comprehensive-overview.md
  - label-domain-kg-integration.md
  - genkit-migration-and-expansion-roadmap.md
  - foundation-first-strategy.md

---

## 🚀 クイックスタート

### 新メンバー向け

1. **システム全体を理解する**
   - [data-flow-diagram-lancedb.md](./data-flow-diagram-lancedb.md) でUML図を確認
   - [blueprint.md](./blueprint.md) でシステム全体像を把握

2. **検索システムを理解する**
   - [hybrid-search-quick-reference.md](./hybrid-search-quick-reference.md) でクイックリファレンス
   - [hybrid-search-specification-latest.md](./hybrid-search-specification-latest.md) で詳細仕様

3. **AI/LLMを理解する**
   - [genkit-design.md](./genkit-design.md) でGenkit統合方針
   - [prompt-design.md](./prompt-design.md) でプロンプト設計

### 開発者向け

- **検索改善**: `hybrid-search-logic-current.md` → 実装コード
- **新機能開発**: `data-flow-diagram-lancedb.md` → システム設計
- **パフォーマンス最適化**: `phase5-week2-completion-report.md` → 最新の最適化手法

---

## 📊 技術スタック概要

- **フロントエンド**: Next.js 15.3.3 (React 18.3.1)
- **バックエンド**: Next.js API Routes + Node.js Scripts
- **データベース**: 
  - Firestore 11.9.1（ユーザーデータ、会話履歴）
  - LanceDB 0.22.0（ベクトルデータ）
- **検索エンジン**: ハイブリッド（Xenova Transformers + Lunr.js + LanceDB）
- **LLM**: Gemini API（2.5-flash / 2.0-flash）
- **AI Framework**: Genkit 1.19.2（部分統合）
- **埋め込みモデル**: paraphrase-multilingual-mpnet-base-v2（768次元）

---

## 📝 ドキュメント更新ガイドライン

1. **新しいPhaseが完了したら**
   - 完了レポートを作成
   - 旧Phaseのレポートをarchiveへ移動
   - このREADMEを更新

2. **仕様変更があったら**
   - 該当する設計書を更新
   - 更新日を記載
   - 大きな変更はdata-flow-diagram-lancedb.mdの更新履歴に追記

3. **新機能を追加したら**
   - 新しい設計書を作成
   - このREADMEに追加
   - data-flow-diagram-lancedb.mdのコンポーネント図を更新

---

## 🔗 関連ドキュメント

- [実装ガイド](../implementation/): 実装詳細とベストプラクティス
- [運用ガイド](../operations/): デプロイ、モニタリング、トラブルシューティング
- [テストガイド](../testing/): テスト戦略と実行ガイド
- [仕様書](../specifications/): 機能仕様と要件定義

---

**質問・フィードバック**: プロジェクトチームまで

