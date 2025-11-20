# Architecture ドキュメント

このディレクトリには、Confluence Firebase RAGシステムのアーキテクチャ設計書を格納しています。

**App Name**: Confluence Spec-Finder  
**最終更新**: 2025年11月10日  
**現在のPhase**: Phase 5完了 + page_idマイグレーション完了 + BOM除去処理・トークン化修正完了

---

## 📱 システム概要

### 主要機能
- **Google Authentication**: @tomonokai-corp.com ドメイン制限による安全な認証
- **Question Submission**: Confluenceドキュメントに関する質問を入力
- **Streaming Response**: リアルタイム回答生成とプログレス表示
- **Confluence Data Retrieval via Hybrid Search**: LanceDB + Lunr.js + キーワード検索による関連ドキュメント取得
- **AI-Powered Summarization**: Gemini 2.5 Flashモデルによる簡潔な要約生成
- **Markdown Rendering**: 高度なマークダウン表示（テーブル対応、正規化）
- **Response Display**: 要約回答と参照元Confluenceページのタイトル・URL表示
- **Chat History**: Firestoreによる会話履歴の保存・読み込み

### 技術スタック
- **Frontend**: Next.js 15.3.3 (React 18.3.1, TypeScript 5.9.2)
- **Styling**: Tailwind CSS 3.4.1 + @tailwindcss/typography
- **UI Components**: Radix UI (Headless UI)
- **Markdown**: ReactMarkdown + remark-gfm
- **Authentication**: Firebase Authentication 11.9.1
- **Database**: 
  - Firestore 11.9.1 (conversations, user data)
  - LanceDB 0.22.0 (vector search with scalar indexes on `page_id`)
- **Search Engine**: Hybrid search (LanceDB + Lunr.js + keyword search)
  - ベクトル検索: Gemini Embedding 768次元
  - BM25検索: Lunr.js + Kuromoji（最優先、50%）
  - タイトル救済検索: LanceDB LIKE検索（25%）
  - ラベルスコア: カテゴリ、ドメイン、優先度（15%）
- **AI**: Google AI Gemini API (gemini-2.5-flash)
- **Vector Embeddings**: Gemini Embeddings API (text-embedding-004, 768 dimensions)
- **Performance Optimization**: 
  - スカラーインデックス（`page_id`）による高速クエリ（平均5ms）
  - startup-optimizerによるウォームアップ処理

### スタイルガイドライン
- **Primary color**: Deep Indigo (#3F51B5) - プロフェッショナルで信頼性を表現
- **Background color**: Light Indigo (#E8EAF6) - クリーンで落ち着いたインターフェース
- **Accent color**: Vibrant Orange (#FF9800) - 重要な要素とアクションを強調
- **Typography**: Inter フォントファミリー - モダンで中立的な外観
- **Layout**: 中央配置のチャット表示、下部に入力ボックスと送信ボタン
- **UI/UX**: 
  - リアルタイムストリーミング応答とプログレス表示
  - 高度なマークダウン表示（テーブル対応）
  - レスポンシブデザイン
  - プロフェッショナルなアイコンと微細なトランジション
  - クリーンで直感的なユーザーインターフェース

---

## 📋 目次

1. [システム全体設計](#1-システム全体設計)
   - 1.1 [データフロー・システム設計図](#11-データフローシステム設計図) (1.1.1)
   - 1.2 [データベース統合設計](#12-データベース統合設計) (1.2.1-1.2.4)
   - 1.3 [実装状況](#13-実装状況) (1.3.1)
   - 1.4 [環境設定](#14-環境設定) (1.4.1)
2. [ハイブリッド検索システム](#2-ハイブリッド検索システム)
   - 2.1 [検索仕様書・リファレンス](#21-検索仕様書リファレンス) (2.1.1, 2.1.2)
   - 2.2 [検索システムの構成](#22-検索システムの構成)
   - 2.3 [データベース最適化](#23-データベース最適化)
3. [AI・LLM関連](#3-aillm関連)
   - 3.1 [Genkit統合](#31-genkit統合) (3.1.1)
   - 3.2 [プロンプト設計](#32-プロンプト設計) (3.2.1)
   - 3.3 [AI設定・エラーハンドリング](#33-ai設定エラーハンドリング) (3.3.1-3.3.2)
4. [Phase 0A機能](#4-phase-0a機能)
   - 4.1 [Structured Label](#41-structured-label) (4.1.1-4.1.2)
   - 4.2 [Knowledge Graph](#42-knowledge-graph)
   - 4.3 [ドメイン知識](#43-ドメイン知識) (4.2.1)
5. [UI/UX設計](#5-uiux設計) (5.1)
6. [将来計画](#6-将来計画)
   - 6.1 [Confluence/Jira統合計画](#61-confluencejira統合計画) (6.1.1)
7. [アーカイブ](#7-アーカイブ)
   - 7.1 [完了レポート](#71-完了レポート) (7.1.1)
   - 7.2 [非推奨ドキュメント](#72-非推奨ドキュメント) (7.2.1-7.2.4)
   - 7.3 [統合・移動済みファイル](#73-統合移動済みファイル) (7.3.1-7.3.18)

---

## 1. システム全体設計

### 1.1 データフロー・システム設計図

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 1.1.1 | [01.01.01-data-flow-diagram-lancedb.md](./01.01.01-data-flow-diagram-lancedb.md) | **UML図・システム設計の全体像**<br>コンポーネント図、データフロー図、シーケンス図 | 2025-11-09 |

**内容:**
- コンポーネント図（フロントエンド、バックエンド、データストア、外部サービス）
- データフロー図（同期処理、検索・回答生成フロー）
- シーケンス図（データ同期、ストリーミング検索・回答生成）
- 技術スタック詳細
- 環境別構成（ローカル/本番）

### 1.2 データベース統合設計

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 1.2.1 | [01.02.01-lancedb-firestore-integration-design.md](./01.02.01-lancedb-firestore-integration-design.md) | **LanceDBとFirestoreの統合設計**<br>✅ 実装完了（Phase 0A-2） | 2025-10-15 |
| 1.2.2 | [01.02.02-lancedb-data-structure-specification.md](./01.02.02-lancedb-data-structure-specification.md) | **LanceDBデータ構造仕様書**<br>スキーマ定義、フィールド詳細仕様 | 2025-11 |
| 1.2.3 | [01.02.03-firestore-integration-guide.md](./01.02.03-firestore-integration-guide.md) | **Firestore統合ガイド**<br>コレクション構造、セキュリティルール、データモデル | 2025-11 |
| 1.2.4 | [01.02.04-lancedb-integration-guide.md](./01.02.04-lancedb-integration-guide.md) | **LanceDB統合ガイド**<br>統合方法と使用方法、スキーマ定義、検索実装 | - |

**内容:**
- FirestoreをマスターデータとしたStructuredLabel管理
- LanceDBへのStructuredLabel統合
- 同期戦略とワークフロー
- エラーハンドリングとパフォーマンス最適化
- LanceDB統合方法と使用方法（統合ガイド）
- スキーマ定義、検索実装、パフォーマンス特性
- LanceDBスキーマ定義（page_idマイグレーション完了）
- Firestoreデータモデルとセキュリティルール

### 1.3 実装状況

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 1.3.1 | [01.03.01-current-implementation-status.md](./01.03.01-current-implementation-status.md) | **現在の実装状況**<br>本番環境で動作確認済みの実装状況 | 2025-11-02 |

### 1.4 環境設定

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 1.4.1 | [01.04.01-environment-configuration-strategy.md](./01.04.01-environment-configuration-strategy.md) | **環境設定戦略**<br>実行環境別の環境変数管理、Next.js設定、GitHub Actions対応 | 2025-01 |

**内容:**
- 実行環境の判別（Next.jsアプリケーション vs スクリプト実行）
- 環境変数の条件付き検証
- Next.js設定との統合
- GitHub Actionsでの動作

---

## 2. ハイブリッド検索システム

### 2.1 検索仕様書・リファレンス

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 2.1.1 | [02.01.01-hybrid-search-quick-reference.md](./02.01.01-hybrid-search-quick-reference.md) | **クイックリファレンス**<br>検索コンポーネント、スコアリング、重み配分 | 2025-10-17 |
| 2.1.2 | [02.01.02-hybrid-search-specification.md](./02.01.02-hybrid-search-specification.md) | **最新仕様書**<br>Phase 4完成版の詳細仕様（契約・包括ガイド・実装詳細統合済み） | 2025-11-10 |

**読み方:**
- **クイックリファレンス**: 検索パラメータやスコアリングの概要を素早く確認
- **最新仕様書**: 詳細な実装仕様、バグ修正履歴、トラブルシューティングガイド

### 2.2 検索システムの構成

**検索コンポーネント:**
- **ベクトル検索** (5%): Gemini Embedding 768次元、コサイン類似度
- **BM25検索** (53% - 最優先): Lunr.js + Kuromoji、Okapi BM25
- **タイトル救済検索** (26%): LanceDB LIKE検索、2語組み合わせ
- **ラベルスコア** (16%): カテゴリ、ドメイン、優先度
- **Knowledge Graph拡張**: 🔴 無効化済み（Phase 7: パフォーマンス最適化のため）
- **スコアリング**: RRF融合 + Composite Scoring

### 2.3 データベース最適化

**最新の最適化** (2025年11月):
- **スカラーインデックス**: `page_id`フィールドにスカラーインデックスを設定
- **パフォーマンス向上**: `getAllChunksByPageId`が14秒 → 5msに高速化（99.96%改善）
- **スキーマ変更**: `pageId` → `page_id`に変更（スカラーインデックス対応）

---

## 3. AI・LLM関連

### 3.1 Genkit統合

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 3.1.1 | [03.01.01-genkit-design.md](./03.01.01-genkit-design.md) | **Genkit統合設計**<br>Flows実装方針、利用ガイド | 2025-01 |

**Genkit統合状況** (v1.19.2):
- ✅ 実装済みFlows: auto-label-flow, retrieve-relevant-docs-lancedb, streaming-summarize-confluence-docs
- ✅ Dev UI: http://localhost:4000
- 🔄 ハイブリッド: メイン処理は直接Gemini API、ラベル生成はGenkit Flow

**LLMモデル**:
- **gemini-2.5-flash**: メイン処理（ストリーミング回答生成）
- **gemini-2.0-flash**: ラベル自動生成（一貫性重視）

### 3.2 プロンプト設計

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 3.2.1 | [03.02.01-prompt-design.md](./03.02.01-prompt-design.md) | プロンプト設計ガイドライン | 2025-01 |

### 3.3 AI設定・エラーハンドリング

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 3.3.1 | [03.03.01-ai-models-configuration.md](./03.03.01-ai-models-configuration.md) | **AIモデル設定ガイド**<br>Gemini設定（温度、topK、maxOutputTokens）、埋め込みモデル設定 | 2025-11 |
| 3.3.2 | [03.03.02-error-handling.md](./03.03.02-error-handling.md) | **エラーハンドリング仕様**<br>APIエラーレスポンス、バッチ処理エラーハンドリング、リトライポリシー | 2025-11 |

---

## 4. Phase 0A機能

### 4.1 Structured Label

| # | ドキュメント | 説明 | ステータス | 最終更新 |
|---|------------|------|---------|---------|
| 4.1.1 | [04.01.01-structured-label-design.md](./04.01.01-structured-label-design.md) | **Structured Label System**<br>自動ラベル付けシステム | 🟡 部分実装 | 2025-10-14 |
| 4.1.2 | [04.01.02-label-system-api.md](./04.01.02-label-system-api.md) | **ラベルシステムAPI仕様**<br>LabelManagerクラスAPI、ユーティリティ関数、使用例 | 2025-11 |

**実装状況** (Phase 0A-1):
- **実装**: Genkit Flowによる自動生成機能完成
- **生成方法**: ルールベース(80%) + LLMベース(20%)
- **使用状況**: 検索では既存labels配列を使用

### 4.2 Knowledge Graph

**実装状況** (Phase 0A-2): 🔴 無効化済み
- **実装**: 完了（ノード679件、エッジ24,208件）
- **無効化理由**: パフォーマンス悪化（9.2秒オーバーヘッド）、品質向上なし
- **将来計画**: デュアルモード検索（高速モード/詳細分析モード）

### 4.3 ドメイン知識

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 4.2.1 | [04.02.01-domain-knowledge-extraction-guide.md](./04.02.01-domain-knowledge-extraction-guide.md) | **ドメイン知識抽出包括ガイド**<br>ドメイン知識抽出システムの全体像、8,122個のキーワード管理、抽出パイプライン | 2025-11 |

---

## 5. UI/UX設計

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 5.1 | [05.01.01-ui-ux-performance-strategy.md](./05.01.01-ui-ux-performance-strategy.md) | UI/UXパフォーマンス戦略<br>ストリーミングUI、レスポンシブ設計 | 2025-01 |

---

## 6. 将来計画

### 6.1 検索システム拡張

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 7.1.1 | [07.01.01-graphrag-dual-mode-search.md](./07.01.01-graphrag-dual-mode-search.md) | **GraphRAG デュアルモード検索提案**<br>高速モード/詳細分析モードの2つの検索モード提供 | - |

**内容:**
- 高速検索モード（KG拡張無効、2秒タイムアウト）
- 詳細分析モード（KG拡張有効、10秒タイムアウト）
- UI/UX設計と段階的な実装計画
- 期待される効果とリスク対策

---

## 7. 将来計画（旧）

### 6.1 Confluence/Jira統合計画

| # | ドキュメント | 説明 | 最終更新 |
|---|------------|------|---------|
| 6.1.1 | [06.01.01-confluence-jira-integration-plan.md](./06.01.01-confluence-jira-integration-plan.md) | **Confluence/Jira統合計画**<br>Phase 1: 個別検索対応、Phase 2: 横断検索 | 2025-11-09 |

**内容:**
- Phase 1: Confluence/Jira個別検索対応
- Phase 2: Confluence/Jira横断検索
- データフロー・コンポーネント構成
- 環境別構成と移行計画
- ダッシュボード要件

---

## 7. アーカイブ

### 7.1 完了レポート

**場所**: `docs/archive/architecture/completed-reports/`

| # | ファイル名 | 説明 | 日付 |
|---|-----------|------|------|
| 7.1.1 | `phase5-week2-completion-report.md` | Phase 5 Week 2完了レポート | 2025-10-17 |

### 7.2 非推奨ドキュメント

**場所**: `docs/archive/architecture/deprecated/`

**無効化済み機能:**
| # | ファイル名 | 説明 |
|---|-----------|------|
| 7.2.1 | `KNOWLEDGE_GRAPH_README.md` | Knowledge Graph README（無効化済み） |
| 7.2.2 | `KG_DOCUMENTATION_SUMMARY.md` | Knowledge Graphドキュメント集約（無効化済み） |

**統合済みドキュメント:**
| # | ファイル名 | 統合先 |
|---|-----------|--------|
| 7.2.3 | `hybrid-search-contract.md` | → `hybrid-search-specification.md`に統合済み |
| 7.2.4 | `search-system-comprehensive-guide.md` | → `hybrid-search-specification.md`に統合済み |

### 7.3 統合・移動済みファイル

**場所**: `docs/archive/architecture-legacy/`

**最近統合したファイル** (2025年11月):
| # | ファイル名 | 統合先 |
|---|-----------|--------|
| 7.3.1 | `hybrid-search-logic-current.md` | → `hybrid-search-specification.md`に統合済み |
| 7.3.2 | `hybrid-search-specification-latest.md` | → `hybrid-search-specification.md`にリネーム |
| 7.3.3 | `blueprint.md` | → `README.md`に統合済み |
| 7.3.4 | `jira-data-flow-lancedb.md` | → `confluence-jira-integration-plan.md`に統合済み |
| 7.3.5 | `jira-env-differences-and-migration.md` | → `confluence-jira-integration-plan.md`に統合済み |
| 7.3.6 | `jira-dashboard-indicators.md` | → `confluence-jira-integration-plan.md`に統合済み |

**その他のアーカイブファイル:**
| # | ファイル名 |
|---|-----------|
| 7.3.7 | `hybrid-search-specification-v5.md` |
| 7.3.8 | `hybrid-search-optimization-proposals.md` |
| 7.3.9 | `hybrid-search-flow-and-parallelization-analysis.md` |
| 7.3.10 | `enhanced-hybrid-search-design.md` |
| 7.3.11 | `phase5-week1-completion-report.md` |
| 7.3.12 | `phase-5-improvement-plan.md` |
| 7.3.13 | `phase5-parallel-search-risk-analysis.md` |
| 7.3.14 | `phase5-code-quality-check.md` |
| 7.3.15 | `knowledge-graph-comprehensive-overview.md` |
| 7.3.16 | `label-domain-kg-integration.md` |
| 7.3.17 | `genkit-migration-and-expansion-roadmap.md` |
| 7.3.18 | `foundation-first-strategy.md` |

---

## 📈 実装状況サマリー

### Phase 5の主な成果
- ✅ 並列検索実装（品質維持100%）
- ✅ ハイブリッド検索強化（RRF融合 + Composite Scoring）
- ✅ 検索重み配分最適化
- ✅ LanceDB接続プーリング
- ✅ 検索キャッシュ拡大（TTL 15分、maxSize 5000）

### 最新の改善 (2025年11月)
- ✅ BOM除去処理の実装（すべてのデータ処理パス）
- ✅ トークン化修正（kuromoji統一使用）
- ✅ データベース再構築（2,088行）
- ✅ page_idマイグレーション完了（スカラーインデックス対応）

---

## 🚀 クイックスタート

### 新メンバー向け

**ステップ1: システム全体を理解する**
1. このREADMEの[システム概要](#-システム概要)セクションでシステム全体像を把握
2. [1.1.1 01.01.01-data-flow-diagram-lancedb.md](./01.01.01-data-flow-diagram-lancedb.md) でUML図を確認

**ステップ2: 検索システムを理解する**
1. [2.1.1 02.01.01-hybrid-search-quick-reference.md](./02.01.01-hybrid-search-quick-reference.md) でクイックリファレンスを確認
2. [2.1.2 02.01.02-hybrid-search-specification.md](./02.01.02-hybrid-search-specification.md) で詳細仕様を確認

**ステップ3: AI/LLMを理解する**
1. [3.1.1 03.01.01-genkit-design.md](./03.01.01-genkit-design.md) でGenkit統合方針を確認
2. [3.2.1 03.02.01-prompt-design.md](./03.02.01-prompt-design.md) でプロンプト設計を確認

### 開発者向け

**開発タスク別の推奨ドキュメント:**
| タスク | 推奨ドキュメント | 説明 |
|--------|----------------|------|
| 検索改善・トラブルシューティング | [2.1.2 02.01.02-hybrid-search-specification.md](./02.01.02-hybrid-search-specification.md) | 実装コード、バグ修正履歴、トラブルシューティングガイド |
| 新機能開発 | [1.1.1 01.01.01-data-flow-diagram-lancedb.md](./01.01.01-data-flow-diagram-lancedb.md) | システム設計、コンポーネント図、データフロー |
| 検索仕様確認 | [2.1.2 02.01.02-hybrid-search-specification.md](./02.01.02-hybrid-search-specification.md) | 最新の検索仕様、契約、包括ガイド |
| データベース統合 | [1.2.1 01.02.01-lancedb-firestore-integration-design.md](./01.02.01-lancedb-firestore-integration-design.md) | 統合設計、同期戦略 |

---

## 📊 技術スタック概要

- **フロントエンド**: Next.js 15.3.3 (React 18.3.1)
- **バックエンド**: Next.js API Routes + Node.js Scripts
- **データベース**: 
  - Firestore 11.9.1（ユーザーデータ、会話履歴）
  - LanceDB 0.22.0（ベクトルデータ）
- **検索エンジン**: ハイブリッド（Gemini Embeddings API + Lunr.js + LanceDB）
- **LLM**: Gemini API（2.5-flash / 2.0-flash）
- **AI Framework**: Genkit 1.19.2（部分統合）
- **埋め込みモデル**: Gemini Embeddings API (text-embedding-004、768次元)

---

## 📝 ドキュメント更新ガイドライン

### 1. 新しいPhaseが完了したら
- 完了レポートを作成
- 旧Phaseのレポートを`docs/archive/architecture/completed-reports/`へ移動
- このREADMEの[実装状況サマリー](#-実装状況サマリー)を更新

### 2. 仕様変更があったら
- 該当する設計書を更新
- 更新日を記載
- 大きな変更は`01.01.01-data-flow-diagram-lancedb.md`の更新履歴に追記

### 3. 新機能を追加したら
- 新しい設計書を作成
- このREADMEの該当セクションに追加
- `01.01.01-data-flow-diagram-lancedb.md`のコンポーネント図を更新

---

## 🔗 関連ドキュメント

### 実装・運用関連
- [実装ガイド](../implementation/): 実装詳細とベストプラクティス
- [運用ガイド](../operations/): デプロイ、モニタリング、トラブルシューティング
- [テストガイド](../testing/README.md): テスト戦略と実行ガイド

### 仕様・設計関連
- [仕様書](../specifications/): 機能仕様と要件定義

---

**質問・フィードバック**: プロジェクトチームまで

